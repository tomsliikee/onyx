// Reads GNOME Shell's compiled stylesheet. It is flat CSS (no nesting, no
// at-rules), so a plain scan of "selectors { declarations }" is enough.

/**
 * @param {string} text
 * @returns {{selectors: string[], decls: {prop: string, value: string}[]}[]}
 */
export function parseRules(text) {
    const clean = text.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [];
    for (const match of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selectors = match[1].split(',')
            .map(s => s.trim().replace(/\s+/g, ' '))
            .filter(s => s.length > 0);
        const decls = [];
        for (const part of splitDecls(match[2])) {
            const colon = part.indexOf(':');
            if (colon < 1)
                continue;
            decls.push({
                prop: part.slice(0, colon).trim(),
                value: part.slice(colon + 1).trim().replace(/\s+/g, ' '),
            });
        }
        if (selectors.length > 0 && decls.length > 0)
            rules.push({selectors, decls});
    }
    return rules;
}

// Splits on ";" outside parentheses and quotes (url("a;b") stays whole).
function splitDecls(body) {
    const parts = [];
    let depth = 0;
    let quote = null;
    let start = 0;
    for (let i = 0; i < body.length; i++) {
        const c = body[i];
        if (quote) {
            if (c === quote)
                quote = null;
        } else if (c === '"' || c === '\'') {
            quote = c;
        } else if (c === '(') {
            depth++;
        } else if (c === ')') {
            depth--;
        } else if (c === ';' && depth === 0) {
            parts.push(body.slice(start, i));
            start = i + 1;
        }
    }
    parts.push(body.slice(start));
    return parts.map(p => p.trim()).filter(p => p.length > 0);
}
