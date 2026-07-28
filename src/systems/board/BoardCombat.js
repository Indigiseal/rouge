// BoardCombat — attackEnemy, gem effects, poison/shock, remove defeated, floor clear
import { CardDataGenerator } from '../loot/CardDataGenerator.js';
import { SoundHelper } from '../../audio/SoundHelper.js';
import { CombatSequencer } from '../combat/CombatSequencer.js';
import { snapOriginToPixelGrid } from '../../ui/PixelSnap.js';
import { recordHumanRunEvent, snapshotHumanRunCard } from '../HumanRunRecorder.js';
import {
    ENCHANT_FIRE_SPLASH_FRACTION,
    ENCHANT_FIRE_SPLASH_MINIMUM,
    ENCHANT_FIRE_SPLASH_RADIUS,
    ENCHANT_FREEZE_TURNS,
    ENCHANT_HEAL_AMOUNT,
    ENCHANT_SHADOW_MULTIPLIER,
    ENCHANT_SHIELD_MULTIPLIER,
    ENCHANT_SHIELD_TURNS,
    ENCHANT_WEAKNESS_MULTIPLIER,
    getEnchantChance,
    getWeaponEnchant,
} from '../../content/balance/WeaponEnchants.js';
import { effectiveArmorProtection } from '../combat/ArmorMath.js';
import { playSmokePuff } from '../../ui/SmokeBurst.js';

export class BoardCombat {
    constructor(cs) {
        this.isMeleeWeapon = isMeleeWeapon.bind(cs);
        this.isRangedWeapon = isRangedWeapon.bind(cs);
        this.isVenomousWeapon = isVenomousWeapon.bind(cs);
        this.applyWeaponPoison = applyWeaponPoison.bind(cs);
        this.getEnemyPoisonSummary = getEnemyPoisonSummary.bind(cs);
        this.applyShockStatus = applyShockStatus.bind(cs);
        this.attachFrozenFrame = attachFrozenFrame.bind(cs);
        this.removeFrozenFrame = removeFrozenFrame.bind(cs);
        this.processEnemyPoisonEffects = processEnemyPoisonEffects.bind(cs);
        this._aliveEnemyIndices = _aliveEnemyIndices.bind(cs);
        this._anyMeleeAlive = _anyMeleeAlive.bind(cs);
        this.currentFrontRowR = currentFrontRowR.bind(cs);
        this.maxHiddenMeleeRowR = maxHiddenMeleeRowR.bind(cs);
        this._revealOneBehindAfterFrontClears = _revealOneBehindAfterFrontClears.bind(cs);
        this.restoreEnemyStatusMarkers = restoreEnemyStatusMarkers.bind(cs);
        this.rollEvade = rollEvade.bind(cs);
        this.attackEnemy = attackEnemy.bind(cs);
        this.getFireSplashRadius = getFireSplashRadius.bind(cs);
        this.applyWeaponGemEffect = applyWeaponGemEffect.bind(cs);
        this.isEnemyType = isEnemyType.bind(cs);
        this.isOpenEnemyCard = isOpenEnemyCard.bind(cs);
        this.hasHolographicOmen = hasHolographicOmen.bind(cs);
        this.applyHolographicOmenStartEffect = applyHolographicOmenStartEffect.bind(cs);
        this.isAnyEnemyCard = isAnyEnemyCard.bind(cs);
        this.burnEnemy = burnEnemy.bind(cs);
        this.damageGemTarget = damageGemTarget.bind(cs);
        this.applyRelicSlow = applyRelicSlow.bind(cs);
        this.rollWeaponEnchant = rollWeaponEnchant.bind(cs);
        this.applyWeaponEnchantOnHit = applyWeaponEnchantOnHit.bind(cs);
        this.applyWeaponEnchantOnKill = applyWeaponEnchantOnKill.bind(cs);
        this.hideEnemyCard = hideEnemyCard.bind(cs);
        this.removeDefeatedEnemy = removeDefeatedEnemy.bind(cs);
        this.checkFloorClear = checkFloorClear.bind(cs);
        this.tryApplyBoardGem = tryApplyBoardGem.bind(cs);
    }
}

function isMeleeWeapon(w) {
  if (!w) return false;
  if (this.isRangedWeapon(w)) return false;
  const n = (w.name || w.id || '').toLowerCase();
  return (
    w.range === 'melee' ||
    w.isRanged === false ||
    w.subType === 'sword' ||
    n.includes('sword') || n.includes('dagger') || n.includes('mace') || n.includes('hammer') ||
    n.includes('axe')
  );
}

function isRangedWeapon(w) {
  if (!w) return false;
  const n = (w.name || w.id || '').toLowerCase();
  return (
    w.range === 'ranged' ||
    w.isRanged === true ||
    w.subType === 'bow' ||
    n.includes('bow') || n.includes('crossbow')
  );
}

function isVenomousWeapon(w) {
  return !!w && ((w.poisonDamage || 0) > 0 || (w.name || '').toLowerCase().includes('venomous dagger'));
}

function applyWeaponPoison(card, weapon) {
  const poisonStacks = [];
  if (this.isVenomousWeapon(weapon)) {
    poisonStacks.push({
      damage: Math.max(1, weapon.poisonDamage || 1),
      turns: Math.max(1, weapon.poisonTurns || 3)
    });
  }

  if (weapon?.gemEffect === 'poison') {
    const stacks = CardDataGenerator.weaponGemStack(weapon);
    const tickDamage = this.scene.amuletManager?.modifyPoisonGemTickDamage?.(1) ?? 1;
    for (let i = 0; i < stacks; i++) {
      poisonStacks.push({
        damage: tickDamage,
        turns: 3
      });
    }
  }

  const relicEffects = this.scene.gameState?.relicEffects || {};
  if (relicEffects.weaponPoisonChance && Math.random() < relicEffects.weaponPoisonChance) {
    poisonStacks.push({
      damage: Math.max(1, relicEffects.poisonDamage || 1),
      turns: Math.max(1, relicEffects.poisonTurns || 3)
    });
  }

  if (poisonStacks.length === 0) return;
  if (!card.data.statusEffects) card.data.statusEffects = [];
  poisonStacks.forEach(stack => {
    card.data.statusEffects.push({
      type: 'poison',
      damage: stack.damage,
      turns: stack.turns,
      stackable: true
    });
  });
  const totalDamage = poisonStacks.reduce((sum, stack) => sum + stack.damage, 0);
  this.scene.createFloatingText(card.sprite.x, card.sprite.y - 16, 'Poisoned!', 0x44ff44);
  this.scene.createFloatingText(card.sprite.x, card.sprite.y - 32, `poison -${totalDamage}/turn`, 0x88dd88);

  // Show looping poison icon at top-right corner of the enemy card
  if (card.sprite && !card.poisonMarker && this.scene.textures.exists('poisonedStatus')) {
    const halfW = (card.sprite.displayWidth || 52) / 2;
    const halfH = (card.sprite.displayHeight || 70) / 2;
    // The Spider Queen's tall sprite has a web hanging upward, so her real
    // body sits in the lower half — drop the marker 60px to land on her body.
    const bodyOffsetY = card.data.name === 'Spider Queen' ? 60 : 0;
    const marker = this.scene.add.sprite(
      Math.round(card.sprite.x + halfW - 2),
      Math.round(card.sprite.y - halfH + 2 + bodyOffsetY),
      'poisonedStatus'
    );
    marker.setOrigin(1, 0);
    marker.setDepth((card.sprite.depth || 1) + 3);
    if (this.scene.anims?.exists('poison_status_anim')) marker.play('poison_status_anim');
    card.poisonMarker = marker;
  }
}

