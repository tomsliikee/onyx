// Builds Onyx's stylesheet from GNOME Shell's own one. Each rule keeps its
// selectors; only the declarations whose colour changes are written out, so
// sizes, radii and everything without colour stay GNOME's.
//
// Dark: GNOME's greys move down onto black, near-white text becomes white.
// Light: GNOME's light greys move up onto white, dark text becomes black.
// GNOME keeps a few things dark in its light theme (OSD, Alt-Tab, the
// screenshot panel); in light those get the dark treatment and are then
// inverted, so they turn white like the rest.

import {areaOf, AREAS} from './areas.js';
import {parseRules} from './theme.js';
import {
    PALETTE, DARK_SHIFT, DARK_STRETCH, DARK_WHITE_FROM, DARK_SURFACE_UP_TO,
    LIGHT_LIFT, LIGHT_SURFACE_FROM, LIGHT_BLACK_UP_TO, NEUTRAL_SPREAD,
    HAIRLINE_WIDTH_PX,
} from './palette.js';

export const AREA_NAMES = Object.keys(AREAS);

// Dark in light and dark in Onyx too: the overview's backdrop and what sits
// right on it (app names, workspaces). White there would glare, and app
// names would need dark text on a wallpaper.
export const KEPT_DARK = ['#overviewGroup', '.overview-tile', '.grid-search-result',
    '.workspace-thumbnail', '.workspace-animation'];
// The overview's own surfaces; only these turn see-through when the overview
// is set to transparent. The backdrop and the app grid around them stay.
export const OVERVIEW_SURFACES = ['#dash', '.search-entry', '.search-section-content',
    '.list-search-result', '.search-provider-icon', '.app-folder-dialog',
    '.page-navigation-arrow', '.folder-name-entry'];
// Dark in GNOME's light theme and white in Onyx's. Kept by hand;
// tests/css.test.js fails when GNOME's light theme gets a dark surface that
// is in neither this list nor KEPT_DARK.
export const DARK_IN_LIGHT = ['.screenshot-ui', '.osd-window', '.workspace-switcher',
    '.ws-switcher', '.switcher-', '.resize-popup', '.osd-monitor-label',
    '.osd-break', ...OVERVIEW_SURFACES, '#keyboard', '.keyboard-key',
    '.word-suggestions', '.emoji-panel'];

// Overlays on top of the screen picture; they stay dark in light too.
const NOT_INVERTED = ['.screenshot-ui-area', '.screenshot-ui-screen-selector',
    '.screenshot-ui-window-selector', '.pad-osd'];

// The surfaces that float, per area, for the hairline.
export const HAIRLINE = {
    menus: ['.popup-menu-content'],
    calendar: ['.notification-banner'],
    osd: ['.osd-window', '.screenshot-ui-panel', '.workspace-switcher'],
    dialogs: ['.modal-dialog', '.switcher-list'],
    overview: ['#dash .dash-background', '.search-section-content'],
};

const clamp = v => Math.max(0, Math.min(255, Math.round(v)));

/** Where one grey channel of GNOME's goes. */
export function mapGrey(v, scheme) {
    if (scheme === 'dark') {
        if (v >= DARK_WHITE_FROM)
            return 255;
        if (v <= DARK_SURFACE_UP_TO)
            return clamp((v - DARK_SHIFT) * DARK_STRETCH);
        return v;
    }
    if (v <= LIGHT_BLACK_UP_TO)
        return 0;
    if (v >= LIGHT_SURFACE_FROM)
        return clamp(v + LIGHT_LIFT);
    return v;
}

const hex2 = v => v.toString(16).padStart(2, '0');
const grey = v => `#${hex2(v)}${hex2(v)}${hex2(v)}`;
const greyA = (v, a) => `rgba(${v}, ${v}, ${v}, ${a})`;

const COLOUR = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)|\b(?:white|black)\b/g;

function readColour(text) {
    if (text === 'white')
        return {r: 255, g: 255, b: 255, a: 1};
    if (text === 'black')
        return {r: 0, g: 0, b: 0, a: 1};
    if (text.startsWith('#')) {
        const h = text.length === 4
            ? text.slice(1).split('').map(c => c + c).join('')
            : text.slice(1);
        return {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16),
            a: 1,
        };
    }
    const n = text.match(/[\d.]+/g).map(Number);
    return {r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1};
}

/**
 * Maps every colour literal in a value. `invert` turns the result around
 * (for GNOME's dark-in-light surfaces); semi-transparent black stays,
 * because that is a shade or a shadow on any background.
 */
export function mapColours(value, scheme, invert = false) {
    return value.replace(COLOUR, text => {
        const c = readColour(text);
        if (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) > NEUTRAL_SPREAD)
            return text;
        const avg = Math.round((c.r + c.g + c.b) / 3);
        let v = mapGrey(avg, scheme);
        if (invert && !(v === 0 && c.a < 1))
            v = 255 - v;
        else if (v === avg)
            return text;
        return c.a < 1 ? greyA(v, c.a) : grey(v);
    });
}

