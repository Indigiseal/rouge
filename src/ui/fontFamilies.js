// Shared by the renderer and the font coverage audit. Names express UI roles.
export const FEEDBACK_FAMILY = 'UI Feedback';
export const READING_FAMILY = 'UI Serif';
export const SCRIPT_FAMILIES = { ja: 'jp', zh: 'sc', 'zh-cn': 'sc', 'zh-hans': 'sc', 'zh-tw': 'tc', 'zh-hant': 'tc', ko: 'kr' };

export function fontFamily(role = 'feedback', locale = 'en') {
    const family = role === 'reading' ? READING_FAMILY : FEEDBACK_FAMILY;
    const script = SCRIPT_FAMILIES[String(locale).toLowerCase()];
    return [`"${family}"`, ...(script ? [`"${family} ${script}"`] : []),
        '"UI Symbols"', '"UI Icons"', ...(role === 'feedback' ? ['"UI Serif"'] : []),
        role === 'reading' ? 'serif' : 'sans-serif'].join(', ');
}

export async function loadUiFonts(locale = 'en') {
    if (typeof document === 'undefined' || !document.fonts) return;
    const script = SCRIPT_FAMILIES[String(locale).toLowerCase()];
    const sample = ({ jp: '攻撃', sc: '攻击', tc: '攻擊', kr: '공격' })[script] || 'Damage';
    await Promise.all([
        document.fonts.load(`500 16px "${READING_FAMILY}"`),
        document.fonts.load(`600 16px "${FEEDBACK_FAMILY}"`),
        document.fonts.load(`700 16px "${FEEDBACK_FAMILY}"`),
        document.fonts.load('16px "UI Symbols"', '✓'),
        document.fonts.load('16px "UI Icons"', '⚔'),
        ...(script ? [
            document.fonts.load(`500 16px "${READING_FAMILY} ${script}"`, sample),
            document.fonts.load(`600 16px "${FEEDBACK_FAMILY} ${script}"`, sample),
            document.fonts.load(`700 16px "${FEEDBACK_FAMILY} ${script}"`, sample),
        ] : []),
    ]);
}
