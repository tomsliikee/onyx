import Gio from 'gi://Gio';
import {test, equal, done} from './harness.js';
import {AREA_NAMES, DARK_IN_LIGHT, KEPT_DARK, buildCss, mapColours, mapDecl, mapGrey} from '../extension/lib/css.js';
import {areaOf} from '../extension/lib/areas.js';
import {parseRules} from '../extension/lib/theme.js';

// The installed GNOME Shell theme: the tests check Onyx against the real one.
const resource = Gio.Resource.load('/usr/share/gnome-shell/gnome-shell-theme.gresource');
const read = name => new TextDecoder().decode(resource.lookup_data(
    `/org/gnome/shell/theme/${name}`, Gio.ResourceLookupFlags.NONE).toArray());
const GNOME = {dark: read('gnome-shell-dark.css'), light: read('gnome-shell-light.css')};

const allOn = Object.fromEntries(AREA_NAMES.map(a => [a, true]));
const opts = (scheme, extra = {}) => ({
    scheme, accent: true, hairline: true, areas: {...allOn},
    overviewTransparent: false, overviewOpacity: 0.6, ...extra,
});
const rulesOf = css => parseRules(css);
const find = (css, selector) => rulesOf(css).filter(r => r.selectors.includes(selector));
const value = (css, selector, prop) => {
    for (const r of find(css, selector)) {
        const d = r.decls.find(x => x.prop === prop);
        if (d)
            return d.value;
    }
    return null;
};

test('dark: popups become black, text white, raised controls stay visible', () => {
    equal(mapGrey(0x36, 'dark'), 0);
    equal(mapGrey(0xfa, 'dark'), 255);
    equal(mapGrey(0x47, 'dark') > 0x15, true);
    equal(mapGrey(0x9b, 'dark'), 0x9b);
});

test('light: popups become white, text black', () => {
    equal(mapGrey(0xfa, 'light'), 255);
    equal(mapGrey(0x22, 'light'), 0);
    equal(mapGrey(0xec, 'light') < 255, true);
});

test('real colours stay, greys lose their blue tint', () => {
    equal(mapColours('#c01c28', 'dark'), '#c01c28');
    equal(mapColours('#36363a', 'dark'), '#000000');
    equal(mapColours('rgba(250, 250, 251, 0.1)', 'dark'), 'rgba(255, 255, 255, 0.1)');
    equal(mapColours('st-lighten(#38383b, 7%)', 'dark'), 'st-lighten(#000000, 7%)');
});

test('inverted: shades stay black, the rest turns around', () => {
    equal(mapColours('rgba(0, 0, 0, 0.3)', 'dark', true), 'rgba(0, 0, 0, 0.3)');
    equal(mapColours('#2e2e33', 'dark', true), '#ffffff');
    equal(mapColours('rgba(255, 255, 255, 0.2)', 'dark', true), 'rgba(0, 0, 0, 0.2)');
});

test('the accent becomes the text colour, its foreground the surface', () => {
    const how = {scheme: 'dark', accent: true, island: false, overviewAlpha: null};
    equal(mapDecl({prop: 'background-color', value: '-st-accent-color'}, how), '#ffffff');
    equal(mapDecl({prop: 'color', value: '-st-accent-fg-color'}, how), '#000000');
    equal(mapDecl({prop: 'color', value: '-st-accent-fg-color'}, {...how, scheme: 'light'}), '#ffffff');
    equal(mapDecl({prop: 'color', value: '-st-accent-color'}, {...how, accent: false}), null);
});

test('an unchanged declaration is left to GNOME', () => {
    const how = {scheme: 'dark', accent: true, island: false, overviewAlpha: null};
    equal(mapDecl({prop: 'border-radius', value: '12px'}, how), null);
    equal(mapDecl({prop: 'color', value: '#9b9b9d'}, how), null);
});

