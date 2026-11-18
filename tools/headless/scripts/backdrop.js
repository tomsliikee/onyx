// The overview's backdrop: Onyx's own wallpaper when transparent without
// Blur my Shell, none when solid, and see-through surfaces in either style
// when Blur my Shell blurs the overview. Load BMS with ONYX_WITH to test it.

import Gio from 'gi://Gio';

export default async function ({settings, shot, sleep, note, Main}) {
    const group = Main.layoutManager.overviewGroup;
    const report = async tag => {
        Main.overview.show();
        await sleep(1500);
        const ours = group.get_children().find(c => c.name === 'onyx-overview-wallpaper');
        const bms = group.get_children().some(c => c.name?.includes?.('bms') ||
            c.get_children?.().some(k => k.name?.includes?.('bms')));
        const dash = Main.overview.dash._background;
        note(`${tag} wallpaper=${ours ? `yes(${ours.get_n_children()} bg, index ${group.get_children().indexOf(ours)})` : 'no'} bms-layer=${bms} dash-bg=${dash.get_theme_node().get_background_color().to_string()}`);
        await shot(`${tag}-overview`);
        Main.overview.hide();
        await sleep(1000);
    };
    const bmsLoaded = Boolean(Main.extensionManager.lookup('blur-my-shell@aunetx'));
    note(`bms ${bmsLoaded ? 'loaded' : 'not loaded'}`);

    for (const style of ['solid', 'transparent']) {
        settings.set_string('overview-style', style);
        await sleep(600);
        await report(style);
    }
    if (bmsLoaded) {
        const bms = new Gio.Settings({schema_id: 'org.gnome.shell.extensions.blur-my-shell.overview'});
        bms.set_boolean('blur', false);
        await sleep(600);
        await report('transparent-bmsblur-off');
        bms.set_boolean('blur', true);
        await Main.extensionManager.disableExtension('blur-my-shell@aunetx');
        await sleep(800);
        await report('transparent-bms-disabled');
        await Main.extensionManager.enableExtension('blur-my-shell@aunetx');
        await sleep(800);
        settings.set_string('overview-style', 'solid');
        await sleep(600);
        await report('solid-bms-again');
    }
    settings.set_string('overview-style', 'transparent');
    await sleep(300);
    settings.set_boolean('area-overview', false);
    await sleep(600);
    note(`area off wallpaper=${group.get_children().some(c => c.name === 'onyx-overview-wallpaper')}`);
    settings.reset('area-overview');
    settings.reset('overview-style');
    await sleep(600);
    note(`reset wallpaper=${group.get_children().some(c => c.name === 'onyx-overview-wallpaper')}`);
}
