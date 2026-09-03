// Audit every .width/.height read in src/ and flag the ones that resolve to a
// camera, the scale manager, the canvas or the game config — i.e. anything that
// now returns device pixels (1280x720) where the code wants world units (640x360).
//
// The last sweep used one regex and missed `cam?.width`. This one finds the
// variables first, then looks for reads on them.
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'src');
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})(ROOT);

// Anything assigned from a viewport-sized source.
const SOURCE = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*(?:cameras\s*\??\.\s*main|\.scale\b|\.canvas\b|game\s*\??\.\s*config|renderer)/;

let findings = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');

  // variables in this file that hold a viewport-sized object
  const vars = new Set();
  for (const l of lines) {
    const m = l.match(SOURCE);
    if (m) vars.add(m[1]);
  }
  // plus the direct forms
  const direct = /(?:cameras\s*\??\.\s*main|this\.scale|scene\.scale|\.canvas|game\s*\??\.\s*config)\s*\??\.\s*(?:width|height)\b/;

  lines.forEach((l, i) => {
    if (l.trimStart().startsWith('//') || l.trimStart().startsWith('*')) return;
    let hit = direct.test(l);
    for (const v of vars) {
      if (new RegExp(`\\b${v}\\s*\\??\\.\\s*(?:width|height)\\b`).test(l)) hit = true;
    }
    if (hit) {
      // cameraWorldSize() is the sanctioned way to ask
      if (/cameraWorldSize/.test(l)) return;
      findings++;
      console.log(`${path.relative(ROOT, f).replace(/\\/g, '/')}:${i + 1}  ${l.trim()}`);
    }
  });
}
console.log(findings ? `\n${findings} unconverted viewport read(s)` : '\nclean: every viewport read goes through cameraWorldSize()');
