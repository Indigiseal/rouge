# Game Designer Handoff

Extracted from the current game code without changing gameplay code.

Primary source files:
- `CardDataGenerator.js`: floor card weights, enemies, bosses, gear, traps, amulet drop pool, potions, food, magic cards.
- `cardSystem.js`: board size, enemy density rules, enemy death drops, mimic reward, floor card generation.
- `gameScene.js`: floor clear rewards and boss reward rooms.
- `scenes/ShopScene.js`, `scenes/RareShopScene.js`, `scenes/TreasureScene.js`, `scenes/RestScene.js`, `scenes/AnvilScene.js`: economy rooms.
- `scenes/EventScene.js`: event choices and rewards.
- `AmuletManager.js`: amulet effects.
- `MetaProgressionManager.js`: death relics.

## High-Level Structure

| System | Current behavior |
|---|---|
| Run length | 45 floors, 3 acts of 15 floors each |
| Boss floors | 15, 30, 45 |
| Player start | 115 HP, 15 AP, 0 coins, 0 crystals, 5 inventory slots |
| Progression | Floor-based loot, gear merging, amulets, relics, event outcomes |
| Magic cards | Carryable, single-use inventory cards. Casting costs 1 AP; target spells require a revealed valid target, while recovery and buff spells can be cast directly. |
| XP | No XP system found in the current codebase |
| Regular enemy kill coins | None by default |
| Main combat payout | Paid once when all enemies are defeated |

## Map Nodes

Each act map has 15 floors. Floor 0 is a fixed combat start node; floor 14 is a boss node. Middle floors generate 2-4 nodes each.

| Node type | Notes |
|---|---|
| COMBAT | Standard fight |
| ELITE | Harder fight with one +30% HP / +30% attack mini-boss enemy; opens an elite chest after clear |
| SHOP | Regular coin/crystal shop |
| RARE_SHOP | Premium shop; at least one per act |
| REST | +20 HP, AP fully restored |
| ANVIL | Repair station; two guaranteed per act |
| EVENT | Random event node |
| TREASURE | Keyed/force-open chest |
| TREASURE_GOOD | Better chest, rarer |
| BOSS | Act boss |

Map room weights before placement restrictions:

| Type | Weight |
|---|---:|
| COMBAT | 48 |
| ELITE | 8 |
| SHOP | 10 |
| RARE_SHOP | 4 |
| REST | 12 |
| ANVIL | 8 |
| EVENT | 21 |
| TREASURE | 4 |
| TREASURE_GOOD | 2 |

Guarantees per act: at least one rest, shop, rare shop, normal treasure, good treasure, one early anvil, and one late anvil.

## Board Size And Combat Density

| Floor band | Normal board size | Elite board size |
|---|---:|---:|
| Act 1, floors 1-15 | Scales 6 to 11 cards | Normal x1.15, capped at 16 |
| Act 2, floors 16-30 | Scales 11 to 14 cards | Normal x1.15, capped at 16 |
| Act 3, floors 31-45 | Scales 14 to 16 cards | Normal x1.15, capped at 16 |

Card generation uses weighted rolls, then applies caps/guarantees:

| Rule | Value |
|---|---|
| Trap cap | 1 per floor in Act 1, 2 per floor in Act 2+ |
| Key cap | 1 per floor |
| Gem cap | 2 per floor |
| Empty card cap | 1 per floor |
| Weapon guarantee | 1 weapon early; 2 weapons from floor 10, elite rooms, or boards with 10+ cards |
| Enemy max ratio | 45% through floor 14, 55% after floor 14, +1 enemy for elite |
| Enemy minimum | At least 2; Act 1 18% of board, Act 2 28%, Act 3 33%, +1 for elite |

## Card Type Drop Weights

These are weights, not final exact percentages. Final boards can differ because of caps, enemy minimums, enemy maximums, and weapon guarantees.

