// Onyx: loads a stylesheet built from GNOME Shell's own (lib/css.js) and
// builds it again when the colour scheme, the accent or a setting changes.
// Nothing runs between those changes.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {AREA_NAMES, buildCss} from './lib/css.js';

// A slider in the settings sends a burst of changes; one rebuild after it.
const SETTLE_MS = 120;

export default class OnyxExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._stSettings = St.Settings.get();
        this._dir = GLib.build_filenamev([GLib.get_user_runtime_dir(), 'onyx']);
        this._serial = 0;
        this._file = null;
        this._timeout = 0;

        this._sessionScheme = Main.sessionMode.colorScheme;
        this._followApps();

        this._settingsId = this._settings.connect('changed', (_s, key) => {
            if (key === 'light-shell')
                this._followApps();
            this._queue();
        });
        // GNOME reloads its own theme on these and keeps extension sheets
        // loaded; Onyx's content depends on them, so it is built again.
        this._stIds = ['notify::color-scheme', 'notify::accent-color', 'notify::high-contrast']
            .map(signal => this._stSettings.connect(signal, () => this._queue()));
        this._apply();
    }

    disable() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = 0;
        }
        this._settings.disconnect(this._settingsId);
        for (const id of this._stIds)
            this._stSettings.disconnect(id);
        this._unload();
        this._setSessionScheme(this._sessionScheme);
        this._settings = null;
        this._stSettings = null;
    }

    // GNOME 50 keeps its shell dark unless color-scheme is "prefer-light";
    // the Dark Style toggle switches between "prefer-dark" and "default".
    // With light-shell on, "default" (apps light) gives a light shell too.
    _followApps() {
        if (this._sessionScheme !== 'prefer-dark')
            return;
        this._setSessionScheme(this._settings.get_boolean('light-shell')
            ? 'prefer-light' : this._sessionScheme);
    }

    _setSessionScheme(scheme) {
        if (Main.sessionMode.colorScheme === scheme)
            return;
        Main.sessionMode.colorScheme = scheme;
        // GNOME picks its own stylesheet again on this notification.
        St.Settings.get().notify('color-scheme');
    }

    _queue() {
        if (this._timeout)
            return;
        this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SETTLE_MS, () => {
            this._timeout = 0;
            this._apply();
            return GLib.SOURCE_REMOVE;
        });
    }

    _options(scheme) {
        const s = this._settings;
        return {
            scheme,
            accent: s.get_boolean('accent'),
            hairline: s.get_boolean('hairline'),
            areas: Object.fromEntries(AREA_NAMES.map(a => [a, s.get_boolean(`area-${a}`)])),
            overviewTransparent: s.get_string('overview-style') === 'transparent',
            overviewOpacity: s.get_double('overview-opacity'),
        };
    }

    _apply() {
        this._unload();
        // High contrast has its own sheet; Onyx would only weaken it.
        const scheme = Main.getStyleVariant();
        if (this._stSettings.high_contrast || (scheme !== 'dark' && scheme !== 'light'))
            return;
        try {
            const source = Gio.File.new_for_uri(
                `resource:///org/gnome/shell/theme/gnome-shell-${scheme}.css`);
            const [, bytes] = source.load_contents(null);
            const css = buildCss(new TextDecoder().decode(bytes), this._options(scheme));

            GLib.mkdir_with_parents(this._dir, 0o700);
            // A new name each time, so St never serves a cached parse.
            const file = Gio.File.new_for_path(
                GLib.build_filenamev([this._dir, `onyx-${++this._serial}.css`]));
            file.replace_contents(new TextEncoder().encode(css), null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            St.ThemeContext.get_for_stage(global.stage).get_theme().load_stylesheet(file);
            this._file = file;
        } catch (e) {
            // GNOME's look stays as it is; that is the safe way to fail.
            console.error(`Onyx: ${e.message}`);
        }
    }

    _unload() {
        if (!this._file)
            return;
        St.ThemeContext.get_for_stage(global.stage).get_theme().unload_stylesheet(this._file);
        try {
            this._file.delete(null);
        } catch (e) {
            console.warn(`Onyx: ${e.message}`);
        }
        this._file = null;
    }
}
