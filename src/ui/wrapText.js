// Canvas word wrapping with a grapheme fallback for CJK and long words.
// Combining accents and joined characters never get split between lines.
const NO_LINE_START = new Set([...'，。、！？：；）」』》〉】…—％,.!?:;)%']);

export function wrapUiText(text, object) {
    const width = object.style.wordWrapWidth;
    if (!width) return text;
    const context = object.context;
    const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
    const graphemes = value => segmenter ? [...segmenter.segment(value)].map(part => part.segment) : [...value];
    return String(text).split('\n').map(paragraph => {
        const lines = [];
        let line = '';
        for (const word of paragraph.split(/(\s+)/u)) {
            if (!word) continue;
            if (context.measureText(line + word).width <= width) { line += word; continue; }
            if (line.trim()) { lines.push(line.trimEnd()); line = ''; }
            if (!word.trim()) continue;
            if (context.measureText(word).width <= width) { line = word; continue; }
            for (const glyph of graphemes(word)) {
                // Chinese and Japanese never start a line with closing punctuation:
                // "，" or "。" stays on the line it ends, even a hair over the width.
                if (line && !NO_LINE_START.has(glyph) && context.measureText(line + glyph).width > width) { lines.push(line); line = ''; }
                line += glyph;
            }
        }
        lines.push(line.trimEnd());
        return lines.join('\n');
    }).join('\n');
}