Predefined weights exist for floors 1-30; floor 31+ uses the formula below. Boss floors are `{ boss: 100 }`.

After balancing, every non-boss floor weight is adjusted:

| Type | Adjustment |
|---|---|
| enemy | Floor <= 14: x0.68, floor >= 15: x0.78, minimum 20 |
| coin | x0.25, minimum 1 |
| trap | x0.75, minimum 3 |
| weapon | x0.95 plus floor bonus; minimum 7/9/11/12 by floor band |
| armor | x1.15, minimum 10 before floor 18, 12 after |
| amulet | x0.4, minimum 1, capped at 4 before floor 15 and 6 after |
| potion | x1.2, minimum 8 |
| food | x1.7, minimum 19 |
| magic | x1.25, minimum 5 |
| thorns | minimum 3 |
| crystal | x0.8 before floor 15, x0.5 after, minimum 3 |
| gem | 0 before floor 12, 3 floors 12-15, 9 floors 16-30, 12 floors 31+ |
| key | minimum 2 |
| empty | 0 through floor 15, then minimum 12 |

Formula weights for floors not explicitly listed:

| Type | Formula |
|---|---|
| enemy | `min(30 + floor * 2, 82)` |
| coin | `max(30 - floor, 2)` |
| crystal | `min(5 + floor * 0.4 rounded down, 18)` |
| trap | `min(5 + floor, 35)` |
| weapon | `max(10 - floor / 4 rounded down, 1)` |
| armor | `min(6 + floor / 3 rounded down, 18)` |
| amulet | `min(4 + floor * 0.8 rounded down, 35)` |
| potion | 10 |
| food | `max(12, 18 - floor / 3 rounded down)` |
| magic | `min(3 + floor / 2 rounded down, 15)` |
| gem | 9 before balancing, then overwritten by the gem gate |
| key | `min(1 + floor / 4 rounded down, 2)` |
| mimic | 3 from floor 3+ |

## Currency And Chest Rewards

| Source | Reward |
|---|---|
| Coin card | `3 + floor / 8 rounded down` through `6 + floor / 8 rounded down` coins |
| Crystal card | 1 crystal |
| All enemies defeated | Non-boss only: `floor(24 + floor * 1.2)` coins, modified by gold bonuses |
| Boss reward room | Full heal, full AP, `25 + floor` coins, `4 + floor / 6 rounded down` crystals, plus 3 reward cards |
| Mimic kill | `20 + floor * 2` coins and `5 + floor / 5 rounded down` crystals |
| Prospector's Pick kill bonus | 10% per kill; then 50% for 1-2 coins, 50% for 1 crystal |
| Fortune Card crit bonus | 25% per crit; then 65% for 1-2 coins, 35% for 1 crystal |
| Mask of Hollow Whispers | 15% enemy death chance to leave a random card in the enemy spot |

### Coin Card Scaling

Coin cards remain a small tactical cache, not a replacement for the once-per-floor combat-clear payout. Their value rises by 1 every eight floors so store access keeps pace with prices:

`minimum = 3 + floor(floor / 8)`; payout is `minimum` through `minimum + 3`.

| Floors | Coin card payout |
|---|---:|
| 1-7 | 3-6 |
| 8-15 | 4-7 |
| 16-23 | 5-8 |
| 24-31 | 6-9 |
| 32-39 | 7-10 |
| 40-45 | 8-11 |

Chest rewards:

| Chest type | Coins | Crystals | Item rarity target |
|---|---:|---:|---|
| Treasure | `8 + floor / 3 rounded down` | `1 + floor / 14 rounded down` | Uncommon, capped by act |
| Good treasure | `12 + floor / 2 rounded down` | `1 + floor / 12 rounded down` | Rare, or Epic from floor 38+, capped by act |
| Elite chest | `15 + floor / 2 rounded down` | `2 + floor / 10 rounded down` | Rare, capped by act |
| Forced chest open | 75% coins, at least 1 crystal at 50%, item rarity downgraded 1 tier |
| Forced chest trap | 45% chance, deals 5 HP |

