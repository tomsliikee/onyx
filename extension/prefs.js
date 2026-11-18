// Onyx's settings, in Adwaita: look, overview, and one switch per area.

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// Same keys as AREAS in lib/areas.js.
const AREAS = [
    ['menus', 'Quick Settings and menus', 'Quick Settings, their submenus, right-click and top bar menus'],
    ['calendar', 'Calendar and notifications', 'Date menu, notification list and banners'],
    ['osd', 'Screenshot and OSD', 'Screenshot panel, volume and brightness, workspace switcher'],
    ['dialogs', 'Dialogs and Alt-Tab', 'Log out, password and system dialogs, window switcher, on-screen keyboard'],
    ['overview', 'Overview', 'Dash, search entry and results, app folders'],
];
const STYLES = ['solid', 'transparent'];

export default class OnyxPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        window.add(page);

        const look = new Adw.PreferencesGroup({
            title: 'Look',
            description: 'Black in dark mode, white in light mode. The top bar is left alone.',
        });
        page.add(look);
        look.add(this._switch(settings, 'light-shell', 'Light shell with light apps',
            'GNOME keeps its shell dark when Dark Style is off; on, it turns white'));
        look.add(this._switch(settings, 'accent', 'Monochrome accent',
            'White in dark mode, black in light mode; off keeps the system accent'));
        look.add(this._switch(settings, 'hairline', 'Hairline',
            'A 1 px edge around menus, dialogs and panels'));

        const overview = new Adw.PreferencesGroup({
            title: 'Overview',
            description: 'Transparent lets Blur my Shell show through when it is on.',
        });
        page.add(overview);
        const style = new Adw.ComboRow({
            title: 'Surfaces',
            model: Gtk.StringList.new(['Solid', 'Transparent']),
        });
        overview.add(style);
        const opacity = new Adw.SpinRow({
            title: 'Opacity',
            subtitle: 'Percent, when transparent',
            adjustment: new Gtk.Adjustment({lower: 0, upper: 100, step_increment: 5, page_increment: 10}),
        });
        overview.add(opacity);

        const syncStyle = () => {
            const i = STYLES.indexOf(settings.get_string('overview-style'));
            if (style.selected !== i)
                style.selected = i;
            opacity.sensitive = i === 1;
        };
        const syncOpacity = () => {
            const v = Math.round(settings.get_double('overview-opacity') * 100);
            if (opacity.value !== v)
                opacity.value = v;
        };
        style.connect('notify::selected', () =>
            settings.set_string('overview-style', STYLES[style.selected]));
        opacity.connect('notify::value', () =>
            settings.set_double('overview-opacity', opacity.value / 100));
        const ids = [
            settings.connect('changed::overview-style', syncStyle),
            settings.connect('changed::overview-opacity', syncOpacity),
        ];
        syncStyle();
        syncOpacity();
        window.connect('close-request', () => {
            for (const id of ids)
                settings.disconnect(id);
            return false;
        });

        const areas = new Adw.PreferencesGroup({
            title: 'Areas',
            description: 'Buttons, switches and entries shared by these follow while any area is on.',
        });
        page.add(areas);
        for (const [key, title, subtitle] of AREAS)
            areas.add(this._switch(settings, `area-${key}`, title, subtitle));
    }

    _switch(settings, key, title, subtitle) {
        const row = new Adw.SwitchRow({title, subtitle});
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }
}
