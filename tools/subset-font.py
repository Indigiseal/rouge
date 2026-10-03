# -*- coding: utf-8 -*-
"""Cut a full font down to the characters this game can display.

EB Garamond ships as 14 files / 6 MB (every weight, italics, variable). We use
one weight, and of that weight we use Latin and Cyrillic — the rest is dead
payload every player would download. This produces a woff2 of ~33 KB.

Run after adding a language, or after adding strings in a script the ranges
below don't already cover:

    python tools/subset-font.py

Needs: pip install fonttools brotli
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC = os.path.join(ROOT, 'assets', 'fonts', 'EB_Garamond', 'static')
OUT_DIR = os.path.join(ROOT, 'assets', 'fonts')
# Medium is what the game references. SemiBold is built alongside it so the
# weight can be swapped by changing one src line in index.html — only the
# weight named there is ever downloaded.
WEIGHTS = ['Medium', 'SemiBold']

# Whole blocks rather than just the characters in the string tables today, so a
# newly written line can't land on a glyph that was trimmed out.
RANGES = ','.join([
    'U+0020-007E',   # ASCII
    'U+00A0-00FF',   # Spanish: ¿ ¡ á é í ó ú ñ and the rest of Latin-1
    'U+0100-017F',   # Latin Extended-A — headroom for fr/de/pl
    'U+0400-045F',   # Cyrillic
    'U+0490-0491',   # Ukrainian ґ
    'U+2010-2027',   # – — ‘ ’ “ ” … ·
    'U+2030-205E',   # ‰ ‹ › and misc punctuation
    'U+00D7,U+00B7,U+2022,U+2190,U+2192,U+2264,U+2265',
])


def build(weight, flavor, ext):
    src = os.path.join(STATIC, 'EBGaramond-%s.ttf' % weight)
    out = os.path.join(OUT_DIR, 'EBGaramond-%s-subset%s' % (weight, ext))
    cmd = [sys.executable, '-m', 'fontTools.subset', src,
           '--unicodes=' + RANGES,
           '--layout-features=kern,liga,ccmp,locl',
           '--no-hinting',
           '--desubroutinize',
           '--drop-tables+=DSIG',
           '--output-file=' + out]
    if flavor:
        cmd.append('--flavor=' + flavor)
    subprocess.run(cmd, check=True)
    return out


for weight in WEIGHTS:
    src = os.path.join(STATIC, 'EBGaramond-%s.ttf' % weight)
    if not os.path.exists(src):
        sys.exit('source font not found: %s' % src)
    print('source  %8.1f KB  %s' % (os.path.getsize(src) / 1024, os.path.basename(src)))
    for flavor, ext in [('woff2', '.woff2'), (None, '.ttf')]:
        out = build(weight, flavor, ext)
        print('built   %8.1f KB  %s' % (os.path.getsize(out) / 1024, os.path.basename(out)))
