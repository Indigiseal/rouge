// Authoritative talent display strings (ASCII-only for pixel font safety).

export const TALENT_DISPLAY = Object.freeze({
  "keenEdge": Object.freeze({
    name: "Keen Edge",
    descriptionRanks: Object.freeze(["First dagger or bow attack each floor deals +1 damage.","First dagger or bow attack each floor deals +2 damage.","First dagger or bow attack each floor deals +3 damage."]),
  }),
  "firstBlood": Object.freeze({
    name: "First Blood",
    descriptionRanks: Object.freeze(["First attack each floor deals +25% damage.","First attack each floor deals +40% damage.","First attack each floor deals +55% damage."]),
  }),
  "twinFang": Object.freeze({
    name: "Twin Fang",
    descriptionRanks: Object.freeze(["Dagger hits +8% damage, bows +4% (off-hand pip still free).","Dagger hits +12% damage, bows +6% (off-hand pip still free).","Dagger hits +18% damage, bows +9% (off-hand pip still free)."]),
  }),
  "frontVolley": Object.freeze({
    name: "Front Volley",
    descriptionRanks: Object.freeze(["Bow attacks also hit a random front enemy for 18% bow damage (no extra pip).","Bow attacks also hit a random front enemy for 26% bow damage (no extra pip).","Bow attacks also hit a random front enemy for 34% bow damage (no extra pip)."]),
  }),
  "assassinate": Object.freeze({
    name: "Assassinate",
    descriptionRanks: Object.freeze(["If an enemy has 2 HP or less after your hit, finish them (no extra pip).","If an enemy has 2 HP or less after your hit, finish them (no extra pip).","If an enemy has 3 HP or less after your hit, finish them (no extra pip)."]),
  }),
  "softSteps": Object.freeze({
    name: "Soft Steps",
    descriptionRanks: Object.freeze(["+2% dodge with leather.","+4% dodge with leather.","+6% dodge with leather."]),
  }),
  "secondSkin": Object.freeze({
    name: "Second Skin",
    descriptionRanks: Object.freeze(["Start each run with common leather.","Start with common leather, +1 max durability on leather.","Start with common leather, +2 max durability on leather."]),
  }),
  "slippery": Object.freeze({
    name: "Slippery",
    descriptionRanks: Object.freeze(["After a dodge, +5% dodge until you are hit.","After a dodge, +8% dodge until you are hit.","After a dodge, +12% dodge until you are hit."]),
  }),
  "shadowRest": Object.freeze({
    name: "Shadow Rest",
    descriptionRanks: Object.freeze(["Heal 1 HP at the start of each floor.","Heal 2 HP at the start of each floor.","Heal 3 HP at the start of each floor."]),
  }),
  "bloodthirst": Object.freeze({
    name: "Bloodthirst",
    descriptionRanks: Object.freeze(["Low HP lifesteal: at <=50/35/25/10% Max HP heal 10/20/30/40% of damage dealt (highest tier only). Needs playtest."]),
  }),
  "toolKit": Object.freeze({
    name: "Tool Kit",
    descriptionRanks: Object.freeze(["+1 max durability on starting weapons.","+1 max durability on starting weapons and dagger/bow drops.","+2 max durability on starting weapons and dagger/bow drops."]),
  }),
  "luckyDraw": Object.freeze({
    name: "Lucky Draw",
    descriptionRanks: Object.freeze(["+5% weight for uncommon+ dagger/bow combat loot.","+10% weight for uncommon+ dagger/bow combat loot.","+15% weight for uncommon+ dagger/bow combat loot."]),
  }),
  "poisonTip": Object.freeze({
    name: "Poison Tip",
    descriptionRanks: Object.freeze(["Dagger/bow: 8% chance to poison (2 dmg x 2 turns).","Dagger/bow: 12% chance to poison (2 dmg x 2 turns).","Dagger/bow: 16% chance to poison (3 dmg x 2 turns)."]),
  }),
  "scavengerKit": Object.freeze({
    name: "Scavenger",
    descriptionRanks: Object.freeze(["Start each run with 1 healing potion.","Start with 1 healing potion, another every 10 floors.","Start with 1 healing potion, another every 7 floors."]),
  }),
  "quietKill": Object.freeze({
    name: "Quiet Kill",
    descriptionRanks: Object.freeze(["Once per floor: a killing blow skips enemy counter-attacks.","Once per floor: killing blow skips counters, heal 1 HP.","Once per two floors -> every floor: killing blow skips counters, heal 2 HP."]),
  }),
  "hardened": Object.freeze({
    name: "Hardened",
    descriptionRanks: Object.freeze(["Chain and plate: +1 DEF and +1 max durability.","Chain and plate: +1 DEF and +1 max durability.","Chain and plate: +1 DEF, +1 max durability, and +5% to armor procs."]),
  }),
  "reprisal": Object.freeze({
    name: "Reprisal",
    descriptionRanks: Object.freeze(["When DEF absorbs a hit, reflect 15% of blocked damage (floor, can kill).","When DEF absorbs a hit, reflect 25% of blocked damage (floor, can kill).","When DEF absorbs a hit, reflect 35% of blocked damage (floor, can kill)."]),
  }),
  "counterDrill": Object.freeze({
    name: "Counter Drill",
    descriptionRanks: Object.freeze(["Chain: +3% melee counter chance.","Chain: +6% melee counter chance.","Chain: +9% melee counter chance."]),
  }),
  "bulwark": Object.freeze({
    name: "Bulwark",
    descriptionRanks: Object.freeze(["Chain and plate: +12% to armor special procs (counter / ranged ignore).","Chain and plate: +24% to armor special procs (counter / ranged ignore).","Chain and plate: +36% to armor special procs (counter / ranged ignore)."]),
  }),
  "armorerStart": Object.freeze({
    name: "Armorer's Start",
    descriptionRanks: Object.freeze(["Start each run with uncommon chain or plate - pick which at run start."]),
  }),
  "rivets": Object.freeze({
    name: "Rivets",
    descriptionRanks: Object.freeze(["25% chance to skip any armor durability loss (DEF, ignore, dodge).","35% chance to skip any armor durability loss (DEF, ignore, dodge).","45% chance to skip any armor durability loss (DEF, ignore, dodge)."]),
  }),
  "veteranGrip": Object.freeze({
    name: "Veteran Grip",
    descriptionRanks: Object.freeze(["+1 max durability on starting swords.","+1 max durability on starting swords and sword/axe drops.","+2 max durability on starting swords and sword/axe drops."]),
  }),
  "sharpened": Object.freeze({
    name: "Sharpened",
    descriptionRanks: Object.freeze(["Sword/axe crit chance +2%.","Sword/axe crit chance +4%.","Sword/axe crit chance +6%."]),
  }),
  "heavyHands": Object.freeze({
    name: "Heavy Hands",
    descriptionRanks: Object.freeze(["Crit multiplier gains +1% per rarity tier.","Crit multiplier gains +2% per rarity tier.","Crit multiplier gains +3% per rarity tier."]),
  }),
  "bloodPrice": Object.freeze({
    name: "Blood Price",
    descriptionRanks: Object.freeze(["Killing with sword/axe heals 1 HP.","Killing with sword/axe heals 2 HP.","Killing with sword/axe heals 3 HP."]),
  }),
  "executionersEye": Object.freeze({
    name: "Executioner's Eye",
    descriptionRanks: Object.freeze(["Vs enemies below 40% HP: sword/axe +5% damage.","Vs enemies below 40% HP: sword/axe +8% damage.","Vs enemies below 40% HP: sword/axe +12% damage."]),
  }),
  "ironStomach": Object.freeze({
    name: "Iron Stomach",
    descriptionRanks: Object.freeze(["+3 Max HP at run start.","+6 Max HP at run start.","+9 Max HP at run start."]),
  }),
  "fieldRations": Object.freeze({
    name: "Field Rations",
    descriptionRanks: Object.freeze(["Heal 2 HP at the start of each floor.","Heal 3 HP at the start of each floor.","Heal 4 HP at the start of each floor."]),
  }),
  "muster": Object.freeze({
    name: "Muster",
    descriptionRanks: Object.freeze(["Start each run with 1 healing potion.","Start with 1 healing potion and +2 Max HP.","Start with 1 healing potion and +4 Max HP."]),
  }),
  "smithyFavor": Object.freeze({
    name: "Smithy Favor",
    descriptionRanks: Object.freeze(["1 free anvil repair per act.","1 free anvil repair per act, repairs restore +1 extra pip.","2 free anvil repairs per act, repairs restore +1 extra pip."]),
  }),
  "secondWind": Object.freeze({
    name: "Second Wind",
    descriptionRanks: Object.freeze(["Once per act: at <=25% HP, restore 10% Max HP.","Once per act: at <=25% HP, restore 15% Max HP.","Once per act: at <=25% HP, restore 20% Max HP."]),
  }),
});

