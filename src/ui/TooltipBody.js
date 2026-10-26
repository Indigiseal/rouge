// A tooltip's body text with each sigil's name in colour, so a card with a lot
// of text still shows its sigils at a glance (Taya).
//
// A sigil line reads "Name: rule" (sigilLine). One Phaser Text holds a single
// colour, so the body is split: ordinary lines stay together in one text, and
// a sigil line becomes its name, coloured, on a line of its own, then its rule
// under it in the body colour. The lines themselves are not changed, only how
// they are drawn.

import { SIGILS } from '../content/sigils/sigils.js';
import { getGameLanguage, translateItemName } from '../i18n/i18n.js';

// A deep violet that reads on the light tooltip panel next to the body ink.
export const SIGIL_NAME_COLOR = '#7a3a9e';
const GAP = 1;

// Built once per language: every tooltip asks for them.
const namesByLanguage = new Map();

function sigilNames(scene) {
    const language = scene ? getGameLanguage(scene) : '';
    if (namesByLanguage.has(language)) return namesByLanguage.get(language);
    const names = new Set();
    for (const sigil of Object.values(SIGILS)) {
        if (sigil?.name) names.add(scene ? translateItemName(scene, sigil.name) : sigil.name);
    }
    // Longest first, so "Venom Stacking" wins over "Venom".
    const sorted = [...names].sort((a, b) => b.length - a.length);
    namesByLanguage.set(language, sorted);
    return sorted;
}

/** { name, rule } when `line` is a sigil line ("Name: rule" or "Name 2: rule"), else null. */
export function splitSigilLine(line, names) {
    for (const name of names) {
        if (!line.startsWith(name)) continue;
        const match = line.slice(name.length).match(/^( \d+)?\s?:\s*(.*)$/s);
        if (match) return { name: `${name}${match[1] || ''}`, rule: match[2] };
    }
    return null;
}

/**
 * The body as text objects stacked from y = 0, each at x = 0, unparented.
 * Returns { parts, width, height }; the caller places them (left or centred).
 */
export function buildTooltipBody(scene, body, style, { lineGap = GAP } = {}) {
    const names = sigilNames(scene);
    const parts = [];
    let y = 0;
    let run = [];
    const add = (text, extra = {}) => {
        const obj = scene.add.text(0, y, text, { ...style, ...extra }).setOrigin(0, 0);
        parts.push(obj);
        y += Math.ceil(obj.height) + lineGap;
    };
    const flush = () => {
        if (run.length) add(run.join('\n'));
        run = [];
    };
    for (const line of String(body ?? '').split('\n')) {
        const sigil = splitSigilLine(line, names);
        if (!sigil) { run.push(line); continue; }
        flush();
        add(sigil.name, { fill: SIGIL_NAME_COLOR });
        if (sigil.rule) add(sigil.rule);
    }
    flush();
    const width = Math.ceil(Math.max(0, ...parts.map((p) => p.width)));
    return { parts, width, height: Math.max(0, y - lineGap) };
}
