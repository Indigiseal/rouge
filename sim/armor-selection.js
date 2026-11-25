// Preserve the bot's DEF/dodge preference, then distinguish otherwise equal
// armor by its special defenses and remaining lifetime. Padded has neither
// chain's counter nor plate's ranged deflection and must not win on bag order.
export function armorScore(armor) {
  if (!armor || !(armor.durability > 0)) return -1;
  return (armor.protection || 0) + (armor.dodgeChance || 0) * 20;
}

export function compareArmor(a, b) {
  const special = (armor) => (armor?.rangedIgnoreChance || 0) + (armor?.meleeCounterChance || 0);
  return armorScore(b) - armorScore(a)
    || special(b) - special(a)
    || (b?.durability || 0) - (a?.durability || 0);
}
