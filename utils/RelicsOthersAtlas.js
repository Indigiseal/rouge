export const RELICS_OTHERS_TEXTURE = 'relicsOthers';

// Canonical names for every authored frame in assets/relicsOthers.png.
// Keep the keys visual and stable so a renamed artifact does not require
// reshuffling the atlas itself.
export const RELICS_OTHERS_ATLAS = Object.freeze({
    bottomlessBag:        { frame: 0,  name: 'Bottomless Bag' },
    evasionBoots:         { frame: 1,  name: 'Boots of Evasion' },
    regenerationAmulet:   { frame: 2,  name: 'Amulet of Regeneration' },
    healingRing:          { frame: 3,  name: 'Healing Ring' },
    chronosHeart:         { frame: 4,  name: 'Chronos Heart' },
    runeOfBalance:        { frame: 5,  name: 'Rune of Balance' },
    soulHarvester:        { frame: 6,  name: 'Soul Harvester' },
    divinersSpade:        { frame: 7,  name: "Diviner's Spade" },
    compass:              { frame: 8,  name: "Wayfinder's Compass" },
    lockpicks:            { frame: 9,  name: "Skeleton's Lockpicks" },
    greasewingsFeast:     { frame: 10, name: "Greasewing's Feast" },
    sunstone:             { frame: 11, name: 'Sunstone' },

    venomSpider:          { frame: 12, name: 'Spider Venom' },
    spiderWeb:            { frame: 13, name: "Webweaver's Thread" },
    boneArmor:            { frame: 14, name: 'Bone Armor' },
    fireRuneStone:        { frame: 15, name: 'Ember Rune' },
    greedPouch:           { frame: 16, name: 'Pouch of Greed' },
    goldenTrinketBox:     { frame: 17, name: "Scavenger's Coffer" },
    morningstar:          { frame: 18, name: "Giant's Morningstar" },
    merchantSeal:         { frame: 19, name: "Merchant's Seal" },
    hangingBat:           { frame: 20, name: 'Nightwatch Familiar' },
    charmingFan:          { frame: 21, name: "Courtier's Fan" },
    redCloak:             { frame: 22, name: 'Crimson Mantle' },
    travelTent:           { frame: 23, name: "Wayfarer's Camp" },

    watchersLamp:         { frame: 24, name: "Watcher's Lamp" },
    featherMask:          { frame: 25, name: 'Masquerade of Feathers' },
    travelersJournal:     { frame: 26, name: "Traveler's Journal" },
    lute:                 { frame: 27, name: 'Lute of First Light' },
    wayfarersMap:         { frame: 28, name: "Wayfarer's Map" },
    magnifyingGlass:      { frame: 29, name: "Seeker's Lens" },
    breadLoaf:            { frame: 30, name: "Pilgrim's Loaf" },
    herbalBundle:         { frame: 31, name: 'Gravebloom Bundle' },
    iceShield:            { frame: 32, name: 'Winter Aegis' },
    stormShard:           { frame: 33, name: 'Storm Shard' },
    griffinMedallion:     { frame: 34, name: 'Griffin Medallion' },
    fireSpirit:           { frame: 35, name: 'Ember of Defiance' },

    strawHat:             { frame: 36, name: 'Harvest Crown' },
    diadem:               { frame: 37, name: "Lost Princess's Diadem" },
    cookHat:              { frame: 38, name: "Camp Cook's Toque" },
    musketeerHat:         { frame: 39, name: "Musketeer's Plume" },
    wizardHat:            { frame: 40, name: "Starcaller's Hat" },
    basket:               { frame: 41, name: "Veteran's Carryall" },
    spectacles:           { frame: 42, name: "Dungeonmaster's Spectacles" },
    horn:                 { frame: 43, name: 'Goblin War Horn' },
    featherQuill:         { frame: 44, name: "Scribe's Quill" },
    signetRing:           { frame: 45, name: 'Blood Signet' },
    diamondPendant:       { frame: 46, name: 'Last Light Pendant' },
    greenHood:            { frame: 47, name: 'Verdant Hood' },

    fishbowl:             { frame: 48, name: "Oracle's Fishbowl" },
    fingerlessGloves:     { frame: 49, name: 'Quickhand Gloves' },
    pickaxe:              { frame: 50, name: "Prospector's Pick" },
    shieldPotion:         { frame: 51, name: 'Ironhide Tonic' },
    moonPotion:           { frame: 52, name: 'Moonwell Phial' },
    grapplingHook:        { frame: 53, name: "Delver's Hook" },
    poisonPotion:         { frame: 54, name: "Queen's Antivenom" },
    boneScroll:           { frame: 55, name: "Lich's Covenant" },
    utilityBelt:          { frame: 56, name: "Berserker's Warbelt" },
    thornOrb:             { frame: 57, name: 'Orb of Thorns' },
    goldenSeed:           { frame: 58, name: 'Golden Seed' },
    goldBar:              { frame: 59, name: 'Tempered Ingot' },

    perfumeBottle:        { frame: 60, name: "Siren's Perfume" },
    goldenMedallion:      { frame: 61, name: 'Stoneheart Medallion' },
    birdSkull:            { frame: 62, name: 'Carrion Oath' },
    dragonClaw:           { frame: 63, name: 'Dragon Claw' },
    hollowWhispersMask:   { frame: 64, name: 'Mask of Hollow Whispers' },
    goldenBell:           { frame: 65, name: 'Tea Room Bell' },
    wormVenomVial:        { frame: 66, name: 'Worm Venom Charm' },
    stolenInkPen:         { frame: 67, name: 'Stolen Ink Pen' }
});

