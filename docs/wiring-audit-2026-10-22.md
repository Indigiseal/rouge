# Wiring and mechanics audit — 22 October 2026

This is an audit of the current working tree. No gameplay, art or sound wiring
was changed during the audit. Some files changed in other work while this chat
was active; findings below describe the files currently on disk.

## Verification

- All 33 configured `test:` scripts passed, including each location, inventory
  transactions, Codex, amulets, save-related regression cases and simulator hits.
- All 402 registered asset entries resolve to existing files, including auxiliary
  atlas/font files. This establishes file presence, not visual or listening approval.
- Reproduced the fire-gem and simulator-merge gaps below against current code.
- Evidence: `output/qa-wiring-audit/tests.json`, `assets.json`,
  `reproductions.json` and `sheet-grid.json`.
- This pass did not visually play through the browser game or establish balance.

## Confirmed behavior gaps

### Fire gems do not hit the whole board

`src/systems/board/BoardCombat.js` (`applyWeaponGemEffect`, around lines 913–932)
still gates splash by nearest-edge distance. The base radius from
`src/content/cards/gems.js` is 59 pixels. Hidden enemies inside the radius do
take damage; distant enemies do not. This conflicts with Taya's stated fire
identity: hit every enemy, including face-down enemies.

Reproduction: three enemy cards at x=100, 155 and 380, all y=100. A one-shard
fire-gem hit on card 0 attempts 3 fire damage on cards 0 and 1, but none on the
distant face-down card 2. Scorched Land is separate and already targets the board.

Making fire gems board-wide would also make Emberstone's existing x1.5 splash
radius bonus redundant. Its replacement effect needs a design decision; do not
silently choose a new amulet effect while fixing fire targeting.

### Simulator equipment merges lose build properties

`sim/balance-sim.js` (`mergeWeapons`, around line 1145) generates a new catalog
weapon and transfers its primary gem, but does not carry sigils or Reliquary
enchantments. The second Twin Socket gem is also not copied. `mergeArmor`
likewise does not copy sigils. Live merging in
`src/systems/inventory/CardMergeRules.js` preserves these properties.

Reproduction using the simulator's current weapon merge function: merge a
common Growth sword enchanted with Thunderclap and a common Mending sword.
The uncommon result has neither sigils nor an enchantment. This is a simulator
fidelity defect, not evidence that the player's actual merged weapon loses them.
The passing `test:sim-weapon-preservation` tests weapon-selection policy, not
these merge functions. New-build balance comparisons need this corrected first.

## Assets and content not connected yet

- **Cloudborn Storm roster:** all six PNGs exist in `assets/art/stormhatch/`,
  but are not registered as game art. Storm still uses Rain Mite, Storm Boar,
  Storm Ram, Cliff Gull, Thunder Crow and Tempest Roc with placeholder art.
  The proposed Flying mechanic is not implemented. This art-review pass did not
  replace the roster or approve final gameplay numbers.
- **Storm death previews:** six `Death_Cloudborn*.mp3` / `Death_Lightning*.mp3`
  / `Death_Storm*.mp3` files are present and registered through
  `src/content/audio/enemyDeathSounds.js`. They preload but have no matching
  active enemy definitions, so current Storm encounters do not play them.
  Taya requested listening approval before combat wiring. A future Storm Archon
  boss needs boss-specific lookup support: the current death resolver only
  reads `enemyType`, whereas boss identity uses `bossId`.
- **Unique death audio:** the five current Frost monsters, five desert monsters,
  five old Storm monsters and two Crystal Lair spiders have no per-kind entry
  in the death catalog. They use the shared death fallback. Attack sounds are
  also shared rather than a unique voice/attack cue per enemy.
- **Desert art:** all five creatures and Sandscale Chieftain use placeholder
  art. Bog Mermaid still uses Mire Bride idle/attack artwork.
- **Room presentation:** Storm, Frost and desert use the default stone backdrop;
  Storm/desert have fallback doors. Frost's animated door is connected. Several
  boards remain shared by design until their own art is supplied.
- **Sigils and spells:** new mechanics are implemented, but many icon, glowing
  spell-face and stamp assignments remain provisional. Silkdeep still borrows
  the cobra stamp instead of a spider. Thornwake uses the existing deer pending
  thorned antlers. Frost/Storm/desert also reuse existing stamps.

## Deliberately unfinished design

- Summon Mimic works as a spell, but is not in `WEAPON_ENCHANTS`, so it is not
  among the Reliquary's five enchanting choices. Its enchantment rule remains
  undecided; this is not an accidentally disconnected approved effect.
- Boneflood's weapon-transformation amulet is explicitly deferred.
- A dedicated maximum-AP sigil, placements/retirement for Honed, Crushing, Keen
  and Combo, and parked Rally remain design decisions. Sandglass Scarab already
  provides the approved food-based maximum-AP amulet effect.
- No new poison/lightning immunity should be inferred from creature themes.

## Minor asset observations

Two sheets contain spare pixels outside their declared cells:
`gamingBoardSIdewaysSmall.png` is 417x144 for 208x144 cells, and
`optionsButtonUpDown32x32.png` is 64x34 for 32x32 cells. The full declared frames
fit; these remainders alone do not demonstrate a broken frame or justify an edit.

Recommended order: settle Emberstone alongside board-wide fire targeting;
correct simulator merge fidelity; review Storm art/audio before connecting the
Cloudborn roster; then finish placeholder art and browser playtesting.
