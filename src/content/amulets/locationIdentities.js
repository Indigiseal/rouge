import { SANDGLASS_SCARAB } from './sandglassScarab.js';
import { MOSSY_STONE } from './mossyStone.js';
import { SANDSPICE_POUCH } from './sandspicePouch.js';

// Shared presentation keeps saved items, offers and runtime definitions aligned.
// Stable IDs preserve existing discoveries and equipped amulets.
export const LOCATION_AMULET_IDENTITIES = Object.freeze({
    tacticiansPin: Object.freeze({ name: "Tactician's Pin", sprite: 'tacticianPin', spriteFrame: 0 }),
    travelKitchen: SANDSPICE_POUCH,
    keepersWard: Object.freeze({ name: "Keeper's Ward", originLocationId: 'boneflood' }),
    vampireFang: Object.freeze({ name: 'Vampire Fang', originLocationId: 'veilbleed' }),
    sirensPendant: Object.freeze({ name: "Siren's Perfume", originLocationId: 'veilbleed' }),
    plagueHeart: Object.freeze({ name: 'Plague Chalice', originLocationId: 'silkdeep' }),
    leadershipBanner: Object.freeze({ name: 'Leadership Banner', originLocationId: 'thornwake' }),
    maskOfEmbers: Object.freeze({ name: 'Mask of Embers', originLocationId: 'ashhowl' }),
    mossyStone: Object.freeze({ name: MOSSY_STONE.name,
        description: MOSSY_STONE.description, originLocationId: MOSSY_STONE.originLocationId }),
    runeOfFire: Object.freeze({ name: 'Emberstone', originLocationId: 'ashhowl',
        description: 'Fire gem splash radius x1.5' }),
    greaterRuneOfFire: Object.freeze({ name: 'Molten Heart', originLocationId: 'ashhowl',
        description: '+20% fire gem damage (rounded up)' }),
    runeOfZap: Object.freeze({ name: 'Storm Shard', originLocationId: 'stormhatch',
        description: 'Lightning gems bounce to 1 extra enemy' }),
    greaterRuneOfZap: Object.freeze({ name: 'Tempest Heart', originLocationId: 'stormhatch',
        description: '+20% lightning gem damage (rounded up)' }),
    runeOfPoison: Object.freeze({ name: 'Spider Fang', originLocationId: 'silkdeep',
        description: 'Poison gems also poison 1 nearby enemy' }),
    greaterRuneOfPoison: Object.freeze({ name: "Broodmother's Fang", originLocationId: 'silkdeep',
        description: '+2 poison gem tick damage' }),
    boneSpool: Object.freeze({ name: 'Bone Spool', originLocationId: 'boneflood',
        description: 'Discarding a card restores 1 pip to a random damaged weapon or armor item you keep, including worn armor. Cannot repair broken items.' }),
    duneQuiver: Object.freeze({ name: 'Dune Quiver', originLocationId: 'sandreach',
        description: '+1 damage to bows.' }),
    gluttonsCharm: Object.freeze({ name: SANDGLASS_SCARAB.name,
        description: SANDGLASS_SCARAB.description, originLocationId: 'sandreach' }),
    vacancyStep: Object.freeze({ name: 'Bone Hook', originLocationId: 'boneflood',
        description: 'The first time revealed enemies stand apart, a hook pulls them together: they swap with face-down cards to stand as neighbors.' }),
    monocle: Object.freeze({ name: "Goblin's Ransom", originLocationId: 'tollroad',
        description: '3% chance to find a crystal when killing an enemy.' }),
    goblinSpyglass: Object.freeze({ name: "Goblin's Spyglass", originLocationId: 'tollroad',
        description: '15% chance after a damaging weapon hit to reveal one face-down card that is not an enemy or a trap.' }),
});