Reward rarity cap:

| Floor band | Max reward rarity from capped rewards |
|---|---|
| Floors 1-15 | Uncommon |
| Floors 16-30 | Rare |
| Floors 31+ | Legendary |

Chest reward item roll:

| Item type | Chance |
|---|---:|
| Weapon | 45% |
| Armor | 40% |
| Magic | 15% |

## Enemies

Normal enemies use the highest tier whose `minFloor` is at or below the current floor. Elite rooms pass an elite flag into enemy generation.

Enemy roles matter tactically. Melee enemies form the front line and can block access to ranged enemies. Ranged enemies pressure the player from behind, so the player may need to kill or reveal melee blockers first, carry a bow, or use a melee weapon with Lightning to reach archers through chain damage.

Elite rooms also promote one non-boss enemy into a mini-boss with +30% HP and +30% attack. When revealed, that mini-boss card is slightly lighter so the player can read it as the elite threat.

| Enemy | Role | Min floor | Tiers: min floor / attack / HP | Abilities |
|---|---|---:|---|---|
| Skeleton | Melee | 1 | 1: 6/9; 5: 8/12; 10: 8/12; 15: 8/14; 31: 11/20 | None |
| Spider | Melee | 3 | 3: 5/8; 8: 6/10; 13: 5/9; 16: 6/9; 18: 7/13; 31: 10/18 | Poison 2 for 3 turns, stackable |
| Goblin | Melee | 4 | 4: 6/10; 11: 8/12; 16: 9/14; 20: 9/14; 31: 11/20 | 50% chance steal 1 coin |
| Goblin Archer | Ranged | 2 | 2: 3/5; 7: 4/8; 12: 4/7; 16: 5/7; 22: 7/10; 31: 8/13 | None |
| Skeleton Archer | Ranged | 6 | 6: 3/6; 11: 4/8; 16: 5/8; 17: 5/8; 25: 7/10; 31: 8/13 | None |
| Lost Soul | Melee | 16 | 16: 6/8; 24: 7/10; 31: 9/13 | 30% evade |
| Cerberus Head | Melee | 16 | 16: 7/9; 31: 9/12 | Summon-only enemy |
| Angry Nestmother | Ranged | Event-driven | Based on skeleton tier: HP x1.2, attack +2 | Appears if player stole the egg |
| Mimic | Melee | 3+ via card weight | HP `8 + floor / 2 rounded down`, attack 2 | Must be killed within 3 turns or escapes |

## Bosses

Each act rolls one boss from the act tier.

| Act / floor | Boss | HP | Attack | Abilities |
|---|---|---:|---:|---|
| Act 1 / 15 | Giant Skeleton | 36 | 7 | 30% summon 1 skeleton |
| Act 1 / 15 | Goblin King | 40 | 8 | 50% steal 3 coins, 30% summon 1 goblin |
| Act 1 / 15 | Spider Queen | 36 | 7 | Poison 5 for 5 turns, stackable; 30% summon 1 spider |
| Act 2 / 30 | Soul Eater | 110 | 16 | 15% evade, 20% summon 1 Lost Soul, armor break 3, rage below 35% HP for x1.5 damage |
| Act 2 / 30 | Lich | 84 | 14 | Lifesteal 50%, 20% summon 1 skeleton |
| Act 2 / 30 | Cerberus | 118 | 17 | Rage below 40% HP for x1.5 damage, armor break 5, 25% summon 1 Cerberus Head |
| Act 3 / 45 | Ancient Cerberus | 136 | 22 | Rage below 30% HP for x2 damage, armor break 6, 30% summon 1 Cerberus Head |

## Weapons

Merging compatible durability cards restores the upgraded card to full durability. This makes merging both an upgrade path and a repair-like pressure release for worn weapons, armor, and thorns.

