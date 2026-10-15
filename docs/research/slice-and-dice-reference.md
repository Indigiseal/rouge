# Slice & Dice — abilities reference and what we could borrow

Research for mixing and matching abilities (amulets, enemies, heroes) in our
game. Data: the community wiki at minmax.wiki (CC-BY-SA), crawled 2026-10-14:
**83 keywords, 60 monsters, 102 heroes, 355 items**. Full tables are at the
end of this file. Slice & Dice is by tann (code) and a3um (art).

## How their system fits together

Everything in Slice & Dice is a **die with six sides**. A side is a base
action (damage, shield, heal, mana, summon, blank) plus a number, plus
**keywords** that change how it behaves. Items, heroes and monsters all speak
that one language, which is what makes their mix-and-match work:

- **Heroes** are dice. Five colours act as classes: Yellow fighters (damage,
  Pain, Cleave, Bloodlust, Steel), Grey defenders (shields, Repel, Cleanse),
  Orange rogues (Ranged, Poison, Cruel, Cantrip), Blue mages (mana, Charged,
  Growth), Red healers (heal, Vitality, Regen, Revive).
- **Items** (their amulets) almost never add a new rule. They edit a die:
  90 items **add a keyword to a side**, 104 **replace a side**, 56 give a
  **flat +N** to some sides. A few copy other items, and 9 only work for one
  colour of hero.
- **Monsters** are dice too, but their identity comes from a **trait**: a
  rule printed on the monster (Regen, Split, Spiky, Flees if alone...).

## Patterns worth stealing

### 1. Keywords as modifiers that weapons, amulets and enemies share

Our weapons have one special each (cleave, pierce, dual wield...). Their
keywords would let an amulet, gem, anvil upgrade or event bolt a *condition*
onto any weapon. The best fits for a card game where each weapon drag is one
action:

- **Conditional doubles** — the simplest and most readable:
  Engage (x2 vs full-hp target), Cruel (x2 vs half hp or less),
  Terminal (x2 vs 1 hp), Pristine (x2 if you are on full hp),
  Deathwish (x2 if you are dying this turn), Underdog / Overdog (x2 if the
  target has more / less hp than you), Duel (x2 vs a target attacking you).
- **Sequencing** — makes the *order* you play cards matter:
  Focus (x2 vs the target of the previous action), Chain (x2 if this shares
  a keyword with the previous action), Pair / Triple (same value as the last
  one or two), Echo (copy the previous value), Copycat (copy the previous
  keywords), Inspired (x2 if the previous one was higher).
- **Scaling** — grows over a fight or reads your state:
  Growth (+1 after each use this fight), Decay (-1 after use), Era (+1 each
  turn), Bloodlust (+1 per damaged enemy), Steel (+ your current shield —
  for us, armor), Flesh (+ your current hp), Hoard (+ empty item slots — for
  us, empty bag slots), Vigil (+1 per fallen ally — for us, per used-up card).
