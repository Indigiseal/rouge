import { SoundHelper } from '../../audio/SoundHelper.js';
import { tweenAlongArc } from '../../ui/ArcFlight.js';
import { CombatSequencer } from './CombatSequencer.js';
import { getEnemyHitAttack, spendSapping, enemyStrikeSigils, applyEnemyStrikeSigils } from '../../content/combat/enemyAttack.js';
import { ENCHANT_SAPPING_CHANCE } from '../../content/balance/WeaponEnchants.js';
import { CONTROL_HESITATION_CHANCE, pickControlTreacheryTarget } from '../../content/amulets/control.js';
import { isSilkCocoonCacheRoom } from '../board/CocoonCacheBoard.js';
import { canHurtEnemyAtAll } from '../board/BoardCombat.js';
import { getEnemy } from '../../content/cards/enemies.js';
import { HAND_LOCKS, handLockKindOf, handLockOf } from '../../content/combat/handLock.js';
import { playStrikeSlash } from '../../ui/StrikeSlash.js';
import { consumeMirrorSigil, enemyWarcryChance, playerWarcryChance, regenerateAmount, armorThornsDamage, companionStrengthBonus } from './SigilEffects.js';
import { getSigil, hasEnemyTrait, sigilLevel } from '../../content/sigils/sigils.js';
import { tryEnemySandstorm, tryEnemyQuickStrike } from '../../content/combat/sandreach.js';

// A boss summons for sure once it has gone this many turns without one.
const BOSS_SUMMON_PITY = 4;
import { ENEMY_BASE_CRIT, ENEMY_CRIT_MULT } from '../../content/balance/CombatChance.js';
import { TOLLROAD_GOBLIN_ALLY_TYPES } from '../../content/location-packs/tollroad/index.js';
import { showBossAttackFrame } from '../../content/cards/bossAttackFrames.js';
import { bossSoundKeys } from '../../content/audio/bossSounds.js';
import { consumeBoneShield } from '../../content/combat/boneShield.js';
import { consumeBriarShield } from '../../content/combat/briarShield.js';
import { t } from '../../i18n/i18n.js';
import { playCharmHearts } from './StatusOverlay.js';
import { advanceBonePile, repairBoneArmor, summonAtHealthThresholds } from '../../content/combat/boneflood.js';
import { growEnemy, regenerateAllies } from '../../content/combat/mireturn.js';
import { strengthenPlayerPoison } from '../../content/combat/silkdeep.js';
import { addPlayerBurn, takePlayerBurnTick, SCORCHED_CHANCE } from '../../content/combat/ashhowl.js';
import { tryEnemyShock } from '../../content/combat/storm.js';
import { consumeCompanionAttackHold, tryEnemyFrost } from '../../content/combat/frost.js';

// The Crystal Spiderling webs instead of hitting (older saves carry the old
// card, which had damage, so the id counts too).
function isWebSpinner(companion) {
    return Boolean(companion?.websEnemies || companion?.id === 'crystalSpiderlingCompanion');
}

const GOBLIN_ALLY_TYPE_SET = new Set(TOLLROAD_GOBLIN_ALLY_TYPES);
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
// A thrown web or ink blob (throwWebAt): flight time and arc height. Each
// lock's art is in content/combat/handLock.js.
const WEB_THROW_MS = 420;
const WEB_THROW_ARC = 30;

/**
 * Owns the enemy-turn queue and companion combat turn loop.
 * Scene keeps VFX / inventory / card-system APIs; this controller drives timing.
 */