| Weapon | Rarity | Unlock floor | Damage | Durability | Special |
|---|---|---:|---:|---:|---|
| Dagger | Common | 1 | 3 | 4 | Dual wield |
| Dagger | Uncommon | 10 | 4 | 5 | Dual wield |
| Dagger | Rare | 18 | 5 | 6 | Dual wield |
| Dagger | Epic | 26 | 6 | 7 | Dual wield |
| Dagger | Legendary | 34 | 7 | 8 | Dual wield |
| Bow | Common | 8 | 4 | 5 | Ranged, block |
| Bow | Uncommon | 18 | 5 | 6 | Ranged, block |
| Bow | Rare | 24 | 6 | 7 | Ranged, block |
| Bow | Epic | 30 | 7 | 8 | Ranged, block |
| Bow | Legendary | 38 | 9 | 9 | Ranged, block |
| Sword | Common | 16 | 6 | 6 | None |
| Sword | Uncommon | 19 | 7 | 8 | None |
| Sword | Rare | 22 | 8 | 10 | None |
| Sword | Epic | 25 | 9 | 11 | None |
| Sword | Legendary | 28 | 10 | 13 | None |
| Axe | Common | 31 | 7 | 6 | Special attack |
| Axe | Uncommon | 34 | 9 | 8 | Special attack |
| Axe | Rare | 37 | 11 | 10 | Special attack |
| Axe | Epic | 40 | 13 | 12 | Special attack |
| Axe | Legendary | 43 | 16 | 14 | Special attack |

## Armor

| Armor | Rarity | Unlock floor | Protection | Durability | Extra |
|---|---|---:|---:|---:|---|
| Leather | Common | 1 | 1 | 15 | 5% dodge |
| Leather | Uncommon | 10 | 2 | 20 | 8% dodge |
| Leather | Rare | 18 | 3 | 25 | 10% dodge |
| Leather | Epic | 26 | 4 | 28 | 12% dodge |
| Leather | Legendary | 34 | 5 | 30 | 15% dodge |
| Chain | Common | 16 | 2 | 15 | None |
| Chain | Uncommon | 19 | 3 | 20 | None |
| Chain | Rare | 22 | 4 | 25 | None |
| Chain | Epic | 25 | 5 | 28 | None |
| Chain | Legendary | 28 | 7 | 30 | None |
| Plate | Common | 31 | 3 | 15 | None |
| Plate | Uncommon | 34 | 5 | 20 | None |
| Plate | Rare | 37 | 7 | 25 | None |
| Plate | Epic | 40 | 9 | 28 | None |
| Plate | Legendary | 43 | 11 | 30 | None |

## Other Card Types

| Card | Values |
|---|---|
| Thorns | Common 1 dmg/6 durability/cost 8; Uncommon 2/7/12; Rare 3/9/18; Epic 4/10/23; Legendary 5/11/28 |
| Potion cards generated on floors | Always Minor Healing Potion in current generator: 35 HP, common, cost 5 |
| Food cards generated on floors | Always Bread in current generator: 25 AP, common, cost 2 |
| Egg | 30 AP food, uncommon, cost 6; can hatch into Chick Companion |
| Chick Companion | Rare, attack 2 lightning damage after enemy turns, cost 20, unique |
| Skeleton Warrior | Rare, attack 3 melee physical, cost 20, unique |
| Gems | Fire, Poison, Lightning; each is common; 1 random effect |
| Key | Mysterious Key, rare |
| Empty | Nothing |

Defined potion merge tiers:

| Tier | Potion | Heal | Min floor | Rarity | Cost |
|---:|---|---:|---:|---|---:|
| 1 | Minor Healing Potion | 35 | 1 | Common | 5 |
| 2 | Healing Potion | 70 | 5 | Common | 7 |
| 3 | Strong Healing Potion | 110 | 10 | Uncommon | 10 |
| 4 | Greater Healing Potion | 200 | 15 | Uncommon | 18 |

