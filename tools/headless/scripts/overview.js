// The overview and Lantern's panel with Onyx on and off, in dark and light,
// for comparing against GNOME's own look. Load Lantern with ONYX_WITH.

import St from 'gi://St';

export default async function ({settings, desktop, shot, sleep, note, Main}) {
    const lantern = Main.extensionManager.lookup('material-search@thomashaiden')?.stateObj?._panel;
    note(`lantern ${lantern ? 'loaded' : 'not loaded'}`);
    const areas = ['menus', 'calendar', 'osd', 'dialogs', 'overview'];
    for (const scheme of ['dark', 'light']) {
        desktop.set_string('color-scheme', scheme === 'dark' ? 'prefer-dark' : 'default');
        await sleep(800);
        for (const onyx of [true, false]) {
            for (const a of areas)
                settings.set_boolean(`area-${a}`, onyx);
            await sleep(600);
            const tag = `${scheme}-${onyx ? 'onyx' : 'gnome'}`;
            const sheet = St.ThemeContext.get_for_stage(global.stage).get_theme().default_stylesheet?.get_basename();
            note(`${tag} default sheet ${sheet}`);
            Main.overview.show();
            await sleep(1500);
            await shot(`${tag}-overview`);
            Main.overview.hide();
            await sleep(1000);
            if (lantern) {
                lantern.open();
                await sleep(700);
                const entry = lantern._entry;
                const node = entry.get_theme_node();
                note(`${tag} entry focus=${entry.has_key_focus?.() ?? '?'} pseudo=${entry.get_style_pseudo_class()} bg=${node.get_background_color().to_string()}`);
                await shot(`${tag}-lantern`);
                lantern.close();
                await sleep(600);
            }
        }
    }
    for (const a of areas)
        settings.reset(`area-${a}`);
}
