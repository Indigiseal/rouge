# Sigils — one set of abilities for cards and enemies

Design draft, 2026-10-14. Not built yet. Background research:
[research/slice-and-dice-reference.md](research/slice-and-dice-reference.md).

## The idea

A **sigil** is a mark on a card that gives it one rule. **Enemy traits and
sigils are the same thing**: enemies are born with some, and the player finds
them for their own cards. A player who meets a sigil on an enemy and later
wins it for a weapon already knows what it does — and the other way round.
One list, one icon language, both sides of the board.

Merging the two also shrinks the list: our 22 enemy traits and boss abilities
fold into a dozen or so sigils.

## Rules (decided)

| Rule | Decision |
|---|---|
| What it is | A mark on the card plus a one-line tooltip. Art still open: corner icon, card corners, or a frame |
| Shared | Enemy traits **are** sigils; the same sigil can sit on an enemy or on a player's card |
| Wording | Written from the point of view of **whoever carries it**, so one rule reads right on both sides |
| Two strengths | A shared sigil has one strength for enemies and one for players (Thorns on a Bone Heap and on your dagger can differ) |
| Multipliers | **×1.5**, never ×2 |
| Rounding | Always **round down**, for both sides (×1.5 of 5 = 7) |
| How long | Until the card is destroyed. Survives upgrades, merges and saves, like the Briar Room thorns |
| Enemies | Can never remove or steal a player's sigil |
| Merging | Two cards with different sigils merge into one card carrying **both** |
| Cap | **2 sigils per card** |
| Same sigil twice | Goes up a **level** instead of taking the second slot (Thorns 2, Thorns 3), the way Briar Room thorns add up today |
| Where from | Secret rooms on the map, elite treasure chests, **the Reliquary** (fuse a magic card) and **the Briar Room** (Thorns) |
| Secret rooms | Appear when the player stands on the floor right before them |

## The sigils

### Shared — on enemies and on player cards