Defined food merge tiers:

| Tier | Food | AP | Min floor | Rarity | Cost |
|---:|---|---:|---:|---|---:|
| 1 | Bread | 25 | 1 | Common | 2 |
| 2 | Rations | 30 | 3 | Common | 4 |
| 3 | Hearty Meal | 35 | 6 | Uncommon | 7 |
| 4 | Feast | 40 | 8 | Rare | 13 |

Magic cards:

Magic cards take an inventory slot during the run. They are collected from the board or shops, then dragged from inventory to cast. A successful cast consumes the card, except when Moth-Wing Dust returns it (25% chance). This makes magic a flexible tactical resource, but also an inventory-space decision.

| Magic | Min floor | Rarity | Cost | Effect |
|---|---:|---|---:|---|
| Fireball | 1 | Uncommon | 8 | 15 damage to single enemy |
| Mirror Shield | 2 | Common | 6 | Reflect next enemy attack |
| Restoration | 2 | Uncommon | 10 | Fully restores HP and AP |
| Frost Ring | 3 | Rare | 12 | Freezes all enemies for 3 turns |
| Magic Shield | 3 | Uncommon | 8 | Armor +20% for 10 turns |
| Weakness | 4 | Uncommon | 10 | Reduces all enemy damage by 30% |
| Shadow Blade | 5 | Rare | 15 | Attack damage +50% for 10 turns |
| Bone Wall | 6 | Rare | 14 | Reflects next 2 enemy attacks |
| Smoke Screen | 7 | Rare | 16 | Flips all face-up enemies down |
| Soul Drain | 8 | Legendary | 25 | Kills a non-boss enemy and heals 30 HP |

## Shops And Costs

Regular shop stock:

| Slot | Item |
|---|---|
| 1 | Potion |
| 2 | Weapon |
| 3 | Armor |
| 4 | Thorns |
| 5 | Magic |
| 6 | Random duplicate: weapon x3, magic, potion, thorns, armor, or food |
| 7 | Amulet, paid in crystals |
| Bonus | Merchant's Seal adds +1 weapon/armor slot per stack, uncommon before floor 15 and rare from floor 15+ |

Regular item price formula:

`floor( (5 + floor * 2) * rarityMultiplier + typeBonus )`

| Rarity | Multiplier |
|---|---:|
| Common | 1 |
| Uncommon | 1.5 |
| Rare | 2 |
| Epic | 2.5 |
| Legendary | 3 |

| Type | Added price |
|---|---|
| Weapon | +damage |
| Armor | +protection x2 |
| Thorns | +thorn damage x3 |
| Magic | Final price x1.2 |
| Artifact flag | Final price x2 |

Amulet crystal price:

`max(1, floor(2 * rarityMultiplier) + floor(activeAmulets / 3))`

| Amulet rarity | Crystal multiplier |
|---|---:|
| Common | 1 |
| Uncommon | 1.5 |
| Rare | 2 |
| Legendary | 3 |
| Cursed | 1.5 |

Sell price: 40% of buy price.

Rare shop stock:

| Item | Price |
|---|---:|
| Amulet | `max(2, floor / 10 rounded down + 2)` crystals |
| Uncommon weapon 1 | `20 + floor * 5` coins |
| Uncommon weapon 2 | `25 + floor * 5` coins |
| Thorns, rare target capped by act | `15 + floor * 4` coins |
| Random gem | `18 + floor * 4` coins |
| Chick Companion, if unlocked | 35% chance, `35 + floor * 3` coins |
| Skeleton Warrior, if unlocked | 35% chance, `35 + floor * 3` coins |
| Merchant's Seal bonus slot | Rare or Epic from floor 38+, capped by act, `30 + floor * 5` coins |

Anvil repair:

