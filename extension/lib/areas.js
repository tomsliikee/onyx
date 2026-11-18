// Which part of the shell a selector belongs to. The keys of AREAS are the
// switches in the settings; a selector matching none of them is a shared
// control (button, entry, switch, scroll bar) and follows when any area is on.

export const AREAS = {
    menus: ['.popup-', '.quick-', '.background-app', '.keyboard-brightness',
        '.audio-device', '.candidate-', '.toggle-switch', '.check-box',
        '.slider', '.system-action', '.device-subtitle'],
    calendar: ['.datemenu', '.calendar', '.message', '.notification',
        '.events-', '.world-clocks', '.weather-', '.dnd-', '.pie-timer'],
    osd: ['.screenshot-ui', '.osd-', '.pad-osd', '.resize-popup',
        '.workspace-switcher', '.ws-switcher', '.select-area', '.magnifier-'],
    dialogs: ['.modal-dialog', '.end-session', '.prompt-dialog', '.run-dialog',
        '.polkit-dialog', '.dialog-list', '.conflicting-session', '.switcher-',
        '.cycler-highlight', '.parental-controls', '.access-dialog',
        '.keyboard-key', '#keyboard', '.word-suggestions', '.emoji-panel'],
    overview: ['#dash', '.dash-', '.app-folder', '.app-grid', '.overview-',
        '#overviewGroup', '.grid-search', '.list-search', '.search-',
        '.page-indicator', '.page-navigation', '.workspace-thumbnail',
        '.window-caption', '.window-close', '.icon-dropshadow'],
};

// Never touched: the top bar belongs to other extensions (Transparent Top
// Bar, Blur my Shell, Islands), the lock and login screens run without
// extensions, Looking Glass is a developer tool.
const SKIPPED = ['#panel', '.panel-', '#LookingGlass', '.lg-', '.login-dialog',
    '.unlock-dialog', '#unlockDialog', '#lockDialogGroup', '.screen-shield',
    '.user-icon', '.user-widget', '.caps-lock'];

/**
 * @param {string} selector one selector, no commas
 * @returns {'skip'|'base'|keyof AREAS}
 */
export function areaOf(selector) {
    if (SKIPPED.some(token => selector.includes(token)))
        return 'skip';
    // The first token wins: ".app-folder-dialog .icon-button" is overview.
    let best = null;
    let bestAt = Infinity;
    for (const [area, tokens] of Object.entries(AREAS)) {
        for (const token of tokens) {
            const at = selector.indexOf(token);
            if (at >= 0 && at < bestAt) {
                best = area;
                bestAt = at;
            }
        }
    }
    return best ?? 'base';
}