| Sigil | Replaces today | On an enemy | On a player's card |
|---|---|---|---|
| **Arrest** | Web, Ink, the chick's Shock, freezing | locks one of the player's cards for a turn | the enemy hit skips its next turn (the player throws something at it) |
| **Venom** | Poison, Venom Amp, Spider poison | poisons the player on hit | poisons the enemy on hit |
| **Thorns** | Thorns reflect (+ the research's Spiky) | damages whoever hits it | damages enemies that hit the player |
| **Sunder** | Gnaw, Armor Break | wears down the player's armor | strips armor from the enemy |
| **Daze** | Club stun, Spore | chance the player loses an action or misses | chance the enemy misses its next attack |
| **Crushing** | Heavy shot, Pierce | chance of a hit that ignores armor or hits harder | chance of a heavy hit |
| **Cutpurse** | Coin steal (enemy and boss) | steals coins on hit | gains coins on hit |
| **Leech** | Lifesteal | heals when it hits the player | heals the player on hit |
| **Elusive** | Evasion | chance the player's attack misses it | chance to dodge (on armor) |
| **Desperate** | Rage | ×1.5 near death | ×1.5 while the player is below a quarter health |
| **Outnumbered** | Wolf Pack | +1 per other enemy on the board | +1 per enemy on the board |
| **Merciless** | (new) | ×1.5 once the player is below half health | ×1.5 against enemies at half health or less |
| **Ambush** | (new) | ×1.5 while the player is unhurt | ×1.5 against unhurt enemies |
| **Unscathed** | (new) | ×1.5 until the player chips it once | ×1.5 while the player is unhurt |
| **Honed** | (new) | +1 after each attack this fight | +1 after each use this fight |
| **Regenerate** | (new) | heals N at the end of each turn: kill it fast | heals the player a little each turn while carried (best on armor; kept small so food and potions still matter) |
| **Ironclad** | (new) | its armor is added to its damage | the player's armor is added to damage |

**Arrest** is the clearest case of one rule, both sides. Today four things do
it: the Silkslinger's web and Ink Wraith's ink lock a player's card, and the
chick's Shock and freezing make an enemy skip its turn. In code, shock and
freeze already share one counter (`card.data.frozen`) — they are one mechanic
with two looks. As a sigil it is one icon, one word.

## Sigils from the events we already have

### The Reliquary — fuse a magic card into a weapon

Today the Reliquary turns a magic card into a weapon **enchant**: a weaker,
repeatable version of the spell that fires on a chance tied to the spell's
rarity (common 25%, uncommon 20%, rare 15%, legendary 5%). Every enchant
becomes a sigil; the chance-to-fire stays as that sigil's strength. Four map
onto sigils already listed above; five are new.

| Spell fused | Enchant today | Sigil | On an enemy | On a player's card |
|---|---|---|---|---|
| Frost Ring | Frostbound: freeze the struck enemy 1 turn | **Arrest** | (as above) | (as above) |
| Shadow Blade | Shadowed: +50% damage on the hit | **Crushing** | (as above) | (as above) |
| Restoration | Mending: heal 3 HP on hit | **Leech** | (as above) | (as above) |
| Fireball | Ember, then Ripple: fire splash to nearby enemies | **Fireball** (built, player only) | — | 10% on hit: a fireball flies at another random face-up enemy (bosses too) for half the hit, at least 3. It flies away rather than splashing, so it never reads as the fire gem |
| Weakness | Sapping: the enemy deals 30% less (was permanent) | **Sapping** (built) | the player's weapons deal less for a turn — a natural boss debuffer | 20% on hit: the enemy hit deals 30% less (rounded down) on its next attack only |
| Magic Shield | Warding: +20% armor for 1 turn | **Warding** (new) | gains armor after it attacks | the player's armor is stronger for a turn |
| Bone Wall | Bulwark: reflect the next attack | **Rebuke** (new) | sends the player's next hit back at them | sends the next enemy attack back |
| Soul Drain | Devouring: slay a non-boss outright | **Devouring** (new, player only) | — | chance to kill a non-boss outright |
| Smoke Screen | Shrouding: hide an enemy on a kill | **Shrouding** (new, player only) | — | a kill hides another enemy |

The enchanted card's brighter glow is replaced by its sigil mark. The
Reliquary's offers, weights and proc chances can stay as they are.

### The Briar Room — Thorns

The Briar Room's thorn wrap is the **Thorns** sigil, with levels: each visit
adds a level, and merging two thorned cards adds their levels, exactly as the
bonus adds up today. Today it means +1 damage per level on a weapon and
1 reflected damage per level on armor; as a sigil, Thorns on a weapon could
keep the damage bonus or switch to reflecting — one decision for the doc's
open questions. The thorn frame (thornFrame.png) becomes, or sits beside,
the Thorns mark.

## Sigils and amulets — keeping them distinct (proposal)

The line: **a sigil changes one card; an amulet changes the rules of the run**
— the board, how cards are placed, the map, the economy, gems, the player's
stats. Of our 34 amulets, the ones that are really about one card's combat
become sigils and leave the amulet pool:

| Amulet | Effect today | Becomes |
|---|---|---|
| Vampire Fang | heal 15% of damage dealt | **Leech**, on the weapon that carries it |
| Hand Mirror | 5% chance to reflect an attack | **Rebuke**, on armor |
| Twinned Mirror | reflect the first attack each fight | **Rebuke**, a higher level |
| Keeper's Ward | 30% chance not to spend a pip | **Tempered** (new): this card sometimes keeps its pip |

They stay amulets:

| Kind | Amulets |
|---|---|
| Board and card placement | Forced March, Close Order, Shifting Medallion, Tactician's Pin |
| Finding things | Provisioner's Bell, Armsfinder's Charm, Apothecary's Eye, Gemseeker's Lens, Mask of Hollow Whispers |
| Map | General's Glasses, Porter's Map |
| Economy | Pouch of Greed, Monocle, Fortune Card |
| Healing and potions | Ring of Regeneration, Ring of Greater Regeneration, Alchemist Bag |
| Gems | Runes of Fire / Zap / Poison, their Greater versions, Gloves of the Hermit Wizard, Plague Heart |
| Global stats | Dragon Claw (+15% to all damage) |

**The bridge:** the Mark amulets (Mark of Hesitation, Mark of Treachery, Twin
Marks, Collar of Binding) mark an enemy each floor. In this system they are
amulets that **give an enemy a sigil** — Mark of Hesitation hands one enemy a
weakened Arrest. They stay amulets but speak the sigil language.

## Enemy only — what a monster is, not what a weapon does

| Sigil | Today |
|---|---|
| **Summon** | calls minions (all 9 bosses, and elite enemies — decided 2026-10-14) |
| **Provocation** | must be attacked first (Silk Husk, Drowned, Hollow Mourner) |
| **Veil** | flips face-down each turn (Lost Soul, Thorn Fairy) |
| **Bark** | immune to ranged (Thorn Sprite, Crypt Warden) |
| **Rally** | extra goblin attacks (Toll Brute) |

Also shown as text today, could get marks: **Veteran** (+15% HP/ATK),
**Elite** (mini-boss, +30% HP/ATK).

## Player only — depend on the order cards are played, or the bag

| Sigil | Rule |
|---|---|
| **Hunter** | ×1.5 against the enemy you hit last |
| **Combo** | ×1.5 if your previous card carried the same sigil |
| **Tandem** | ×1.5 if your previous attack did the same damage |
| **Packrat** | +1 damage per empty bag slot |

## Which enemies carry what today

| Sigil | Enemies and bosses |
|---|---|
| Arrest | Silkslinger, Ink Wraith |
| Venom | Spider, Stinger Scorpion, Mire Toad, Spider Queen, The Mire Bride |
| Thorns | Thorn Ent, Bone Heap, Cinder Lizard |
| Sunder | Cave Crawler, Bog Slug, Veil Ripper, Ember Maw, Soul Eater, Cerberus, Ancient Cerberus |
| Daze | Goblin, Skull Lobber, Spore Archer, Fen Spitter, Slag Spitter |
| Crushing | Skeleton Archer, Road Sniper, Grave Cantor, Lava Slime, Goblin Archer, Mire Brute, Cinder Brute |
| Cutpurse | Highway Cutpurse, Goblin King |
| Leech | Lich |
| Elusive | Soul Eater, The Mire Bride |
| Desperate | Soul Eater, Cerberus, Ancient Cerberus |
| Outnumbered | Wolf |
| Summon | all 9 bosses |
| Provocation | Silk Husk, Drowned, Hollow Mourner |
| Veil | Lost Soul, Thorn Fairy |
| Bark | Thorn Sprite, Crypt Warden |
| Rally | Toll Brute |

Merging changes some numbers: Daze, Crushing and Sunder each fold two traits
whose odds differ today, so each needs one tuned strength (per side).

## New enemy sigils to consider (from the research)

- **Split** — summons a smaller copy below set health values.
- **Tough** — damage per hit is capped; rewards many small hits.
- **Brittle** — dies to any single hit of 4 or more; rewards one heavy swing.
- **Explodes** — on death, damages the enemies next to it.
- **Bone shards** — on death, 1 damage to adjacent enemies.
- **Flees** — runs if left alone, or if a neighbour dies to big overkill.

## Bosses — phases and helpers (decided direction)

- **Health phases:** at set health levels (for example two-thirds and one-third)
  the boss changes: summons, enrages, changes attacks.
- **A buffer** beside the boss, as well as its usual minions: while it lives
  the boss gains armor, heals each turn, or hits harder. A visible link line
  from helper to boss shows why the boss is tough.
- **A debuffer** that weakens the player with sigils: Arrest, Daze, Venom, or
  weapons −1 damage this turn. (Never stealing sigils.)
- Each boss could get its own matched pair, e.g. the Lich with a bone priest
  that heals it and a hex-caster that weakens your weapons.

## Open questions

- Sigil art: corner icon, card corners, or a frame — and how two show at once.
- Each shared sigil's two strengths (enemy and player).
- Thorns on a weapon: keep today's +1 damage per level, or reflect like armor?
- Level cap for a stacking sigil (Thorns 3? 5?).
- Amulets that become sigils: confirm the four (Vampire Fang, Hand Mirror,
  Twinned Mirror, Keeper's Ward), and where those sigils are found instead.
- Which enemies keep which sigils after the merge (some may lose one).
- Do sigils show on enemy cards before they are revealed?
- How often elite chests offer a sigil; what a secret room offers (one of three?).
- How a sigil goes onto a card: dropped on like a gem, or picked from a list.