- **Costs and limits** — power with a price:
  Pain (you take N), Exert (blank next turn), Single-use (gone after use
  this fight), Death (you die — on a monster's side it is a self-destruct),
  Mandatory (must be used if possible).

A sketch: *Executioner's Ring — your daggers gain Terminal.* *Whetstone
Charm — swords gain Focus.* *Hoarder's Belt — axes gain +1 per empty bag
slot.* The amulet stays one line, but the weapon you drag changes.

### 2. Cursed items — strong upside, forced downside

16 items have negative tiers and "Must be equipped": Glass Helm (+3 max hp,
death is permanent), Martyr (+1 and Death on two sides), Coiled Snake (start
poisoned), Handcuffs (-1 item slot), Lead Weight (two sides become blank),
Soul Link (when an ally dies, you die). Several *events* hand them out as the
price of something good.

For us: **cursed amulets** from events and elite chests. A big effect with a
lasting cost (take 1 damage each floor, -1 bag slot, can't use potions,
one weapon type deals half), that only a later event or a rare item removes.

### 3. Monster traits — the richest part of their design

Their 60 monsters reuse a handful of dice and get their character from one
trait. Grouped by idea, with what each could become on our board:

- **Hp thresholds** (the trait fires when hp crosses a number):
  Split (Slimer: summons a Slimelet at hp 5 and 2), Provoke (Ogre: +1 to
  all sides at hp 8 and 3), Ethereal (Ghost: immune for the rest of the turn
  at hp 4), Blind (Cyclops: stunned at hp 8), Concentration (Wizz: stunned
  at hp 4), Flames (Agnes/Gytha/Magrat: a free hit on one lane at hp 3),
  Devour (Tarantus: kills a hero at hp 10).
  → Gives a boss or elite phases with no new systems: "at half health,
  summons two spiders", "below 5 hp, becomes immune for a turn".
- **Damage rules** (how it can be hurt):
  Tough (each listed hp point must be removed separately — caps big hits),
  Rotting (dies to any single hit of 4+), Hydra (dies if hit 5 times in a
  turn), Chip (the first 1-damage hit is doubled), Armour 1 (-1 damage from
  every hit), Refractive (immune to spells).
  → Puzzles each weapon answers differently: Tough rewards dual wield and
  lightning hops; Rotting rewards one heavy axe swing.
- **Retaliation** (punishes the attacker):
  Spiky N (attacker takes N), Hellfire (6 back while above hp 5),
  Petrify (turns the side that hit it to stone), Pain Mirror (attacker takes
  what it dealt), Tr0lled (attacker dies if it hits for 4+).
  → We have thorns retaliate; "petrify" maps neatly to our web/ink lock —
  the weapon that hits it gets locked.
- **Fleeing** — Chest (flees at end of turn, drops an item if killed — our
  Mimic), Goblin (flees if alone), Bandit (Mercenary: flees if a neighbour is
  overkilled by 2+). Cheap tension: kill it fast or lose the reward.
- **Death effects that hit their own side** — Bones (1 damage to adjacent
  allies when it dies), Barrel (5 damage to adjacent allies). On our grid
  board this is a natural fit: *kill the barrel next to the troll*.
- **Auras** — Warchief (all monsters +1), Bramble (all heroes' sides become
  single-use), Rotten (heroes lose 1 max hp each turn), Bell (each turn 1
  damage to all heroes and 5 to itself — a race), The Hand (gives the heroes
  +1, a boss that powers you up).
- **Targeting** — Eliminate (always hits the lowest-hp target), Heavy (the
  highest), Back-row (starts out of reach), Flanking / Descend (hit
  neighbours). On our board: an archer that only shoots your weakest card,
  a brute that always breaks your best armour first.

### 4. What maps directly onto our cards

| Slice & Dice | Ours |
|---|---|
| hero dice sides | weapon / armor / magic cards |
| keywords on a side | weapon specials, gem effects, enchants |
| items editing sides | amulets, gems, the anvil, the Reliquary |
| shields (Steel, Repel) | armor protection |
| monster traits | enemy `features` / `abilities` |
| cursed items | (none yet) |
| hero colours | character classes |

We already have several of their ideas: Cleave (sword), Poison, Regen
(Troll-like), Summon, Thorns/Spiky, the fleeing Chest (Mimic), back-row
(frontline gate), Taunt, Rage (Provoke-like), web/ink (Petrify-like).
**New to us:** sequencing keywords, conditional doubles, scaling keywords,
cursed items, hp-threshold phases, death effects on neighbours, auras, and
lowest- / highest-hp targeting.

### Suggested first steps

1. Give weapons one **keyword slot** that amulets, gems or the anvil fill,
   starting with 4–5 easy ones: Cruel, Engage, Terminal, Focus, Growth.
2. Add 2–3 **cursed amulets** from events, each with a clear cost.
3. Give enemies **one trait each** from the groups above. Barrel, Bones,
   Split and Tough are the cheapest to build on our board and the easiest
   to read.

---

## All keywords (83)

| Keyword | Effect |
|---|---|
| Alliteration | x2 vs targets with the same first letter as me (Case-sensitive). |
| Bloodlust | Bonus equal to the number of damaged enemies. |
| Boost | Target gets +N to all sides this turn. |
| Cantrip | Activates during rolling if it lands face-up(Whilst rolling dice, if this side lands face-up, it gets used instantly without taking up that hero's turn. Target chosen randomly. If you have a cantrip heal/shield, it will only target heroes who are missing hp/ taking damage. You can still reroll it and use it as normal). |
| Chain | x2 if this shares a keyword with the previously-used dice this turn. |
| Channel | Costs -1 mana each time it is cast (minimum 1). |
| Charged | Bonus equal to your current mana. |
| Cleanse | Reduce negative effects by N (poisoned, weakened, petrified and inflicted) (Can cleanse incoming negative effects. Always cleanse current negative effects before incoming negative effects). |
| Cleave | Also hits both sides of the target (Can be used to hit enemies in the back row indirectly). |
| Cooldown | Can only be cast once each turn. |
| Copycat | Copies the keywords from the last-used dice face this turn. |
| Cruel | x2 vs targets on half or less hp (Also works when targeting allies). |
| Death | you die. |
| Deathwish | x2 if you are dying this turn (Dying heroes flash red). |
| Decay | Gets -1 this fight after use. |
| Deplete | Costs +1 mana each time it is cast. |
| Descend | Also hits below the target. |
| Dispel | Remove all traits from the target this fight (Only innate traits). |
| Dog | x2 if you have the same hp as the target. |
| Double-use | Can be used twice in a turn. |
| Drink | Discard all your 'Potion' items permanently. |
| Duel | x2 vs targets who are targeting me. |
| Duplicate | Copy this onto all allied sides this turn. |
| Echo | Copy the value of previously-used dice this turn. |
| Ego | x2 if you target yourself. |
| Eliminate | Target must have the least hp (If a monster side has this, they include incoming damage in their calculations (and their target sare locked)). |
| Enduring | Keywords remain when the side is changed (if possible). |
| Engage | x2 vs targets on full hp. |
| Era | +1 at the end of each turn. |
| Exert | Replace all sides with blanks (exerted) until the end of next turn. |
| Flanking | Hits the top and bottom targets. |
| Flesh | Bonus equal to your current hp. |
| Focus | x2 vs the target of the previously-used dice this turn. |
| Future | Effect is delayed until the start of next turn. |
| Growth | Gets +1 this fight after use. |
| Heavy | Target must have the most hp(If a monster has this, they include incoming damage in their calculations (and their targetsare locked)). |
| Hoard | Bonus equal to the number of unequipped items you have. |
| Inflict-death | Add death to target's sides for a turn (Can be cleansed. If a monster has this, then the inflicted-death status lasts until the end of next turn or cleansed). |
| Inflict-decay | Add decay to target's sides for a turn (Can be cleansed. If a monster has this, then the inflicted-decay status lasts until the end of next turn or cleansed). |
| Inflict-pain | Add pain to target's sides for a turn (Can be cleansed. If a monster has this, then the inflicted-pain status lasts until the end of next turn or cleansed). |
| Inflict-single-use | Add single-use to target's sides for a turn (Can be cleansed. If a monster has this, then the inflicted-single-use status lasts until the end of next turn or cleansed). |
| Inspired | x2 if the previously-used dice this turn was higher. |
| Invigorate | +1 for each hp you gained this turn. |
| Mana-cost | Costs N mana. |
| Mana-gain | You also gain N mana. |
| Mandatory | Must be used (if possible). |
| Nothing | This keyword has no effect. |
| Overdog | x2 if you have more hp than the target. |
| Pain | You take N damage (Pain damage can be blocked. Damage is resolved in an order favourable to the player). |
| Pair | x2 if this has the same value as the previously-used dice this turn. |
| Patient | x2 if you didn't use this hero last turn. |
| Perma-boost | Target gets +N to all sides this fight. |
| Petrify | Transforms N sides to stone this fight (Can be cleansed. Lasts until the end of the fight or cleansed. Petrification order: Top, Left, Middle, Right, Rightmost, Bottom). |
| Plague | Bonus equal to the total poison on all characters. |
| Poison | Also inflicts N unblockable damage at the end of each turn (Can be cleansed. You can't prevent yourself from being poisoned except by using cleanse or killing the attacking monster. Lasts until the end of the fight or cleansed). |
| Pristine | x2 if you have full hp. |
| Quad-use | Can be used 4 times in a turn. |
| Quin | x5 if this has the same value as the 4 previously-used dice this turn. |
| Rainbow | Bonus equal to the number of keywords on the side. |
| Rampage | Can be reused if it was lethal(If the rampage side you used causea monster or hero death, you get to use the side again). |
| Ranged | Can target enemies in the back row and avoid on-hit passives. |
| Regen | Also heals for N at the end of each turn. |
| Repel | N damage to all enemies attacking the target. |
| Rescue | This side can be used again if it saves a hero. |
| Rite | +1 for each unused ally, they skip this turn. |
| Self-heal | Also heal yourself for N. |
| Self-shield | Also shield yourself for N. |
| Selfless | Cannot target yourself. |
| Sept | x7 if this has the same value as the 6 previously-used dice this turn. |
| Single-cast | Can only be cast once each fight. |
| Single-use | After you use this side, replace it with a blank (used) this fight. |
| Skill | Bonus equal to hero level. |
| Smith | Target gets +N to damage and shield sides this turn. |
| Spell-rescue | Cost is refunded if it saves a hero. |
| Steel | Bonus equal to this hero's current shields. |
| Sticky | Cannot be rerolled (Can be negated by 'Cannot be locked'). |
| Terminal | x2 vs targets on 1 hp. |
| Triple | x3 if this has the same value as the 2previously-used dice this turn. |
| Underdog | x2 if the target has more hp than you. |
| Vigil | +1 for each defeated ally. |
| Vitality | Also grants the target +N empty max hp this fight. |
| Vulnerable | Target takes +N damage from dice & spells this turn. |
| Weaken | Target gets -N to all sides this turn (Can be cleansed. If a monster has this, then the weaken status lasts until the end of next turn or cleansed). |

## All monsters (60)

| Monster | Size | HP | Trait | Dice sides |
|---|---|---|---|---|
| Archer | Tiny | 2 | Back-row: Starts at the back | 3 damage x2; 2 damage x4 |
| Bones | Tiny | 4 | Bone-shards: 1 damage to adjacent allies upon death | 4 damage x4; 3 damage x2 |
| Caw Egg | Tiny | 4 | - | Summon a caw Death x3; Blank x3 |
| Chest | Tiny | 5 | Riches: Flees at the end of the turn. Drops a t0-t2 item if defeated. Tough (HP 5): this hp must be removed individually | 5 damage x2; 2 damage Petrify x2; Summon a bones x2 |
| Grave | Tiny | 3 | Tough (HP 1,2,3): these hp must be removed individually | Summon a bones x6 |
| Illusion | Tiny | 1 | - | 2 damage Weaken; 1 damage Weaken x3; 1 damage Petrify x2 |
| Imp | Tiny | 4 | Spiky 1: On-hit: damage the attacker for 1 | 4 damage x3; 1 damage Poison x2; Summon a bones |
| Rat | Tiny | 3 | - | 3 damage x4; 2 damage x2 |
| Slimelet | Tiny | 2 | - | 3 damage x4; Blank x2 |
| Sniper | Tiny | 3 | Back-row: Starts at the back | 5 damage x4; 4 damage Eliminate x2 |
| Spider | Tiny | 4 | - | 3 damage x4; 1 damage Poison x2 |
| Thorn | Tiny | 2 | Refractive: Immune to spellsSpiky 5: On-hit: damage the attacker for 5 | 4 damage Eliminate x2; 2 damage Petrify x2; 1 damage Petrify x2 |
| Wisp | Tiny | 5 | Infused (HP 3): +1 mana | 2 damage Inflict-pain x4; Summon a bones x2 |
| Bandit | Hero-sized | 8 | Mercenary: Flees if an adjacent monster is overkilled by 2 or more | 6 damage x2; 5 damage x2; 2 damage Poison; 1 damage Poison |
| Barrel | Hero-sized | 6 | Explode: 5 damage to adjacent allies upon death | Blank x6 |
| Dragon Egg | Hero-sized | 6 | - | Summon a dragon Death x2; Blank x4 |
| Fanatic | Hero-sized | 13 | - | 8 damage Pain x2; 6 damage Pain x2; 4 damage Pain x2 |
| Gnoll | Hero-sized | 3 | Armour 1: Reduce damage taken from spells and dice by 1 | 5 damage Heavy x2; 6 damage Exert x2; 4 damage Heavy x2 |
| Goblin | Hero-sized | 5 | I'm outta here: Flees if alone | 4 damage x2; 3 damage Eliminate x2; 1 damage Cleave x2 |
| Quartz | Hero-sized | 7 | Shatter (HP 3): Dies if this hp is removed and no further | 5 damage, Inflict Single-use x2; 2 damage Weaken x4 |
| Saber | Hero-sized | 10 | - | 12 damage Death; 5 damage x3; 8 damage Exert x2 |
| Snake | Hero-sized | 5 | - | 2 damage Poison x2; 1 damage Poison x4 |
| Sudul | Hero-sized | 6 | - | 2 damage; 1 damage; 4 damage; 3 damage; 5 damage; 6 damage |
| Warchief | Hero-sized | 7 | Commander: All monsters: +1 to all sides | 2 damage x6 |
| Wolf | Hero-sized | 6 | - | 4 damage x2; 3 damage x2; 1 damage Cleave x2 |
| Z0mbie | Hero-sized | 10 | Tr0lled: Attacker dies if I take 4 or more damage in a single attack | 3 damage Cleave x2; 2 damage Poison x2; 2 damage Cleave x2 |
| Zombie | Hero-sized | 10 | Rotting: Dies if takes 4 or more damage in a single attack | 3 damage Cleave x2; 2 damage Poison x2; 2 damage Cleave x2 |
| error | Hero-sized | 5 | - | 3 damage Single-use Cleave Engage   Self-heal Weaken Vulnerable; Blank x3; 153 damage Death; 9 damage Cleave |
| Agnes | Big | 7 | Top Flame (HP 3): 2 damage to the top-most enemy | 1 damage to all enemies x4; Summon a wolf x2 |
| Alpha | Big | 13 | - | 2 damage Cleave x2; 6 damage x2; Summon a wolf x2 |
| Banshee | Big | 10 | Wail: After the first spell each turn is cast, 1 damage to all enemies | 4 damage Weaken x2; 5 damage Descend x2; 3 damage Poison x2 |
| Basilisk | Big | 12 | Petrify: On-hit: turn the attacking side to stone | 2 damage Cleave x3; 2 damage Poison x2; 1 damage Weaken Cleave |
| Boar | Big | 7 | Determination (HP 1): this hp must be removed individually | 4 damage x4; 2 damage Flanking x2 |
| Bramble | Big | 11 | Knotted Bark: All heroes: Add single-use to all sides | 7 damage x2; 3 damage Cleave x2; 2 damage Poison x2 |
| Caw | Big | 7 | Flight: After taking damage for the first time each turn, move back this turn | 7 damage x4; 3 damage Cleave x2 |
| Crone | Big | 6 | Top Spark (HP 3): 2 damage to the top-most enemy | 5 damage Heavy x3; 3 damage Descend x2; 2 damage Poison |
| Cyclops | Big | 15 | Blind (HP 8): Stunned this turn | 3 damage to all enemies x2; 4 damage Cleave x2; 2 damage to all enemies x2 |
| Demon | Big | 12 | Hellfire (HP 5): On-hit: 6 damage to the attacker | 6 damage Inflict-pain x2; 2 damage to all enemies x2; Summon an imp x2 |
| Ghost | Big | 6 | Ethereal (HP 4): Become immune to damage this turn | 6 damage Eliminate x2; 4 damage Descend x2; 2 damage Poison x2 |
| Gytha | Big | 7 | Middle Flame (HP 3): 2 damage to the middle enemy | 7 damage Heavy x4; 1 damage Weaken Cleave x2 |
| Hydra | Big | 20 | 5 heads: Dies if damaged 5 times in a turn | 5 damage Cleave x3; 10 damage x2; 2 damage Weaken Cleave |
| Jinx | Big | 8 | Random curse: A random tier 2 or 3 curse | 3 damage Cleave x2; 2 damage to all enemies x2; Summon 2 bones x2 |
| Magrat | Big | 7 | Bottom Flame (HP 3): 2 damage to the bottom-most enemy | 3 damage Descend x4; 2 damage Poison x2 |
| Ogre | Big | 10 | Provoke (HP 3, 8): +1 to all sides this fight | 1 damage to all enemies x4; 2 damage Cleave x2 |
| Slate | Big | 5 | Tough (HP 1, 2, 3, 4, 5): these hp must be removed individually | 7 damage x4; 2 damage to all enemies x2 |
| Slimer | Big | 7 | Split (HP 2, 5): summon a Slimelet | 2 damage Cleave x4; 3 damage Flanking x2 |
| Spiker | Big | 13 | Spiky 2: On-hit: damage the attacker for 2 | 7 damage x4; 2 damage to all enemies x2 |
| Troll | Big | 15 | Regen 1: Regenerate 1 health at the end of each turn | 3 damage Cleave x3; 2 damage to all enemies x2; 1 damage Cleave Poison |
| Wizz | Big | 5 | Back-row: Starts at the backConcentration (HP 4): Stunned this turn | 4 damage Weaken; Heal 3 to all allies; 2 damage to all enemies x2; Summon 2 bones x2 |
| Baron | Huge | 25 | Mana Glutton (HP 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24): +1 mana | 9 damage Heavy x3; Summon 2 bones x2; 1 damage Poison Cleave |
| Basalt | Huge | 40 | 1: Chip: The first time I take exactly 1 damage, double it to 2, then increase Chip to 2 | 4 damage Weaken Flanking x2; 9 damage Inflict-death x2; Summon a slate x2 |
| Bell | Huge | 25 | Gong: At the end of each turn, 1 damage to all heroes and 5 damage to me | 7 damage Heavy x2; 2 damage Cleave x2; Summon an imp x2 |
| Dragon | Huge | 40 | - | 5 damage to all enemies x2; 15 damage Heavy x2; 3 damage Poison Cleave x2 |
| Hexia | Huge | 30 | Pain Mirror: On-hit: attacker takes equal damage to meMana Burn: Whenever mana is spent, deal that much damage to the bottom hero | 8 damage Descend Inflict-pain x2; 4 damage Petrify x2; Summon a demon x2 |
| Lich | Huge | 20 | Back-row: Starts at the back Living Skeleton every 5th HP(starting at 5): Summon a Bones | 2 damage Petrify x2; Summon 2 bones x2; 1 damage to all enemies Weaken x2 |
| Rotten | Huge | 18 | Plague: All heroes get -1 max hp at the end of each turn (minimum 1) | 6 damage Heavy x2; Summon an imp x2; 1 damage Poison Cleave x2 |
| Slime Queen | Huge | 13 | Split (HP 5, 10): summon a Slimer | 9 damage Heavy; 4 damage Cleave; 5 damage Flanking x2; 3 damage Cleave x2 |
| Tarantus | Huge | 25 | Devour (HP 10): kill the top-most enemy | 12 damage x2; 3 damage Poison Weaken x2; Summon 3 spiders; Summon 2 spiders |
| The Hand | Huge | 40 | Handicap: All heroes: +1 to all sides | 10 damage Petrify; 10 damage Cleave; Summon 3 sabers x2; 7 damage to all enemies; 4 damage Poison Cleave |
| Troll King | Huge | 20 | Regen 2: Regenerate 2 health at the end of each turn | 5 damage Cleave x3; 3 damage to all enemies x2; 2 damage Poison Cleave |

## All heroes (102)

Colour is the class family: Yellow fighter, Grey defender, Orange rogue, Blue mage, Red healer.

| Hero | Colour | Tier | HP | Dice sides |
|---|---|---|---|---|
| Cultist | Blue | 1 | 5 | +4 mana Pain; +3 mana Pain; 1 damage Single-use Self-heal x2; +2 mana Pain; +1 mana Pain |
| Initiate | Blue | 1 | 4 | +1 mana Cantrip; +1 mana Growth; +1 mana Single-use x3; Blank |
| Mage | Blue | 1 | 4 | +2 mana x2; +1 mana x2; Blank x2 |
| Student | Blue | 1 | 5 | Target hero can use their dice again; Shield 1 Mana-gain x2; Blank x3 |
| Caldera | Blue | 2 | 6 | 3 damage Cruel Single-use; +2 mana x2; 1 damage Mana-gain x2; Blank |
| Evoker | Blue | 2 | 7 | +3 mana; +2 mana; Blank x3; +1 mana |
| Fiend | Blue | 2 | 6 | +1 mana Cantrip; +3 mana Pain; 2 damage Single-use Self-heal x2; +2 mana Pain; Blank |
| Glacia | Blue | 2 | 9 | 1 damage Weaken Single-use; +2 mana; Shield 1 Mana-gain x2; +1 mana x2 |
| Jester | Blue | 2 | 6 | +3 mana; Gain 1 reroll Cantrip; +1 mana Single-use x2; Dodge all enemy attacks/effects; Blank |
| Myco | Blue | 2 | 7 | +3 mana Decay; +2 mana Decay; Shield 1 Growth; 1 damage Growth; +1 mana Decay; Revive the top-most defeated ally |
| Seer | Blue | 2 | 7 | +1 mana Growth; 1 damage Poison Single-use; +3 mana Single-use x2; Blank x2 |
| Sparky | Blue | 2 | 6 | 2 damage Mana-gain; +1 mana x2; 0 damage Charged Single-use x2; Blank |
| Ace | Blue | 3 | 8 | +3 mana Triple; +2 mana Pair; Blank x3; +1 mana |
| Artificer | Blue | 3 | 7 | 3 damage Single-use Self-heal; 2 damage Charged Single-use; +4 mana Single-use x2; 2 damage Poison Single-use; Heal 10 Single-use |
| Chronos | Blue | 3 | 7 | Target hero can use their dice again; Gain 1 reroll Cantrip; +2 mana Growth x2; Dodge all enemy attacks/effects; Blank |
| Ghast | Blue | 3 | 8 | +5 mana Death; +2 mana; 2 damage Weaken Single-use x2; +1 mana; Blank |
| Sorcerer | Blue | 3 | 7 | +1 mana Cantrip x3; Gain 1 reroll Cantrip; Blank x2 |
| Warlock | Blue | 3 | 8 | +2 mana Bloodlust; 3 damage Single-use Self-heal; +4 mana Pain x2; Blank x2 |
| Weaver | Blue | 3 | 9 | +0 mana Charged; +3 mana; +3 mana Single-use x2; Dodge all enemy attacks/effects; Blank |
| Wizard | Blue | 3 | 9 | Shield 1 Single-use Perma-boost; +1 mana Cantrip; 1 shield Mana-gain x2; 1 damage Mana-gain x2 |
| Glitch | Blue | 4 | 6 | Shield 1 Single-use Perma-boost; Blank x2; Stun an enemy Single-use; Shield 1 Repel Rescue Rampage; Heal 666 Rampage |
| Alloy | Grey | 1 | 4 | Shield 1 Repel; Shield 1 Double-use; Shield 1 Cleave; Shield 1 Mana-gain; Shield 1 Cleanse; Shield 1 Engage |
| Buckle | Grey | 1 | 6 | Shield 2 Pristine; 2 damage Heavy; Shield 2 x2; Blank x2 |
| Defender | Grey | 1 | 7 | Shield 3; Shield 2; 1 damage x2; Shield 1; Blank |
| Squire | Grey | 1 | 5 | Shield 2 Focus; 1 damage Focus; Redirect all enemy attack/effects from an ally to you, Self-shield 2 x2; Shield 1 x2 |
| Armorer | Grey | 2 | 9 | 3 damage Heavy; Shield 4; Shield 1 Cleave x2; Shield 1 Smith x2 |
| Bard | Grey | 2 | 7 | Shield 2 Charged; Gain 1 reroll Cantrip; Shield 1 to all allies x2; +2 mana Single-use; Blank |
| Cleric | Grey | 2 | 6 | Heal and shield 2 x2; +1 mana x2; Shield 2 Cleanse; Blank |
| Guardian | Grey | 2 | 8 | Shield 2 Cleave; 1 damage Cleave; Shield 2 Engage x2; Blank x2 |
| Knight | Grey | 2 | 8 | Shield 3 Pristine; Shield 3 Steel x2; 3 damage Exert x2; Blank |
| Monk | Grey | 2 | 8 | Shield 2 Cleanse; Shield 1 Repel x2; Redirect all enemy attack/effects from an ally to you, Self-shield 3 x2; Blank |
| Statue | Grey | 2 | 20 | Blank x6 |
| Warden | Grey | 2 | 9 | Shield 4; Shield 3; 2 damage x2; Shield 2; Shield 1 |
| Granite | Grey | 3 | 12 | Shield 2 Repel; 2 damage Steel; Redirect all enemy attack/effects from an ally to you, Self-shield 3 x2; Stun an enemy with equal or less hp than you; Blank |
| Keeper | Grey | 3 | 9 | Shield 2 Repel x2; Shield 5 Steel x2; Add Self-heal & Self-shield to target's sides this turn; Blank |
| Mimic | Grey | 3 | 8 | Target hero can use their dice again; Shield 3 Duplicate; Blank x3; Shield 2 Copycat |
| Paladin | Grey | 3 | 10 | Shield 4 Cleanse; 4 damage Heavy; Heal and Shield 3 x2; +2 mana; Blank |
| Poet | Grey | 3 | 8 | Target hero can use their dice again; Shield 2 to all allies; Shield 2 Charged x2; Shield 1 Cantrip x2 |
| Stalwart | Grey | 3 | 10 | Shield 3 Cleanse x2; Shield 2 Cleave x2; Shield 2 Double-use; 5 damage Exert |
| Tw1n | Grey | 3 | 4 | Shield 1 x5; Blank |
| Twin | Grey | 3 | 4 | Shield 1 x5; Blank |
| Valkyrie | Grey | 3 | 10 | 4 damage Deathwish; Shield 2 Rescue; Target ally: Cannot be killed this turn x2; Revive the 2 top-most defeated allies; Blank |
| Dabble | Orange | 1 | 5 | Heal 5; Shield 2; +1 mana x2; 2 damage; 1 damage |
| Lost | Orange | 1 | 3 | 1 damage Ranged Poison; 2 damage Cruel; 1 damage Cruel x2; Dodge all enemy attacks/effects; Blank |
| Scoundrel | Orange | 1 | 6 | 1 damage Vulnerable; 1 damage Cleave; Blank x4 |
| Thief | Orange | 1 | 4 | 2 damage Ranged; 2 damage x2; Blank x3 |
| Dabbler | Orange | 2 | 7 | 3 damage; 2 damage; +2 mana; Heal 4; Shield 2 x2 |
| Gambler | Orange | 2 | 7 | 5 damage; 2 damage; Blank x3; 1 damage |
| Juggler | Orange | 2 | 7 | 2 damage Cantrip; 1 damage Cantrip x3; Shield 1 Cantrip; Blank |
| Ninja | Orange | 2 | 6 | 2 damage Double-use; 1 damage Copycat x3; Dodge all enemy attacks/effects; Blank |
| Ranger | Orange | 2 | 7 | 2 damage Ranged Engage; 2 damage Ranged; 1 damage Ranged Cleave x2; Blank x2 |
| Rogue | Orange | 2 | 7 | 2 damage Cruel; 1 damage Cantrip x2; 1 damage Poison x2; Dodge all enemy attacks/effects |
| Spellblade | Orange | 2 | 7 | 1 damage Copycat; 1 damage Poison; 1 damage Mana-gain x2; +1 mana x2 |
| Trapper | Orange | 2 | 7 | Kill an enemy with 4 or less hp Ranged; Shield 2 Growth; 1 damage Vulnerable x2; Dodge all enemy attacks/effects; Blank |
| Assassin | Orange | 3 | 8 | 3 damage Poison Single-use; 3 damage Cruel; 2 damage Ranged Engage x2; Dodge all enemy attacks/effects; Blank |
| Dabblest | Orange | 3 | 9 | +3 mana; 4 damage; 3 damage x2; Shield 5; Heal 5 |
| Dancer | Orange | 3 | 9 | 1 damage to all enemies Rampage Pain; Gain 1 reroll Cantrip; 1 damage Cantrip x2; 3 damage; Dodge all enemy attacks/effects |
| Fencer | Orange | 3 | 7 | 3 damage Pristine; 1 damage to all enemies x2; 2 damage Double-use x2; Dodge all enemy attacks/effects |
| Ludus | Orange | 3 | 6 | 6 damage; 5 damage; 4 damage; 3 damage; 1 damage; 2 damage |
| Roulette | Orange | 3 | 9 | 7 damage Sticky Mandatory Death; 5 damage; 2 damage Cantrip x2; 2 damage Cleave x2 |
| Sharpshot | Orange | 3 | 8 | Kill an enemy with 5 or less hp Ranged; 3 damage Ranged x3; 2 damage Ranged Copycat; Blank |
| Venom | Orange | 3 | 8 | 1 damage Poison Plague; 2 damage Poison; 2 damage Poison Single-use x2; Heal 3 Cleanse; Blank |
| Acolyte | Red | 1 | 5 | Heal 2 Vitality x2; Heal 1 Cleave x2; +1 mana x2 |
| Healer | Red | 1 | 5 | +2 mana; +1 mana x2; Heal 3 x2; Blank |
| Mystic | Red | 1 | 5 | Heal and shield 1 Mana-gain; Heal 1 Mana-gain; +1 mana; Heal 1; Blank x2 |
| Splint | Red | 1 | 4 | +3 mana Single-use; +2 mana Single-use; Heal 5 Single-use x2; +1 mana Single-use; Blank |
| Disciple | Red | 2 | 7 | Heal 2 Double-use x2; +2 mana x2; Revive the top-most defeated ally; Blank |
| Druid | Red | 2 | 7 | 2 damage Growth; Shield 2 Growth; +2 mana x2; Heal 2 Cleanse; Blank |
| Enchanter | Red | 2 | 8 | Heal and shield 1 Mana-gain; Add Self-heal & Self-shield to target's sides this turn; Add Self-shield to target's sides this turn; Add Self-heal to target's sides this turn; Heal 1 Boost; Heal 1 Cleanse |
| Fey | Red | 2 | 5 | 1 damage Weaken x2; Heal 1 Mana-gain x2; Heal 1 Boost x2 |
| Herbalist | Red | 2 | 7 | +2 mana x2; Heal 1 Regen x2; Add growth to target's sides this turn; 1 damage Poison Single-use |
| Medic | Red | 2 | 6 | Heal 2 Cleanse; Heal 1 Regen; Heal 2 Cleave x2; +2 mana; Blank |
| Priestess | Red | 2 | 7 | Heal 3 Vitality x2; Heal 1 Mana-gain x2; Heal 1 to all allies x2 |
| Vampire | Red | 2 | 7 | +2 mana; Heal 1 to all other allies Pain Vitality; 2 damage Self-heal x2; Heal 5; Blank |
| Doctor | Red | 3 | 9 | 1 damage to all heroes and monsters Poison; Heal 2 Mana-gain x2; Heal 2 Regen x2; Blank |
| Fate | Red | 3 | 8 | Heal and shield 2 Mana-gain; Heal and shield 1 Mana-gain; +3 mana Single-use x2; Dodge all enemy attacks/effects; Blank |
| Forsaken | Red | 3 | 10 | +3 mana; Revive the 2 top-most defeated allies; Blank x2; Heal 2 to all other allies Pain Vitality; Heal 2 to all allies |
| Prophet | Red | 3 | 8 | Heal 3 Rescue; Heal 4 Vitality x2; Heal 2 Mana-gain x2; Blank |
| Shaman | Red | 3 | 9 | Heal 5 Vitality; Heal 10; 3 damage Growth; Shield 3 Growth; Heal 2 Mana-gain; Blank |
| Surgeon | Red | 3 | 9 | Heal 2 Mana-gain x2; Heal and shield 2 x2; Heal 2 Double-use x2 |
| Witch | Red | 3 | 8 | +3 mana; Heal 5 Cleanse; Heal 1 Boost; 1 damage Weaken; Heal 3 Cleave; Blank |
| Wraith | Red | 3 | 8 | 4 damage Self-heal; Add Self-heal & Self-shield to target's sides this turn; +2 mana x2; Dodge all enemy attacks/effects Cantrip; Blank |
| Brigand | Yellow | 1 | 5 | 3 damage Exert x2; 1 damage Self-shield x2; 1 damage x2 |
| Fighter | Yellow | 1 | 5 | 2 damage x2; 1 damage x2; Shield 1 x2 |
| Hoarder | Yellow | 1 | 6 | 2 damage Heavy; 1 damage Rampage; 1 damage Deathwish; 1 damage Engage; 2 damage Single-use; 2 damage Pain |
| Ruffian | Yellow | 1 | 4 | 5 damage Pain; 1 damage Cleave; 1 damage x2; Shield 2; Blank |
| Berserker | Yellow | 2 | 8 | 3 damage Deathwish; 1 damage Cleave; 4 damage Pain x2; Blank x2 |
| Brute | Yellow | 2 | 8 | 2 damage Self-shield x2; 3 damage Heavy x2; Stun an enemy with equal or less hp than you; Blank |
| Collector | Yellow | 2 | 8 | 3 damage Exert; 1 damage Duplicate; 2 damage Ranged; 2 damage Self-shield; 1 damage Cleave; 1 damage Focus |
| Gladiator | Yellow | 2 | 7 | 2 damage Engage; 1 damage Engage; 2 damage Self-shield x2; Shield 2; Blank |
| Scrapper | Yellow | 2 | 8 | 1 damage Bloodlust x2; 1 damage Steel x2; Blank x2 |
| Sinew | Yellow | 2 | 7 | 1 damage Cleave Chain; Shield 2 x2; 4 damage Exert x2; Blank |
| Soldier | Yellow | 2 | 6 | 3 damage x2; 2 damage x2; Shield 2 x2 |
| Whirl | Yellow | 2 | 7 | 1 damage to all enemies; 3 damage; 1 damage Cleave x2; Shield 1 Cleave; Blank |
| Barbarian | Yellow | 3 | 12 | 10 damage Death; 8 damage Pain; 2 damage Bloodlust x2; 6 damage Pain; 4 damage Pain |
| Bash | Yellow | 3 | 10 | 7 damage Exert; 2 damage Steel; 5 damage Heavy x2; Stun an enemy with equal or less hp than you; Blank |
| Brawler | Yellow | 3 | 9 | 3 damage Steel; 3 damage Self-shield x2; 2 damage Rampage x2; Blank |
| Curator | Yellow | 3 | 7 | 3 damage Pristine; 1 damage Charged; 1 damage Steel; 1 damage Bloodlust; 1 damage Era; 6 damage Death |
| Eccentric | Yellow | 3 | 8 | Blank x3; 4 damage x2; 4 damage Descend |
| Leader | Yellow | 3 | 8 | Target hero can use their dice again; 2 damage Duplicate; 3 damage x2; Shield 2 Smith; Blank |
| Veteran | Yellow | 3 | 11 | 4 damage x2; 3 damage x2; Shield 3 x2 |
| Wanderer | Yellow | 3 | 8 | 1 damage Inflict-pain Single-use; 1 damage Quad-use; 2 damage Era x2; Blank x2 |

## All items (355)

Negative tiers are cursed items ("Must be equipped").

| Item | Tier | Effect |
|---|---|---|
| Bug | -50 | +1 max hp -1 max hp |
| Broken Spirit | -2 | Must be equipped Immune to healing Immune to shields |
| Exhaustion | -2 | Must be equipped Add single-use to all sides |
| Pharoah's Curse | -2 | Must be equipped -1 to all sides |
| Slimed | -2 | Must be equipped Cannot be rerolled |
| Soul Link | -2 | Must be equipped When an ally dies, you die |
| Wretched Crown | -2 | Must be equipped Upon death: kill all allies |
| Affliction | -1 | Must be equipped Add pain to the two left sides |
| Broken Heart | -1 | Must be equipped Immune to healing |
| Coiled Snake | -1 | Must be equipped Start poisoned |
| D4 | -1 | Must be equipped Replace the right side with '1 self damage cantrip' |
| Handcuffs | -1 | Must be equipped -1 item slot |
| Lead Weight | -1 | Must be equipped Replace the top and bottom sides with 'blank' |
| Martyr | -1 | Must be equippedAdd death & +1 to the two left sides |
| Mould | -1 | Must be equipped Add decay to all sides |
| Weariness | -1 | Must be equipped Add single-use to the middle row |
| Bent Fork | 0 | x1 the pips of all sides |
| Bent Spoon | 0 | +0 to all sides |
| Bond Certificate | 0 | 15th turn: +15 to all sides |
| Burred Shield | 0 | Replace the left side with 'Shield 5 pain' |
| Cholesterol | 0 | +5 empty max hp Immune to healing |
| Corroded Bomb | 0 | Replace the right side with '1 damage to all heroes and monsters Charged , mana-cost' |
| Cracked Emerald | 0 | Gain the effects of all tier 10 items on other heroes |
| Cracked Phylactery | 0 | Add Self-heal to the two left sides -6 max hp |
| Cyanide Pill | 0 | Add Cantrip & Death to the two right sides |
| Dead Branch | 0 | Replace the bottom side with '1 damage Single-use ' |
| Dull Wit | 0 | Replace mana/mana-gain sides with basic damage sides, retaining their original value and other keywords |
| Extra Pocket | 0 | +1 item slot (max 3) |
| False Idol | 0 | +1 max hp for each 'z' in your name |
| Fidget Spinner | 0 | Replace the middle side with 'Target hero can use their dice again Duplicate ' |
| Flea | 0 | +1 to all sides with exactly 0 pips |
| Fly | 0 | Add Growth & Decay to the left side |
| Gambler's Two | 0 | +1 to the rightmost side -1 to other sides |
| Grass | 0 | Replace blank sides with 'blank (petrified)' |
| Hidden Strength | 0 | Replace the bottom side with '10 damage to all enemies Mana-cost ' |
| Paper | 0 | Add Nothing to the left side |
| Peanut Shell | 0 | Must be equipped +1 empty max hp |
| Potion Shard | 0 | Replace the bottom side with '3 damage pain, Drink ' |
| Rusty Longsword | 0 | Replace the middle row with '1 damage' |
| Scissors | 0 | Add Deathwish & pain to the middle side |
| Snake Oil | 0 | Add engage to all basic heal sides |
| Spanner | 0 | Revert all changes to the top side |
| Spell: Betray | 0 | Cost: 2 mana - Kill an ally |
| Spell: Hinder | 0 | Cost: 1 mana - 1 damage to an ally Weaken |
| Spell: Mana | 0 | Cost: 1 mana - +1 mana Single-cast |
| Toy Sword | 0 | Replace the rightmost side with '0 damage' |
| Trick Deck | 0 | Add Sept to the left side |
| Twiddle | 0 | Swap the top side with the bottom side |
| Void | 0 | - |
| Wooden Armour | 0 | +2 max hp -1 to all sides |
| rorriM tekcoP | 0 | Copy the rightmost side onto the left side |
| Anchor | 1 | Turn 1: self-shield 2 |
| Ballet Shoes | 1 | Swap the left side with the rightmost side |
| Barkskin | 1 | Immune to shields +2 max hp |
| Basilisk Scale | 1 | Start petrified for 1 +3 to the top side |
| Big Heart | 1 | Replace the middle side with 'Heal 5' |
| Big Shield | 1 | Replace the left side with 'Shield 4' |
| Bone Charm | 1 | No hp penalty when defeated |
| Castor Root | 1 | Replace blank sides with 'Heal 1' |
| Change of Heart | 1 | Replace heal/self-heal sides with basic shield sides, retaining their original value and other keywords |
| Cleanse Potion | 1 | Replace the rightmost side with 'Heal 21 drink, Cleanse ' |
| Cloak | 1 | Replace the middle side with 'Dodge all enemy attacks/effects' |
| Coin | 1 | +1 to the left side Cannot be locked |
| Compass | 1 | Rotate sides clockwise around the middle side |
| Copper Ring | 1 | +1 empty max hp +1 max stored mana |
| Courage Potion | 1 | Add drink & +2 to the left side |
| Emerald Shard | 1 | Gain the effects of all tier 2 items on other heroes (not potions) (Can copy the effects of items that are exclusive to a certain hero color) |
| Foil | 1 | Replace the right side with '0 damage Skill ' |
| Glass Helm | 1 | +3 max hp Death is permanent |
| Healing Wand | 1 | Replace the rightmost side with 'Heal 4 Single-use ' |
| Infused Herbs | 1 | Replace the bottom side with 'Heal 2 Regen , Cleanse , mana-cost' |
| Knife Bag | 1 | Replace blank sides with '1 damage Cantrip , pain' |
| Leather Vest | 1 | +1 max hp |
| Pendulum | 1 | Swap the left side with the middle side |
| Reagents | 1 | Replace the two right sides with 'blank' & 'Heal 1 Regen ' |
| Revive Potion | 1 | Replace the right side with 'Revive the 2 top-most defeated allies drink' |
| Rusty Plate | 1 | Replace the middle side with 'blank' +3 max hp |
| Scar | 1 | +4 empty max hp |
| Seedling | 1 | Replace the left side with '2 damage Growth ' |
| Spell: Poultice | 1 | Cost: 1 mana - Heal 2 Single-cast |
| Stake | 1 | Add Terminal to all damage sides |
| Tattered Robes | 1 | Replace the three right sides with '+1 mana' +1 max stored mana |
| Wine | 1 | Start poisoned The monster with the most hp starts poisoned |
| Wolf Ears | 1 | Set max hp to 6 |
| Worn Arms | 1 | Replace the top and bottom sides with '2 damage' & 'Shield 2' |
| 2 of Hearts | 2 | At the start of each turn, self-heal 2 if you are on exactly 2 hp |
| Big Hammer | 2 | Replace the two left sides with '5 damage Heavy ' & 'blank' |
| Blessed Ring | 2 | Replace the rightmost side with 'Shield 1 Rescue ' |
| Blessed Water | 2 | Replace the rightmost side with 'Heal 2 Vitality ' |
| Buckler | 2 | Replace the middle side with 'Shield 3 Bloodlust ' |
| Burning Blade | 2 | Replace the left side with '4 damage' -2 max hp |
| Cheater's Sleeves | 2 | Add Quin to the top and bottom sides |
| Citrine Ring | 2 | +1 to the rightmost side |
| Cursed Bolt | 2 | After a spell is cast, 1 self damage +1 to the two right sides |
| First-aid Kit | 2 | Orange heroes only Replace the left side with 'Heal 4 Cleanse ' |
| Fletching | 2 | Add ranged to the left side |
| Flickering Blade | 2 | Replace the rightmost side with '1 damage Copycat ' |
| Friendship Bracelet | 2 | +2 empty max hp Monsters flee if you have 5x as much hp as them instead of 10x |
| Gambler's Ace | 2 | +2 to the left side -2 to other sides |
| Garnet | 2 | +1 to incoming healing |
| Golden Thread | 2 | Yellow heroes only +1 to all non-damage sides |
| Incense | 2 | Add Rite to the top side |
| Iron Heart | 2 | Add Exert & +1 to all sides+1 max hp |
| Leather Gloves | 2 | Copy the rightmost side onto the top and bottom sides |
| Liqueur | 2 | Swap the top side with the rightmost side +2 max stored mana |
| Longbow | 2 | Replace the top and bottom sides with '2 damage Ranged ' |
| Mana Potion | 2 | Replace the rightmost side with '+5 mana drink' |
| Origami | 2 | Swap each side with its opposite (Swap top side with bottom side, left side with right side, middle side with rightmost side) |
| Powdered Mana | 2 | Replace blank sides with '+1 mana' |
| Regen Potion | 2 | Replace the bottom side with 'Heal 3 drink, Regen ' |
| Relic | 2 | +1 to all sides if you are on exactly 1 hp |
| Sapphire | 2 | Replace the middle side with '+2 mana' |
| Sapphire Skull | 2 | Upon death: +2 mana |
| Shortsword | 2 | Replace the two right sides with '2 damage' |
| Silver Imp | 2 | Replace the top and bottom sides with 'Gain 1 reroll Cantrip , pain' |
| Spell: Remedy | 2 | Cost: 1 mana - Heal 1 Cleanse , Single-cast |
| Spell: Restore | 2 | Cost: 2 mana - Heal 1 to all allies |
| Spell: Slice | 2 | Cost: 3 mana - 1 damage to all enemies |
| Square Wheel | 2 | Replace the three right sides with 'Gain 1 reroll Cantrip ', 'blank' & 'blank' |
| Statuette | 2 | Replace the middle row with 'blank' +6 max hp |
| Titanbane Potion | 2 | Add Dispel & drink & +1 to the middle side |
| Twin Daggers | 2 | Replace the top and bottom sides with '1 damage Cantrip ' |
| Wandify | 2 | Add Single-use & +1 to the two right sides |
| Whey | 2 | Add Vitality to the left side |
| Abacus | 3 | Shift your middle row across by 1 +1 max hp |
| Autumn Leaf | 3 | Add growth to the rightmost side |
| Blood Chalice | 3 | Self-shield 1 for each wasted point of healing you receive |
| Bowl | 3 | Revert all changes to all sides (Replace all sides with your base sides) |
| Clumsy Hammer | 3 | Replace the top side with '4 damage Heavy , Eliminate ' |
| Droopy Hat | 3 | +2 max hp +2 max stored mana |
| Enchanted Shield | 3 | At the start of each turn, self-shield 1 |
| Faint Halo | 3 | +1 max hp this fight whenever you save a hero |
| Glass Blade | 3 | Replace the left side with '5 damage' 'Glass Blade' lost upon death |
| Idol of Aiiu | 3 | +1 max hp for each vowel in your name |
| Iron Pendant | 3 | +1 to incoming shields |
| Lead Boots | 3 | Cannot be rerolled +1 to all sides |
| Lich's Tome | 3 | +1 to all sides After you use this dice, summon a bones |
| Lightning Rod | 3 | Replace the left side with '0 damage ranged, Charged , Rampage , pain' |
| Lucky | 3 | +1 to the left side, -2 to the middle side |
| Pocket Phylactery | 3 | Add pain to the two left sides +6 max hp |
| Pure Heart Pendant | 3 | Replace the middle side with 'Heal 3 Cleanse ' |
| Rain of Arrows | 3 | Replace the top side with '1 damage ranged, Duplicate ' |
| Rejuvenation Wand | 3 | Replace the top and bottom sides with 'Heal 10 Single-use ' |
| Scalpel | 3 | Red heroes only +1 to all damage sides |
| Spell: Sprout | 3 | Cost: 3 mana - Heal 3 Channel |
| Three-of-a-Kind | 3 | Add triple to the rightmost side |
| Tower Shield | 3 | Replace the middle side with 'Shield 7 heavy' |
| Unholy Strength | 3 | Immune to shields Immune to healing +1 to the middle row |
| Urn | 3 | Add Enduring to the middle side |
| Whetstone | 3 | +1 to all basic damage sides |
| Antivenom | 4 | Immune to poison |
| Apple | 4 | Add Ego to the two left sides |
| Bonesaw | 4 | Red heroes only Replace the top and bottom sides with '3 damage Cruel ' |
| Chainmail | 4 | +3 max hp |
| Charged Skull | 4 | Upon death: +4 mana |
| Charon's Obol | 4 | Add deathwish to the two right sides |
| Cracked Wheel | 4 | Cannot be rerolled +1 reroll |
| Demon Eye | 4 | Add pain & +2 to the left side |
| Diving Suit | 4 | Replace the two right sides with the hero below's base sides |
| Duelling Pistol | 4 | Add Duel to the left side |
| Empty Chalice | 4 | If you have 0 mana at the end of the turn, +1 mana |
| Flawed Diamond | 4 | Add Pristine to the two left sides +4 empty max hp |
| Harpoon | 4 | Replace the rightmost side with '1 damage Vulnerable ' |
| Hissing Ring | 4 | Replace the middle side with '2 damage Poison ' |
| Jester's Cap | 4 | Replace all sides with Jester's sides |
| Lich Finger | 4 | Add Mana-gain & Death to the left side |
| Life Bolt | 4 | After a spell is cast, self-heal 1 |
| Longsword | 4 | Replace the middle row with '3 damage' |
| Magic Staff | 4 | Set all mana/mana-gain sides to 2 |
| Mana Bomb | 4 | Replace the rightmost side with '0 damage to all heroes and monsters Charged , Mana-cost ' |
| Mana Jelly | 4 | Add Single-use & Cantrip to all mana/mana-gain sides |
| Mini Crossbow | 4 | Replace the rightmost side with '2 damage ranged, Engage ' |
| Natural | 4 | Blue heroes only Replace the two right sides with '+2 mana' |
| Pillow | 4 | Add Patient to the left side |
| PowerStone | 4 | Grey heroes only Replace the left side with '+0 mana Steel ' |
| Quicksilver | 4 | Keep unused shields |
| Ritual Dagger | 4 | Replace the rightmost side with 'Revive the 4 top-most defeated allies Death ' |
| Siphon | 4 | Replace the middle side with 'Heal 0 Vitality , Flesh , Pain ' |
| Smelly Manure | 4 | Add growth to the top and bottom sides Add Decay to the middle row |
| Spell: Hack | 4 | Cost: 2 mana - Replace blank sides with '4 damage' this turn |
| Spell: Hex | 4 | Cost: 3 mana - Kill an enemy with exactly 6 hp ranged, Single-cast |
| Splitting Arrows | 4 | Replace the two right sides with '1 damage ranged, cleave' |
| Syringe | 4 | +5 to all sides if there are 2 or fewer living heroes |
| Terrarium | 4 | Replace the two right sides with 'Shield 2 growth' & '+1 mana growth' |
| Tiara | 4 | Add Self-heal to all mana/mana-gain sides |
| Troll's Nose | 4 | Regenerate 1 health at the end of each turn |
| Viscera | 4 | Replace the middle side with '0 damage Flesh , pain' |
| Alembic | 5 | Replace the middle side with 'Add Mana-gain & pain to target's sides this turn' |
| Ambrosia | 5 | Add rescue to the left side |
| Blindfold | 5 | Remove all keywords from the middle row |
| Chakram | 5 | Replace shield/self-shield sides with ranged damage sides, retaining their original value and other keywords |
| Chocolate Bar | 5 | +1 to all cruel, engage, deathwish & chain sides |
| Demon Horn | 5 | Replace the rightmost side with 'Heal 2 Boost , Inflict-pain ' |
| Determination | 5 | Cannot be killed for the first 2 turns |
| Door | 5 | +2 to all shield/self-shield sides if there are 4 or more monsters |
| Dragonhide Gloves | 5 | Copy the middle side onto the top and bottom sides |
| Duck | 5 | Add Echo to the two right sides |
| Enchanted Harp | 5 | Replace the middle side with 'Shield 2 to all allies' |
| Eucalyptus | 5 | Replace the right side with 'Heal 3 Cleanse , Double-use ' |
| Eyepatch | 5 | Remove all keywords from the left side |
| Faerie Pact | 5 | Replace the rightmost side with '+4 mana' -4 max hp |
| Fearless | 5 | +1 max hp Replace the rightmost side with 'Stun an enemy with equal or less hp than you' |
| Heart of Light | 5 | Replace the two right sides with 'Heal 3 Cleanse ' |
| Idol of Chrzktx | 5 | +1 max hp for each consonant in your name |
| Ladder | 5 | Replace the middle side with the hero above's base side |
| Monocle | 5 | Add Engage to the middle side |
| Ordinary Triangle | 5 | +1 to all sides with exactly 3 pips |
| Ornate Hilt | 5 | Add Self-shield to all damage sides |
| Pauldron | 5 | +2 to the top side, -2 to the bottom side |
| Polished Emerald | 5 | Gain the effects of all tier 0-3 items on other heroes (not potions) (Can copy the effects of items that are exclusive to a certain hero color) |
| Red flag | 5 | +3 max hp Replace the middle side with 'Redirect all enemy attacks/effects from an ally to you cleave' |
| Ruby | 5 | +2 to incoming healing +2 empty max hp |
| Sack of Mana | 5 | Replace the middle column with 'blank', '+4 mana' & 'blank' |
| Shining Bow | 5 | Add ranged to all damage sides |
| Shuriken | 5 | Add ranged & Chain to the two right sides |
| Simplicity | 5 | +1 to all basic heal, mana, damage & shield sides |
| Sling | 5 | Add Underdog to the bottom side |
| Spell: Beam | 5 | Cost: 5 mana - 7 damage Single-cast , ranged |
| Spell: Clink | 5 | Cost: 2 mana - Double all friendly shields Deplete |
| Spell: Heat | 5 | Cost: 3 mana - Heal 3 to all allies with shields Cleanse |
| Tankard | 5 | +1 to all sides for each stack of poison on you |
| Treasure Chest | 5 | Add Hoard & Single-use to the left side |
| Updog | 5 | Add Overdog to the top side |
| Wand of Wand | 5 | Replace the right side with '1 damage Single-use , Single-use "]Inflict- Single-use [/Link]' |
| Whiskey | 5 | +2 max hp +6 empty max hp |
| Blinding Bolt | 6 | After a spell is cast, self-shield 2 |
| Blood Amulet | 6 | Add Self-heal to the two left sides |
| Candle | 6 | Add Vigil to all sides |
| Catnip | 6 | Add Cantrip to the rightmost side |
| Crescent Shield | 6 | Replace the left side with 'Shield 1 Repel , rampage, rescue' |
| Demonic Deal | 6 | Add pain & +2 to all sides |
| Duvet | 6 | Add Patient to the three right sides |
| Dynamo | 6 | Add Single-use & Era to the two right sides |
| Early Grave | 6 | Add pain & Cantrip to the top and bottom sides |
| Ghost Shield | 6 | At the start of each turn, self-shield 2 |
| Glowing Egg | 6 | Add growth to the left side |
| Glyph of Purity | 6 | Add Cleanse to the top and bottom sides |
| Hourglass | 6 | First turn: +1 to all sides |
| InfiniHeal | 6 | Replace the two right sides with heal all sides, retaining their original value and keywords |
| Ink Bottle | 6 | Replace blank sides with 'Shield 1 Cantrip ' |
| Karma | 6 | Add Self-heal to all heal sides Add Self-shield to all shield sides Add pain to all damage sides |
| Leaden Handle | 6 | Add heavy & +1 to all damage sides |
| Lens | 6 | Add Focus to all heal/self-heal sides |
| Nunchaku | 6 | Add Chain to the top and bottom sides |
| Ocular Amulet | 6 | +1 to the left side |
| Overflowing Chalice | 6 | If you have 3 or more mana at the end of the turn, +2 mana |
| Poem | 6 | Add Alliteration to all sides |
| Poodle | 6 | Add Dog to the middle column |
| Scales | 6 | Set the value of the rightmost side to the maximum of your other side's values |
| Shimmering Halo | 6 | +2 max hp this fight whenever you save a hero |
| Silver Pendant | 6 | +2 to incoming shields |
| Spell: Mark | 6 | Cost: 4 mana - 2 damage Vulnerable |
| Spinning Scythe | 6 | Replace the middle side with '1 damage to all heroes and monsters rampage' |
| Tentacle | 6 | Add Repel to the two right sides -2 max hp |
| Thimble | 6 | Immune to damage during your turn |
| Tie | 6 | Add Pristine to the middle side |
| Tooth Necklace | 6 | Add Cruel to the two left sides |
| Twisted Bar | 6 | Set all sides to 2 |
| Twisted Flax | 6 | +1 to the top and bottom sides, -1 to the middle side |
| Wand Grips | 6 | Add Single-use & +2 to the left side |
| Water | 6 | +1 to the left and right sides, -1 to the middle and rightmost sides |
| Wrench | 6 | +1 to the middle side |
| Anvil | 7 | Add Steel to the middle side |
| Boots of Speed | 7 | +1 reroll Replace the left side with 'Dodge all enemy attacks/effects' |
| Broadsword | 7 | Replace the middle column with '4 damage' |
| Cauldron | 7 | Add Rite & +1 to the middle side |
| Charge Link | 7 | Add charged & Single-use to the top and bottom sides |
| Conduit | 7 | Replace the middle side with '+2 mana Duplicate ' |
| Demon Claw | 7 | Add Rampage & -1 to the left side |
| Dragon Pipe | 7 | +1 to all heal/self-heal sides |
| Erythrocyte | 7 | Replace the middle side with 'Shield 0 Flesh ' |
| Flute | 7 | Replace the rightmost side with 'Shield 1 to all allies Cantrip ' |
| Ichor Chalice | 7 | 1 damage to the top-most enemy for each wasted point of healing you receive |
| Iron Helm | 7 | +6 max hp |
| Metal Studs | 7 | +1 to all shield/self-shield sides |
| Mushroom | 7 | Add Decay & +1 to all sides |
| Ogre Blood | 7 | Add Bloodlust to the middle side |
| Pair of Kings | 7 | Add Pair to the top and bottom sides |
| Pocket Mirror | 7 | Copy the left side onto the rightmost side |
| Poison Dip | 7 | Add Poison to the top and bottom sides |
| Second Chance | 7 | Replace the rightmost side with 'Target hero can use their dice again' |
| Sharp Wit | 7 | Replace mana/mana-gain sides with basic damage sides, retaining their other keywords and triple their values |
| Sickle | 7 | +1 to all lowest-pip sides |
| Spell: Charge | 7 | Cost: 2 mana - Shield 2 Boost , Single-cast |
| Spell: Invest | 7 | Cost: 4 mana - +6 mana Future , Cooldown |
| Spell: Spark | 7 | Cost: 5 mana - Add Mana-gain to target's sides this turn |
| Stasis | 7 | Your sides cannot change |
| Study | 7 | Cost: 2 mana - 3 damage or shield 3 Forget Burst |
| Tourmaline Paraiba | 7 | Add Era to all mana/mana-gain sides |
| Troll's Blood | 7 | Regenerate 2 health at the end of each turn |
| Two Reeds | 7 | +1 to all sides with even pips |
| Wand of Stun | 7 | Replace the middle side with 'Stun an enemy Single-use ' |
| Wax Seal | 7 | All sides get +1 for each other identical side |
| Wooden Bracelet | 7 | +1 to all sides with no keywords |
| Brimstone | 8 | Triple the pips of the rightmost side |
| Burning Halo | 8 | 1 damage to all enemies whenever you save a hero |
| Clay | 8 | Copy the other equipped items on you |
| Cocoon | 8 | Add Era & -1 to all sides |
| Deadly Bolt | 8 | After a spell is cast, 1 damage to the top-most enemy |
| Enhance Wand | 8 | Replace the top side with 'Shield 1 Single-use , Perma-boost ' |
| Faerie Dust | 8 | Replace blank sides with '+3 mana' |
| Gauntlet | 8 | +1 to all damage sides |
| Greatsword | 8 | Replace the middle side with '5 damage Inspired ' |
| Ironblood Pendant | 8 | +3 to incoming healing and shields |
| Mirror Mask | 8 | Replace all sides with the hero above's base sides |
| Olympian Trident | 8 | Add cleave to the middle side |
| Prism | 8 | Add Rainbow to the middle side |
| Sapphire Ring | 8 | +1 to all mana/mana-gain sides |
| Scorpion Tail | 8 | Add Weaken & Pain to the top and bottom sides |
| Serration | 8 | Add Vulnerable to the top and bottom sides |
| Singularity | 8 | +2 to the two right sides |
| Spell: Light | 8 | Cost: 3 mana - Heal 5 Target hero can use their dice again Single-cast |
| Standard | 8 | Yellow heroes only +1 to all sides |
| Sushi | 8 | Replace the left side with 'Gain 2 rerolls Cantrip ' |
| Wandcraft | 8 | Replace all sides with Single-use mana sides, retaining their original value and keywords |
| Angel Feather | 9 | Add rescue to the top and bottom sides |
| Boarhide Bracers | 9 | +2 to the top and bottom sides |
| Bullseye | 9 | Add Engage to the middle column |
| Chaos Wand | 9 | Replace the middle side with '1 damage Single-use , cleave, Engage , Self-heal , Weaken , Vulnerable ' |
| Charged Hammer | 9 | Replace the left side with '10 damage heavy, Charged ' |
| Collar | 9 | Add Copycat to the top and bottom sides |
| Dolphin | 9 | Add Echo to all sides |
| Dumbbell | 9 | +4 to all sides with 4 or more pips |
| Emerald Mirror | 9 | Gain the effects of all tier 5-7 items on other heroes |
| Eye of Horus | 9 | +1 to all sides |
| Goblet of Life | 9 | Replace the middle side with 'Heal and shield 2 cleave, Self-heal , Self-shield ' |
| Helm of Power | 9 | Double the pips of the left side |
| Horned Viper | 9 | Add Poison to the two left sides |
| Iron Crown | 9 | Grey heroes only +4 to the left side |
| Silk Cape | 9 | Copy the left side onto the middle row |
| Timestone | 9 | Add Cantrip to the two right sides |
| Triple Shuriken | 9 | Add Ranged & Chain to all sides |
| Diamond Skull | 10 | +2 max hp Upon death: +1 to allied sides this fight |
| Egg Basket | 10 | +6 to the left side, replace all other sides with 'blank' |
| Fangs | 10 | Add Invigorate to the top and bottom sides |
| Mithril Shields | 10 | Add Cantrip to all shield/self-shield sides |
| Poseidon's Charm | 10 | Add cleave to the top and bottom sides |
| Spell: Infinity | 10 | Cost: 10 mana - Kill an enemy |
| Top Duplicate | 10 | Add duplicate to the top side |
| Blue Skink | 11 | Replace all sides with the hero below's base sides, retaining your side's values and keywords |
| Huge Sword | 11 | Add cleave to all damage sides |
| Pentagram | 11 | Cannot be killed for the first 4 turns |
| Ruby Shards | 11 | Add cleave to all heal/self-heal/shield/self-shield sides |
| Whirlwind | 11 | Add Cantrip to the middle column |
| Archmage Orb | 12 | +1 mana for each wasted point of healing you receive |
| Broomstick | 12 | Add Mana-gain to the two left sides |
| Face of Horus | 12 | +2 to all sides |
| Golden D6 | 12 | Set the values of all sides to Ludus's sides |
| Diamond Ring | 13 | Replace damage sides with heal, shield, Mana-gain sides, retaining their original value and keywords |
| Ethereal Cloak | 13 | Replace all sides with 'Dodge all enemy attacks/effects' |
| Fertiliser | 13 | Add growth to all sides |
| Illegal | 13 | Replace left side with '2 rerolls Cantrip ' & middle side with 'Target hero can use their dice again' |
| Placeholder | 13 | Add dispel to all sides |
| Banned | 14 | Add cleave to the left side & growth to the middle side |
| Bag of Holding | 20 | Gain the effects of all tier 7 items |

---
Source: [minmax.wiki Slice & Dice](https://minmax.wiki/slice-and-dice), community content under CC-BY-SA. Slice & Dice by tann and a3um.
