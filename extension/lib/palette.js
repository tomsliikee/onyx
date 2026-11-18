// Every colour Onyx introduces lives here. Everything else is derived from
// GNOME's own theme by moving its greys onto these ends.

export const PALETTE = {
    dark: {
        // The base surface, the text and the monochrome accent.
        surface: 0x00,
        text: 0xff,
        hairline: 0x26,
        // Notification cards, lifted off the black so they stand out: the
        // front card of a stack, the one behind it, and the rest.
        card: {top: 0x3a, second: 0x2e, lower: 0x24},
    },
    light: {
        surface: 0xff,
        text: 0x00,
        hairline: 0xe0,
        card: {top: 0xeb, second: 0xe3, lower: 0xdb},
    },
};

// Soft mode: every grey is squeezed between these ends, so black becomes a
// dark grey, white a light grey, and the monochrome accent follows.
export const SOFT = {
    dark: {lo: 0x1c, hi: 0xe2},
    light: {lo: 0x2a, hi: 0xf0},
};

// GNOME's dark greys sit between #222226 and #56565c; popups are #36363a,
// the dash and search results #38383b. Shifting by this much puts both on
// pure black. Stretching the rest keeps raised controls (toggles, message
// cards) visible on that black.
export const DARK_SHIFT = 0x3a;
export const DARK_STRETCH = 2;
// Above this a grey counts as GNOME's near-white text and becomes pure white.
export const DARK_WHITE_FROM = 0xe6;
// Greys between these stay as they are: dimmed text, separators.
export const DARK_SURFACE_UP_TO = 0x60;

// GNOME's light surfaces are #fafafb (popups) and #ececf0 (raised).
export const LIGHT_LIFT = 0x05;
export const LIGHT_SURFACE_FROM = 0xc0;
// Below this a grey is GNOME's dark text (#222226) and becomes pure black.
export const LIGHT_BLACK_UP_TO = 0x40;

// A colour whose channels differ by more than this is a real colour
// (warning amber, destructive red) and stays as GNOME draws it.
export const NEUTRAL_SPREAD = 16;

export const HAIRLINE_WIDTH_PX = 1;
