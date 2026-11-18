// Loads the script named in ONYX_SCRIPT and hands it the running Onyx,
// the desktop settings and screenshots.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const OUT = GLib.getenv('ONYX_OUT');
const sleep = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
    resolve();
    return GLib.SOURCE_REMOVE;
}));

async function shot(name) {
    const stream = Gio.File.new_for_path(`${OUT}/shots/${name}.png`).replace(null, false, Gio.FileCreateFlags.NONE, null);
    const screenshot = new Shell.Screenshot();
    await new Promise(resolve => screenshot.screenshot(false, stream, (_source, result) => {
        try {
            screenshot.screenshot_finish(result);
        } catch (e) {
            logError(e);
        }
        resolve();
    }));
    stream.close(null);
}

const lines = [];
function note(line) {
    lines.push(line);
    GLib.file_set_contents(`${OUT}/log.txt`, `${lines.join('\n')}\n`);
}

export default class Driver extends Extension {
    enable() {
        this._run().catch(e => {
            note(`DRIVER ERROR ${e.message}\n${e.stack}`);
            global.context.terminate();
        });
    }

    disable() {}

    async _run() {
        // The shell starts in the overview; it has to be gone first.
        await sleep(3000);
        for (let calm = 0, tries = 0; calm < 8 && tries < 60; tries++) {
            if (Main.layoutManager._startingUp || Main.overview.visible) {
                calm = 0;
                if (!Main.layoutManager._startingUp)
                    Main.overview.hide();
            } else {
                calm++;
            }
            await sleep(250);
        }
        const onyx = Main.extensionManager.lookup('onyx@thomashaiden');
        if (!onyx?.stateObj?._settings)
            throw new Error(`Onyx is not running: ${onyx?.error}`);
        const script = await import(`file://${GLib.getenv('ONYX_SCRIPT')}`);
        await script.default({
            extension: onyx.stateObj,
            settings: onyx.stateObj._settings,
            desktop: new Gio.Settings({schema_id: 'org.gnome.desktop.interface'}),
            shot, sleep, note, Main,
            frames: async ms => {
                let count = 0;
                const id = global.stage.connect('after-paint', () => count++);
                await sleep(ms);
                global.stage.disconnect(id);
                return count;
            },
        });
        global.context.terminate();
    }
}
