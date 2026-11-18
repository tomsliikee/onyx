// The overview's backdrop when it is transparent. GNOME paints the overview
// on an opaque backdrop; with Blur my Shell's overview blur on, its blurred
// wallpaper sits under everything else in the overview. Without it, Onyx puts
// the plain wallpaper there, so the transparent surfaces show it.

import Gio from 'gi://Gio';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Background from 'resource:///org/gnome/shell/ui/background.js';
import {ExtensionState} from 'resource:///org/gnome/shell/misc/extensionUtils.js';

const BMS_UUID = 'blur-my-shell@aunetx';
const BMS_OVERVIEW = 'org.gnome.shell.extensions.blur-my-shell.overview';

/**
 * Tells whether Blur my Shell blurs the overview: the extension is active
 * and its overview blur is on. Calls `onChange` when that may have changed.
 */
export class BlurMyShell {
    constructor(onChange) {
        this._onChange = onChange;
        this._settings = null;
        this._settingsId = 0;
        this._stateId = Main.extensionManager.connect('extension-state-changed',
            (_m, ext) => {
                if (ext.uuid === BMS_UUID) {
                    this._watch();
                    this._onChange();
                }
            });
        this._watch();
    }

    get blursOverview() {
        const ext = Main.extensionManager.lookup(BMS_UUID);
        return ext?.state === ExtensionState.ACTIVE &&
            (this._settings?.get_boolean('blur') ?? true);
    }

    // Its overview settings, from its own schemas folder or the system's.
    _watch() {
        if (this._settings)
            return;
        const ext = Main.extensionManager.lookup(BMS_UUID);
        if (!ext)
            return;
        const fallback = Gio.SettingsSchemaSource.get_default();
        let source = fallback;
        const dir = ext.dir.get_child('schemas');
        if (dir.query_exists(null)) {
            try {
                source = Gio.SettingsSchemaSource.new_from_directory(dir.get_path(), fallback, false);
            } catch {
                source = fallback;
            }
        }
        const schema = source?.lookup(BMS_OVERVIEW, true);
        if (!schema)
            return;
        this._settings = new Gio.Settings({settings_schema: schema});
        this._settingsId = this._settings.connect('changed::blur', () => this._onChange());
    }

    destroy() {
        Main.extensionManager.disconnect(this._stateId);
        if (this._settings)
            this._settings.disconnect(this._settingsId);
        this._settings = null;
    }
}

/** The wallpaper under the overview, one background per monitor. */
export class Wallpaper {
    constructor() {
        this._group = new St.Widget({name: 'onyx-overview-wallpaper'});
        this._managers = [];
        this._overview = Main.layoutManager.overviewGroup;
        this._overview.insert_child_at_index(this._group, 0);
        // Stays below what GNOME and other extensions add later.
        this._addedId = this._overview.connect('child-added', (_g, child) => {
            if (child !== this._group)
                this._overview.set_child_below_sibling(this._group, null);
        });
        this._monitorsId = Main.layoutManager.connect('monitors-changed', () => this._build());
        this._build();
    }

    _build() {
        this._clear();
        for (let i = 0; i < Main.layoutManager.monitors.length; i++) {
            this._managers.push(new Background.BackgroundManager({
                container: this._group,
                monitorIndex: i,
                vignette: false,
            }));
        }
    }

    _clear() {
        for (const manager of this._managers)
            manager.destroy();
        this._managers = [];
    }

    destroy() {
        this._overview.disconnect(this._addedId);
        Main.layoutManager.disconnect(this._monitorsId);
        this._clear();
        this._group.destroy();
    }
}
