// Onyx: builds a copy of GNOME Shell's stylesheet with new colours
// (lib/css.js) and puts it in place of GNOME's own as the theme's default
// sheet, so the sheets of other extensions keep winning over it as they win
// over GNOME's. It is built again when the colour scheme or a setting
// changes, and put back when GNOME reloads its theme. Nothing runs between
// those changes.

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
        this._serial ??= 0;
        this._file = null;
        this._timeout = 0;
        this._installing = false;
        // Another shell (a nested or headless one) can share the runtime dir.
        this._pid = new Gio.Credentials().get_unix_pid();
        this._context = St.ThemeContext.get_for_stage(global.stage);

        this._sessionScheme = Main.sessionMode.colorScheme;
        this._followApps();

        this._settingsId = this._settings.connect('changed', (_s, key) => {
            if (key === 'light-shell')
                this._followApps();
            this._queue();
        });
        // GNOME builds a new theme with its own sheet when the colour scheme
        // or high contrast changes, and other extensions can call
        // Main.loadTheme(); Onyx's sheet is built for the new variant and
        // goes back in. The accent needs nothing: the sheet has none left.
        this._contextId = this._context.connect('changed', () => {
            if (!this._installing && !this._isInstalled())
                this._apply();
        });
        this._apply();
    }

    disable() {
        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = 0;
        }
        this._settings.disconnect(this._settingsId);
        this._context.disconnect(this._contextId);
        this._setSessionScheme(this._sessionScheme);
        this._restore();
        this._settings = null;
        this._stSettings = null;
        this._context = null;
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
        // High contrast has its own sheet; Onyx would only weaken it.
        const scheme = Main.getStyleVariant();
        if (this._stSettings.high_contrast || (scheme !== 'dark' && scheme !== 'light')) {
            this._restore();
            return;
        }
        // Every area off: GNOME's own sheet, without building anything.
        if (!AREA_NAMES.some(a => this._settings.get_boolean(`area-${a}`))) {
            this._restore();
            return;
        }
        let file;
        try {
            const source = Gio.File.new_for_uri(
                `resource:///org/gnome/shell/theme/gnome-shell-${scheme}.css`);
            const [, bytes] = source.load_contents(null);
            const css = buildCss(new TextDecoder().decode(bytes), this._options(scheme));
            GLib.mkdir_with_parents(this._dir, 0o700);
            // A new name each time, so St never serves a cached parse.
            file = Gio.File.new_for_path(GLib.build_filenamev(
                [this._dir, `onyx-${this._pid}-${++this._serial}.css`]));
            file.replace_contents(new TextEncoder().encode(css), null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            this._install(file);
        } catch (e) {
            // GNOME's look stays as it is; that is the safe way to fail.
            console.error(`Onyx: ${e.message}`);
            this._delete(file);
            return;
        }
        const old = this._file;
        this._file = file;
        if (old && !old.equal(file))
            this._delete(old);
    }

    _isInstalled() {
        const sheet = this._context.get_theme()?.default_stylesheet;
        return Boolean(sheet && this._file && sheet.equal(this._file));
    }

    // Main.loadTheme() with Onyx's sheet in place of GNOME's.
    _install(file) {
        const previous = this._context.get_theme();
        const theme = new St.Theme({
            application_stylesheet: previous?.application_stylesheet ?? null,
            default_stylesheet: file,
        });
        for (const sheet of previous?.get_custom_stylesheets() ?? [])
            theme.load_stylesheet(sheet);
        this._installing = true;
        try {
            this._context.set_theme(theme);
        } finally {
            this._installing = false;
        }
    }

    _restore() {
        if (!this._file)
            return;
        const installed = this._isInstalled();
        const file = this._file;
        this._file = null;
        // GNOME's own theme again, with every extension's sheet.
        if (installed) {
            this._installing = true;
            try {
                Main.loadTheme();
            } finally {
                this._installing = false;
            }
        }
        this._delete(file);
    }

    _delete(file) {
        if (!file)
            return;
        try {
            file.delete(null);
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
                console.warn(`Onyx: ${e.message}`);
        }
    }
}