| Item | Cost |
|---|---|
| Armor | 2 coins per 5 durability |
| Thorns | 2 coins per durability |
| Dagger | Common 1, higher tiers 2 per durability |
| Bow | Common/Rare 2, Legendary 3 per durability |
| Sword | 2 per durability |
| Axe | 4 per durability |

Rest room: heals 20 HP and fully restores AP.

## Amulets

Random amulet drops exclude most event-only amulets. Non-stackable amulets already owned are hidden from future drops/shops. Regeneration can stack.

| Amulet | Rarity | Random pool min floor / weight | Effect |
|---|---|---|---|
| Bottomless Bag | Common | 1 / 7 | +2 inventory slots |
| Amulet of Regeneration | Uncommon | 1 / 10 | +1 HP per stack at end of each floor |
| Pouch of Greed | Uncommon | 1 / 10 | +30% gold found |
| Healing Ring | Uncommon | 2 / 10 | Potions and spell healing +20% |
| Stoneheart Medallion | Uncommon | 2 / 8 | +10 max HP and +10 current HP |
| Camp Cook's Toque | Uncommon | 2 / 8 | Food restores 50% more AP |
| Diviner's Spade | Uncommon | 2 / 7 | +5 max AP and +5 current AP |
| Golden Seed | Uncommon | 2 / 7 | +1 max HP whenever discarding a card |
| Boots of Evasion | Uncommon | 3 / 8 | 10% dodge chance |
| Moonwell Phial | Uncommon | 3 / 8 | Restores +2 AP at floor end |
| Skeleton's Lockpicks | Rare | 3 / 5 | Treasure chests open without key |
| Merchant's Seal | Rare | 3 / 5 | +1 bonus shop slot with better quality |
| Prospector's Pick | Uncommon | 3 / 7 | 10% kill chance for 1-2 coins or 1 crystal |
| Quickhand Gloves | Rare | 4 / 6 | 15% chance for free actions |
| Wayfinder's Compass | Rare | 4 / 5 | Reveals one extra non-enemy card at floor start |
| Watcher's Lamp | Rare | 4 / 5 | Briefly reveals one trap at floor start |
| Lute of First Light | Uncommon | 3 / 6 | First melee enemy on each floor skips first attack |
| Wayfarer's Map | Rare | 4 / 5 | +1 max AP every other floor, capped at +15 |
| Vampiric Ring | Uncommon | 4 / 7 | Heal 2 HP per enemy kill |
| Greasewing's Feast | Uncommon | 5 / 6 | One card per floor becomes food, except boss rooms |
| Chronos Heart | Rare | 5 / 5 | +3 max AP |
| Mask of Hollow Whispers | Rare | 5 / 5 | 15% enemy death chance to leave a random card |
| Sunstone | Rare | 6 / 5 | +1 max HP for every card left behind when floor clears |
| Traveler's Journal | Rare | 6 / 4 | +2 max HP for each unique amulet carried |
| Siren's Perfume | Rare | 6 / 4 | 15% chance enemies attack their own kind instead of you |
| Tempered Ingot | Rare | 6 / 6 | Weapons lose half durability |
| Dragon Claw | Rare | 8 / 5 | +1 weapon damage |
| Ember of Defiance | Cursed | 8 / 4 | +20% damage below 30% HP, +10% damage taken |
| Soul Harvester | Rare | 10 / 4 | Heal 1 HP per kill, +1 AP every 3 kills |
| Carrion Oath | Rare | 10 / 4 | Healing potion cures poison and heals +2 HP per poison stack removed |
| Rune of Balance | Cursed | 10 / 4 | +3 HP per kill, -30% max HP |
| Ember Rune | Uncommon | 10 / 5 | Fire gem splash radius +25 pixels |
| Berserker's Warbelt | Cursed | 14 / 3 | +50% damage below 50% HP, potions cannot heal above 50% |
| Lost Princess's Diadem | Legendary | 15 / 2 | Prevents death once per run |
| Tea Room Bell | Rare | Event-only | +4 AP entering non-battle rooms |
| Moth-Wing Dust | Rare | Event-only | Magic cards have 25% chance to return after use |
| Worm Venom Charm | Rare | Event-only | Poison attacks/effects are nullified |
| Stolen Ink Pen | Rare | Event-only | Gain 1 coin whenever discarding a card |
| Lucky Clover | Rare | Event-only | +3% crit chance |
| Fortune Card | Rare | Event-only | +8% crit chance; crits can drop 1-2 coins or 1 crystal |