function mapAccent(value, scheme) {
    const {surface, text} = PALETTE[scheme];
    // The fg variant first: "-st-accent-color" is a prefix of it.
    return value
        .replace(/-st-accent-fg-color/g, grey(surface))
        .replace(/-st-accent-color/g, grey(text));
}

// st-lighten on an inverted colour has to darken, and the other way round.
const swapLighten = value => value.replace(/st-(lighten|darken)\(/g,
    (_, f) => f === 'lighten' ? 'st-darken(' : 'st-lighten(');

/**
 * The new value of one declaration, or null when Onyx leaves it to GNOME.
 * @param {{prop: string, value: string}} decl
 * @param {{scheme: 'dark'|'light', accent: boolean, island: boolean,
 *          overviewAlpha: number|null}} how
 */
export function mapDecl(decl, how) {
    let {value} = decl;
    // Dark-in-light surfaces get the dark treatment and are then inverted.
    const scheme = how.island ? 'dark' : how.scheme;
    if (how.accent)
        value = mapAccent(value, scheme);
    const invert = how.island && decl.prop !== 'box-shadow';
    value = mapColours(value, scheme, invert);
    if (invert)
        value = swapLighten(value);
    if (how.overviewAlpha !== null && decl.prop.startsWith('background')) {
        const s = PALETTE[how.scheme].surface;
        value = value.split(grey(s)).join(greyA(s, how.overviewAlpha));
    }
    return value === decl.value ? null : value;
}

const COLOUR_PROP = /color|^background|^border(-(top|right|bottom|left))?$|shadow/;

const isIsland = selector =>
    DARK_IN_LIGHT.some(t => selector.includes(t)) &&
    !NOT_INVERTED.some(t => selector.includes(t));

/**
 * @typedef {object} Options
 * @property {'dark'|'light'} scheme
 * @property {boolean} accent      monochrome accent
 * @property {boolean} hairline
 * @property {Record<string, boolean>} areas  one switch per AREA_NAMES
 * @property {boolean} overviewTransparent
 * @property {number} overviewOpacity 0..1, used when transparent
 */

/**
 * @param {string} gnomeCss GNOME Shell's stylesheet for this scheme
 * @param {Options} options
 * @returns {string}
 */
export function buildCss(gnomeCss, options) {
    const on = area => area === 'base'
        ? AREA_NAMES.some(a => options.areas[a])
        : options.areas[area] === true;
    const alpha = options.overviewTransparent
        ? Math.round(Math.max(0, Math.min(1, options.overviewOpacity)) * 100) / 100
        : null;

    if (!on('base'))
        return '';

    const out = [];
    for (const rule of parseRules(gnomeCss)) {
        // Selectors of one rule can belong to different areas and can be
        // dark-in-light or not, so they are grouped by how they are mapped.
        // A switched-off area still gets its rules, with GNOME's own values:
        // they keep their place in the cascade, so a shared rule (".button")
        // cannot win over its ".quick-toggle" rule.
        const groups = new Map();
        for (const selector of rule.selectors) {
            const area = areaOf(selector);
            if (area === 'skip')
                continue;
            const how = {
                scheme: options.scheme,
                accent: options.accent,
                island: options.scheme === 'light' && isIsland(selector),
                overviewAlpha: area === 'overview' && OVERVIEW_SURFACES.some(t => selector.includes(t))
                    ? alpha : null,
                original: !on(area),
            };
            const key = `${how.island}|${how.overviewAlpha}|${how.original}`;
            if (!groups.has(key))
                groups.set(key, {how, selectors: []});
            groups.get(key).selectors.push(selector);
        }
        for (const {how, selectors} of groups.values()) {
            const decls = [];
            for (const decl of rule.decls) {
                // Unchanged colour declarations are written too: GNOME's rules
                // overwrite each other in order, and a later one left out
                // would lose to an earlier one Onyx changed.
                const value = mapDecl(decl, how);
                if (value !== null)
                    decls.push(`${decl.prop}: ${how.original ? decl.value : value};`);
                else if (COLOUR_PROP.test(decl.prop))
                    decls.push(`${decl.prop}: ${decl.value};`);
            }
            if (decls.length > 0)
                out.push(`${selectors.join(', ')} { ${decls.join(' ')} }`);
        }
    }

    if (options.hairline) {
        const colour = grey(PALETTE[options.scheme].hairline);
        for (const [area, selectors] of Object.entries(HAIRLINE)) {
            if (on(area))
                out.push(`${selectors.join(', ')} { border: ${HAIRLINE_WIDTH_PX}px solid ${colour}; }`);
        }
    }
    return `${out.join('\n')}\n`;
}
