// Opens every area Onyx styles, in dark and light, with Onyx on, and once
// with it off for comparison. Then the transparent overview, an area
// switched off, and 10 times off and on. JS errors land in the shell's
// output, which run.sh prints.

import Gio from 'gi://Gio';
import St from 'gi://St';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';

export default async function ({extension, settings, desktop, shot, sleep, note, Main, frames}) {
    Main.notify('Onyx test', 'A notification in the list and as a banner.');
    await sleep(400);

    const tour = async tag => {
        await shot(`${tag}-banner`);
        await sleep(5500);

        const qs = Main.panel.statusArea.quickSettings.menu;
        qs.open(false);
        await sleep(700);
        await shot(`${tag}-quicksettings`);
        qs.close(false);
        await sleep(300);

        const date = Main.panel.statusArea.dateMenu.menu;
        date.open(false);
        await sleep(700);
        await shot(`${tag}-calendar`);
        date.close(false);
        await sleep(300);

        Main.osdWindowManager.showAll(Gio.ThemedIcon.new('audio-volume-medium-symbolic'), null, 0.6, 1);
        await sleep(400);
        await shot(`${tag}-osd`);
        await sleep(2500);

        const dialog = new ModalDialog.ModalDialog();
        dialog.contentLayout.add_child(new St.Label({text: 'Log out? Onyx test dialog.'}));
        dialog.addButton({label: 'Cancel', action: () => dialog.close()});
        dialog.addButton({label: 'Log Out', action: () => dialog.close(), default: true});
        dialog.open();
        await sleep(700);
        await shot(`${tag}-dialog`);
        dialog.close();
        await sleep(500);

        await Main.screenshotUI.open();
        await sleep(900);
        await shot(`${tag}-screenshot`);
        Main.screenshotUI.close(true);
        await sleep(500);

        Main.overview.show();
        await sleep(1200);
        Main.overview.searchEntry.set_text('set');
        await sleep(1500);
        await shot(`${tag}-search`);
        Main.overview.searchEntry.set_text('');
        Main.overview.hide();
        await sleep(1000);
    };

    const scheme = () => desktop.get_string('color-scheme') === 'prefer-dark' ? 'dark' : 'light';
    const switchScheme = async () => {
        desktop.set_string('color-scheme', scheme() === 'dark' ? 'default' : 'prefer-dark');
        await sleep(800);
    };

    await tour(`${scheme()}-on`);
    note(`${scheme()} sheet: ${extension._file?.get_basename() ?? 'none'}`);
    await switchScheme();
    note(`${scheme()} sheet after switch: ${extension._file?.get_basename() ?? 'none'}`);
    await tour(`${scheme()}-on`);

    extension.disable();
    await sleep(400);
    await tour(`${scheme()}-off`);
    await switchScheme();
    await tour(`${scheme()}-off`);
    extension.enable();
    await sleep(400);

    settings.set_string('overview-style', 'transparent');
    settings.set_double('overview-opacity', 0.4);
    await sleep(500);
    Main.overview.show();
    await sleep(1200);
    Main.overview.searchEntry.set_text('set');
    await sleep(1500);
    await shot(`${scheme()}-transparent-search`);
    Main.overview.searchEntry.set_text('');
    Main.overview.hide();
    await sleep(1000);
    settings.reset('overview-style');
    settings.reset('overview-opacity');

    settings.set_boolean('area-menus', false);
    await sleep(500);
    Main.panel.statusArea.quickSettings.menu.open(false);
    await sleep(700);
    await shot(`${scheme()}-menus-off`);
    Main.panel.statusArea.quickSettings.menu.close(false);
    settings.reset('area-menus');
    await sleep(500);

    const stylesheets = () => St.ThemeContext.get_for_stage(global.stage).get_theme().get_custom_stylesheets().length;
    const before = stylesheets();
    for (let i = 0; i < 10; i++) {
        extension.disable();
        await sleep(50);
        extension.enable();
        await sleep(150);
    }
    note(`lifecycle: custom sheets before=${before} after=${stylesheets()}`);
    extension.disable();
    await sleep(200);
    const dir = Gio.File.new_for_path(extension._dir);
    const left = [];
    const it = dir.enumerate_children('standard::name', 0, null);
    for (let info; (info = it.next_file(null));)
        left.push(info.get_name());
    note(`disabled: custom sheets=${stylesheets()} files left=${JSON.stringify(left)}`);
    extension.enable();
    await sleep(500);

    note(`idle frames in 3 s: ${await frames(3000)}`);
}
