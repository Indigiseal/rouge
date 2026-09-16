"""Build self-hosted, licensed fonts from the translation corpus.

python tools/build-ui-fonts.py   (requires fonttools and brotli)
Downloads upstream sources into the OS temp cache. Re-run when translations
change. CJK subsets preserve shaping tables and include English plus the entire
locale corpus, not a hand-picked alphabet. Runtime downloads no third-party fonts.
"""
import hashlib
import json
import pathlib
import subprocess
import tempfile
import urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/fonts/ui'
CACHE = pathlib.Path(tempfile.gettempdir()) / 'rouge-font-sources'
OUT.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)
DATA = json.loads(subprocess.check_output(['node', str(ROOT / 'tools/font-corpus.mjs')], text=True, encoding='utf-8'))
BASE = 'https://raw.githubusercontent.com/google/fonts/main/ofl/'
manifest = {'fonts': {}, 'locales': {}}

def download(folder, filename):
    destination = CACHE / (folder + '-' + filename)
    if not destination.exists():
        url = BASE + folder + '/' + urllib.request.quote(filename)
        print('Download', folder, filename, flush=True)
        urllib.request.urlretrieve(url, destination)
    return destination

def build(folder, filename, name, weight, chars=None, source=None):
    font = TTFont(source or download(folder, filename))
    if 'fvar' in font:
        axes = {'wght': weight}
        if any(axis.axisTag == 'wdth' for axis in font['fvar'].axes): axes['wdth'] = 100
        font = instantiateVariableFont(font, axes, inplace=True)
    if chars is not None:
        options = subset.Options()
        options.layout_features = ['*']
        sub = subset.Subsetter(options=options)
        sub.populate(unicodes=chars)
        sub.subset(font)
    codes = sorted(font.getBestCmap())
    font.flavor = 'woff2'
    path = OUT / (name + '.woff2')
    font.save(path)
    manifest['fonts'][name] = {'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'codepoints': codes}
    print('Built', path.name, path.stat().st_size, flush=True)

# Preserve broad European-script coverage for new copy and dynamic item names.
for weight in (600, 700):
    build('notosans', 'NotoSans[wdth,wght].ttf', 'feedback-' + str(weight), weight)
build('notosanssymbols2', 'NotoSansSymbols2-Regular.ttf', 'symbols', 400)
build('notoemoji', 'NotoEmoji[wght].ttf', 'icons', 400,
      {ord(c) for texts in DATA['corpus'].values() for text in texts for c in text})
build('', '', 'reading-500', 500, source=ROOT / 'assets/fonts/EB_Garamond/static/EBGaramond-Medium.ttf')
for suffix, locale in [('jp', 'ja'), ('sc', 'zh'), ('tc', 'zh-tw'), ('kr', 'ko')]:
    content = ''.join(DATA['corpus'].get(locale, []) + DATA['corpus']['en'])
    chars = {ord(c) for c in content} | set(range(32, 127))
    for role, family, weights in [('feedback', 'Sans', (600, 700)), ('reading', 'Serif', (500,))]:
        folder = 'noto' + family.lower() + suffix
        for weight in weights:
            build(folder, 'Noto' + family + suffix.upper() + '[wght].ttf', f'{role}-{suffix}-{weight}', weight, chars)
        (OUT / (folder + '-OFL.txt')).write_bytes(download(folder, 'OFL.txt').read_bytes())
    manifest['locales'][locale] = suffix
for folder in ['notosans', 'notosanssymbols2', 'notoemoji']:
    (OUT / (folder + '-OFL.txt')).write_bytes(download(folder, 'OFL.txt').read_bytes())
(OUT / 'ebgaramond-OFL.txt').write_bytes((ROOT / 'assets/fonts/EB_Garamond/OFL.txt').read_bytes())
(OUT / 'coverage.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
