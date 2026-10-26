# Sigils vs amulets: draft for Taya and Petr

**Status: draft, nothing here is in the game yet.** Rules are as of pre-alpha 0.2 (`src/content/sigils/sigils.js`).

## The rule

> **A sigil only makes sense on this card, in this spot. An amulet is about you and the whole run.**
>
> Amulets change you; sigils change your bag.

The quick test: *if this card could do its job from anywhere in the bag, or without being used, it is really an
amulet.* Kinship (+1 to the weapons in the slots on either side of it) is the model: it means something only
because it sits in one slot, and an amulet has no slot.

This is about the **player's** side only. Enemies have no amulets, so an enemy sigil can be anything: the
enemy rules stay as they are, even where the player side changes below.

Please mark each row ✔ (agree), ✘ (keep as it is), or write something else.

## 1. Copies of an amulet

The same effect as an amulet, word for word or nearly. Cut the player side, or give it a card-shaped twist.

| Sigil | Player rule now | Same as | Proposal |
|---|---|---|---|
| Keen | +5% crit chance | Starfall Pendant (identical text) | **Cut.** Or twist: "this weapon's crits ignore armor" |
| Leech | Heal 15% of damage dealt | Vampire Fang (identical) | **Cut.** Or twist: "a kill with this weapon heals what the hit overkilled" |
| Cutpurse | +1 coin on each hit | Pouch of Greed (+20% gold) | **Cut**, keep Bounty |
| Bounty | A kill gives +2 coins | Pouch of Greed | Keep: it asks you to finish enemies with *this* weapon |
| Mirror (armor) | First enemy attack each fight goes back | Hand Mirror (5% chance) | Keep: it lives on the worn armor and is not a chance |

## 2. Amulets in disguise

They work "carried or worn", from anywhere in the bag. Make them **positional**, like Kinship, so where a card
goes becomes a choice.

| Sigil | Player rule now | Proposal |
|---|---|---|
| Companion Strength | Carried or worn: your companions deal +1 | Companions **in the slots next to this card** deal +1 |
| Regenerate | Carried or worn: heals 1 HP per companion each enemy turn | Heals 1 HP per companion **next to this card** |
| Pack Strength | +1 weapon damage per companion in the bag | +1 per companion **next to this weapon** (+2 at most) |
| Packrat | +1 damage per empty bag slot | Keep, or: +1 per **empty slot next to it**. The bag-wide version fights against carrying anything |

## 3. Chance-on-hit effects

About twenty sigils read "10-20% chance on a hit: something happens". They are about the weapon, so they pass
the rule, but they blur together and the player cannot plan around a dice roll. Keep the ones with a clear
identity (a status the game already shows), and cut or merge the rest.

| Sigil | Player rule now | Proposal |
|---|---|---|
| Venom | Poisons the enemy hit: 1 for 3 turns | **Keep** (always, not a chance) |
| Frost | 25%: the enemy hit skips its next turn | **Keep** |
| Shock | 10%: the target misses its next attack, bosses too | **Keep** |
| Sunder | Each hit strips 1 armor | **Keep** (always) |
| Scorched | 10%: 3 burn to every enemy | **Keep** |
| Sandstorm (daze) | 20%: the enemy misses its next attack | Merge into **Web**: both are "it misses its next attack" |
| Web | 15%: the enemy misses its next attack | Keep, takes Sandstorm's place |
| Sapping | 20%: the enemy's next attack is 30% weaker | Cut: a weaker version of Web |
| Crushing | 15%: x1.5 and ignores armor | Cut, or fold the armor part into Sunder |
| Fireball | 10%: a fireball at another enemy for half the hit | Keep (the only "hits a second enemy") |
| Venomous Bomb | 10%: 3 poison to every enemy | Cut: Scorched with poison |
| Quick Strike | 10%: strikes the same enemy again | Merge with **Echo** into one |
| Echo | 10%: strikes again for half | Merge with Quick Strike |
| Devouring | 8%: kills a non-boss outright | Keep: the big rare moment |
| Second Wind | 10%: +2 AP | Cut: an AP amulet's job (Quickstep Charm) |
| Mending | 10%: repairs 1 pip on a damaged item | Cut, or make positional: "repairs the card next to it" |
| Forage | 10%: food appears on the board | Cut: board/map luck is amulet ground |
| Growth | +1 max HP on a damaging hit | Cut: a run-wide stat (Mossy Stone does this) |
| Bulwark | Chance to block the next attack | Keep one of Bulwark / Briar Guard / Warding |
| Briar Guard | Chance to reflect the next attack | (see Bulwark) |
| Warding | 20%: armor 20% stronger for a turn | (see Bulwark) |
| Ash Cloud | A kill hides another enemy | Keep: a kill trigger, not a chance |

## 4. Already good: they depend on the card itself

No change. These are the model for new sigils.

- **Position:** Kinship, Ironclad (the worn armor feeds this weapon).
- **The card's own state:** Twin Socket, Tempered (keeps its pip), Honed, Hunter, Combo, Riposte, Bloodlust.
- **Its gem:** Conductive, Venom Splash, Venom Stacking.
- **Worn armor:** Thorns, Fleetfoot, Mirror.
- **When to swing it:** Archer Bane, Well Fed, Desperate, Frozen Hammer (merciless), Ambush, Unscathed, Shatter,
  Charged, Outnumbered. Each is x1.5 in one situation, so they make you pick which weapon to use, which is a
  card choice.

Already retired, no change: Tandem, Ransom, Warcry, Charm, Scout. Not working yet: Zap.

## 5. New sigils in Kinship's style

The bag layout is the space amulets can never use, and only Kinship uses it today. Ideas, not balanced:

| Idea | Rule |
|---|---|
| Whetstone | The weapon to the **left** keeps its pip on a hit |
| Bellows | Gems on the cards **next to this one** deal +1 |
| Echoing | **Doubles** the sigil of the card on its **right** |
| Shield Wall | Armor cards **next to this one** get 1 pip back after each fight |
| Quiver | Bows **next to this card** cost no pip on their first shot each fight |
| Lonely | x1.5 while **both** neighbouring slots are empty |

## Questions for Petr

1. Cut or twist the copies (Keen, Leech)? A twist keeps the art and the drops.
2. Do sigils on enemies need the same trim? (Draft says no: enemies have no amulets.)
3. How many chance-on-hit sigils should survive? The draft keeps about 10 of 22.
4. Which of the new positional ideas fit the story of where sigils come from?
