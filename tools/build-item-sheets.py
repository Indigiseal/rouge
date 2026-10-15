# tools/build-item-sheets.py
# Packs the individual weapon and armor card images into two sprite sheets the
# game loads instead of forty separate files:
#
#   assets/art/weaponsSheet.png + .json   5 rows (dagger, bow, sword, spear, axe)
#   assets/art/armorSheet.png  + .json    3 rows (leather, chain, plate)
#
# Columns are rarity, left to right: common, uncommon, rare, epic, legendary.
# Each .json is a Phaser "JSON hash" atlas naming every frame by its texture
# key (sword_C, chain_L...), the keys the card data already uses; the game
# cuts the sheets back into those textures at boot (content/assets/itemSheets.js).
#
# The single images are the source to draw in. They live in
# assets/_masters/items/ (kept out of git and the itch zip, like the .aseprite
# files); the game only ever loads the two sheets. After editing one, rebuild:
#   python tools/build-item-sheets.py
#
# Each image keeps its own size (most are 53x70, a few 54x70) in a 54x70 cell,
# with a 2px transparent gutter so neighbours can never bleed into each other.

import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'assets', 'art')                 # where the sheets go
SOURCES = os.path.join(ROOT, 'assets', '_masters', 'items')  # the single images
CELL_W, CELL_H, GUTTER = 54, 70, 2
RARITIES = ['C', 'U', 'R', 'E', 'L']

# Texture key -> source file, row by row. The file names are irregular
# (dagger_c vs sword_C, leatherCommon), so they are listed rather than derived.
SHEETS = {
    'weaponsSheet': [
        ['dagger_C:dagger_c', 'dagger_U:dagger_u', 'dagger_R:dagger_r', 'dagger_E:dagger_e', 'dagger_L:dagger_l'],
        ['bow_c:bow_c', 'bow_U:bow_U', 'bow_R:bow_R', 'bow_E:bow_E', 'bow_L:bow_L'],
        ['sword_C:sword_C', 'sword_U:sword_u', 'sword_R:sword_R', 'sword_E:sword_E', 'sword_L:sword_L'],
        ['spear_C:spear_c', 'spear_U:spear_u', 'spear_R:spear_R', 'spear_E:spear_E', 'spear_L:spear_L'],
        ['axe_C:axe_C', 'axe_U:axe_U', 'axe_R:axe_R', 'axe_E:axe_E', 'axe_L:axe_L'],
    ],
    'armorSheet': [
        ['leather_C:leatherCommon', 'leather_U:leather_U', 'leather_R:leather_R', 'leather_E:leather_E', 'leather_L:leather_L'],
        ['chain_C:chain_C', 'chain_U:chain_U', 'chain_R:chain_R', 'chain_E:chain_E', 'chain_L:chain_L'],
        ['plate_C:plate_C', 'plate_U:plate_U', 'plate_R:plate_R', 'plate_E:plate_E', 'plate_L:plate_L'],
    ],
}


def build(name, rows):
    cols = max(len(r) for r in rows)
    width = GUTTER + cols * (CELL_W + GUTTER)
    height = GUTTER + len(rows) * (CELL_H + GUTTER)
    sheet = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    frames = {}
    for r, row in enumerate(rows):
        for c, entry in enumerate(row):
            key, file = entry.split(':')
            img = Image.open(os.path.join(SOURCES, file + '.png')).convert('RGBA')
            if img.width > CELL_W or img.height > CELL_H:
                raise SystemExit(f'{file}.png is {img.size}, bigger than the {CELL_W}x{CELL_H} cell')
            x = GUTTER + c * (CELL_W + GUTTER)
            y = GUTTER + r * (CELL_H + GUTTER)
            sheet.paste(img, (x, y))
            frames[key] = {
                'frame': {'x': x, 'y': y, 'w': img.width, 'h': img.height},
                'rotated': False,
                'trimmed': False,
                'spriteSourceSize': {'x': 0, 'y': 0, 'w': img.width, 'h': img.height},
                'sourceSize': {'w': img.width, 'h': img.height},
            }
    sheet.save(os.path.join(ART, name + '.png'))
    atlas = {
        'frames': frames,
        'meta': {'image': name + '.png', 'size': {'w': width, 'h': height}, 'scale': '1',
                 'app': 'tools/build-item-sheets.py'},
    }
    with open(os.path.join(ART, name + '.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(atlas, f, indent=1)
    print(f'{name}.png  {width}x{height}  {len(frames)} frames')


for sheet_name, sheet_rows in SHEETS.items():
    build(sheet_name, sheet_rows)