// Gameplay IDs stay stable for saves and balance code. These maps are the
// only place where an existing effect is paired with atlas art and a name.
export const AMULET_ATLAS_KEYS = Object.freeze({
    regeneration: 'regenerationAmulet',
    healingRing: 'healingRing',
    invulnerability: 'diadem',
    evasionBoots: 'evasionBoots',
    dragonClaw: 'dragonClaw',
    greedPouch: 'greedPouch',
    golemHeart: 'goldenMedallion',
    chronosHeart: 'chronosHeart',
    speedBoots: 'fingerlessGloves',
    abyssHourglass: 'moonPotion',
    temperedSteel: 'goldBar',
    bottomlessBag: 'bottomlessBag',
    travelKitchen: 'strawHat',
    hungryDagger: 'birdSkull',
    bloodyHarvest: 'runeOfBalance',
    vampiricRing: 'signetRing',
    soulHarvester: 'soulHarvester',
    eternalRage: 'fireSpirit',
    berserkerBelt: 'utilityBelt',
    diviners_spade: 'divinersSpade',
    wayfinder: 'compass',
    skeletonKey: 'lockpicks',
    greasewingFeast: 'greasewingsFeast',
    sunstone: 'sunstone',
    merchantPact: 'merchantSeal',
    watchersLamp: 'watchersLamp',
    reapersMask: 'hollowWhispersMask',
    travelersJournal: 'travelersJournal',
    charmingTune: 'lute',
    wayfarersMap: 'wayfarersMap',
    sirensPendant: 'perfumeBottle',
    teaRoomBell: 'goldenBell',
    wormVenomCharm: 'wormVenomVial',
    stolenInkPen: 'stolenInkPen'
});

export const RELIC_ATLAS_KEYS = Object.freeze({
    spiderVenom: 'venomSpider',
    webWeaver: 'spiderWeb',
    boneArmor: 'boneArmor',
    undeadResilience: 'herbalBundle',
    greedyPockets: 'horn',
    scavenger: 'goldenTrinketBox',
    giantStrength: 'morningstar',
    queenBlessing: 'poisonPotion',
    lichCurse: 'boneScroll',
    veteranExplorer: 'basket',
    tent: 'travelTent',
    luckyScrap: 'shieldPotion',
    dungeonMaster: 'spectacles'
});

function getAtlasEntry(mapping, id, kind) {
    const atlasKey = mapping[id];
    const entry = atlasKey ? RELICS_OTHERS_ATLAS[atlasKey] : null;
    if (!entry) {
        throw new Error(`Missing relicsOthers atlas entry for ${kind} "${id}"`);
    }
    return entry;
}

export function getAmuletAtlasPresentation(id) {
    const entry = getAtlasEntry(AMULET_ATLAS_KEYS, id, 'amulet');
    return {
        name: entry.name,
        sprite: RELICS_OTHERS_TEXTURE,
        spriteFrame: entry.frame
    };
}

export function getRelicAtlasPresentation(id) {
    const entry = getAtlasEntry(RELIC_ATLAS_KEYS, id, 'relic');
    return {
        name: entry.name,
        iconSheet: RELICS_OTHERS_TEXTURE,
        iconFrame: entry.frame
    };
}

export function applyAmuletAtlasPresentation(data) {
    if (!data?.id || !AMULET_ATLAS_KEYS[data.id]) return data;
    return { ...data, ...getAmuletAtlasPresentation(data.id) };
}

function validateAtlasAssignments() {
    const atlasFrames = new Set();
    Object.entries(RELICS_OTHERS_ATLAS).forEach(([key, entry]) => {
        if (atlasFrames.has(entry.frame)) {
            throw new Error(`Duplicate relicsOthers frame ${entry.frame} in atlas catalog`);
        }
        atlasFrames.add(entry.frame);
        if (!key || !entry.name) {
            throw new Error(`Invalid relicsOthers atlas entry at frame ${entry.frame}`);
        }
    });

    const playableFrames = new Map();
    [
        ['amulet', AMULET_ATLAS_KEYS],
        ['relic', RELIC_ATLAS_KEYS]
    ].forEach(([kind, mapping]) => {
        Object.entries(mapping).forEach(([id, atlasKey]) => {
            const entry = getAtlasEntry(mapping, id, kind);
            const previous = playableFrames.get(entry.frame);
            if (previous) {
                throw new Error(
                    `relicsOthers frame ${entry.frame} is assigned to both ${previous} and ${kind} "${id}"`
                );
            }
            playableFrames.set(entry.frame, `${kind} "${id}" (${atlasKey})`);
        });
    });
}

validateAtlasAssignments();
