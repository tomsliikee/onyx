// Notification cards and soft mode: the calendar with two notifications and
// Quick Settings, in dark and light, with soft off and on.

export default async function ({settings, desktop, shot, sleep, note, Main}) {
    Main.notify('Onyx test', 'A notification card in the list.');
    Main.notify('Second one', 'Cards should stand out from the panel.');
    await sleep(6000);
    for (const scheme of ['dark', 'light']) {
        desktop.set_string('color-scheme', scheme === 'dark' ? 'prefer-dark' : 'default');
        await sleep(800);
        for (const soft of [false, true]) {
            settings.set_boolean('soft', soft);
            await sleep(600);
            const tag = `${scheme}-${soft ? 'soft' : 'hard'}`;
            const date = Main.panel.statusArea.dateMenu.menu;
            date.open();
            await sleep(800);
            await shot(`${tag}-calendar`);
            date.close();
            await sleep(500);
            const qs = Main.panel.statusArea.quickSettings.menu;
            qs.open();
            await sleep(800);
            await shot(`${tag}-quicksettings`);
            qs.close();
            await sleep(500);
        }
    }
    settings.reset('soft');
    note('soft done');
}
