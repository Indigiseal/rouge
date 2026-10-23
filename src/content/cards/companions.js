// Companion card names. The chick is plain "Chick" until it is trained, then
// the "Storm Chick" (Taya). Older saves carry the old names, "Chick Companion"
// and "Storm Hatchling", and are brought across when they load.

export const CHICK_NAME = 'Chick';
export const STORM_CHICK_NAME = 'Storm Chick';

const OLD_CHICK_NAMES = new Set(['Chick Companion', 'Storm Hatchling']);

/** The saved card with the chick's current name; any other card as it was. */
export function refreshCompanionName(data) {
    if (data?.type !== 'companion' || data.id !== 'chickCompanion') return data;
    if (!OLD_CHICK_NAMES.has(data.name)) return data;
    const trained = data.upgradedForm === 'stormHatchling' || Number(data.shockChance) > 0;
    return { ...data, name: trained ? STORM_CHICK_NAME : CHICK_NAME };
}