function getEnemyPoisonSummary(enemyData) {
  const stacks = enemyData.statusEffects?.filter(effect => effect.type === 'poison') || [];
  if (stacks.length === 0) return null;
  return {
    stacks: stacks.length,
    damage: stacks.reduce((sum, effect) => sum + effect.damage, 0)
  };
}

function applyShockStatus(card, turns = 1) {
  if (!card?.data || !card.sprite || (card.data.health || 0) <= 0) return false;
  if ((card.data.frozen || 0) > 0) return false;

  card.data.frozen = Math.max(1, turns);
  card.data.shockedTurns = Math.max(1, turns);
  this.scene.createFloatingText(card.sprite.x, card.sprite.y - 18, 'Shocked!', 0x66ccff);

  if (!card.shockMarker && this.scene.textures.exists('shockedStatus')) {
    const halfW = (card.sprite.displayWidth || 52) / 2;
    const halfH = (card.sprite.displayHeight || 70) / 2;
    const bodyOffsetY = card.data.name === 'Spider Queen' ? 60 : 0;
    const marker = this.scene.add.sprite(
      Math.round(card.sprite.x + halfW - 2),
      Math.round(card.sprite.y - halfH + 2 + bodyOffsetY),
      'shockedStatus'
    );
    marker.setOrigin(1, 0);
    marker.setDepth((card.sprite.depth || 1) + 4);
    if (this.scene.anims?.exists('shock_status_anim')) marker.play('shock_status_anim');
    card.shockMarker = marker;
  }
  return true;
}

function attachFrozenFrame(card) {
  if (!card?.sprite || (card.data?.frozen || 0) <= 0) return;
  if ((card.data?.shockedTurns || 0) > 0) return;
  const textureKey = card.data?.type === 'boss' && this.scene.textures?.exists?.('bossFrozenFrame')
    ? 'bossFrozenFrame'
    : 'frozenFrame';
  if (!this.scene.textures?.exists?.(textureKey)) return;
  if (card.frozenFrame && card.frozenFrame.active) {
    if (card.frozenFrame.texture?.key !== textureKey) card.frozenFrame.setTexture(textureKey);
    card.frozenFrame.setPosition(Math.round(card.sprite.x), Math.round(card.sprite.y));
    return;
  }
  const frame = snapOriginToPixelGrid(
    this.scene.add.image(card.sprite.x, card.sprite.y, textureKey)
  );
  frame.setDepth((card.sprite.depth || 1) + 2);
  card.frozenFrame = frame;
}

function removeFrozenFrame(card) {
  if (card?.frozenFrame) {
    card.frozenFrame.destroy();
    card.frozenFrame = null;
  }
}

function processEnemyPoisonEffects() {
  for (let i = this.boardCards.length - 1; i >= 0; i--) {
    const card = this.boardCards[i];
    if (!this.isOpenEnemyCard(card)) continue;
    const effects = card.data.statusEffects;
    if (!effects?.length) continue;

    let poisonDamage = 0;
    for (let e = effects.length - 1; e >= 0; e--) {
      const effect = effects[e];
      if (effect.type !== 'poison') continue;
      poisonDamage += effect.damage;
      effect.turns--;
      if (effect.turns <= 0) effects.splice(e, 1);
    }

    // Remove the poison icon once all stacks have expired
    if (card.poisonMarker && !effects.some(e => e.type === 'poison')) {
      card.poisonMarker.destroy();
      card.poisonMarker = null;
    }

    if (poisonDamage <= 0) continue;
    card.data.health -= poisonDamage;
    this.scene.createFloatingText(card.sprite.x, card.sprite.y, `-${poisonDamage} Poison`, 0x66ff66);
    this.scene.shakeCard(card.sprite);

    if (card.data.health <= 0) {
      this.removeDefeatedEnemy(i, card);
    } else {
      this.updateEnemyInfoText(card);
    }
  }
}

function _aliveEnemyIndices({ revealedOnly = false } = {}) {
  const out = [];
  for (let i = 0; i < this.boardCards.length; i++) {
    const c = this.boardCards[i];
    if (!c) continue;
    if (!this.isEnemyType(c.data?.type)) continue;
    if (revealedOnly && !c.revealed) continue;
    out.push(i);
  }
  return out;
}

function _anyMeleeAlive({ includeHidden = true } = {}) {
  for (let i = 0; i < this.boardCards.length; i++) {
    const c = this.boardCards[i];
    if (!c) continue;
    if (c.data?.tutorialDormant) continue;
    if (!this.isEnemyType(c.data?.type)) continue;
    if (!includeHidden && !c.revealed) continue;
    if (c.data.role === 'MELEE') return true;
  }
  return false;
}

function currentFrontRowR() {
  let best = -Infinity;
  for (const i of this._aliveEnemyIndices({ revealedOnly: true })) {
    const br = this.boardCards[i]?.data?.brick?.r;
    if (typeof br === 'number' && br > best) best = br;
  }
  return best;
}

function maxHiddenMeleeRowR() {
  let best = -Infinity;
  for (let i = 0; i < this.boardCards.length; i++) {
    const c = this.boardCards[i];
    if (!c || c.revealed) continue;
    if (!this.isEnemyType(c.data?.type)) continue;
    if (c.data.role !== 'MELEE') continue;
    const br = c.data?.brick?.r;
    if (typeof br === 'number' && br > best) best = br;
  }
  return best;
}

