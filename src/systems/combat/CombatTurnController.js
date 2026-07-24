import { SoundHelper } from '../../audio/SoundHelper.js';
import { CombatSequencer } from './CombatSequencer.js';

// Gap between consecutive enemies' attacks. Derived from the sequencer's last
// beat so it always clears one attacker's full timeline — retuning the beats
// retunes this with them.
const ENEMY_ATTACK_GAP = CombatSequencer.BEATS.death + 20;
const BOSS_SWARM_ATTACK_GAP = 220;

// One volume for every companion's attack, deliberately under the hero's own
// impact (0.4) and swing (0.5): a companion acts on its own each turn, and if it
// matched the hero it would compete with the swing the player actually chose.
// Shared by melee and ranged so the two never drift apart on tuning.
const COMPANION_SFX_VOLUME = 0.35;

/**
 * Owns the enemy-turn queue and companion combat turn loop.
 * Scene keeps VFX / inventory / card-system APIs; this controller drives timing.
 */
export class CombatTurnController {
    constructor(scene) {
        this.scene = scene;
        this._turnHandlersBound = false;
        this.enemyTurnTimers = [];
        this.enemyTurnQueued = false;
        this.pendingEnemyTurns = 0;
        this.stalemateEnemyTurnQueued = false;
        this.isEnemyTurn = false;
    }

    resetBinding() {
        this._turnHandlersBound = false;
    }

    bindEnemyTurnHandler() {
        if (this._turnHandlersBound) return;
        this._turnHandlersBound = true;
        this.scene.events.on('endPlayerTurn', () => this.runEnemyTurn());
    }

    scheduleEnemyTurn() {
        const scene = this.scene;
        if (scene._transitioning || scene.enemiesCleared) return;
        // Queue one enemy turn per action. Rapid actions no longer coalesce into
        // a single attack — each one earns its own enemy response.
        this.pendingEnemyTurns = (this.pendingEnemyTurns || 0) + 1;
        this._drainEnemyTurns();
    }

    hasCombatStalemate() {
        const scene = this.scene;
        if (scene._transitioning || scene.enemiesCleared || scene.gameState?.playerHealth <= 0) return false;

        const board = scene.cardSystem?.boardCards || [];
        const enemiesRemain = board.some(card => (
            card?.revealed
            && scene.isEnemyCard(card)
            && (card.data?.health ?? 1) > 0
        ));
        if (!enemiesRemain) return false;

        // A remaining board card can still reveal or provide a way forward.
        if (board.some(card => card && !scene.isEnemyCard(card))) return false;

        const inventory = scene.inventorySystem?.slots || scene.gameState?.inventory || [];
        const hasUsableWeapon = inventory.some(card => (
            card?.type === 'weapon' && (card.durability ?? 1) > 0
        )) || (
            scene.gameState?.equippedWeapon?.type === 'weapon'
            && (scene.gameState.equippedWeapon.durability ?? 1) > 0
        );
        if (hasUsableWeapon) return false;

        // Magic can still change or resolve a fight without a weapon.
        return !inventory.some(card => card?.type === 'magic');
    }

    queueStalemateEnemyTurn() {
        const scene = this.scene;
        if (this.stalemateEnemyTurnQueued || this.enemyTurnQueued || this.isEnemyTurn) return;
        if ((this.pendingEnemyTurns || 0) > 0 || !this.hasCombatStalemate()) return;

        this.stalemateEnemyTurnQueued = true;
        const timer = scene.time.delayedCall(900, () => {
            this.stalemateEnemyTurnQueued = false;
            if (this.hasCombatStalemate()) this.scheduleEnemyTurn();
        });
        this.enemyTurnTimers.push(timer);
    }

