# Location redesign: remaining work

The first playable roster, boss and local sigil pool are implemented for all ten
locations. All ten can appear in any act, with three choices excluding visited
locations. This is the playable foundation, not final art or balance approval.

The [22 October wiring audit](wiring-audit-2026-10-22.md) records the current
gaps with reproduced evidence: fire gems still have local splash despite the
board-wide design, simulator equipment merges lose build properties, and the
Cloudborn art/death assets are not connected to an active roster. All 33
configured checks passed; they do not cover these behavior gaps.

## Implemented follow-through

- Location magic includes Bone Shield, Briar Shield, Venomous Bomb, Summon Mimic,
  Restoration, the Ash spells, existing Veilbleed spells, Frost Ring,
  Thunderclap and Desert Feast. The Reliquary offers five explained choices.
- Sandglass Scarab reuses Glutton's Charm, grants maximum AP through eating,
  caps at +10 per run, and saves earned cap usage.
- Leadership Banner moves the companion extra-action effect into a rare,
  Thornwake-flavored amulet that can drop anywhere. It gives each companion
  that acted a 10% chance for one extra action, with no chaining and normal
  target, hold and cooldown rules. Its horn art is provisional.
- Warcry and Tandem are retired from new sigil rewards. Existing saved cards
  retain their mechanics and recognizable IDs.
- Goblin's Ransom reuses Monocle at the approved 3% crystal-on-kill chance;
  Goblin's Spyglass carries Scout's 15% safe reveal. Both drop globally.
  Scout/Ransom are retired from new sigil rewards, with legacy weapons preserved.
  Close Order is now Bone Hook, keeping its behavior and stable ID. See
  [the amulet pass](location-amulet-design-pass.md).
- Bone Spool repairs 1 pip on a random remaining damaged item per deliberate
  card discard, including worn armor; Dune Quiver gives bows only +1 damage.
  Both are global uncommon drops with provisional art and focused regression tests.
- The six gem runes now reinforce Ashhowl (Emberstone/Molten Heart), Stormhatch
  (Storm Shard/Tempest Heart) and Silkdeep (Spider Fang/Broodmother's Fang).
  They retain their gem bonuses, art, rarity, drop weights and saved IDs.
- Bog's Mossy Stone grants +1 maximum HP per successful card merge, capped at
  +50 per run, without healing. Both bag and worn-armor merges count; cap usage
  survives Continue and re-equipping. The old Marrow kill-based proposal is replaced.
- Sandspice Pouch carries the desert Feast idea by restoring the retired Travel
  Kitchen's existing +50% food AP effect, rounded down. Its stable ID is retained;
  it drops globally and works with Sandglass Scarab without duplicating its growth.

## Next priorities

1. **Storm story playtesting.** New nest and carnival starts now belong to Storm
   in any act. Fresh nests have no goblin cog/engineer link; old pending stories,
   engineer endings, mother pursuit and rewards are preserved. Verify minigame
   and carnival presentation during human playtesting. See [the story pass](storm-story-design-pass.md).
2. **Amulet follow-through.** The agreed first mechanic pass is implemented.
   Review names/art and playtest the new synergies. Boneflood's weapon-transformation
   amulet is explicitly deferred for later; do not implement it in this pass.
3. **Unsettled sigils/enchantments.** Choose Summon Mimic's Reliquary conversion.
   Frost's Echo is now implemented at the approved 10% half-damage extra-hit rule,
   with no extra AP/pip spent and no chaining. Decide whether Sandreach also needs a dedicated
   maximum-AP sigil beyond its implemented Scarab amulet. Honed, Crushing, Keen
   and Combo still need deliberate placement or retirement; Rally stays parked.
4. **Art and names.** Frost now uses Taya's snow-monster sheet row, with all three
   tier faces, plus the generated Frost Giant idle/attack art and the new ice door.
   The earlier generated winter-animal cards are superseded and no longer loaded.
   Replace generic Storm/desert creatures and bosses,
   Bog Mermaid's temporary art, provisional spell faces/icons/stamps, and room/
   door fallbacks. Confirm final location and creature names. User supplies art.
5. **Human playtesting and balance.** Test all-act difficulty, companion builds,
   control effects, poison/fire stacking, unlimited Growth and food generation.
   Simulator primary/off-hand execution now uses the shared player-sigil hooks,
   verified against live inventory combat. Improve its target forecasts and
   audit merged equipment's sigil/enchantment preservation before using it to
   tune new build synergies. Smoke tests do not establish balance. See the
   [simulator sigil pass](simulator-player-sigil-pass.md).
6. **Visual and save regression pass.** Check actual room presentation, effects,
   hover explanations, full inventory rewards, bosses, save/continue, and act
   transitions in the running game. Focused Node tests already cover the main
   mechanics; final art/layout still needs visual review.

Elemental immunities remain unapproved beyond existing Heatproof. Do not add
new poison/lightning resistance without a playtest decision.