function _revealOneBehindAfterFrontClears(killedIndex) {
  if (this._anyMeleeAlive({ includeHidden: true })) return;
  const killed = this.boardCards[killedIndex];
  const neighborIdxs = (killed && killed.data?.brickNeighbors?.length) ? killed.data.brickNeighbors.slice() : [];
  const pickFrom = (arr) => {
    const candidates = arr.filter(i => {
      const c = this.boardCards[i];
      if (!c || c.revealed) return false;
      if (c.data?.tutorialDormant) return false;
      return this.isEnemyType(c.data?.type) && c.data.role !== 'MELEE';
    });
    if (candidates.length) {
      const idx = candidates[Math.floor(Math.random() * candidates.length)];
      this.revealCard(idx, true);
      return true;
    }
    return false;
  };
  if (neighborIdxs.length && pickFrom(neighborIdxs)) return;
  const all = [];
  for (let i = 0; i < this.boardCards.length; i++) all.push(i);
  pickFrom(all);
}

function restoreEnemyStatusMarkers(card) {
  if (!this.isOpenEnemyCard(card)) return;
  const makeMarker = (texture, anim, depthOffset) => {
    const halfW = (card.sprite.displayWidth || 52) / 2;
    const halfH = (card.sprite.displayHeight || 70) / 2;
    const bodyOffsetY = card.data.name === 'Spider Queen' ? 60 : 0;
    const marker = this.scene.add.sprite(
      Math.round(card.sprite.x + halfW - 2),
      Math.round(card.sprite.y - halfH + 2 + bodyOffsetY),
      texture
    ).setOrigin(1, 0).setDepth((card.sprite.depth || 1) + depthOffset);
    if (this.scene.anims.exists(anim)) marker.play(anim);
    return marker;
  };

  if (card.data.statusEffects?.some(effect => effect.type === 'poison')
      && this.scene.textures.exists('poisonedStatus')) {
    card.poisonMarker = makeMarker('poisonedStatus', 'poison_status_anim', 3);
  }
  if ((card.data.shockedTurns || 0) > 0 && this.scene.textures.exists('shockedStatus')) {
    card.shockMarker = makeMarker('shockedStatus', 'shock_status_anim', 4);
  }
}

function rollEvade(card) {
    if (!card?.data || !card.sprite?.scene) return false;
    const evadeAbility = card.data.abilities?.find(a => a.type === 'evade');
    const chance = Number(evadeAbility?.chance) || 0;
    if (chance <= 0 || Math.random() >= chance) return false;
    SoundHelper.playVariant(this.scene, 'dodge_miss', 0.5);
    this.scene.createFloatingText(card.sprite.x, card.sprite.y, 'Miss!', 0xffffff);
    return true;
}