    _drainEnemyTurns() {
        const scene = this.scene;
        if (this.enemyTurnQueued || this.isEnemyTurn || scene._transitioning || scene.enemiesCleared) return;
        if (!this.pendingEnemyTurns || this.pendingEnemyTurns <= 0) return;
        this.enemyTurnQueued = true;
        const timer = scene.time.delayedCall(500, () => {
            this.enemyTurnQueued = false;
            this.pendingEnemyTurns = Math.max(0, (this.pendingEnemyTurns || 0) - 1);
            scene.events.emit('endPlayerTurn');
        });
        this.enemyTurnTimers.push(timer);
    }

    runEnemyTurn() {
        this.enemyTurnQueued = false;
        if (this.isEnemyTurn) return;
        this.isEnemyTurn = true;
        this.revealedEnemiesAttack();
    }

    revealedEnemiesAttack() {
        const scene = this.scene;
        if (scene.gameState.playerHealth <= 0) return; // Don't attack a dead player.

        // Snapshot which enemies are eligible to act this action. A freshly revealed
        // enemy sits out the action that revealed it (a one-action grace so flipping
        // into an enemy doesn't zap you on the same click), then joins the fight on
        // the next action. This is PER-ENEMY: revealing a new enemy no longer cancels
        // attacks from enemies already on the board.
        const eligible = scene.cardSystem.boardCards
            .map((card, index) => ({ card, index }))
            .filter(({ card }) => card && card.revealed && scene.isEnemyCard(card) && !card.justRevealed);
        // Clear the grace flag now that we've snapshotted — they act next turn.
        scene.cardSystem.boardCards.forEach(card => {
            if (card && card.justRevealed) card.justRevealed = false;
        });
        if (eligible.length === 0) {
            this.finishEnemyTurnEffects({ runCompanions: false });
            return;
        }

        // Summoning is a boss command, not an attack. It happens on every
        // eligible boss turn even while the boss is frozen; Frost Ring still
        // denies its damage and other on-hit effects, but cannot turn a boss
        // fight into three completely free turns.
        eligible.forEach(({ card }) => {
            if (card.data?.type !== 'boss' || !card.data?.abilities || (card.data.health || 0) <= 0) return;
            card.data.abilities.forEach(ability => {
                if (ability.type === 'summon' && Math.random() < ability.chance) {
                    const n = ability.count || 1;
                    for (let k = 0; k < n; k++) scene.cardSystem.summonEnemy(ability.enemyType, card);
                }
            });
        });

        // Check if player is blocking with bow
        if (scene.gameState.blockNextAttack) {
            scene.gameState.blockNextAttack = false; // Reset block
            SoundHelper.playSound(scene, 'armor_equip', 0.5);
            scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, 'Blocked!', 0x00aaff);

            // Visual effect for successful block
            const blockEffect = scene.add.circle(scene.playerAvatar.x, scene.playerAvatar.y, 30, 0x00aaff, 0.5);
            scene.tweens.add({
                targets: blockEffect,
                alpha: 0,
                scale: 2,
                duration: 500,
                onComplete: () => blockEffect.destroy()
            });

            this.finishEnemyTurnWithCompanion();
            return; // Block prevents ALL enemy attacks this action
        }

