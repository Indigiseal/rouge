// Armor equip sounds, one per armor type: leather thumps and creaks, chain
// jangles, plate clanks. assets/music/Armor_<Type>.mp3, loaded as
// armor_equip_<type>. Generated with ElevenLabs (tools/death-sounds.json,
// 'armor' set). A type without one keeps the shared metal clank, armor_equip.

export const ARMOR_EQUIP_TYPES = Object.freeze(['leather', 'chain', 'plate']);

export const ARMOR_EQUIP_SOUND_ASSETS = Object.freeze(ARMOR_EQUIP_TYPES.map((type) => ({
    key: `armor_equip_${type}`,
    path: `assets/music/Armor_${type[0].toUpperCase()}${type.slice(1)}.mp3`,
    type: 'audio',
})));

/** The sound for putting on (or taking off) this armor, loaded or not. */
export function armorEquipSoundKey(scene, armor) {
    const key = `armor_equip_${armor?.armorType}`;
    return scene?.cache?.audio?.exists?.(key) ? key : 'armor_equip';
}
