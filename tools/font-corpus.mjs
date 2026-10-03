// Translation corpus shared by the font builder and coverage audit.
import fs from 'node:fs';
import vm from 'node:vm';

export function fontCorpus() {
  const source = fs.readFileSync(new URL('../src/i18n/i18n.js', import.meta.url), 'utf8')
    .replace(/export\s+(?=(const|function|class))/g, '');
  const names = [...source.matchAll(/const (\w*(?:STRINGS|TRANSLATIONS|ADDITIONS))\s*=/g)].map(m => m[1]);
  const context = {};
  vm.runInNewContext(`${source}\n globalThis.tables = [${names.join(',')}]; globalThis.supported = SUPPORTED_LANGUAGES;`, context);
  const corpus = {};
  const strings = value => typeof value === 'string' ? [value]
    : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
  for (const table of context.tables) {
    for (const [locale, values] of Object.entries(table)) {
      if (!/^[a-z]{2}(?:-[A-Za-z]+)?$/.test(locale)) continue;
      (corpus[locale] ||= []).push(...strings(values));
    }
  }
  // Regression specimens: accents, combining marks, CJK punctuation and dense glyphs.
  const specimens = {
    en: '0123456789 −+×%!? … → ← ≤ ≥ ✓ ⚔ ◄ ► œ Œ é e\u0301',
    ja: '日本語 攻撃 会心 回避 無効 毒 回復 龍 鬱 −30！',
    zh: '简体中文 攻击 暴击 闪避 免疫 中毒 治疗 龙 龘 −30！',
    'zh-tw': '繁體中文 攻擊 暴擊 閃避 免疫 中毒 治療 龍 龘 −30！',
    ko: '한국어 공격 치명타 회피 면역 독 회복 −30!',
  };
  for (const [locale, specimen] of Object.entries(specimens)) (corpus[locale] ||= []).push(specimen);
  return { corpus, supported: Array.from(context.supported) };
}

if (process.argv[1]?.endsWith('font-corpus.mjs')) console.log(JSON.stringify(fontCorpus()));
