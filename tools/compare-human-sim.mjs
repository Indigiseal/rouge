import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

function isWeapon(card) {
  return card?.type === 'weapon' || Boolean(card?.weaponType);
}

function isMergedWeapon(card) {
  return isWeapon(card) && card.rarity != null && card.rarity !== 'common';
}

function hasAlternativeWeapon(event, chosen) {
  const cards = [
    ...(event.state?.inventory || []).map((entry) => entry?.card),
    event.state?.equipped?.weapon,
  ].filter(Boolean);
  const seen = new Set();
  return cards.some((card) => {
    const identity = card.traceId || `${card.name}:${card.rarity}:${card.durability}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return isWeapon(card)
      && identity !== (chosen?.traceId || `${chosen?.name}:${chosen?.rarity}:${chosen?.durability}`)
      && (
        (card.durability || 0) > 1
        || (card.weaponType === chosen?.weaponType && card.rarity === chosen?.rarity)
      );
  });
}

function sum(items, selector) {
  return items.reduce((total, item) => total + (Number(selector(item)) || 0), 0);
}

export function analyzeHumanTrace(trace) {
  if (!trace || !Array.isArray(trace.events)) {
    throw new Error('Not a human-run trace: expected an object with an events array.');
  }

  const events = trace.events;
  const attacks = events.filter((event) => event.type === 'weapon_attack');
  const lastPipAttacks = attacks.filter((event) => (event.details?.weapon?.durability || 0) === 1);
  const merges = events.filter((event) => event.type === 'cards_merged');
  const weaponMerges = merges.filter((event) => isWeapon(event.details?.result));
  const lowPipWeaponMerges = weaponMerges.filter((event) => (
    (event.details?.sources || []).some((source) => (source?.card?.durability ?? Infinity) <= 1)
  ));
  const twoLowPipWeaponMerges = weaponMerges.filter((event) => {
    const weapons = (event.details?.sources || []).map((source) => source?.card).filter(isWeapon);
    return weapons.length === 2 && weapons.every((weapon) => (weapon.durability ?? Infinity) <= 1);
  });
  const daggerRefreshMerges = twoLowPipWeaponMerges.filter((event) => (
    (event.details?.sources || []).every((source) => source?.card?.weaponType === 'dagger')
  ));
  const repairs = events.filter((event) => event.type === 'anvil_repair');
  const consumablesUsed = events.filter((event) => (
    event.type === 'potion_used' || event.type === 'food_used' || event.type === 'magic_used'
  ));
  const spaceMakingConsumables = consumablesUsed.filter((event) => {
    const inventoryWasFull = event.state?.inventoryState
      ? event.state.inventoryState.emptySlots === 0
      : (event.state?.inventory || []).length >= 5;
    const usefulBoardCardVisible = (event.state?.board || []).some((entry) => (
      entry?.revealed && entry.card?.type !== 'enemy' && entry.card?.type !== 'boss'
    ));
    return inventoryWasFull && usefulBoardCardVisible;
  });
  const floorDepartures = events.filter((event) => event.type === 'floor_departed');
  const floorStarts = events.filter((event) => event.type === 'floor_started');
  const availableWeaponCount = (event, weaponType) => {
    const inventoryWeapons = (event.state?.inventory || []).filter((entry) => (
      entry.card?.type === 'weapon' && entry.card?.weaponType === weaponType
    )).length;
    const visibleBoardWeapons = (event.state?.board || []).filter((entry) => (
      entry.revealed
      && entry.card?.type === 'weapon'
      && entry.card?.weaponType === weaponType
    )).length;
    return inventoryWeapons + visibleBoardWeapons;
  };
  const mergeDepthByCard = new Map();
  let mergeCascadeSteps = 0;
  let maxMergeCascadeDepth = 0;
  for (const event of merges) {
    const sourceIds = (event.details?.sources || [])
      .map((source) => source?.card?.traceId)
      .filter(Boolean);
    const sourceDepth = sourceIds.reduce(
      (deepest, id) => Math.max(deepest, mergeDepthByCard.get(id) || 0),
      0
    );
    if (sourceDepth > 0) mergeCascadeSteps++;
    const resultId = event.details?.result?.traceId;
    const resultDepth = sourceDepth + 1;
    if (resultId) mergeDepthByCard.set(resultId, resultDepth);
    maxMergeCascadeDepth = Math.max(maxMergeCascadeDepth, resultDepth);
  }
  const started = events.find((event) => event.type === 'recording_started');
  const runEnd = [...events].reverse().find((event) => event.type === 'run_ended');
  const floorNumbers = events
    .map((event) => event.state?.floor)
    .filter(Number.isFinite);

  return {
    sessionId: trace.sessionId || null,
    partialRun: (started?.state?.floor || 1) > 1 || !runEnd,
    startingFloor: started?.state?.floor ?? null,
    endingFloor: floorNumbers.length ? Math.max(...floorNumbers) : null,
    outcome: runEnd?.details?.outcome || 'recording stopped before run ended',
    counts: {
      events: events.length,
      weaponAttacks: attacks.length,
      weaponBreaks: events.filter((event) => event.type === 'weapon_broke').length,
      lastPipWeaponAttacks: lastPipAttacks.length,
      mergedLastPipWeaponAttacks: lastPipAttacks.filter((event) => isMergedWeapon(event.details?.weapon)).length,
      avoidableLastPipWeaponAttacks: lastPipAttacks.filter((event) => (
        hasAlternativeWeapon(event, event.details?.weapon)
      )).length,
      weaponMerges: weaponMerges.length,
      lowPipWeaponMerges: lowPipWeaponMerges.length,
      twoLowPipWeaponMerges: twoLowPipWeaponMerges.length,
      daggerRefreshMerges: daggerRefreshMerges.length,
      anvilRepairs: repairs.length,
      repairedPips: sum(repairs, (event) => (
        (event.details?.after?.durability || 0) - (event.details?.before?.durability || 0)
      )),
      usefulVisibleLoot: events.filter((event) => event.type === 'board_loot_collected').length,
      gemsSocketed: events.filter((event) => event.type === 'gem_socketed').length,
      potionsUsed: events.filter((event) => event.type === 'potion_used').length,
      restorationUsed: events.filter((event) => (
        event.type === 'magic_used' && event.details?.card?.effect === 'restoration'
      )).length,
      inventoryDiscards: events.filter((event) => event.type === 'inventory_card_discarded').length,
      spaceMakingConsumables: spaceMakingConsumables.length,
      boardLootCollected: events.filter((event) => event.type === 'board_loot_collected').length,
      boardItemsLeftBehind: sum(floorDepartures, (event) => (
        (event.state?.board || []).filter((entry) => (
          entry.card?.type !== 'enemy' && entry.card?.type !== 'boss'
        )).length
      )),
      inventorySlotFills: events.filter((event) => event.type === 'inventory_slot_filled').length,
      inventorySlotEmpties: events.filter((event) => event.type === 'inventory_slot_emptied').length,
      blockedBoardPickups: events.filter((event) => event.type === 'board_loot_pickup_blocked').length,
      weaponBoardPickups: events.filter((event) => (
        event.type === 'board_loot_collected' && event.details?.card?.type === 'weapon'
      )).length,
      potionBoardPickups: events.filter((event) => (
        event.type === 'board_loot_collected' && event.details?.card?.type === 'potion'
      )).length,
      mergeCascadeSteps,
      maxMergeCascadeDepth,
      weaponMaterialsLeftBehind: sum(floorDepartures, (event) => (
        (event.state?.board || []).filter((entry) => entry.card?.type === 'weapon').length
      )),
      nonBossDeparturesWithPotion: floorDepartures.filter((event) => (
        event.details?.roomType !== 'BOSS'
        && (event.state?.inventory || []).some((entry) => entry.card?.type === 'potion')
      )).length,
      bossEntriesWithPotion: floorStarts.filter((event) => (
        event.details?.roomType === 'BOSS'
        && (event.state?.inventory || []).some((entry) => entry.card?.type === 'potion')
      )).length,
      maxAvailableBows: events.reduce(
        (largest, event) => Math.max(largest, availableWeaponCount(event, 'bow')),
        0
      ),
      maxAvailableDaggers: events.reduce(
        (largest, event) => Math.max(largest, availableWeaponCount(event, 'dagger')),
        0
      ),
    },
  };
}

function averageHuman(analyses, key) {
  return analyses.length ? sum(analyses, (entry) => entry.counts[key]) / analyses.length : 0;
}

function fixed(value) {
  return Number(value || 0).toFixed(2);
}

function comparisonRows(analyses, sim) {
  const durability = sim?.durability || {};
  return [
    ['Weapon breaks', averageHuman(analyses, 'weaponBreaks'), durability.weaponBreaksPerRun],
    ['Last-pip attacks', averageHuman(analyses, 'lastPipWeaponAttacks'), durability.lastPipWeaponAttacksPerRun],
    ['Merged weapon last-pip attacks', averageHuman(analyses, 'mergedLastPipWeaponAttacks'), durability.mergedLastPipWeaponAttacksPerRun],
    ['Avoidable last-pip attacks', averageHuman(analyses, 'avoidableLastPipWeaponAttacks'), durability.avoidableLastPipWeaponAttacksPerRun],
    ['Weapon merges', averageHuman(analyses, 'weaponMerges'), durability.weaponMergesPerRun],
    ['Low-pip dagger refresh merges', averageHuman(analyses, 'daggerRefreshMerges'), durability.daggerRefreshMergesPerRun],
    ['Anvil repairs', averageHuman(analyses, 'anvilRepairs'), durability.anvilRepairsPerRun],
    ['Pips repaired', averageHuman(analyses, 'repairedPips'), durability.repairedPipsPerRun],
  ];
}

function printReport(analyses, sim) {
  console.log('\n=== Human vs Simulator Decision Report ===');
  for (const analysis of analyses) {
    console.log(
      `Human trace ${analysis.sessionId || '(unknown)'}: floor ${analysis.startingFloor ?? '?'}`
      + ` to ${analysis.endingFloor ?? '?'}, ${analysis.outcome}`
      + `${analysis.partialRun ? ' (partial run)' : ''}`
    );
  }
  console.log(
    `Inventory decisions per trace: ${fixed(averageHuman(analyses, 'inventoryDiscards'))} discards,`
    + ` ${fixed(averageHuman(analyses, 'spaceMakingConsumables'))} consumables used while full with visible loot,`
    + ` ${fixed(averageHuman(analyses, 'boardLootCollected'))} board pickups,`
    + ` ${fixed(averageHuman(analyses, 'boardItemsLeftBehind'))} items deliberately left at departure`
  );
  console.log(
    `Merge flow per trace: ${fixed(averageHuman(analyses, 'weaponBoardPickups'))} weapon pickups,`
    + ` ${fixed(averageHuman(analyses, 'blockedBoardPickups'))} blocked pickup attempts,`
    + ` ${fixed(averageHuman(analyses, 'mergeCascadeSteps'))} merges that reused a prior merge result,`
    + ` depth ${fixed(averageHuman(analyses, 'maxMergeCascadeDepth'))}`
  );
  console.log(
    `Carry policy per trace: potion held on ${fixed(averageHuman(analyses, 'nonBossDeparturesWithPotion'))}`
    + ` non-boss departures and ${fixed(averageHuman(analyses, 'bossEntriesWithPotion'))} boss entries;`
    + ` peak available bows ${fixed(averageHuman(analyses, 'maxAvailableBows'))},`
    + ` daggers ${fixed(averageHuman(analyses, 'maxAvailableDaggers'))}`
  );

  if (sim) {
    console.log(`Simulator: ${sim.runs} runs, ${(100 * (sim.outcome?.winRate || 0)).toFixed(1)}% wins`);
    console.log('\nMetric                              Human/trace   Sim/run   Difference');
    console.log('-------------------------------------------------------------------');
    for (const [label, human, simulated] of comparisonRows(analyses, sim)) {
      const simValue = Number(simulated || 0);
      console.log(
        `${label.padEnd(35)} ${fixed(human).padStart(8)}   ${fixed(simValue).padStart(7)}   ${fixed(human - simValue).padStart(10)}`
      );
    }
  } else {
    console.log('\nHuman decision counts (average per supplied trace):');
    const counts = analyses[0]?.counts || {};
    for (const key of Object.keys(counts)) {
      console.log(`  ${key}: ${fixed(averageHuman(analyses, key))}`);
    }
    console.log('\nAdd --sim-summary=<file> to compare with a simulator summary.');
  }

  const humanLastPip = averageHuman(analyses, 'lastPipWeaponAttacks');
  const simLastPip = Number(sim?.durability?.lastPipWeaponAttacksPerRun || 0);
  if (sim && simLastPip > humanLastPip + 0.25) {
    console.log('\nFinding: the simulator spends the last weapon pip more often than the recorded player.');
  }
  const humanAvoidable = averageHuman(analyses, 'avoidableLastPipWeaponAttacks');
  const simAvoidable = Number(sim?.durability?.avoidableLastPipWeaponAttacksPerRun || 0);
  if (sim && simAvoidable > humanAvoidable + 0.25) {
    console.log('Finding: many simulator breaks are avoidable because another usable weapon was already carried.');
  }
}

function usage() {
  console.log(
    'Usage: node tools/compare-human-sim.mjs <human-trace.json> [more traces...]'
    + ' [--sim-summary=sim-summary.json] [--json]'
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    usage();
  } else {
    const tracePaths = args.filter((arg) => !arg.startsWith('--'));
    const simPath = args.find((arg) => arg.startsWith('--sim-summary='))?.slice('--sim-summary='.length);
    if (!tracePaths.length) {
      usage();
      process.exitCode = 1;
    } else {
      const analyses = tracePaths.map((path) => analyzeHumanTrace(readJson(path)));
      const simulator = simPath ? readJson(simPath) : null;
      if (args.includes('--json')) {
        console.log(JSON.stringify({ human: analyses, simulator }, null, 2));
      } else {
        printReport(analyses, simulator);
      }
    }
  }
}
