// Every resolved talent effect must be a plain number (or null for the armour
// pick). A rank whose value is a {perFloor, cap} spec has to be run through
// accumulate() — when two of them were not, the spec object leaked out as
// `frontVolleyPct`, the `pct <= 0` guard did not reject it, and the volley dealt
// NaN damage that made enemies unkillable. Nothing failed loudly; the ladder
// just quietly lost 20 points of win rate.
import assert from 'node:assert/strict';
import { resolveTalentEffects, TALENT_NODES, getBranchesForCharacter } from '../src/content/talents/index.js';

for (const characterId of ['rogue', 'warrior']) {
  const branch = getBranchesForCharacter(characterId).find((b) => b.purchasable);
  if (!branch) continue;
  const maxed = {};
  for (const id of branch.nodes) maxed[id] = TALENT_NODES[id]?.maxRank || 1;

  for (const floorsCleared of [0, 10, 24, 44]) {
    const effects = resolveTalentEffects(characterId, maxed, {}, { floorsCleared });
    for (const [key, value] of Object.entries(effects)) {
      if (value === null || typeof value === 'string') continue;
      assert.equal(
        typeof value, 'number',
        `${characterId}: talent effect ${key} resolved to ${JSON.stringify(value)} `
        + `at floorsCleared=${floorsCleared} — a {perFloor, cap} spec that never `
        + 'reached accumulate()',
      );
      assert.ok(
        Number.isFinite(value),
        `${characterId}: talent effect ${key} is not finite (${value})`,
      );
    }
  }
}
// No dead ranks. Spending XP and getting the exact same numbers back is the
// worst purchase a meta tree can offer, and it is easy to author by accident:
// Keen Edge once read [1, 1, 1, 2, 2], and Twin Fang's percentages all collapsed
// onto the same integer after rounding, so four of its five ranks changed
// nothing at all. Every rank must differ from the one below it SOMEWHERE in a
// run — not necessarily on every floor, but somewhere a player would see it.
const FLOORS = Array.from({ length: 45 }, (_, i) => i);
for (const characterId of ['rogue', 'warrior']) {
  const branch = getBranchesForCharacter(characterId).find((b) => b.purchasable);
  if (!branch) continue;
  for (const talentId of branch.nodes) {
    const node = TALENT_NODES[talentId];
    const maxRank = node?.maxRank || 1;
    for (let rank = 2; rank <= maxRank; rank++) {
      const differs = FLOORS.some((floorsCleared) => {
        const lo = resolveTalentEffects(characterId, { [talentId]: rank - 1 }, {}, { floorsCleared });
        const hi = resolveTalentEffects(characterId, { [talentId]: rank }, {}, { floorsCleared });
        return JSON.stringify(lo) !== JSON.stringify(hi);
      });
      assert.ok(
        differs,
        `${characterId}: ${talentId} rank ${rank - 1} -> ${rank} changes nothing on any `
        + 'floor — that rank costs XP and gives the player exactly what they had',
      );
    }
  }
}

// Two ranks must not read the same either. A rank that changes the numbers but
// describes itself identically is the same bad purchase from the player's side:
// Keen Edge once printed "+1 damage" for ranks 1, 2 and 3 because the leading
// term was the base and only the tail differed.
for (const characterId of ['rogue', 'warrior']) {
  const branch = getBranchesForCharacter(characterId).find((b) => b.purchasable);
  if (!branch) continue;
  for (const talentId of branch.nodes) {
    const node = TALENT_NODES[talentId];
    const seen = new Map();
    (node?.descriptionRanks || []).forEach((text, i) => {
      const prev = seen.get(text);
      assert.equal(
        prev, undefined,
        `${characterId}: ${talentId} ranks ${prev + 1} and ${i + 1} print the same text `
        + `("${text}") — the player cannot tell what the purchase bought`,
      );
      seen.set(text, i);
    });
    assert.equal(
      (node?.descriptionRanks || []).length, node?.maxRank || 1,
      `${characterId}: ${talentId} has ${(node?.descriptionRanks || []).length} descriptions `
      + `for ${node?.maxRank} ranks`,
    );
  }
}

console.log('Talent effect, dead-rank and description checks passed.');