// Bog healers sustain other revealed allies, including other healers.
function regenerateEnemies(scene) {
    const cs = scene?.cardSystem;
    for (const { card, amount } of regenerateAllies(cs?.boardCards, card => scene.isEnemyCard(card))) {
        cs.updateEnemyInfoText?.(card);
        if (card.sprite) scene.createFloatingText(card.sprite.x, card.sprite.y - 18, `+${amount}`, 0x4a884f);
    }
}

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

        // A remaining board card can still be a way forward — but only if
        // interacting with it could plausibly change the fight. A face-down
        // card might turn out to be a weapon or a spell, so it always counts.
        // An already-revealed weapon or magic card sitting uncollected is a
        // genuine option too. Plain loot — a coin, food, a potion, armor, a
        // gem with nothing left to socket it into — is not: picking it up
        // spends no action and cannot make an unreachable enemy reachable.
        //
        // This used to treat ANY non-enemy card as a way out, on the theory
        // that "something is still there to collect" means the player isn't
        // stuck yet. That is true right up until the last enemy is a Silkslinger
        // that has webbed the player's only weapon and a coin is still sitting
        // uncollected on the board: the player can pick up every scrap of loot
        // there is and the fight never becomes winnable, but the old check kept
        // reporting "not a stalemate" for as long as that coin sat there, so
        // the web never got a chance to matter — no forced enemy turn ever
        // fired to tick it down, weaken the player, or otherwise move the
        // fight forward. Cocoon shells don't hit this at all; they are already
        // enemy-typed, so isEnemyCard excludes them here regardless.
        const boardOffersWayForward = board.some(card => {
            if (!card || scene.isEnemyCard(card)) return false;
            if (!card.revealed) return true;
            return card.data?.type === 'weapon' || card.data?.type === 'magic';
        });
        if (boardOffersWayForward) return false;

        // Normal rooms: face-down cards can be flipped without a weapon.
        // Cocoon cache has no flips — only damage opens shells.
        const cocoonCache = isSilkCocoonCacheRoom(scene.gameState);
        if (!cocoonCache && board.some(card => card && !card.revealed && scene.isEnemyCard(card))) {
            return false;
        }

        const inventory = scene.inventorySystem?.slots || scene.gameState?.inventory || [];
        const isUsableWeapon = (card) => (
            card?.type === 'weapon'
            && (card.durability ?? 1) > 0
            && !(card.webbedTurns > 0)
        );
        // Carrying a weapon is not the same as having a way out: every revealed
        // enemy can be immune to the only kind of weapon in the pack — a quiver
        // of bows against a Thorn Sprite. attackEnemy rejects those swings
        // without spending AP or handing the enemies a turn, so a detector that
        // only asked "is there a weapon" left the board frozen with no way to
        // clear the floor and no Next button. Same predicate as the swing.
        const usableWeapons = [scene.gameState?.equippedWeapon, ...inventory]
            .filter(isUsableWeapon);
        const revealedEnemies = board.filter((card) => (
            card?.revealed
            && scene.isEnemyCard(card)
            && (card.data?.health ?? 1) > 0
        ));
        const canDamageSomething = usableWeapons.some((weapon) => (
            revealedEnemies.some((card) => canHurtEnemyAtAll(weapon, card))
        ));
        if (canDamageSomething) return false;

        // Cocoon shells only open to damage. Buff/heal magic does not help —
        // only weapon-like spells that hit a board enemy count as a way out.
        if (cocoonCache) {
            const canCrackCocoon = (card) => (
                card?.type === 'magic'
                && (card.magicType === 'fireball' || card.magicType === 'soulDrain')
            );
            return !inventory.some(canCrackCocoon);
        }

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

        // Silkslinger webs expire at the start of the next enemy turn.
        this.tickHandWebs();

        // Piles remain targetable, but never attack. A returned creature gets
        // the same one-action grace as a newly revealed enemy.
        scene.cardSystem.boardCards.forEach(card => {
            if (!advanceBonePile(card?.data)) return;
            card.justRevealed = true;
            card.sprite?.setAlpha?.(1);
            scene.cardSystem.createCardInfoText?.(card);
            scene.createFloatingText?.(card.sprite?.x ?? 320, card.sprite?.y ?? 120, 'Reassembled!', 0xd6c2c1);
        });

        // Snapshot which enemies are eligible to act this action. A freshly revealed
        // enemy sits out the action that revealed it (a one-action grace so flipping
        // into an enemy doesn't zap you on the same click), then joins the fight on
        // the next action. This is PER-ENEMY: revealing a new enemy no longer cancels
        // attacks from enemies already on the board.
        const eligible = scene.cardSystem.boardCards
            .map((card, index) => ({ card, index }))
            .filter(({ card }) => {
                if (!card || !scene.isEnemyCard(card) || card.justRevealed) return false;
                if ((card.data?.health ?? 0) <= 0 || card.data?.isBonePile) return false;
                // Cocoon shells do not attack — they only crack when damaged.
                if (card.data?.isCocoon || (Array.isArray(card.data?.features) && card.data.features.includes('cocoon_shell'))) {
                    return false;
                }
                if (card.revealed) return true;
                // Thorn Fairy keeps acting while face-down so she can flip back up.
                return hasEnemyTrait(card.data, 'veil_flip');
            });
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
            const isBoss = card.data?.type === 'boss';
            const isElite = !!card.data?.isEliteMiniBoss;
            if ((!isBoss && !isElite) || !card.data?.abilities || (card.data.health || 0) <= 0) return;
            // Unlike a boss, a frozen (Frost, Arrest) elite cannot summon.
            if (isElite && card.data.frozen > 0) return;
            card.data.abilities.forEach(ability => {
                if (ability.type !== 'summon') return;
                if (Array.isArray(ability.thresholds)) {
                    summonAtHealthThresholds(card.data, ability,
                        enemyType => scene.cardSystem.summonEnemy(enemyType, card));
                    return;
                }
                // A boss that has gone BOSS_SUMMON_PITY turns without a
                // summon calls one for sure, so a low chance (Soul Eater
                // 15%) can't leave a whole fight without one.
                const overdue = isBoss && (card.data.turnsSinceSummon || 0) >= BOSS_SUMMON_PITY;
                let summoned = false;
                if (overdue || Math.random() < ability.chance) {
                    const n = ability.count || 1;
                    for (let k = 0; k < n; k++) {
                        // A boss lines its minions up under it; an elite calls
                        // one into the empty board spot nearest it.
                        if (isBoss) summoned = scene.cardSystem.summonEnemy(ability.enemyType, card) || summoned;
                        else scene.cardSystem.summonForElite?.(card);
                    }
                }
                // The count only resets on a summon that happened (a full
                // board refuses one, and the boss stays due).
                if (isBoss) card.data.turnsSinceSummon = summoned ? 0 : (card.data.turnsSinceSummon || 0) + 1;
            });
        });

        // Check the generic weapon-block effect (bows no longer provide it).
        if (scene.gameState.blockNextAttack) {
            scene.gameState.blockNextAttack = false; // Reset block
            SoundHelper.playVariant(scene, 'block_hit', 0.5);
            scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, 'Blocked!', 0x3f818f);

            // Visual effect for successful block
            const blockEffect = scene.add.circle(scene.playerAvatar.x, scene.playerAvatar.y, 30, 0x3f818f, 0.5);
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

        const attackers = eligible;
        const enemyAttackGap = this.getEnemyAttackGap(attackers);

        let attackerIndex = 0;
        const attackNext = () => {
            if (scene._transitioning || scene.enemiesCleared || scene.gameState.playerHealth <= 0 || attackerIndex >= attackers.length) {
                this.finishEnemyTurnEffects();
                return;
            }

            const { index, extra } = attackers[attackerIndex++];
            const card = scene.cardSystem.boardCards[index];
            const veilFaceDown = card
                && !card.revealed
                && hasEnemyTrait(card.data, 'veil_flip');
            if (card && scene.isEnemyCard(card) && (card.revealed || veilFaceDown)) {
                this.processEnemyAttack(card, index);
                scene.updateUI();
                if (scene.gameState.revivedThisHit) {
                    this.finishEnemyTurnEffects({ skipPlayerPoison: true });
                    return;
                }
                // Warcry: another enemy's shout can send this one in again.
                // The extra action never rolls for a third.
                if (!extra && card.revealed && (card.data?.health || 0) > 0 && !(card.data?.frozen > 0)) {
                    const { chance, source } = enemyWarcryChance(
                        scene.cardSystem.boardCards, card, (c) => scene.isEnemyCard(c));
                    if (chance > 0 && Math.random() < chance) {
                        attackers.splice(attackerIndex, 0, { card, index, extra: true });
                        const shout = source?.sprite || card.sprite;
                        if (shout) scene.createFloatingText(shout.x, shout.y - 30, 'Warcry!', 0xc45c45);
                    }
                }
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

    processEnemyAttack(card, index, { fromRally = false, fromQuickStrike = false } = {}) {
        const scene = this.scene;
        if (card?.data?.isBonePile) return;
        if (card?.data?.isCocoon || (Array.isArray(card?.data?.features) && card.data.features.includes('cocoon_shell'))) {
            return;
        }
        // Thorn Fairy veil: face-down → flip up and skip the strike this turn.
        if (hasEnemyTrait(card.data, 'veil_flip') && !card.revealed) {
            scene.cardSystem.revealCard(index, true);
            return;
        }

        // Process frozen duration BEFORE checking if enemy can attack
        if (card.data.frozen && card.data.frozen > 0) {
            const wasShocked = (card.data.shockedTurns || 0) > 0;
            const wasWebbed = (card.data.webbedTurns || 0) > 0;
            card.data.frozen--;
            if (wasShocked) card.data.shockedTurns--;
            if (wasWebbed) card.data.webbedTurns--;

            if (card.data.frozen === 0 && card.sprite) {
                card.sprite.clearTint();
                scene.cardSystem.removeFrozenFrame(card);
                if (wasWebbed) {
                    card.data.webbedTurns = 0;
                    scene.createFloatingText(card.sprite.x, card.sprite.y, 'Broke free!', 0xd6c2c1);
                } else if (wasShocked) {
                    card.shockMarker?.destroy?.();
                    card.shockMarker = null;
                    card.data.shockedTurns = 0;
                    scene.createFloatingText(card.sprite.x, card.sprite.y, 'Shock Wore Off!', 0x71b1ae);
                } else {
                    scene.createFloatingText(card.sprite.x, card.sprite.y, 'Thawed!', 0xfef0cf);
                }
            } else {
                scene.createFloatingText(card.sprite.x, card.sprite.y, `Frozen (${card.data.frozen})`, 0x71b1ae);
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
            scene.createFloatingText(card.sprite.x, card.sprite.y - 28, `${card.data.escapeTurnsLeft} left!`, 0xfbad19);
            // Mimic still takes its small bite below
        }

        // Lute of First Light — first melee enemy on each floor skips its first attack
        if (scene.amuletManager?.hasCharmingTune?.() &&
            !scene.gameState.charmingTuneUsed &&
            card.data.role === 'MELEE') {
            scene.gameState.charmingTuneUsed = true;
            scene.createFloatingText(card.sprite.x, card.sprite.y - 20, 'Charmed (Lute)', 0xa83c69);
            playCharmHearts(scene, card.sprite.x, card.sprite.y, 4, (card.sprite.depth || 1) + 6);
            return;
        }

        // Daze sigil: this attack misses, then it wears off.
        if (card.data?.dazed) {
            card.data.dazed = false;
            scene.createFloatingText(card.sprite.x, card.sprite.y - 20, 'Dazed, misses!', 0xafafa2);
            return;
        }

        // Charm sigil: this attack goes to another face-up enemy; with no one
        // else to hit, the charmed enemy loses it. Either way it wears off.
        if (card.data?.charmed) {
            card.data.charmed = false;
            const target = pickControlTreacheryTarget(
                scene.cardSystem.boardCards,
                index,
                (other) => scene.isEnemyCard(other)
            );
            if (target) {
                scene.createFloatingText(card.sprite.x, card.sprite.y - 20, 'Charmed!', 0xa83c69);
                playCharmHearts(scene, card.sprite.x, card.sprite.y, 4, (card.sprite.depth || 1) + 6);
                const charmed = getEnemyHitAttack(card, scene.cardSystem.boardCards);
                spendSapping(card);
                this.applyEnemyGrowth(card);
                scene.cardSystem.attackEnemy(target.index, charmed, false);
            } else {
                scene.createFloatingText(card.sprite.x, card.sprite.y - 20, 'Charmed, no one to hit', 0xa83c69);
            }
            return;
        }

        if (card.data?.controlHesitation && Math.random() < CONTROL_HESITATION_CHANCE) {
            scene.createFloatingText(card.sprite.x, card.sprite.y - 20, 'Hesitates!', 0x71b1ae);
            return;
        }

        if (card.data?.controlTreachery) {
            const target = pickControlTreacheryTarget(
                scene.cardSystem.boardCards,
                index,
                (other) => scene.isEnemyCard(other)
            );
            if (target) {
                scene.createFloatingText(card.sprite.x, card.sprite.y - 20, 'Betrayal!', 0xa83c69);
                const betrayal = getEnemyHitAttack(card, scene.cardSystem.boardCards);
                spendSapping(card);
                this.applyEnemyGrowth(card);
                scene.cardSystem.attackEnemy(target.index, betrayal, false);
                return;
            }
        }

        // Siren's Perfume — chance to redirect attack onto another enemy
        const charmChance = scene.amuletManager?.getCharmChance?.() || 0;
        if (charmChance > 0 && Math.random() < charmChance) {
            const others = scene.cardSystem.boardCards
                .map((c, i) => ({ card: c, index: i }))
                .filter(({ card: c, index: i }) =>
                    c && c.revealed && i !== index && scene.isEnemyCard(c) && (c.data?.health || 0) > 0
                );
            if (others.length > 0) {
                const target = others[Math.floor(Math.random() * others.length)];
                scene.createFloatingText(card.sprite.x, card.sprite.y - 20, 'Charmed!', 0xa83c69);
                playCharmHearts(scene, card.sprite.x, card.sprite.y, 4, (card.sprite.depth || 1) + 6);
                const charmed = getEnemyHitAttack(card, scene.cardSystem.boardCards);
                spendSapping(card);
                this.applyEnemyGrowth(card);
                scene.cardSystem.attackEnemy(target.index, charmed, false);
                return; // skip player damage
            }
        }

        const features = Array.isArray(card.data?.features) ? card.data.features : [];
        let damageDealt = getEnemyHitAttack(card, scene.cardSystem?.boardCards);
        spendSapping(card);
        scene.cardSystem?.updateEnemyInfoText?.(card);

        // The enemy's own x1.5 sigils (a boss's): Merciless once the hero is
        // at half health or less, Ambush while the hero is unhurt, Unscathed
        // while it is unhurt itself. Rounded down, like the player's.
        const enemySigilHits = enemyStrikeSigils(card, scene.gameState);
        damageDealt = applyEnemyStrikeSigils(card, scene.gameState, damageDealt);
        if (enemySigilHits.length && card.sprite) {
            scene.createFloatingText(card.sprite.x, card.sprite.y - 30,
                enemySigilHits.map((id) => getSigil(id)?.name).join(' + ') + '!', 0xc45c45);
        }
        // Every enemy can crit a little (CombatChance): x1.5, rounded down.
        if (damageDealt > 0 && !scene.tutorialMode && Math.random() < ENEMY_BASE_CRIT) {
            damageDealt = Math.floor(damageDealt * ENEMY_CRIT_MULT);
            if (card.sprite) scene.createFloatingText(card.sprite.x, card.sprite.y - 30, 'Crit!', 0xb51f1e);
        }
        // Honed: every attack it makes adds to the next one this fight.
        if (sigilLevel(card.data, 'honed') > 0) {
            card.data.honedUses = (card.data.honedUses || 0) + 1;
            scene.cardSystem?.updateEnemyInfoText?.(card);
        }

        // Road Sniper — occasional heavy bolt.
        if (features.includes('heavy_shot') && Math.random() < 0.2) {
            damageDealt = Math.ceil(damageDealt * 1.5);
            if (card.sprite) {
                scene.createFloatingText(card.sprite.x, card.sprite.y - 24, 'Heavy shot!', 0xef7c4b);
            }
        }

        // RAGE — when the boss drops below its HP threshold it hits harder. Shows
        // an "ENRAGED!" cue the first time it kicks in so the spike is legible.
        const rage = card.data.abilities?.find(a => a.type === 'rage');
        if (rage) {
            const maxHp = card.data.maxHealth || card.data.health;
            if (maxHp > 0 && (card.data.health / maxHp) <= (rage.threshold ?? 0.3)) {
                damageDealt = Math.ceil(damageDealt * (rage.damageBoost || 1.5));
                if (!card.data._rageShown) {
                    card.data._rageShown = true;
                    scene.createFloatingText(card.sprite.x, card.sprite.y - 24, 'ENRAGED!', 0xb51f1e);
                    SoundHelper.playSound(scene, 'boss_enraged', 0.55);
                }
            }
        }

        this.applyEnemyGrowth(card);
        for (const repaired of repairBoneArmor(card, scene.cardSystem?.boardCards)) {
            scene.cardSystem.updateEnemyInfoText?.(repaired.card);
            scene.createFloatingText?.(repaired.card.sprite?.x ?? 320, repaired.card.sprite?.y ?? 120,
                `+${repaired.amount} armor`, 0xd6c2c1);
        }

        // Capture before armor loses its last pip; that final attack still
        // touches the worn sigil. It also retaliates against ranged attacks.
        const thornRetaliation = damageDealt > 0 ? armorThornsDamage(scene.gameState.equippedArmor) : 0;
        // Bone Shield stops this individual attack and all its on-hit riders.
        // Resolve it before mirror/dodge so those defenses are not spent too.
        if (consumeBoneShield(scene.gameState, damageDealt)) {
            SoundHelper.playSound(scene, 'bone_wall_hit', 0.5);
            scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, 'Bone Shield!', 0xfef0cf);
            scene.updateUI?.();
            this.applyArmorSigilThorns(card, index, thornRetaliation);
            return;
        }

        // Twinned Mirror — the first damaging attack of the fight goes back at
        // the attacker in full: melee, ranged or boss. The player takes nothing,
        // and none of the hit's riders (poison, theft, webbing) land either.
        // Hand Mirror — same bounce, but only on a small chance per attack.
        const briarShield = consumeBriarShield(scene.gameState, damageDealt);
        const twinnedMirror = !briarShield && damageDealt > 0 && scene.amuletManager?.hasChargedTwinnedMirror?.();
        // Mirror sigil on the worn armor: the first attack(s) each fight.
        const mirrorSigil = !briarShield && !twinnedMirror && damageDealt > 0 && consumeMirrorSigil(scene);
        const handMirrorGlint = !briarShield && !twinnedMirror && !mirrorSigil && damageDealt > 0
            && Math.random() < (scene.amuletManager?.getReflectChance?.() || 0);
        if (briarShield || twinnedMirror || mirrorSigil || handMirrorGlint) {
            if (twinnedMirror) scene.gameState.twinnedMirrorUsed = true;
            const x = card.sprite?.x ?? scene.playerAvatar.x;
            const y = card.sprite?.y ?? scene.playerAvatar.y;
            const reflectionName = briarShield ? t(scene, 'ui.hud.briarShield') : 'Mirror';
            CombatSequencer.floatingText(scene, 'reflect', scene.playerAvatar.x, scene.playerAvatar.y - 16,
                briarShield ? reflectionName : twinnedMirror ? 'Reflected!' : 'Glint!', 0xb697a3);
            scene.cardSystem.attackEnemy(index, damageDealt, true);
            CombatSequencer.playSound(scene, 'reflect', 'thorns_hit', 0.45);
            CombatSequencer.floatingText(scene, 'reflect', x, y, `-${damageDealt} ${reflectionName}`, 0xb697a3);
            scene.updateAmuletsUI?.();
            scene.updateUI?.();
            this.applyArmorSigilThorns(card, index, thornRetaliation);
            return;
        }

        // ARMOR BREAK — this hit pierces some of the player's protection.
        const armorBreak = card.data.abilities?.find(a => a.type === 'armor_break');
        const armorPierce = armorBreak?.amount || 0;
        if (armorPierce > 0 && scene.gameState.equippedArmor) {
            scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y - 16, 'Armor Broken!', 0xfbad19);
            SoundHelper.playSound(scene, 'armor_broken', 0.5);
        }

        // A boss with an attack frame strikes in that pose for a moment, in place
        // of the generic slash below.
        let ownAttackArt = false;
        if (card.data?.type === 'boss') {
            ownAttackArt = showBossAttackFrame(scene, card);
            // A boss with its own attack sound, once loaded, adds it to the blow.
            const attackKey = bossSoundKeys(card.data)?.attack;
            if (attackKey && scene.cache?.audio?.exists?.(attackKey)) {
                SoundHelper.playSound(scene, attackKey, 0.6);
            }
        }
        scene.createDamageEffect(card.sprite.x, card.sprite.y);
        // The enemy's blow: the player's weapon slash, upside down, so it
        // reads as a strike coming back down at the hero. Not over a boss's own swing.
        if (!ownAttackArt) playStrikeSlash(scene, card.sprite, { flipY: true });

        // Coin theft keeps its established on-swing trigger.
        card.data.abilities?.forEach(ability => {
            if (ability.type === 'coin_steal') {
                // Legacy goblin ability (chance + amount on the ability object).
                if (Math.random() < ability.chance && scene.gameState.coins > 0
                    && !scene.amuletManager?.blocksCoinTheft?.()) {
                    const stolenAmount = Math.min(ability.amount, scene.gameState.coins);
                    scene.gameState.coins -= stolenAmount;
                    scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, `-${stolenAmount} coins stolen!`, 0xfbad19);
                    scene.createFloatingText(card.sprite.x, card.sprite.y, `+${stolenAmount}`, 0xfbad19);
                    scene.playCoinStealFlight?.(card.sprite);
                }
            }
        });

        // Highway Cutpurse — always lifts a flat purse cut on the swing.
        if (features.includes('coin_steal') && !scene.amuletManager?.blocksCoinTheft?.()) {
            const stolenAmount = Math.min(10, Math.max(0, scene.gameState.coins || 0));
            if (stolenAmount > 0) {
                scene.gameState.coins -= stolenAmount;
                scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, `-${stolenAmount} coins stolen!`, 0xfbad19);
                if (card.sprite) {
                    scene.createFloatingText(card.sprite.x, card.sprite.y, `+${stolenAmount}`, 0xfbad19);
                    scene.playCoinStealFlight?.(card.sprite);
                }
            }
        }

        const damageOptions = features.includes('ignore_armor')
            ? { ignoreArmorChance: 0.1 }
            : {};
        const playerHealthBeforeDamage = scene.gameState.playerHealth;
        const { actualDamage, tookDamage, dodged, revived } = scene.gameState.takeDamage(
            damageDealt,
            index,
            'enemy',
            armorPierce,
            damageOptions,
        );

        // Poison needs contact. Ordinary armor still permits it, but dodge,
        // shield and reflection prevent it. Revival skips new poison this hit.
        if (!dodged && !revived && scene.gameState.playerHealth > 0) {
            for (const ability of card.data.abilities || []) {
                if (ability.type !== 'poison') continue;
                const killedBy = card.data.name || card.data.type || 'Enemy';
                if (scene.gameState.addPlayerEffect({ ...ability, killedBy })) {
                    SoundHelper.playVariant(scene, 'poison_tick', 0.45);
                    scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, 'Poisoned!', 0x71800b);
                }
            }
        }

        if (tookDamage) {
            CombatSequencer.playVariant(scene, 'hurt', 'player_hurt', 0.5);
            CombatSequencer.floatingText(scene, 'hurt', scene.playerAvatar.x, scene.playerAvatar.y,
                { key: 'float.damage', vars: { amount: actualDamage } }, 0xb51f1e, '15px',
                { type: 'damage', amount: actualDamage, lethal: scene.gameState.playerHealth <= 0, target: scene.playerAvatar });

            if (playerHealthBeforeDamage > 0 && scene.gameState.playerHealth <= 0) {
                scene.killedBy = card.data.name || card.data.type || 'Enemy';
            }
        }

        // Mask of Embers: an enemy that hurt the hero catches fire.
        const embers = scene.amuletManager?.getEmberRetaliation?.() || 0;
        if (tookDamage && embers > 0 && card.data && (card.data.health || 0) > 0) {
            scene.cardSystem.damageGemTarget(index, embers, 'Embers', 0xef7c4b, 'fire', 'hit');
        }

        // Goblin — club stun on a connecting hit.
        if (!dodged && features.includes('club_stun') && Math.random() < 0.05) {
            scene.gameState.playerStunnedTurns = Math.max(
                scene.gameState.playerStunnedTurns || 0,
                1,
            );
            scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y - 22, 'Stunned!', 0xffcf7f);
        }

        // Cave Crawler — extra armor chew on a connecting hit (on top of block wear).
        if (!dodged && features.includes('gnaw') && scene.gameState.equippedArmor && Math.random() < 0.5) {
            scene.gameState.tickEquippedArmorDurability();
            if (scene.gameState.equippedArmor) {
                scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y - 28, 'Gnaw!', 0xc8b08a);
                scene.updateUI?.();
            }
        }

        // Stinger Scorpion — each connecting hit pumps +1 into active poison tick damage.
        if (!dodged && !revived && features.includes('poison_amp')) {
            const poison = strengthenPlayerPoison(scene.gameState);
            if (poison) {
                scene.createFloatingText(
                    scene.playerAvatar.x,
                    scene.playerAvatar.y - 18,
                    `Venom +1! (${poison.damage}/tick)`,
                    0x71800b
                );
                scene.updateUI?.();
            }
        }

        // Silkslinger — web a random hand card for one enemy turn.
        if (features.includes('web_hand')) {
            this.applyWebHand(card);
        }

        // Spore Archer — spores cling even if armor/dodge softened the hit.
        if (features.includes('spore_on_hit')) {
            scene.gameState.playerSpored = true;
            scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y - 18, 'Spored!', 0xfee093);
        }

        const frozen = !dodged && !revived ? tryEnemyFrost(scene, card.data, actualDamage) : null;
        if (frozen) {
            const anchor = frozen.companion ? scene.inventorySystem?.slotSprites?.[frozen.index]?.card : scene.playerAvatar;
            scene.createFloatingText(anchor?.x ?? scene.playerAvatar.x, (anchor?.y ?? scene.playerAvatar.y) - 18,
                t(scene, 'status.frost.pending', { count: 2 }), 0x71b1ae);
            scene.updateUI?.();
        }
        const shocked = !dodged && !revived ? tryEnemyShock(scene, card.data, actualDamage) : null;
        if (shocked) {
            const anchor = shocked.companion ? scene.inventorySystem?.slotSprites?.[shocked.index]?.card : scene.playerAvatar;
            scene.createFloatingText(anchor?.x ?? scene.playerAvatar.x, (anchor?.y ?? scene.playerAvatar.y) - 18,
                t(scene, 'status.shock.pending'), 0xffcf7f);
            scene.updateUI?.();
        }

        if (actualDamage > 0 && !dodged && !revived && scene.gameState.playerHealth > 0
            && sigilLevel(card.data, 'scorched') > 0 && Math.random() < SCORCHED_CHANCE) {
            addPlayerBurn(scene.gameState, card.data.name || 'Enemy');
            scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y - 18, t(scene, 'status.burn.applied'), 0xef7c4b);
            scene.updateUI?.();
        }

        if (!dodged && !revived && tryEnemySandstorm(scene.gameState, card.data, actualDamage)) {
            scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y - 18,
                t(scene, 'status.sandstorm.pending'), 0xffcf7f);
            scene.updateUI?.();
        }

        // Sapping (an enemy's sigil): a connecting hit may weaken the hero's
        // next weapon hit. The same 20% as the hero's own Sapping.
        if (actualDamage > 0 && !dodged && sigilLevel(card.data, 'sapping') > 0 && Math.random() < ENCHANT_SAPPING_CHANCE) {
            scene.gameState.playerSapped = true;
            scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y - 26, 'Sapped!', 0x712a65);
        }

        // Toll Brute — chance to bark other goblins into an extra swing.
        if (!fromRally && hasEnemyTrait(card.data, 'goblin_rally') && Math.random() < 0.15) {
            this.triggerGoblinRally(index);
        }

        // Thorn Fairy — strike, then flip face-down (if she survived).
        if (
            hasEnemyTrait(card.data, 'veil_flip')
            && card.revealed
            && (card.data.health ?? 0) > 0
        ) {
            scene.cardSystem.hideEnemyCard?.(index);
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
            if (card.sprite) scene.createFloatingText(card.sprite.x, card.sprite.y - 16, `+${heal} Leech`, 0x71800b);
        }

        this.applyArmorSigilThorns(card, index, thornRetaliation);
        this.applyThornsDamage(card, index, tookDamage);
        if (!fromQuickStrike && !dodged && !revived && scene.cardSystem.boardCards[index] === card
            && tryEnemyQuickStrike(scene.gameState, card.data, actualDamage)) {
            scene.createFloatingText?.(card.sprite.x, card.sprite.y - 30, 'Quick Strike!', 0xffcf7f);
            this.processEnemyAttack(card, index, { fromRally, fromQuickStrike: true });
        }
    }

    applyEnemyGrowth(card) {
        const amount = growEnemy(card);
        if (!amount) return;
        this.scene.cardSystem?.updateEnemyInfoText?.(card);
        if (card.sprite) this.scene.createFloatingText?.(card.sprite.x, card.sprite.y - 18,
            `+${amount} Max HP`, 0x4a884f);
    }

    triggerGoblinRally(sourceIndex) {
        const scene = this.scene;
        const board = scene.cardSystem?.boardCards || [];
        const allies = board
            .map((c, i) => ({ card: c, index: i }))
            .filter(({ card, index }) => (
                index !== sourceIndex
                && card?.revealed
                && scene.isEnemyCard(card)
                && (card.data?.health || 0) > 0
                && !(card.data?.frozen > 0)
                && (
                    GOBLIN_ALLY_TYPE_SET.has(card.data?.enemyType)
                    || getEnemy(card.data?.enemyType)?.goblinAlly
                )
            ));
        if (!allies.length) return;
        if (board[sourceIndex]?.sprite) {
            scene.createFloatingText(
                board[sourceIndex].sprite.x,
                board[sourceIndex].sprite.y - 28,
                'Rally!',
                0xffcf7f
            );
        }
        for (const { card, index } of allies) {
            if (scene.gameState.playerHealth <= 0) break;
            this.processEnemyAttack(card, index, { fromRally: true });
            if (scene.gameState.revivedThisHit) break;
        }
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

    applyArmorSigilThorns(card, index, damage) {
        const scene = this.scene;
        if (!(damage > 0) || scene.cardSystem?.boardCards[index] !== card || !(card.data?.health > 0)) return;
        scene.cardSystem.attackEnemy(index, damage, true);
        CombatSequencer.playVariant(scene, 'reflect', 'thorns_retaliate', 0.45);
        CombatSequencer.floatingText(scene, 'reflect', card.sprite?.x ?? 320, card.sprite?.y ?? 120, `-${damage} Thorns`, 0x71800b);
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
        CombatSequencer.playVariant(scene, 'reflect', 'thorns_retaliate', 0.45);
        CombatSequencer.floatingText(scene, 'reflect', x, y, `-${damage} Thorns`, 0x71800b);

        if (!thorns) return;
        thorns.item.durability = Math.max(0, thorns.item.durability - 1);
        if (thorns.item.durability <= 0) {
            CombatSequencer.floatingText(scene, 'break', scene.playerAvatar.x, scene.playerAvatar.y + 20, 'Thorns broke!', 0x71800b);
            scene.grantCardSpentRelicBonus(thorns.item, scene.playerAvatar.x, scene.playerAvatar.y);
            // Same destroyed-card effect as a weapon or armor, taken from the bag
            // sprite before removeCard tears it down.
            const thornsSprite = scene.inventorySystem?.slotSprites?.[thorns.index]?.card;
            if (thornsSprite?.active) scene.cardSystem?.playCardBreakEffect?.(thornsSprite);
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

    finishEnemyTurnEffects({ runCompanions = true, skipPlayerPoison = false } = {}) {
        const scene = this.scene;
        // Process magic buff durations AFTER enemy attacks
        if (scene.gameState.shadowBlade) {
            scene.gameState.shadowBlade.turns--;
            if (scene.gameState.shadowBlade.turns <= 0) {
                scene.gameState.shadowBlade = null;
                scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, 'Shadow Blade faded', 0x6e7470);
            }
        }

        if (scene.gameState.magicShield) {
            scene.gameState.magicShield.turns--;
            if (scene.gameState.magicShield.turns <= 0) {
                scene.gameState.magicShield = null;
                scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, 'Magic Shield faded', 0x6e7470);
            }
        }

        scene.cardSystem.processEnemyPoisonEffects();
        scene.cardSystem.processEnemyBurnEffects?.();

        // Process player poison effects. Skip after a temple/Second Wind rise
        // so the rest of this enemy phase cannot immediately drop them again.
        let effectDamage = 0;
        let revivedFromPoison = false;
        if (!skipPlayerPoison) {
        for (let i = scene.gameState.playerEffects.length - 1; i >= 0; i--) {
            const effect = scene.gameState.playerEffects[i];
            if (effect.type === 'burn') continue;
            if (effect.type === 'poison') {
                effectDamage += effect.damage;
            }
            effect.turns--;
            if (effect.turns <= 0) {
                scene.gameState.playerEffects.splice(i, 1);
                scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y + 20, 'Poison Wore Off', 0xd6c2c1);
            }
        }

        if (effectDamage > 0) {
            const playerHealthBeforePoison = scene.gameState.playerHealth;
            const { actualDamage, revived } = scene.gameState.takeDamage(effectDamage, -1, 'poison');
            revivedFromPoison = Boolean(revived);
            // A dodged or immune tick already announced itself ("Dodge!",
            // "Poison Immune!") — don't stack a "-0 (Poison)" and a hurt grunt
            // on top of it.
            if (actualDamage > 0) {
                // The venom's sizzle, then the hero feeling it.
                CombatSequencer.playVariant(scene, 'hurt', 'poison_tick', 0.5);
                CombatSequencer.playVariant(scene, 'hurt', 'player_hurt', 0.5);
                CombatSequencer.floatingText(scene, 'hurt', scene.playerAvatar.x, scene.playerAvatar.y, `-${actualDamage} (Poison)`, 0x71800b);
            }

            // Track poison death
            if (playerHealthBeforePoison > 0 && scene.gameState.playerHealth <= 0) {
                scene.killedBy = 'Poison';
            }

            // Lethal poison: gameState.takeDamage() already scheduled
            // gameOver(). Just halt the turn so companion/end-of-turn
            // effects don't run on a dead player.
            if (scene.gameState.playerHealth <= 0) {
                this.isEnemyTurn = false;
                return;
            }
        }
        }

        if (!skipPlayerPoison && !revivedFromPoison && scene.gameState.playerHealth > 0) {
            const burn = takePlayerBurnTick(scene.gameState);
            if (burn > 0) {
                const { actualDamage } = scene.gameState.takeDamage(burn, -1, 'burn');
                if (actualDamage > 0) CombatSequencer.floatingText(scene, 'hurt', scene.playerAvatar.x,
                    scene.playerAvatar.y, t(scene, 'status.burn.tick', { amount: actualDamage }), 0xef7c4b);
                if (scene.gameState.playerHealth <= 0) {
                    scene.killedBy = 'Burn';
                    this.isEnemyTurn = false;
                    scene.updateUI?.();
                    return;
                }
            }
        }

        // Regenerate healers sustain their other revealed living allies.
        regenerateEnemies(scene);

        // Regenerate sigils: carried cards and worn armor heal the hero a
        // little per carried companion at the end of every enemy turn.
        const regen = regenerateAmount(scene);
        if (regen > 0 && scene.gameState.playerHealth > 0
            && scene.gameState.playerHealth < scene.gameState.maxHealth) {
            const before = scene.gameState.playerHealth;
            scene.gameState.heal?.(regen);
            const healed = scene.gameState.playerHealth - before;
            if (healed > 0) {
                CombatSequencer.floatingText(scene, 'hurt', scene.playerAvatar.x, scene.playerAvatar.y - 14,
                    `+${healed} Regenerate`, 0x4a884f);
                scene.updateUI?.();
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
        scene.checkpointCombat?.();
        this._drainEnemyTurns();
        this.queueStalemateEnemyTurn();
    }

    selectCompanionTarget(companion) {
        const scene = this.scene;
        let candidates = (scene.cardSystem?.boardCards || [])
            .map((card, index) => ({ card, index }))
            .filter(({ card }) => (
                card?.revealed
                && card?.sprite
                && scene.isEnemyCard(card)
                && (card.data?.health || 0) > 0
            ));
        if (candidates.length === 0) return null;

        // Silk Husk taunt: companions may only strike face-up taunting enemies.
        const taunters = candidates.filter(({ card }) => {
            if (!card?.revealed || (card.data?.health ?? 0) <= 0) return false;
            const tex = card.sprite?.texture?.key;
            if (!tex || tex === 'cardBack' || String(tex).startsWith('cardFlip')) return false;
            return hasEnemyTrait(card.data, 'taunt');
        });
        if (taunters.length > 0) candidates = taunters;

        if (companion?.attackStyle === 'melee' || companion?.range === 'melee') {
            // Melee companions obey the same frontline gate the player does
            // (see attackEnemy in BoardCombat): while any MELEE enemy lives —
            // including a boss's summons — nothing behind it can be reached.
            // Once the frontline is gone, everything is fair game, bosses and
            // archers alike.
            const bossHasFrontline = candidates.some(({ card }) => !card.data?.alwaysBackline);
            const blocked = scene.cardSystem?._anyMeleeAlive?.({ includeHidden: true });
            const reachable = candidates.filter(({ card }) => {
                if (bossHasFrontline && card.data?.alwaysBackline) return false;
                return !blocked || card.data?.role === 'MELEE';
            });
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
            scene.checkpointCombat?.();
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
            const entry = entries[position];
            this.runCompanionTurn(entry, (attacked) => {
                // Leadership Banner or a legacy Warcry: a companion that attacked may
                // attack again. (No target or webbed: no second try.)
                const chance = attacked ? playerWarcryChance(scene) : 0;
                if (chance > 0 && !scene._transitioning && Math.random() < chance) {
                    const card = scene.inventorySystem?.slotSprites?.[entry.index]?.card;
                    const x = card?.x ?? scene.playerAvatar?.x ?? 320;
                    const y = card?.y ?? scene.playerAvatar?.y ?? 300;
                    scene.createFloatingText(x, y - 18,
                        scene.amuletManager?.getCompanionExtraActionChance?.() > 0
                            ? t(scene, 'amulet.leadershipBanner.trigger') : 'Warcry!', 0xffcf7f);
                    this.runCompanionTurn(entry, () => runNext(position + 1));
                    return;
                }
                runNext(position + 1);
            });
        };
        runNext(0);
    }

    runCompanionTurn(entry, onComplete = () => {}) {
        if (isWebSpinner(entry?.companion)) return this.runWebTurn(entry, onComplete);
        const scene = this.scene;
        const target = this.selectCompanionTarget(entry?.companion);
        if (!entry || !target || scene._transitioning || scene.gameState.playerHealth <= 0) {
            onComplete();
            return false;
        }

        // A Silkslinger web holds a companion the same as it holds a weapon:
        // it sits this turn out. The web lands in the enemy turn just before
        // this and is cleared at the start of the next one, so a webbed
        // companion loses exactly one attack.
        if (entry.companion?.webbedTurns > 0) {
            const slotSprite = scene.inventorySystem?.slotSprites?.[entry.index];
            const x = slotSprite?.card?.x ?? scene.playerAvatar?.x ?? 320;
            const y = slotSprite?.card?.y ?? scene.playerAvatar?.y ?? 300;
            scene.createFloatingText(x, y - 18, handLockOf(entry.companion).text, 0xd6c2c1);
            const skipTimer = scene.time.delayedCall(220, onComplete);
            this.enemyTurnTimers.push(skipTimer);
            return false;
        }

        const attackHold = consumeCompanionAttackHold(entry.companion);
        if (attackHold) {
            scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y - 18,
                t(scene, attackHold === 'frost' ? 'status.frost.missed' : 'status.shock.missed'), 0xffcf7f);
            const timer = scene.time.delayedCall(220, onComplete);
            this.enemyTurnTimers.push(timer);
            return false;
        }

        // Shared "acting" hop — lifts the card art, its value/pips, shadow and
        // shine together, same as the off-hand dagger and thorns.
        scene.inventorySystem?.playSlotStrikeAnimation(entry.index, { slash: true });

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
                    // A companion can name its own strike (the Crystal
                    // Spiderling's shard): label, colour and sound, no zap.
                    const own = entry.companion.strikeLabel;
                    if (own && entry.companion.strikeSound) {
                        CombatSequencer.playSound(scene, 'gem', entry.companion.strikeSound, COMPANION_SFX_VOLUME);
                    } else {
                        CombatSequencer.playVariant(
                            scene, 'gem',
                            isMelee ? 'enemy_hit' : 'lightning_zap',
                            COMPANION_SFX_VOLUME
                        );
                    }
                    scene.cardSystem.damageGemTarget(
                        target.index,
                        (entry.companion.attack || 2) + companionStrengthBonus(scene),
                        own || (isMelee ? 'Skeleton Slash' : 'Chick Zap'),
                        entry.companion.strikeColor ?? (isMelee ? 0xd6c7b3 : 0xffcf7f),
                        (own || isMelee) ? null : 'lightning'
                    );
                    // Crystal Seeker: a hit may turn up a crystal.
                    if ((entry.companion.crystalFindChance || 0) > 0
                        && Math.random() < entry.companion.crystalFindChance) {
                        const sprite = target.card?.sprite;
                        scene.cardSystem.playKillLootPickup?.(
                            sprite?.x ?? 320, sprite?.y ?? 160,
                            { kind: 'crystal', amount: 1 }, entry.companion.name || 'Crystal Seeker'
                        );
                    }
                    if ((entry.companion.shockChance || 0) > 0
                        && Math.random() < entry.companion.shockChance) {
                        const shockedTarget = scene.cardSystem.boardCards[target.index];
                        if (shockedTarget === target.card && shockedTarget?.data?.health > 0) {
                            scene.cardSystem.applyShockStatus(shockedTarget, 1);
                        }
                    }
                }
            }
            const finishTimer = scene.time.delayedCall(220, () => onComplete(true));
            this.enemyTurnTimers.push(finishTimer);
        });
        this.enemyTurnTimers.push(attackTimer);
        return true;
    }

    // The Crystal Spiderling's turn: every other turn it throws a web at an
    // enemy, and that enemy loses its next attack. The turn between, it spins.
    // A boss is too big to hold. The Crystal Seeker's web may turn up a crystal.
    runWebTurn(entry, onComplete = () => {}) {
        const scene = this.scene;
        const companion = entry?.companion;
        const slotCard = scene.inventorySystem?.slotSprites?.[entry?.index]?.card;
        const done = (ms = 220, acted = false) => {
            const timer = scene.time.delayedCall(ms, () => onComplete(acted));
            this.enemyTurnTimers.push(timer);
        };
        if (!companion || scene._transitioning || scene.gameState.playerHealth <= 0) {
            onComplete();
            return false;
        }
        if (companion.webbedTurns > 0) {
            scene.createFloatingText(slotCard?.x ?? 320, (slotCard?.y ?? 300) - 18, handLockOf(companion).text, 0xd6c2c1);
            done();
            return false;
        }
        if ((companion.webSpinTurns || 0) > 0) {
            companion.webSpinTurns -= 1;
            scene.createFloatingText(slotCard?.x ?? 320, (slotCard?.y ?? 300) - 18, 'Spinning...', 0xd6c2c1);
            done();
            return false;
        }
        const targets = (scene.cardSystem?.boardCards || [])
            .map((card, index) => ({ card, index }))
            .filter(({ card }) => (
                card?.revealed && card.sprite && scene.isEnemyCard(card)
                && (card.data?.health || 0) > 0 && !(card.data?.frozen > 0)
                && card.data?.type !== 'boss' && !card.data?.isCocoon
            ));
        if (!targets.length) {
            onComplete();
            return false;
        }
        const attackHold = consumeCompanionAttackHold(companion);
        if (attackHold) {
            scene.createFloatingText(slotCard?.x ?? 320, (slotCard?.y ?? 300) - 18,
                t(scene, attackHold === 'frost' ? 'status.frost.missed' : 'status.shock.missed'), 0xffcf7f);
            done();
            return false;
        }
        // The hardest hitter is the one worth holding.
        const target = targets.reduce((best, next) => (
            (next.card.data.attack || 0) > (best.card.data.attack || 0) ? next : best
        ));
        companion.webSpinTurns = 1;
        scene.markCompanionParticipated(companion);
        scene.inventorySystem?.playSlotStrikeAnimation(entry.index);
        SoundHelper.playSound(scene, 'empty_whoosh', 0.3);
        this.throwWebAt(slotCard, target.card.sprite, () => {
            const card = scene.cardSystem.boardCards[target.index];
            if (card === target.card && (card.data?.health || 0) > 0 && !(card.data.frozen > 0)) {
                card.data.frozen = 1;
                card.data.webbedTurns = 1;
                scene.createFloatingText(card.sprite.x, card.sprite.y - 18, 'Webbed!', 0xd6c2c1);
                SoundHelper.playSound(scene, 'card_place', 0.4);
                if ((companion.crystalFindChance || 0) > 0 && Math.random() < companion.crystalFindChance) {
                    scene.cardSystem.playKillLootPickup?.(
                        card.sprite.x, card.sprite.y, { kind: 'crystal', amount: 1 }, companion.name || 'Crystal Seeker'
                    );
                }
            }
            done(220, true);
        });
        return true;
    }

    tickHandWebs() {
        const scene = this.scene;
        const slots = scene.inventorySystem?.slots || scene.gameState?.inventory || [];
        let cleared = false;
        for (let i = 0; i < slots.length; i++) {
            const item = slots[i];
            if (!item || !(item.webbedTurns > 0)) continue;
            item.webbedTurns -= 1;
            if (item.webbedTurns <= 0) {
                delete item.webbedTurns;
                delete item.webbedKind;
                scene.inventorySystem?.clearWebOverlay?.(i);
                cleared = true;
            }
        }
        if (cleared) this.queueStalemateEnemyTurn();
    }

    // The thrown lock flying from the enemy to the card it locks: the
    // Silkslinger's web (web.png frame 1) spinning, or the Ink Wraith's ink
    // blob. Its overlay lands on the card when it arrives; the card is locked
    // (can't be used) from the throw on.
    throwWebAt(fromSprite, toSprite, onArrive, kind = 'web') {
        const scene = this.scene;
        const lock = HAND_LOCKS[kind] || HAND_LOCKS.web;
        const hasArt = scene.textures?.exists?.(lock.thrownKey)
            && (lock.thrownFrame === undefined || scene.textures.get(lock.thrownKey).has(lock.thrownFrame));
        if (!fromSprite?.scene || !toSprite?.scene || !hasArt) {
            onArrive();
            return;
        }
        const web = scene.add.sprite(0, 0, lock.thrownKey, lock.thrownFrame)
            .setDepth((toSprite.depth || 0) + 20)
            .setScale(0.6);
        // A drawing that sits off-centre in its frame is aimed by its own
        // middle, so the drawing itself lands on the card.
        web.setOrigin(
            (web.width / 2 + lock.thrownDrawingDX) / web.width,
            (web.height / 2 + lock.thrownDrawingDY) / web.height
        );
        scene.tweens.add({
            targets: web,
            ...(lock.spins ? { angle: 360 } : {}),
            scale: 1,
            duration: WEB_THROW_MS,
            ease: 'Sine.easeOut',
        });
        tweenAlongArc(scene, web, {
            fromX: fromSprite.x,
            fromY: fromSprite.y,
            toX: toSprite.x,
            toY: toSprite.y + (lock.overlayDY || 0),
            arc: WEB_THROW_ARC,
            duration: WEB_THROW_MS,
            ease: 'Sine.easeIn',
            onComplete: () => {
                web.destroy();
                onArrive();
            },
        });
    }

    applyWebHand(fromCard = null) {
        const scene = this.scene;
        const slots = scene.inventorySystem?.slots || scene.gameState?.inventory || [];
        // Not the card in the player's hand, while there is any other: a web
        // landing on a card mid-drag left it stuck to the cursor.
        const held = scene.inventorySystem?._liveDrag?.slotIndex;
        const all = [];
        for (let i = 0; i < slots.length; i++) {
            if (slots[i]) all.push(i);
        }
        const candidates = all.length > 1 ? all.filter((i) => i !== held) : all;
        if (candidates.length === 0) return;

        const slotIndex = candidates[Math.floor(Math.random() * candidates.length)];
        const item = slots[slotIndex];
        const kind = handLockKindOf(fromCard?.data);
        item.webbedTurns = 1;
        item.webbedKind = kind;
        // Locked from the throw on, so it cannot be picked up while the web
        // is in the air (if it is the held card, once it is let go).
        scene.inventorySystem?.setCardWebbedInteractive?.(slotIndex, true);

        const slotSprite = scene.inventorySystem?.slotSprites?.[slotIndex];
        this.throwWebAt(fromCard?.sprite, slotSprite?.card, () => {
            // Gone already (cleared, or the card used/destroyed mid-flight).
            if (!(slots[slotIndex] === item && item.webbedTurns > 0)) return;
            scene.inventorySystem?.applyWebOverlay?.(slotIndex);
            const landed = scene.inventorySystem?.slotSprites?.[slotIndex]?.card;
            const x = landed?.x ?? scene.playerAvatar?.x ?? 320;
            const y = landed?.y ?? scene.playerAvatar?.y ?? 300;
            scene.createFloatingText(x, y - 18, handLockOf(item).text, 0xd6c2c1);
        }, kind);
        this.queueStalemateEnemyTurn();
    }
}
