# Magic card sheets

- Original spell art, collected for comparison: `magicCardsOriginalSheet.png`
- Hand-painted normal spell cards: `magicCardsOriginalSheet1.png`
- Hand-painted glowing Reliquary cards: `glowingMagicCardsSheetNew1.png`
- Previous generated sheet, kept for comparison: `glowingMagicCardsSheetNew.png`

The original spells were individual PNGs (`magicBallCard.png`, `forzenRing.png`,
etc.); all nine remain unchanged. The comparison sheet copies them into the
same positions as the new sheet, leaving unused frame 2 blank.
`glowingMagicCardsSheet.png` is the separate, unchanged Reliquary glow sheet;
it is not the original regular spell artwork.

Both sheets are 572×138, two rows of eleven 52×69 frames in the same order (frames
count along the first row, then the second), so one frame table serves both
(`MAGIC_CARD_FRAMES` in `WeaponEnchants.js`). Normal art loads at
native size into the existing 52×70 card textures with one transparent bottom
row. The comparison sheets are 520×70. Edit the active PNG directly; there is
no assembly step. The `magicCards` and `glowingMagicCards` entries in
`src/content/assets/AssetManifest.js` select the normal and glowing sheets.

Frame order, left to right:

0. Bone Shield
1. Frost Ring
2. Unused original frame, preserved
3. Fireball
4. Soul Drain
5. Magic Shield
6. Weakness
7. Shadow Blade
8. Smoke Screen
9. Restoration
10. Desert Feast
11. Thunderclap
12. Scorched Land
13. Summon Mimic
14. Venomous Bomb
15. Briar Shield
16-18. Blank faces, unused

Preload exposes the normal sheet's frames
under existing spell texture keys so saved cards remain compatible. Names
are live text; effects and values stay in the spell definitions. Card backs
are separate and unchanged.

Moved out of the live art folder (nothing loads them): `magicCardsOriginalSheet.png`, `glowingMagicCardsSheet.png`,
`glowingMagicCardsSheetNew.png` and `magicBallCard.png` are in `assets/_unused/art/`.