for (const scheme of ['dark', 'light']) {
    const css = buildCss(GNOME[scheme], opts(scheme));
    const surface = scheme === 'dark' ? '#000000' : '#ffffff';
    const text = scheme === 'dark' ? '#ffffff' : '#000000';

    test(`${scheme}: the generated sheet parses back`, () => {
        equal(rulesOf(css).length > 200, true);
        equal((css.match(/\{/g) ?? []).length, (css.match(/\}/g) ?? []).length);
    });

    test(`${scheme}: popup menus, dialogs, dash and search are ${surface}`, () => {
        equal(value(css, '.popup-menu-content', 'background-color'), surface);
        equal(value(css, '.modal-dialog', 'background-color'), surface);
        equal(value(css, '#dash .dash-background', 'background-color'), surface);
        equal(value(css, '.search-section-content', 'background-color'), surface);
    });

    test(`${scheme}: OSD, Alt-Tab and screenshot panel are ${surface} too`, () => {
        for (const s of ['.osd-window', '.switcher-list', '.screenshot-ui-panel']) {
            const v = rulesOf(css).filter(r => r.selectors.includes(s))
                .flatMap(r => r.decls).find(d => d.prop === 'background-color');
            equal([s, v?.value], [s, surface]);
        }
    });

    test(`${scheme}: a checked quick toggle is ${text} with ${surface} content`, () => {
        equal(value(css, '.quick-toggle:checked', 'background-color'), text);
        equal(value(css, '.quick-toggle:checked', 'color'), surface);
    });

    test(`${scheme}: no accent and no top bar left in the sheet`, () => {
        equal(css.includes('-st-accent'), false);
        equal(/#panel|\.panel-button/.test(css), false);
    });

    test(`${scheme}: the hairline only when switched on`, () => {
        equal(css.includes('.popup-menu-content { border: 1px solid'), true);
        const without = buildCss(GNOME[scheme], opts(scheme, {hairline: false}));
        equal(without.includes('.popup-menu-content { border: 1px solid'), false);
    });

    test(`${scheme}: an area switched off is not in the sheet`, () => {
        const noMenus = buildCss(GNOME[scheme], opts(scheme, {areas: {...allOn, menus: false}}));
        // GNOME's own value, so a shared button rule cannot win over it.
        equal(value(noMenus, '.popup-menu-content', 'background-color').startsWith('#36') ||
            value(noMenus, '.popup-menu-content', 'background-color').startsWith('#fa'), true);
        equal(value(noMenus, '.quick-toggle:checked', 'background-color'), '-st-accent-color');
        equal(value(noMenus, '.modal-dialog', 'background-color'), surface);
    });

    test(`${scheme}: all areas off gives an empty sheet`, () => {
        const none = Object.fromEntries(AREA_NAMES.map(a => [a, false]));
        equal(buildCss(GNOME[scheme], opts(scheme, {areas: none})).trim(), '');
    });

    test(`${scheme}: transparent overview, opacity clamped, popups stay opaque`, () => {
        const t = buildCss(GNOME[scheme], opts(scheme, {overviewTransparent: true, overviewOpacity: 1.7}));
        const v = scheme === 'dark' ? 0 : 255;
        equal(value(t, '#dash .dash-background', 'background-color'), `rgba(${v}, ${v}, ${v}, 1)`);
        const h = buildCss(GNOME[scheme], opts(scheme, {overviewTransparent: true, overviewOpacity: 0.456}));
        equal(value(h, '.search-section-content', 'background-color'), `rgba(${v}, ${v}, ${v}, 0.46)`);
        equal(value(h, '.popup-menu-content', 'background-color'), surface);
        // The backdrop around the workspaces stays opaque.
        equal((value(h, '#overviewGroup', 'background-color') ?? '').startsWith('rgba'), false);
    });
}

test('every dark surface of GNOME\'s light theme is known to Onyx', () => {
    const unknown = [];
    for (const rule of parseRules(GNOME.light)) {
        const bg = rule.decls.find(d => d.prop === 'background-color' && /^#[0-9a-f]{6}$/i.test(d.value));
        if (!bg || parseInt(bg.value.slice(1, 3), 16) > 0x60)
            continue;
        for (const s of rule.selectors) {
            const known = [...DARK_IN_LIGHT, ...KEPT_DARK, '.screenshot-ui-window-selector'];
            if (areaOf(s) !== 'skip' && !known.some(t => s.includes(t)))
                unknown.push(s);
        }
    }
    equal(unknown, []);
});

test('a later GNOME rule keeps winning over an earlier one Onyx changed', () => {
    const css = buildCss('.a { background-color: #36363a; }\n.a { background-color: transparent; }',
        opts('dark', {hairline: false}));
    equal(css.trim().split('\n'), ['.a { background-color: #000000; }', '.a { background-color: transparent; }']);
});

test('building the sheet is cheap', () => {
    const start = Date.now();
    buildCss(GNOME.dark, opts('dark'));
    equal(Date.now() - start < 300, true);
});

done('css');