function attackEnemy(index, damage, isReflection = false, weaponUsed = null, skipDurability = false) {
    const card = this.boardCards[index];
    if (!card || !card.revealed || !this.isEnemyType(card.data.type)) return;
    
    // === front/back gating ===
    // Weapon attacks pass their weapon explicitly from InventoryCombatUse.
    // Do not fall back to the equipped weapon here: non-weapon callers such as
    // Fireball and charmed enemies also use attackEnemy(), and the fallback
    // incorrectly spent the player's durability and triggered weapon gems.
    const weapon = weaponUsed || null;
    
    if (!isReflection && weapon) {
        const isRanged = this.isRangedWeapon(weapon);

        // Check if there are any melee enemies alive (revealed or hidden)
        const meleeBlockers = this._anyMeleeAlive({ includeHidden: true });

        // RANGED weapons (bows) bypass the frontline gate — that's
        // their whole point. Printed damage is applied as-is (no ranged
        // multiplier); see docs/OPEN-QUESTIONS.md for weakened/display.
        if (!isRanged && meleeBlockers && card.data.role !== 'MELEE') {
            SoundHelper.playVariant(this.scene, 'invalid_action', 0.5);
            this.scene.createFloatingText(
                this.scene.playerAvatar.x,
                this.scene.playerAvatar.y,
                'Blocked by frontline!',
                0xff6666
            );
            // Let the tutorial (or any listener) react to a blocked swing.
            this.scene.events.emit('frontlineBlocked', index);
            this.scene.events.emit('tutorialProgress', 'blocked');
            this.scene.tutorialManager?._handleProgress?.('blocked');
            return;
        }
    }
    
    // Apply amulet damage modifiers to weapon damage (not reflection)
    let finalDamage = damage;
    if (!isReflection && weapon && this.scene.amuletManager) {
        finalDamage = this.scene.amuletManager.modifyWeaponDamage(damage);
    }
    // Giant's Morningstar relic: +1 flat damage on every weapon attack.
    if (!isReflection && weapon) {
        const dmgBonus = this.scene.gameState?.relicEffects?.weaponDamageBonus || 0;
        if (dmgBonus) finalDamage += dmgBonus;
    }
    if (!isReflection && weapon && this.scene.gameState?.shadowBlade?.turns > 0) {
        finalDamage = Math.floor(finalDamage * (this.scene.gameState.shadowBlade.multiplier || 1.5));
    }

    // Resolve evasion before rolling/showing critical hits or consuming the
    // once-per-floor War Horn charge. A missed attack must not announce a
    // CRIT or spend a one-shot bonus that never dealt damage.
    if (!isReflection && this.rollEvade(card)) return;

    const critChance = (this.scene.gameState?.discardCritChance || 0)
        + (this.scene.amuletManager?.getCriticalChanceBonus?.() || 0);
    if (!isReflection && weapon && critChance > 0 && Math.random() < critChance) {
        finalDamage *= 2;
        // Big yellow CRIT! plus a sharp screen shake so a crit really lands.
        this.scene.createFloatingText(card.sprite.x, card.sprite.y - 24, 'CRIT!', 0xffe066, '26px');
        this.scene.createFloatingText(card.sprite.x, card.sprite.y - 46, 'Double Damage!', 0xff8800);
        this.scene.cameras.main.shake(200, 0.012);
        // Lucky Streak (Fortune Card): a crit can shake loose a coin or crystal.
        const luckyReward = this.scene.amuletManager?.rollLuckyStreakCritReward?.();
        if (luckyReward) this.playKillLootPickup(card.sprite.x, card.sprite.y, luckyReward, 'Lucky');
    }

    // Goblin War Horn relic: the first attack each floor deals double damage.
    // (Stacks multiplicatively with CRIT — if both fire, you get x4.)
    if (!isReflection && weapon && this.scene.gameState?.relicEffects?.firstAttackDoubleDamage
        && !this.scene.gameState.firstAttackThisFloorUsed) {
        finalDamage *= 2;
        this.scene.gameState.firstAttackThisFloorUsed = true;
        this.scene.createFloatingText(card.sprite.x, card.sprite.y - 38, 'WAR HORN!', 0xffaa00);
        this.scene.createFloatingText(card.sprite.x, card.sprite.y - 54, 'Double Damage!', 0xff8800);
    }

    // Reliquary enchant: ONE roll per swing. `preDamage` procs change the blow
    // itself, so they resolve here next to CRIT and the War Horn; everything
    // else fires once the swing is committed (further down).
    const enchantProc = (!isReflection && weapon) ? this.rollWeaponEnchant(weapon) : null;
    let enchantInstantKill = false;
    if (enchantProc === 'shadowBlade') {
        finalDamage = Math.floor(finalDamage * ENCHANT_SHADOW_MULTIPLIER);
        this.scene.createFloatingText(card.sprite.x, card.sprite.y - 38, 'Shadowed!', 0x9a6cff);
    } else if (enchantProc === 'soulDrain' && card.data.type !== 'boss') {
        enchantInstantKill = true;
        this.scene.createFloatingText(card.sprite.x, card.sprite.y - 38, 'Devoured!', 0x9932cc);
    }

    if (!isReflection) {
        const sx = card.sprite.x;
        const sy = card.sprite.y;
        CombatSequencer.schedule(this.scene, 'hit', () => this.scene.createSlashEffect(sx, sy));
        // Random impact sound on the struck enemy (variants avoid monotony).
        CombatSequencer.playVariant(this.scene, 'hit', 'enemy_hit', 0.4);
    }

    // Reflected damage is the answer to a blow, not a blow of its own, so it
    // shakes on the reflect beat rather than crowding the enemy's own hit.
    CombatSequencer.shakeCard(this.scene, isReflection ? 'reflect' : 'hit', card.sprite);
    
    // Gem effects fire BEFORE the weapon damage lands. If we waited until
    // after, a killing weapon hit would knock the target's health to ≤ 0
    // and burnEnemy / damageGemTarget would short-circuit, silently
    // dropping the gem damage and its "-X Fire" / "Zap" floating text on
    // the main target. Splash to neighbours still works because they
    // weren't touched by the weapon yet.
    if (!isReflection && weapon?.gemEffect && card.sprite?.scene) {
        this.applyWeaponGemEffect(index, weapon, finalDamage);
    }

    // Enchant procs land here for the same reason gems do: a killing weapon hit
    // removes the card, which would silently swallow the effect and its text.
    if (enchantProc && !enchantInstantKill) {
        this.applyWeaponEnchantOnHit(index, enchantProc, finalDamage);
    }

    // Apply damage. (Carrion Oath / hungryDagger no longer alters combat — it was
    // reworked into a potion-based poison cleanse, handled in AmuletManager.)
    const enemyArmor = Math.max(0, card.data.armor || 0);
    if (enemyArmor > 0) {
        finalDamage = Math.max(1, finalDamage - enemyArmor);
    }
    // Devouring bites through whatever is left. Armour is already resolved
    // above, so a high-armour target cannot shrug the kill off.
    if (enchantInstantKill) finalDamage = Math.max(finalDamage, card.data.health);
    card.data.health -= finalDamage;

    // Vampire Fang — heal from damage that actually landed on the enemy.
    if (!isReflection && weapon && finalDamage > 0) {
        this.scene.amuletManager?.processLifesteal?.(finalDamage);
    }
    
    // Reduce weapon durability on attack (only if not reflection damage).
    // Tempered Ingot: halves the rate at which durability is lost.
    // skipDurability=true for the second hit of a dual-wield so it costs only 1 pip total.
    if (!isReflection && !skipDurability && this.scene.gameState.equippedWeapon) {
        const durabilityLoss = this.scene.amuletManager
            ? (Math.random() < this.scene.amuletManager.getWeaponDurabilityRate() ? 1 : 0)
            : 1;
        this.scene.gameState.equippedWeapon.durability -= durabilityLoss;
        if (this.scene.gameState.equippedWeapon.durability <= 0) {
            this.scene.gameState.equippedWeapon = null;
            CombatSequencer.floatingText(this.scene, 'break',
                this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Weapon Broke!', 0xff0000);
        }
        this.scene.updateUI();
    }
    
    // Elemental hit animation on the struck enemy (fire / poison / lightning)
    if (!isReflection && weapon) {
        let hitFx = null;
        if (weapon.gemEffect === 'fire' || weapon.gemEffect === 'lightning' || weapon.gemEffect === 'poison') {
            hitFx = weapon.gemEffect;
        } else if (weapon.poisonDamage > 0) {
            hitFx = 'poison'; // native venomous weapons
        }
        if (hitFx) CombatSequencer.schedule(this.scene, 'gem', () => {
            if (card.sprite?.scene) this.playEnemyHitEffect(card, hitFx);
        });
    }

    if (!isReflection && weapon && card.data.health > 0) {
        this.applyWeaponPoison(card, weapon);
        this.applyRelicSlow(card);
    }

    // (Gem effect ran above, before the weapon damage was applied, so we
    // don't re-trigger it here.)

    this.updateEnemyInfoText(card);

    // Show the weapon damage number on screen, but log it ourselves with an
    // explicit label so the player's own hit is unmistakable in the combat
    // log next to gem "Zap"/"Fire" numbers (skipLog avoids double-logging).
    CombatSequencer.floatingText(this.scene, isReflection ? 'reflect_damage' : 'damage',
        card.sprite.x, card.sprite.y, `-${finalDamage}`, 0xff0000, '15px', { skipLog: true });
    const targetName = card.data?.name || 'Enemy';
    const weaponLabel = (!isReflection && weapon?.weaponType)
        ? ` (${weapon.weaponType.charAt(0).toUpperCase()}${weapon.weaponType.slice(1)})`
        : (isReflection ? ' (Reflected)' : '');
    this.scene.pushCombatLog?.(`${targetName} -${finalDamage}${weaponLabel}`);

    if (card.data.health <= 0) {
        this.removeDefeatedEnemy(index, card);
        if (enchantProc) this.applyWeaponEnchantOnKill(enchantProc);
    }
}

function getFireSplashRadius() {
    // Baseline trimmed 70 → 65 to make fire gems weaker early. The Ember
    // Rune amulet adds its splash bonus back on top (and then some).
    return 65 + (this.scene.amuletManager?.getFireSplashRadiusBonus?.() || 0);
}

function applyWeaponGemEffect(targetIndex, weapon, baseDamage) {
    const target = this.boardCards[targetIndex];
    if (!target?.data) return;

    const stack = CardDataGenerator.weaponGemStack(weapon);

    if (weapon.gemEffect === 'fire') {
        // Fire: flat splash by gem stack. Stacks 4–5 are provisional
        // until gem merge power is decided (docs/OPEN-QUESTIONS.md).
        let splashDamage = [3, 4, 5, 6, 7][stack - 1];
        splashDamage = this.scene.amuletManager?.modifyGemDamage?.(splashDamage, 'fire') ?? splashDamage;
        // Main target: bonus fire damage on top of the weapon hit.
        this.burnEnemy(targetIndex, splashDamage);
        // Measure to the NEAREST EDGE of each enemy's sprite, not its center.
        // A big sprite like the boss has a far-off center but its body can be
        // right next to the minion you hit — center distance would miss it.
        const SPLASH_RADIUS = this.getFireSplashRadius();
        const tx = target.sprite?.x ?? 0;
        const ty = target.sprite?.y ?? 0;
        this.boardCards.forEach((card, i) => {
            if (i === targetIndex || !card?.sprite) return;
            const b = card.sprite.getBounds();
            // Closest point on this sprite's bounding box to the struck card.
            const nx = Phaser.Math.Clamp(tx, b.left, b.right);
            const ny = Phaser.Math.Clamp(ty, b.top, b.bottom);
            const dx = nx - tx;
            const dy = ny - ty;
            if (dx * dx + dy * dy <= SPLASH_RADIUS * SPLASH_RADIUS) {
                this.burnEnemy(i, splashDamage);
            }
        });
        return;
    }

    if (weapon.gemEffect === 'lightning') {
        // Lightning: flat zap by gem stack (stacks 4–5 provisional).
        // Always hits 3 enemies total: main target + 2 others.
        // Stacks only increase the damage.
        let zapDamage = [3, 4, 5, 6, 7][stack - 1];
        zapDamage = this.scene.amuletManager?.modifyGemDamage?.(zapDamage, 'lightning') ?? zapDamage;
        const extraZaps = 2; // always 2 additional = 3 total
        // One random zap SFX per lightning-gem swing (not per hop). Sits on
        // the gem beat so the zap answers the sword hit instead of racing it.
        CombatSequencer.playVariant(this.scene, 'gem', 'lightning_zap', 0.45);
        if (this.scene.tutorialMode) {
            this.scene.events.emit('tutorialProgress', 'gemEffect:lightning');
            this.scene.tutorialManager?._handleProgress?.('gemEffect:lightning');
        }
        // Main target: bonus lightning damage on top of the weapon hit.
        this.damageGemTarget(targetIndex, zapDamage, 'Zap', 0xffe066, 'lightning');
        if (extraZaps > 0) {
            const candidates = this.boardCards
                .map((card, i) => ({ card, i }))
                .filter(({ card, i }) => i !== targetIndex && this.isOpenEnemyCard(card));
            const ranged = candidates.filter(({ card }) => card.data?.role === 'RANGED');
            const melee = candidates.filter(({ card }) => card.data?.role !== 'RANGED');
            const picks = [
                ...Phaser.Utils.Array.Shuffle(ranged).slice(0, extraZaps),
                ...Phaser.Utils.Array.Shuffle(melee),
            ].slice(0, extraZaps);
            // The spark travels enemy → enemy: each hop waits ZAP_STEP ms, draws
            // an arc from the previous target's position, then lands its hit.
            const ZAP_STEP = 170;
            const mainCard = this.boardCards[targetIndex];
            let fromPos = mainCard?.sprite
                ? { x: mainCard.sprite.x, y: mainCard.sprite.y }
                : null;
            picks.forEach(({ i }, zapIndex) => {
                const targetCard = this.boardCards[i];
                const toPos = targetCard?.sprite
                    ? { x: targetCard.sprite.x, y: targetCard.sprite.y }
                    : null;
                const arcFrom = fromPos;
                // Hops start from the gem beat, not from now, so the first
                // hop follows the main target's zap instead of landing on it.
                const hopDelay = CombatSequencer.BEATS.gem + (zapIndex + 1) * ZAP_STEP;
                const hopTimer = this.scene.time.delayedCall(hopDelay, () => {
                    if (arcFrom && toPos) {
                        this.playLightningArc(arcFrom.x, arcFrom.y, toPos.x, toPos.y);
                    }
                    // Each hop opens its own moment: the arc flies, then the
                    // number lands on the hit beat a beat later.
                    this.damageGemTarget(i, zapDamage, 'Zap', 0xffe066, 'lightning', 'hit');
                });
                this.scene.enemyTurnTimers?.push(hopTimer);
                if (toPos) fromPos = toPos; // next hop starts where this one landed
            });
        }
    }
}

function isEnemyType(type) {
    return type === 'enemy' || type === 'eliteEnemy' || type === 'boss';
}

function isOpenEnemyCard(card) {
    return !!card?.revealed && !!card.sprite && this.isEnemyType(card.data?.type);
}

function hasHolographicOmen() {
    const slots = this.scene.inventorySystem?.slots || this.scene.gameState?.inventory || [];
    return slots.some(item => item?.id === 'holographicOmen' || item?.passiveEffect === 'holographicOmen');
}

function applyHolographicOmenStartEffect() {
    if (!this.hasHolographicOmen()) return false;
    const roomType = this.scene.gameState?.roomType || this.scene.roomType || 'COMBAT';
    if (!['COMBAT', 'ELITE', 'BOSS'].includes(roomType)) return false;

    const revealedEnemies = this.boardCards
        .map((card, index) => ({ card, index }))
        .filter(({ card }) => this.isOpenEnemyCard(card));
    if (revealedEnemies.length === 0) return false;

    revealedEnemies.forEach(({ card, index }) => {
        const roll = Math.floor(Math.random() * 4);
        if (roll === 0) {
            card.data.frozen = Math.max(card.data.frozen || 0, 1);
            this.attachFrozenFrame(card);
            this.scene.createFloatingText(card.sprite.x, card.sprite.y - 18, 'Frozen!', 0x66ddff);
        } else if (roll === 1) {
            this.applyWeaponPoison(card, { poisonDamage: 1, poisonTurns: 3 });
        } else if (roll === 2) {
            this.burnEnemy(index, 1);
        } else {
            this.applyShockStatus(card, 1);
        }
        if (this.boardCards[index] === card && card.data?.health > 0) {
            this.updateEnemyInfoText(card);
        }
    });

    if (Math.random() < 0.10) {
        const before = this.scene.gameState?.actionsLeft || 0;
        this.scene.gameState.actionsLeft = Math.max(0, before - 2);
        const lost = before - this.scene.gameState.actionsLeft;
        if (lost > 0) {
            const x = this.scene.playerAvatar?.x || 320;
            const y = this.scene.playerAvatar?.y || 300;
            this.scene.createFloatingText?.(x, y, 'Omen Backfires!', 0xff66cc);
            this.scene.createFloatingText?.(x, y - 16, `-${lost} AP`, 0xff99dd);
            this.scene.updateActionPointUI?.();
            this.scene.updateUI?.();
        }
    }
    return true;
}

function isAnyEnemyCard(card) {
    return !!card && this.isEnemyType(card.data?.type) && card.data.health > 0;
}

function burnEnemy(index, amount) {
    const card = this.boardCards[index];
    if (!this.isAnyEnemyCard(card)) return;
    card.data.health -= amount;
    if (card.revealed && card.sprite?.scene) {
        CombatSequencer.schedule(this.scene, 'gem', () => {
            if (card.sprite?.scene) this.playEnemyHitEffect(card, 'fire');
        });
        CombatSequencer.floatingText(this.scene, 'gem', card.sprite.x, card.sprite.y - 18, `-${amount} Fire`, 0xff7040);
        CombatSequencer.shakeCard(this.scene, 'gem', card.sprite);
        this.updateEnemyInfoText(card);
    }
    // Face-down (unrevealed) enemies still take the damage above, but show no
    // floating text — we don't want to hint that a hidden card is being hit.
    if (card.data.health <= 0) this.removeDefeatedEnemy(index, card);
}

function damageGemTarget(index, amount, label, color, effect = null, beat = 'gem') {
    const card = this.boardCards[index];
    if (!this.isOpenEnemyCard(card)) return;
    if (effect) CombatSequencer.schedule(this.scene, beat, () => {
        if (card.sprite?.scene) this.playEnemyHitEffect(card, effect);
    });
    card.data.health -= amount;
    CombatSequencer.floatingText(this.scene, beat, card.sprite.x, card.sprite.y - 18, `-${amount} ${label}`, color);
    CombatSequencer.shakeCard(this.scene, beat, card.sprite);
    if (card.data.health <= 0) {
        this.removeDefeatedEnemy(index, card);
    } else {
        this.updateEnemyInfoText(card);
    }
}

function applyRelicSlow(card) {
    const slowChance = this.scene.gameState?.relicEffects?.slowChance || 0;
    if (!slowChance || Math.random() >= slowChance || !card?.data || card.data.frozen > 0) return;
    card.data.frozen = 1;
    if (card.sprite) {
        this.attachFrozenFrame(card);
        this.scene.createFloatingText(card.sprite.x, card.sprite.y - 30, 'Slowed!', 0x99ccff);
    }
}

// ─── Reliquary weapon enchants ───────────────────────────────────────────────

function rollWeaponEnchant(weapon) {
    if (!weapon?.enchant || !getWeaponEnchant(weapon.enchant)) return null;
    const chance = Number.isFinite(weapon.enchantChance)
        ? weapon.enchantChance
        : getEnchantChance(weapon.enchant);
    return Math.random() < chance ? weapon.enchant : null;
}

function applyWeaponEnchantOnHit(index, enchantId, swingDamage) {
    if (getWeaponEnchant(enchantId)?.timing !== 'onHit') return;
    const gs = this.scene.gameState;
    if (!gs) return;
    const card = this.boardCards[index];
    const px = this.scene.playerAvatar?.x ?? 320;
    const py = this.scene.playerAvatar?.y ?? 300;

    switch (enchantId) {
        case 'fireball': {
            // Reaches much further than a fire gem's 65px splash, and scales
            // off the swing so it keeps pace with the weapon instead of going
            // stale. Stacks with a fire gem — the gem already resolved above.
            const splash = Math.max(
                ENCHANT_FIRE_SPLASH_MINIMUM,
                Math.floor(swingDamage * ENCHANT_FIRE_SPLASH_FRACTION)
            );
            const tx = card?.sprite?.x;
            const ty = card?.sprite?.y;
            if (tx == null || ty == null) break;
            // Measure to the nearest EDGE of each sprite, matching the gem
            // splash: a boss's centre is far away but its body is not.
            this.boardCards.forEach((other, i) => {
                if (i === index || !other?.sprite) return;
                const b = other.sprite.getBounds();
                const nx = Phaser.Math.Clamp(tx, b.left, b.right);
                const ny = Phaser.Math.Clamp(ty, b.top, b.bottom);
                const dx = nx - tx;
                const dy = ny - ty;
                if (dx * dx + dy * dy <= ENCHANT_FIRE_SPLASH_RADIUS * ENCHANT_FIRE_SPLASH_RADIUS) {
                    this.burnEnemy(i, splash);
                }
            });
            break;
        }

        case 'frostRing': {
            if (!this.isAnyEnemyCard(card)) break;
            card.data.frozen = Math.max(card.data.frozen || 0, ENCHANT_FREEZE_TURNS);
            if (card.sprite) {
                this.attachFrozenFrame(card);
                this.scene.createFloatingText(card.sprite.x, card.sprite.y - 30, 'Frozen!', 0x66ddff);
            }
            break;
        }

        case 'weakness': {
            if (!this.isAnyEnemyCard(card)) break;
            const before = card.data.attack || 0;
            card.data.attack = Math.ceil(before * ENCHANT_WEAKNESS_MULTIPLIER);
            if (card.sprite && card.data.attack < before) {
                this.scene.createFloatingText(card.sprite.x, card.sprite.y - 30, 'Weakened!', 0x9932cc);
            }
            this.updateEnemyInfoText(card);
            break;
        }

        case 'restoration': {
            const before = gs.playerHealth || 0;
            gs.playerHealth = Math.min(gs.maxHealth || 0, before + ENCHANT_HEAL_AMOUNT);
            const healed = gs.playerHealth - before;
            if (healed > 0) {
                this.scene.createFloatingText(px, py, `+${healed} HP`, 0x00ff66);
                this.scene.updateUI?.();
            }
            break;
        }

        case 'magicShield': {
            const base = gs.equippedArmor?.protection || 0;
            gs.magicShield = { turns: ENCHANT_SHIELD_TURNS, multiplier: ENCHANT_SHIELD_MULTIPLIER };
            // Name the actual number rather than a vague "Warded!" — the armor
            // card is about to show this value, so the float explains the change.
            const boosted = effectiveArmorProtection(gs, gs.equippedArmor);
            this.scene.createFloatingText(
                px, py,
                base > 0 ? `Armor ${base} → ${boosted}` : 'Warded!',
                0x88ddff
            );
            // Redraw the worn-armor card so its number updates immediately.
            this.scene.updateEquippedArmorPanel?.();
            this.scene.updateUI?.();
            break;
        }

        case 'boneWall': {
            // The spell reflects two attacks; the proc reflects one.
            gs.boneWall = Math.max(gs.boneWall || 0, 1);
            this.scene.createFloatingText(px, py, 'Bulwark!', 0xffffff);
            this.scene.updateUI?.();
            break;
        }
    }
}

function applyWeaponEnchantOnKill(enchantId) {
    if (getWeaponEnchant(enchantId)?.timing !== 'onKill' || enchantId !== 'smokeScreen') return;
    // Hide one enemy still standing. A face-down card is never picked as an
    // attacker, so this buys a turn exactly like the Smoke Screen card does.
    const candidates = this.boardCards
        .map((card, index) => ({ card, index }))
        .filter(({ card }) => this.isOpenEnemyCard(card) && card.data?.type !== 'boss');
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const hiddenX = pick.card?.sprite?.x ?? 320;
    const hiddenY = pick.card?.sprite?.y ?? 180;
    if (this.hideEnemyCard(pick.index)) {
        // A single puff over the card that just vanished — the spell's full
        // room-filling burst would be far too much for one enemy.
        playSmokePuff(this.scene, hiddenX, hiddenY, { scale: 1.3 });
        SoundHelper.playSound(this.scene, 'smoke_bomb', 0.4);
        this.scene.createFloatingText(
            this.scene.playerAvatar?.x ?? 320,
            this.scene.playerAvatar?.y ?? 300,
            'Shrouded!',
            0xbbbbbb
        );
    }
}

// Flip a revealed enemy back to its card back. Mirrors the Smoke Screen card's
// own teardown (InventoryCombatUse) — markers are destroyed here and rebuilt on
// re-reveal, and the click handler is rebound so the card can be turned again.
function hideEnemyCard(index) {
    const card = this.boardCards[index];
    if (!this.isOpenEnemyCard(card)) return false;

    card.revealed = false;
    card.sprite.setTexture('cardBack');
    card.sprite.off('pointerdown');
    card.sprite.on('pointerdown', () => this.revealCard(index));

    if (card.roleMarker) { card.roleMarker.destroy(); card.roleMarker = null; }
    if (card.poisonMarker) { card.poisonMarker.destroy(); card.poisonMarker = null; }
    if (card.shockMarker) { card.shockMarker.destroy(); card.shockMarker = null; }
    if (card.frozenFrame) { card.frozenFrame.destroy(); card.frozenFrame = null; }
    if (card.infoText) {
        if (card.infoText.list) card.infoText.destroy(true);
        else card.infoText.destroy();
        card.infoText = null;
    }
    return true;
}

function removeDefeatedEnemy(index, card) {
        // Note: defeating the Angry Nestmother does NOT end the grudge — she
        // keeps turning up "once in a while" for the rest of the run you
        // stole her egg (birdAngry stays set until the next run reseeds).

        CombatSequencer.playVariant(this.scene, 'death', 'enemy_death', 0.5);

        // Process amulet kill effects
        if (this.scene.amuletManager) {
            this.scene.amuletManager.processEnemyKill();
        }

        const relicLifesteal = this.scene.gameState.relicEffects?.lifestealOnKill || 0;
        if (relicLifesteal) {
            this.scene.gameState.playerHealth = Math.min(
                this.scene.gameState.maxHealth,
                this.scene.gameState.playerHealth + relicLifesteal
            );
            this.scene.createFloatingText(
                this.scene.playerAvatar.x,
                this.scene.playerAvatar.y,
                `+${relicLifesteal} HP (Lich)`,
                0x9932cc
            );
        }
        
        // Mimic explosion
        if (card.data.name === 'Mimic') {
            this.mimicTreasureExplosion(card.sprite.x, card.sprite.y);
        }

        // Prospector's Pick — small chance the kill drops a coin/crystal,
        // shown with a pickup animation on the enemy's board tile (captured
        // now, before removeCard() destroys the sprite below).
        const pickReward = this.scene.amuletManager?.rollProspectorPickReward?.();
        if (pickReward) {
            this.playKillLootPickup(card.sprite?.x ?? 0, card.sprite?.y ?? 0, pickReward);
        }
        const monocleReward = this.scene.amuletManager?.rollMonocleCrystalReward?.();
        if (monocleReward) {
            this.playKillLootPickup(card.sprite?.x ?? 0, card.sprite?.y ?? 0, monocleReward, 'Monocle');
        }

        // NOTE: individual enemy kills no longer pay coins. The per-kill
        // faucet (3 + floor, every enemy) flooded the economy — coins are now
        // granted once per floor on clear (GameScene.onEnemiesCleared) plus
        // coin cards / chests / events. Mimic treasure above is unaffected.
        SoundHelper.playSound(this.scene, 'treasure_explode', 0.5);

        // Check for on-kill effects from old amulet system (legacy support)
        this.scene.gameState.activeAmulets.forEach(amulet => {
            amulet.abilities?.forEach(ability => {
                if (ability.type === 'action_on_kill') {
                    this.scene.gameState.actionsLeft = Math.min(
                        this.scene.gameState.maxActions, 
                        this.scene.gameState.actionsLeft + ability.amount
                    );
                    this.scene.createFloatingText(
                        this.scene.playerAvatar.x, 
                        this.scene.playerAvatar.y, 
                        `+${ability.amount} Action`, 
                        0x00ff00
                    );
                    this.scene.updateUI();
                }
            });
        });
        
        // Mask of Hollow Whispers — chance to drop a random pickup in the enemy's spot
        const dropChance = this.scene.amuletManager?.getDeathDropChance?.() || 0;
        if (dropChance > 0 && Math.random() < dropChance) {
            this.spawnDeathDrop(index, card);
            // The slot now holds a non-enemy pickup. If that enemy was the
            // last one on the board, the floor is actually clear — we must
            // still run the clear check before bailing, or the Next button
            // never appears.
            this.checkFloorClear();
            return; // skip the normal removal; new card stands in its place
        }

        // Bosses get a bespoke death — a mask animation over the boss, then
        // the silhouette recolors and fades. Regular enemies dissolve as usual.
        if (card.data?.type === 'boss') {
            SoundHelper.playSound(this.scene, 'boss_defeated', 0.6);
            this.playBossDeathEffect(card.sprite);
        } else {
            this.playCardDisappearEffect(card.sprite);
        }

        const savedNeighbors = card.data?.brickNeighbors ? card.data.brickNeighbors.slice() : null;
        this.removeCard(index);
        // temporarily keep a stub with neighbors
        if (savedNeighbors) {
          this.boardCards[index] = { data: { brickNeighbors: savedNeighbors }, revealed: true, sprite: null, shadow: null };
        }
        // try to reveal one behind if melee line is now gone
        this._revealOneBehindAfterFrontClears(index);
        // clean up the stub
        if (this.boardCards[index] && !this.boardCards[index].sprite) {
          this.boardCards[index] = null;
        }
        this.checkFloorClear();
}

function checkFloorClear() {
    // A reflect/thorns kill can finish off the boss on the same action that
    // its own attack drops the player to 0 HP. Without this guard the floor
    // still "clears" — the Next Floor button appears and, if clicked, revives
    // the player via setupBossRewardRoom() — racing against the death screen
    // that gameState.takeDamage() already scheduled.
    if (this.scene.gameState.playerHealth <= 0) return;

    // Reinforcements: while this room still owes waves, don't let it clear.
    // Once the board is nearly empty — or the fight is fully won — drop the next
    // wave from the top instead. A wave is only spent if cards actually dropped.
    // When the waves run out, normal clear resumes below. Which rooms get waves
    // is data: content/balance/Reinforcements.js.
    if (this._waveState && this._waveState.wavesLeft > 0) {
        if (this._waveState.dropping) return;            // a wave is mid-fall
        const liveCount = this.boardCards.filter(Boolean).length;
        const enemiesLeft = this.boardCards.some(c =>
            c && this.isEnemyType(c.data?.type) && (c.data?.health ?? 1) > 0 && !c.data?.isMimic
        );
        if (liveCount <= this._waveState.threshold || !enemiesLeft) {
            if (this.dropWaveCards()) this._waveState.wavesLeft--;
        }
        return;                                          // hold the floor open
    }

    const enemiesRemaining = this.boardCards.some(c =>
        c && c.revealed && this.isEnemyType(c.data?.type) && (c.data?.health ?? 1) > 0
    );

    if (!enemiesRemaining && !this.scene.enemiesCleared) {
        // Check if there are any unrevealed cards that could be enemies
        // A hidden mimic is optional treasure — it shouldn't block floor clear
        const potentialEnemies = this.boardCards.some(c =>
            c && !c.revealed && this.isEnemyType(c.data?.type)
            && (c.data?.health ?? 1) > 0 && !c.data?.isMimic
        );
        
        if (potentialEnemies) return;
        
        const currentFloor = this.scene.gameState.currentFloor;
        const bossFloors = [15, 30, 45];
        
        if (bossFloors.includes(currentFloor)) {
            // Check if this is the final floor
            if (currentFloor === 45) {
                this.scene.time.delayedCall(1000, () => this.scene.gameWon());
            } else {
                // Boss defeated, continue to next floor
                this.scene.onEnemiesCleared();
            }
        } else {
            this.scene.onEnemiesCleared();
        }
    } else if (!enemiesRemaining && this.scene.enemiesCleared) {
        // Clear detection is intentionally idempotent. If another scene or
        // stale input state hid/disabled Next after the first check, any
        // later interaction repairs the button instead of leaving the run
        // permanently stuck with an empty board.
        const potentialEnemies = this.boardCards.some(c =>
            c && !c.revealed && this.isEnemyType(c.data?.type)
            && (c.data?.health ?? 1) > 0 && !c.data?.isMimic
        );
        if (!potentialEnemies) this.scene.showNextFloorButton?.();
    }
}

function tryApplyBoardGem(card, index) {
    const inventory = this.scene.inventorySystem;
    if (!inventory || !card?.sprite) return false;

    if (inventory.discardArea && Phaser.Geom.Intersects.RectangleToRectangle(card.sprite.getBounds(), inventory.discardArea.getBounds())) {
        const discarded = snapshotHumanRunCard(card.data);
        SoundHelper.playSound(this.scene, 'item_discard', 0.7);
        this.scene.createFloatingText(card.sprite.x, card.sprite.y, 'Discarded!', 0xff0000);
        this.scene.recordCardDiscarded?.(card.data, card.sprite.x, card.sprite.y);
        this.removeCard(index);
        recordHumanRunEvent(this.scene, 'board_card_discarded', {
            sourceBoardIndex: index,
            card: discarded,
        });
        // Board discard does not spend AP.
        return true;
    }

    for (let i = 0; i < inventory.slotSprites.length; i++) {
        const slot = inventory.slotSprites[i];
        if (!slot?.background) continue;
        if (!Phaser.Geom.Intersects.RectangleToRectangle(card.sprite.getBounds(), slot.background.getBounds())) continue;

        const targetCard = inventory.slots[i];
        if (targetCard?.type === 'weapon') {
            const gem = snapshotHumanRunCard(card.data);
            if (inventory.applyGemToWeapon(card.data, i)) {
                this.removeCard(index);
                recordHumanRunEvent(this.scene, 'board_gem_socketed', {
                    sourceBoardIndex: index,
                    destinationWeaponSlot: i,
                    gem,
                    weapon: snapshotHumanRunCard(targetCard),
                });
                // Socketing a gem costs AP.
                this.scene.useAction?.();
                return true;
            }
            break;
        }
        if (!targetCard && inventory.addCard(card.data, i)) {
            this.removeCard(index);
            recordHumanRunEvent(this.scene, 'board_loot_collected', {
                sourceBoardIndex: index,
                destinationSlot: inventory.lastAddedSlot,
                card: snapshotHumanRunCard(card.data),
            });
            // Picking a gem into an empty slot does not spend AP.
            return true;
        }
    }

    return false;
}