## Death Relics

Relics are unlocked after death. For regular enemies, matching is broad: any killer name containing spider, skeleton, or goblin can award that enemy family's next unowned relic.

| Death or milestone | Relic | Effect |
|---|---|---|
| Death to spider | Spider Venom | Weapons have 20% chance to poison enemies for 2 damage over 3 turns |
| Later death to spider | Webweaver's Thread | 10% chance a merged card respawns face-down on the board |
| Death to skeleton | Bone Armor | Start each run with Common Bone Armor, 2 protection, 15 durability |
| Later death to skeleton | Gravebloom Bundle | Heal 2 HP at the start of every combat floor |
| Death to goblin | Goblin War Horn | First attack each floor deals double damage |
| Later death to goblin | Scavenger's Coffer | +20% coins from all sources |
| Death to Giant Skeleton | Giant's Morningstar | All weapons deal +1 damage |
| Death to Spider Queen | Queen's Antivenom | Poison immunity |
| Death to Lich | Lich's Covenant | Heal 1 HP per enemy killed, -10 max HP |
| 3 total deaths | Ironhide Tonic | Armor loses durability half as often |
| 5 total deaths | Veteran's Carryall | +1 permanent inventory slot |
| Best floor 7+ | Wayfarer's Camp | +1 max HP whenever a durability card is fully used |
| Best floor 10+ | Dungeonmaster's Spectacles | See one extra card at start |
| After all relics owned | Veteran HP fallback | +2 permanent max HP per eligible death, capped at +20 |

## Events Without Story Text

Story/event tone reference: Life in Adventure (`https://play.google.com/store/apps/details?id=com.StudioWheel.Bard`) is a useful comparison for short fantasy encounters with meaningful choices and mechanical consequences.

Only choices, conditions, costs, and outcomes are listed here.