        // Check for bone wall reflection FIRST (before individual enemy attacks)
        if (scene.gameState.boneWall && scene.gameState.boneWall > 0) {
            // Find the first eligible (non-frozen) attacking enemy
            const firstAttacker = eligible.find(({ card }) => !(card.data.frozen && card.data.frozen > 0)) || null;

            if (firstAttacker) {
                scene.gameState.boneWall--;
                SoundHelper.playSound(scene, 'armor_equip', 0.5);

                // Reflect damage back to enemy
                const reflectedDamage = firstAttacker.card.data.attack;
                scene.cardSystem.attackEnemy(firstAttacker.index, reflectedDamage, true);
                scene.createFloatingText(firstAttacker.card.sprite.x, firstAttacker.card.sprite.y, `-${reflectedDamage} (Reflected)`, 0xffffff);
                scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, 'Bone Wall!', 0xffffff);
                scene.updateUI(); // Refresh so the remaining Bone Wall charges update
                this.finishEnemyTurnWithCompanion();
                return; // Bone wall blocks all attacks this action
            }
        }

        // Check for mirror shield (one-time full reflection)
        if (scene.gameState.mirrorShield) {
            // Find the first eligible (non-frozen) attacking enemy
            const firstAttacker = eligible.find(({ card }) => !(card.data.frozen && card.data.frozen > 0)) || null;

            if (firstAttacker) {
                scene.gameState.mirrorShield = false;
                SoundHelper.playSound(scene, 'armor_equip', 0.5);

                // Reflect full damage back
                const reflectedDamage = firstAttacker.card.data.attack;
                scene.cardSystem.attackEnemy(firstAttacker.index, reflectedDamage, true);
                scene.createFloatingText(firstAttacker.card.sprite.x, firstAttacker.card.sprite.y, `-${reflectedDamage} (Mirrored)`, 0xc0c0c0);
                scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, 'Mirror Shield!', 0xc0c0c0);
                scene.updateUI(); // Refresh so Mirror Shield drops off the effects panel
                this.finishEnemyTurnWithCompanion();
                return; // Mirror shield blocks all attacks this action
            }
        }

        const attackers = eligible;
        const enemyAttackGap = this.getEnemyAttackGap(attackers);

        let attackerIndex = 0;
        const attackNext = () => {
            if (scene._transitioning || scene.enemiesCleared || scene.gameState.playerHealth <= 0 || attackerIndex >= attackers.length) {
                this.finishEnemyTurnEffects();
                return;
            }

            const { index } = attackers[attackerIndex++];
            const card = scene.cardSystem.boardCards[index];
            if (card && card.revealed && scene.isEnemyCard(card)) {
                this.processEnemyAttack(card, index);
                scene.updateUI();
            }

            // Long enough for one attacker's whole timeline (hit → thorns →
            // armor break) to finish before the next one swings, so two enemies
            // never narrate over each other.
            const timer = scene.time.delayedCall(enemyAttackGap, attackNext);
            this.enemyTurnTimers.push(timer);
        };

        attackNext();
    }

    getEnemyAttackGap(attackers = []) {
        const scene = this.scene;
        const roomType = scene.gameState?.roomType || scene.roomType;
        const hasBoss = attackers.some(({ card }) => card?.data?.type === 'boss');
        return roomType === 'BOSS' && hasBoss && attackers.length >= 3
            ? BOSS_SWARM_ATTACK_GAP
            : ENEMY_ATTACK_GAP;
    }

    clearEnemyTurnTimers() {
        if (!this.enemyTurnTimers) {
            this.enemyTurnTimers = [];
            return;
        }
        this.enemyTurnTimers.forEach(timer => timer?.remove?.(false));
        this.enemyTurnTimers = [];
        this.enemyTurnQueued = false;
        this.pendingEnemyTurns = 0;
        this.stalemateEnemyTurnQueued = false;
        this.isEnemyTurn = false;
    }

    processEnemyAttack(card, index) {
        const scene = this.scene;
        // Process frozen duration BEFORE checking if enemy can attack
        if (card.data.frozen && card.data.frozen > 0) {
            const wasShocked = (card.data.shockedTurns || 0) > 0;
            card.data.frozen--;
            if (wasShocked) card.data.shockedTurns--;

            if (card.data.frozen === 0 && card.sprite) {
                card.sprite.clearTint();
                scene.cardSystem.removeFrozenFrame(card);
                if (wasShocked) {
                    card.shockMarker?.destroy?.();
                    card.shockMarker = null;
                    card.data.shockedTurns = 0;
                    scene.createFloatingText(card.sprite.x, card.sprite.y, 'Shock Wore Off!', 0x99ddff);
                } else {
                    scene.createFloatingText(card.sprite.x, card.sprite.y, 'Thawed!', 0xffffff);
                }
            } else {
                scene.createFloatingText(card.sprite.x, card.sprite.y, `Frozen (${card.data.frozen})`, 0x00ccff);
            }
            return;
        }

        // Mimic escape countdown — runs out after 3 enemy turns if still alive
        if (card.data.isMimic) {
            if (card.data.escapeTurnsLeft === undefined) {
                card.data.escapeTurnsLeft = card.data.escapeTurns || 3;
            }
            card.data.escapeTurnsLeft--;
            if (card.data.escapeTurnsLeft <= 0) {
                scene.cardSystem.mimicEscape(index);
                return; // gone — no attack this turn
            }
            scene.createFloatingText(card.sprite.x, card.sprite.y - 28, `${card.data.escapeTurnsLeft} left!`, 0xffaa00);
            // Mimic still takes its small bite below
        }

        // Lute of First Light — first melee enemy on each floor skips its first attack
        if (scene.amuletManager?.hasCharmingTune?.() &&
            !scene.gameState.charmingTuneUsed &&
            card.data.role === 'MELEE') {
            scene.gameState.charmingTuneUsed = true;
            scene.createFloatingText(card.sprite.x, card.sprite.y - 20, 'Charmed (Lute)', 0xff66ff);
            return;
        }

        // Siren's Perfume — chance to redirect attack onto another enemy
        const charmChance = scene.amuletManager?.getCharmChance?.() || 0;
        if (charmChance > 0 && Math.random() < charmChance) {
            const others = scene.cardSystem.boardCards
                .map((c, i) => ({ card: c, index: i }))
                .filter(({ card: c, index: i }) =>
                    c && c.revealed && i !== index && scene.isEnemyCard(c)
                );
            if (others.length > 0) {
                const target = others[Math.floor(Math.random() * others.length)];
                scene.createFloatingText(card.sprite.x, card.sprite.y - 20, 'Charmed!', 0xff66ff);
                scene.cardSystem.attackEnemy(target.index, card.data.attack, false);
                return; // skip player damage
            }
        }

        let damageDealt = card.data.attack;

        // RAGE — when the boss drops below its HP threshold it hits harder. Shows
        // an "ENRAGED!" cue the first time it kicks in so the spike is legible.
        const rage = card.data.abilities?.find(a => a.type === 'rage');
        if (rage) {
            const maxHp = card.data.maxHealth || card.data.health;
            if (maxHp > 0 && (card.data.health / maxHp) <= (rage.threshold ?? 0.3)) {
                damageDealt = Math.ceil(damageDealt * (rage.damageBoost || 1.5));
                if (!card.data._rageShown) {
                    card.data._rageShown = true;
                    scene.createFloatingText(card.sprite.x, card.sprite.y - 24, 'ENRAGED!', 0xff3333);
                }
            }
        }

        // ARMOR BREAK — this hit pierces some of the player's protection.
        const armorBreak = card.data.abilities?.find(a => a.type === 'armor_break');
        const armorPierce = armorBreak?.amount || 0;
        if (armorPierce > 0 && scene.gameState.equippedArmor) {
            scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y - 16, 'Armor Broken!', 0xffa500);
        }

        scene.createDamageEffect(card.sprite.x, card.sprite.y);

        // Apply abilities like poison on hit
        card.data.abilities?.forEach(ability => {
            if (ability.type === 'poison') {
                const killedBy = card.data.name || card.data.type || 'Enemy';
                if (scene.gameState.addPlayerEffect({ ...ability, killedBy })) {
                    scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, 'Poisoned!', 0x00ff00);
                }
            } else if (ability.type === 'coin_steal') {
                // Goblin coin stealing ability
                if (Math.random() < ability.chance && scene.gameState.coins > 0) {
                    const stolenAmount = Math.min(ability.amount, scene.gameState.coins);
                    scene.gameState.coins -= stolenAmount;
                    scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, `-${stolenAmount} coins stolen!`, 0xffd700);
                    scene.createFloatingText(card.sprite.x, card.sprite.y, `+${stolenAmount}`, 0xffd700);
                }
            }
        });

        const playerHealthBeforeDamage = scene.gameState.playerHealth;
        const { actualDamage, tookDamage } = scene.gameState.takeDamage(damageDealt, index, 'enemy', armorPierce);

        if (tookDamage) {
            CombatSequencer.playVariant(scene, 'hurt', 'player_hurt', 0.5);
            CombatSequencer.floatingText(scene, 'hurt', scene.playerAvatar.x, scene.playerAvatar.y, `-${actualDamage}`, 0xff0000);

            if (playerHealthBeforeDamage > 0 && scene.gameState.playerHealth <= 0) {
                scene.killedBy = card.data.name || card.data.type || 'Enemy';
            }
        }

        // Boss LIFESTEAL — the leech heals from the damage it ACTUALLY landed on
        // the player (after armor). Basing it on real damage means good armor
        // throttles the heal, and fully blocking a hit stops it entirely — so a
        // defensive build can out-race a healing boss like the Lich instead of
        // watching it top itself off off a number your armor never touched.
        const leech = card.data.abilities?.find(a => a.type === 'lifesteal');
        if (leech && actualDamage > 0) {
            const heal = Math.max(1, Math.ceil(actualDamage * (leech.percentage || 0.3)));
            if (card.data.maxHealth === undefined) card.data.maxHealth = card.data.health;
            card.data.health = Math.min(card.data.maxHealth, card.data.health + heal);
            scene.cardSystem.updateEnemyInfoText?.(card);
            if (card.sprite) scene.createFloatingText(card.sprite.x, card.sprite.y - 16, `+${heal} Leech`, 0x66ff66);
        }

        this.applyThornsDamage(card, index, tookDamage);
    }

    getActiveThornsCard() {
        const scene = this.scene;
        const slots = scene.inventorySystem?.slots || scene.gameState.inventory || [];
        for (let i = 0; i < slots.length; i++) {
            const item = slots[i];
            if (item?.type === 'thorns' && item.durability > 0) {
                return { item, index: i };
            }
        }
        return null;
    }

    applyThornsDamage(card, index, playerTookDamage = false) {
        const scene = this.scene;
        if (scene.cardSystem.boardCards[index] !== card) return;
        // Thorns only reflect onto melee attackers. Skip back-row (RANGED) enemies
        // and archers — a front-row archer's role is forced to MELEE by position,
        // but it still attacks from range, so its intrinsic ranged flag exempts it.
        // Bosses have no row/role (they occupy a fixed slot) but strike the player
        // in melee, so they always count as melee attackers for thorns.
        const isBoss = card.data.type === 'boss';
        const isMelee = isBoss || (card.data.role === 'MELEE' && !card.data.isRangedType);
        const thorns = isMelee ? this.getActiveThornsCard() : null;
        // Armor thorns (Briar Room bonus) also only bite melee attackers — a ranged
        // archer never touches your armor, so it shouldn't take thorn damage.
        const armorDamage = (isMelee && playerTookDamage)
            ? (scene.gameState.equippedArmor?.thornDamage || 0)
            : 0;
        const cardDamage = thorns ? (thorns.item.thornDamage || 2) : 0;
        const damage = armorDamage + cardDamage;
        if (damage <= 0) return;
        const x = card.sprite?.x || scene.playerAvatar.x;
        const y = card.sprite?.y || scene.playerAvatar.y;

        scene.cardSystem.attackEnemy(index, damage, true);
        CombatSequencer.playSound(scene, 'reflect', 'thorns_hit', 0.45);
        CombatSequencer.floatingText(scene, 'reflect', x, y, `-${damage} Thorns`, 0x9dff7a);

        if (!thorns) return;
        thorns.item.durability = Math.max(0, thorns.item.durability - 1);
        if (thorns.item.durability <= 0) {
            CombatSequencer.floatingText(scene, 'break', scene.playerAvatar.x, scene.playerAvatar.y + 20, 'Thorns broke!', 0x9dff7a);
            scene.grantCardSpentRelicBonus(thorns.item, scene.playerAvatar.x, scene.playerAvatar.y);
            if (scene.inventorySystem) {
                scene.inventorySystem.removeCard(thorns.index);
            } else if (scene.gameState.inventory) {
                scene.gameState.inventory[thorns.index] = null;
            }
        } else if (scene.inventorySystem) {
            // Rebuild first (durability pip just dropped), then play the "acting"
            // hop on the fresh sprite so the thorns card visibly retaliates —
            // same flourish a companion / off-hand dagger uses.
            scene.inventorySystem.rebuildInventorySprites();
            scene.inventorySystem.playSlotStrikeAnimation(thorns.index);
        }
    }

    finishEnemyTurnEffects({ runCompanions = true } = {}) {
        const scene = this.scene;
        // Process magic buff durations AFTER enemy attacks
        if (scene.gameState.shadowBlade) {
            scene.gameState.shadowBlade.turns--;
            if (scene.gameState.shadowBlade.turns <= 0) {
                scene.gameState.shadowBlade = null;
                scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, 'Shadow Blade faded', 0x666666);
            }
        }

        if (scene.gameState.magicShield) {
            scene.gameState.magicShield.turns--;
            if (scene.gameState.magicShield.turns <= 0) {
                scene.gameState.magicShield = null;
                scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, 'Magic Shield faded', 0x666666);
            }
        }

        scene.cardSystem.processEnemyPoisonEffects();

        // Process player poison effects
        let effectDamage = 0;
        let poisonKilledBy = null;
        for (let i = scene.gameState.playerEffects.length - 1; i >= 0; i--) {
            const effect = scene.gameState.playerEffects[i];
            if (effect.type === 'poison') {
                effectDamage += effect.damage;
                poisonKilledBy = effect.killedBy || poisonKilledBy;
            }
            effect.turns--;
            if (effect.turns <= 0) {
                scene.gameState.playerEffects.splice(i, 1);
                scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y + 20, 'Poison Wore Off', 0xcccccc);
            }
        }

        if (effectDamage > 0) {
            const playerHealthBeforePoison = scene.gameState.playerHealth;
            const { actualDamage } = scene.gameState.takeDamage(effectDamage, -1, 'poison');
            // A dodged or immune tick already announced itself ("Dodge!",
            // "Poison Immune!") — don't stack a "-0 (Poison)" and a hurt grunt
            // on top of it.
            if (actualDamage > 0) {
                CombatSequencer.playVariant(scene, 'hurt', 'player_hurt', 0.5);
                CombatSequencer.floatingText(scene, 'hurt', scene.playerAvatar.x, scene.playerAvatar.y, `-${actualDamage} (Poison)`, 0x00ff00);
            }

            // Track poison death
            if (playerHealthBeforePoison > 0 && scene.gameState.playerHealth <= 0) {
                scene.killedBy = poisonKilledBy || 'Poison';
            }

            // Lethal poison: gameState.takeDamage() already scheduled
            // gameOver(). Just halt the turn so companion/end-of-turn
            // effects don't run on a dead player.
            if (scene.gameState.playerHealth <= 0) {
                this.isEnemyTurn = false;
                return;
            }
        }

        scene.updateUI();
        if (scene.gameState.playerHealth <= 0) {
            this.isEnemyTurn = false;
            return;
        }
        if (runCompanions) {
            this.finishEnemyTurnWithCompanion();
            return;
        }

        this.isEnemyTurn = false;
        scene.updateUI();
        this._drainEnemyTurns();
        this.queueStalemateEnemyTurn();
    }

    selectCompanionTarget(companion) {
        const scene = this.scene;
        const candidates = (scene.cardSystem?.boardCards || [])
            .map((card, index) => ({ card, index }))
            .filter(({ card }) => (
                card?.revealed
                && card?.sprite
                && scene.isEnemyCard(card)
                && (card.data?.health || 0) > 0
            ));
        if (candidates.length === 0) return null;

        if (companion?.attackStyle === 'melee' || companion?.range === 'melee') {
            // Melee companions obey the same frontline gate the player does
            // (see attackEnemy in BoardCombat): while any MELEE enemy lives —
            // including a boss's summons — nothing behind it can be reached.
            // Once the frontline is gone, everything is fair game, bosses and
            // archers alike.
            const blocked = scene.cardSystem?._anyMeleeAlive?.({ includeHidden: true });
            const reachable = blocked
                ? candidates.filter(({ card }) => card.data?.role === 'MELEE')
                : candidates;
            if (reachable.length === 0) return null;
            return reachable[Math.floor(Math.random() * reachable.length)];
        }

        const archers = candidates.filter(({ card }) => card.data?.isRangedType === true);
        const pool = archers.length > 0 ? archers : candidates;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    finishEnemyTurnWithCompanion() {
        const scene = this.scene;
        this.runCompanionTurns(() => {
            this.isEnemyTurn = false;
            scene.updateUI();
            // Run the next queued enemy turn, if any actions stacked up during this one.
            this._drainEnemyTurns();
            this.queueStalemateEnemyTurn();
        });
    }

    runCompanionTurns(onComplete = () => {}) {
        const scene = this.scene;
        const entries = scene.getCompanionEntries();
        const runNext = (position) => {
            if (position >= entries.length) {
                onComplete();
                return;
            }
            this.runCompanionTurn(entries[position], () => runNext(position + 1));
        };
        runNext(0);
    }

    runCompanionTurn(entry, onComplete = () => {}) {
        const scene = this.scene;
        const target = this.selectCompanionTarget(entry?.companion);
        if (!entry || !target || scene._transitioning || scene.gameState.playerHealth <= 0) {
            onComplete();
            return false;
        }

        // Shared "acting" hop — lifts the card art, its value/pips, shadow and
        // shine together, same as the off-hand dagger and thorns.
        scene.inventorySystem?.playSlotStrikeAnimation(entry.index);

        const attackTimer = scene.time.delayedCall(120, () => {
            const currentTarget = scene.cardSystem.boardCards[target.index];
            if (currentTarget === target.card && currentTarget?.data?.health > 0) {
                scene.markCompanionParticipated(entry.companion);
                // Evasive enemies (Lost Soul) can dodge a companion's strike too —
                // rollEvade shows "Miss!" and we skip the damage and the shock.
                if (!scene.cardSystem.rollEvade(currentTarget)) {
                    const isMelee = entry.companion.attackStyle === 'melee'
                        || entry.companion.range === 'melee';
                    // Companions never ran through the weapon/gem paths that own
                    // the combat SFX, so both of them used to strike in silence.
                    // Each borrows the sound of the effect whose visual it already
                    // shares: melee lands a blade, so it takes the hero's impact
                    // variants; the chick takes the lightning-gem zap. Both ride
                    // the 'gem' beat damageGemTarget uses below, so the sound and
                    // the number land together.
                    CombatSequencer.playVariant(
                        scene, 'gem',
                        isMelee ? 'enemy_hit' : 'lightning_zap',
                        COMPANION_SFX_VOLUME
                    );
                    scene.cardSystem.damageGemTarget(
                        target.index,
                        entry.companion.attack || 2,
                        isMelee ? 'Skeleton Slash' : 'Chick Zap',
                        isMelee ? 0xd8d8c8 : 0xffe066,
                        isMelee ? null : 'lightning'
                    );
                    if ((entry.companion.shockChance || 0) > 0
                        && Math.random() < entry.companion.shockChance) {
                        const shockedTarget = scene.cardSystem.boardCards[target.index];
                        if (shockedTarget === target.card && shockedTarget?.data?.health > 0) {
                            scene.cardSystem.applyShockStatus(shockedTarget, 1);
                        }
                    }
                }
            }
            const finishTimer = scene.time.delayedCall(220, onComplete);
            this.enemyTurnTimers.push(finishTimer);
        });
        this.enemyTurnTimers.push(attackTimer);
        return true;
    }
}