// Localized display copy lives alongside the canonical English data. Adding a
// language is now data-only: no talent behavior or scene code needs changing.
const TALENT_DISPLAY_TRANSLATIONS = Object.freeze({
  es: Object.freeze({
    keenEdge: { name: 'Filo agudo', descriptionRanks: ['El primer ataque con daga o arco de cada piso inflige +1 de daño.', 'El primer ataque con daga o arco de cada piso inflige +2 de daño.', 'El primer ataque con daga o arco de cada piso inflige +3 de daño.'] },
    firstBlood: { name: 'Primer golpe', descriptionRanks: ['El primer ataque de cada piso inflige +25% de daño.', 'El primer ataque de cada piso inflige +40% de daño.', 'El primer ataque de cada piso inflige +55% de daño.'] },
    twinFang: { name: 'Colmillo doble', descriptionRanks: ['Los golpes con daga infligen +8% de daño; los arcos, +4% (el punto de mano secundaria sigue siendo gratis).', 'Los golpes con daga infligen +12% de daño; los arcos, +6% (el punto de mano secundaria sigue siendo gratis).', 'Los golpes con daga infligen +18% de daño; los arcos, +9% (el punto de mano secundaria sigue siendo gratis).'] },
    frontVolley: { name: 'Salva frontal', descriptionRanks: ['Los ataques de arco también golpean a un enemigo frontal aleatorio con el 18% del daño del arco (sin punto extra).', 'Los ataques de arco también golpean a un enemigo frontal aleatorio con el 26% del daño del arco (sin punto extra).', 'Los ataques de arco también golpean a un enemigo frontal aleatorio con el 34% del daño del arco (sin punto extra).'] },
    assassinate: { name: 'Asesinar', descriptionRanks: ['Si un enemigo tiene 2 PV o menos tras tu golpe, remátalo (sin punto extra).', 'Si un enemigo tiene 2 PV o menos tras tu golpe, remátalo (sin punto extra).', 'Si un enemigo tiene 3 PV o menos tras tu golpe, remátalo (sin punto extra).'] },
    armorerStart: { name: 'Inicio de armero', descriptionRanks: ['Empieza cada partida con malla o placas poco comunes; eliges cuál al iniciar la partida.'] },
    rivets: { name: 'Remaches', descriptionRanks: ['25% de probabilidad de evitar cualquier pérdida de durabilidad de armadura (DEF, ignorar, esquivar).', '35% de probabilidad de evitar cualquier pérdida de durabilidad de armadura (DEF, ignorar, esquivar).', '45% de probabilidad de evitar cualquier pérdida de durabilidad de armadura (DEF, ignorar, esquivar).'] },
    bulwark: { name: 'Baluarte', descriptionRanks: ['Malla y placas: +12% a las activaciones especiales de armadura (contraataque / ignorar a distancia).', 'Malla y placas: +24% a las activaciones especiales de armadura (contraataque / ignorar a distancia).', 'Malla y placas: +36% a las activaciones especiales de armadura (contraataque / ignorar a distancia).'] },
    hardened: { name: 'Endurecido', descriptionRanks: ['Malla y placas: +1 DEF y +1 de durabilidad máxima.', 'Malla y placas: +1 DEF y +1 de durabilidad máxima.', 'Malla y placas: +1 DEF, +1 de durabilidad máxima y +5% a las activaciones de armadura.'] },
    reprisal: { name: 'Represalia', descriptionRanks: ['Cuando DEF absorbe un golpe, refleja el 15% del daño bloqueado (redondeado hacia abajo; puede matar).', 'Cuando DEF absorbe un golpe, refleja el 25% del daño bloqueado (redondeado hacia abajo; puede matar).', 'Cuando DEF absorbe un golpe, refleja el 35% del daño bloqueado (redondeado hacia abajo; puede matar).'] },
  }),
});

export function getTalentDisplay(talentId, language = 'en') {
  const base = TALENT_DISPLAY[talentId];
  if (!base) return null;
  const translated = TALENT_DISPLAY_TRANSLATIONS[language]?.[talentId];
  return translated ? { ...base, ...translated } : base;
}