| Event | Choice | Condition / cost | Player gets or loses |
|---|---|---|---|
| Broken Music Box | Force it open | None | Takes 35 damage. If alive, gains 16 coins. Queues Monster Bird Nest. |
| Broken Music Box | Open it carefully | Requires key card or Skeleton's Lockpicks | Consumes key unless using Lockpicks. Gains 1 crystal. Queues Monster Bird Nest. |
| Broken Music Box | Leave it alone | None | Heals 5 HP. Queues Monster Bird Nest. |
| Monster Bird Nest | Grab just the cog | None | Gets story cog. Queues Goblin Engineer. |
| Monster Bird Nest | Grab the egg and the cog | None | Gets Egg or fallback reward, takes 20 damage, equipped armor loses 1 durability, Nestmother can appear later. Queues Goblin Engineer. |
| Monster Bird Nest | Leave the nest alone | None | No immediate reward. Queues Goblin Engineer. |
| Goblin Engineer | Refuse to pay | None | Repair chance 50% if cog exists, otherwise 50%; success: +1 inventory slot; failure: +12 coins and +1 crystal. |
| Goblin Engineer | Give unwanted card for parts | Requires cog and sacrifice card | Consumes first non-essential card. Repair chance 80%; success: +1 inventory slot; failure: +12 coins and +1 crystal. |
| Goblin Engineer | Pay full repair | Requires cog and 30 coins | Pays 30 coins. Repair chance 100%; success: +1 inventory slot. |
| Egg Hatches | See what hatches | Requires pending egg event | Egg can become Chick Companion. |
| Too-Nice Room | Rest in bed | None | Full heal, then loses a random non-key/non-potion card if possible; otherwise loses up to 10 coins. |
| Too-Nice Room | Leave | None | No reward. |
| Too-Nice Room | Inspect, then confront fairy | Inspect branch | Gains random amulet. |
| Too-Nice Room | Inspect, then fight fairy | Inspect branch | Loses up to 12 HP, loses up to 4 AP, gains Tea Room Bell. |
| Book Worm | Feed it a magic card | Requires magic card | Consumes a magic card, gains Moth-Wing Dust. |
| Book Worm | Squish it | None | Gains Worm Venom Charm. |
| Book Worm | Put it back | None | Gains Stolen Ink Pen. |
| Briar Room | Offer weapon/armor | Requires dragging a weapon or armor | Weapon gains +1 permanent damage, or armor gains +1 thorn damage. |
| Briar Room | Slash vines | None | Loses up to 10 HP, gains rare Thorns Card. |
| Briar Room | Burn vines | Requires Fireball | Consumes Fireball, gains random amulet. |
| Briar Room | Leave | None | No reward. |
| Old Drill Room | Search room | No qualifying companion | Gains 5 coins. |
| Old Drill Room | Train Storm Chick | Companion fought in 3 rooms and not upgraded | Chick becomes Storm Hatchling: 20% chance to shock for 1 turn. |
| Old Drill Room | Train Skeleton Warrior | Companion fought in 3 rooms and not upgraded | Skeleton Warrior becomes Slimebone Guard: +1 protection while carried. |
| Old Drill Room | Train other companion | Companion fought in 3 rooms and not upgraded | Companion gains +1 damage. |
| Something Wicked | Buy dusty pipe | 1 coin and inventory room | Gains Dusty Pipe junk card. Queues Brass Wizard. |
| Something Wicked | Buy rubber duck | 1 coin and inventory room | Gains Rubber Duck junk card. Queues Brass Wizard. |
| Something Wicked | Buy broken ring | 1 coin and inventory room | Gains Broken Ring junk card. Queues Brass Wizard. |
| Something Wicked | Buy four-leaf clover | 1 coin | Gains Lucky Clover as inventory amulet if possible, otherwise auto-equips it. Queues Brass Wizard. |
| Something Wicked | Refuse | None | Loses up to 3 HP. Queues Brass Wizard. |
| Brass Wizard | Insert 1 coin | 1 coin | 25% no reward; 30% random respectable card; 25% opens tray interaction; 20% gains Fortune Card. |
| Brass Wizard tray | Trade carnival junk | Requires dropping carnival junk | Consumes junk, gains Holographic Omen passive card. |
| Brass Wizard tray | Reroll card | Drop non-junk, non-companion, non-egg card | Consumes old card, gives different card of same type/rarity when possible. |
| Brass Wizard | Leave booth / pull hand back | None | No reward. |
| Well of Almost-You | Reach into well | None | Opens gear trade drop zone. Dropping weapon/armor/thorns converts it into one of the other gear categories at same rarity. |
| Well of Almost-You | Drop crystal | 1 crystal | Pays 1 crystal and opens gear trade drop zone. |
| Well of Almost-You | Walk away | None | No reward. |
| Copying Mirror | Leave mirror | None | No reward. Mirror interaction itself duplicates a valid non-unique, non-egg inventory card when dropped onto mirror. |
| Slimy Prison | Pull him free | None | Gains Skeleton Warrior companion and unlocks future rare-shop Skeleton Warrior chances. |
| Slimy Prison | End his suffering | None | Gains random cursed amulet. |
| Slimy Prison | Grab floating amulet | None | Gains random non-cursed amulet, but loses up to 8 HP. |
| Quiet Crossroads | Gain 10 coins | None | +10 coins. |
| Quiet Crossroads | Heal 5 HP | None | +5 HP. |
| Quiet Crossroads | Leave | None | No reward. |
