// CardSystem — board orchestration; layout/spawn/combat/fx live in ./board/
import { CardDataGenerator } from './loot/CardDataGenerator.js';
import { SoundHelper } from '../audio/SoundHelper.js';
import { showItemTooltip, hideItemTooltip, showBossTooltip } from '../ui/ItemTooltip.js';
import { snapOriginToPixelGrid } from '../ui/PixelSnap.js';
import { openAmuletChoiceOverlay } from '../ui/AmuletChoiceOverlay.js';
import { BoardLayout } from './board/BoardLayout.js';
import { FloorSpawner } from './board/FloorSpawner.js';
import { BoardCombat } from './board/BoardCombat.js';
import { BoardCardFx } from './board/BoardCardFx.js';

export class CardSystem {

    static BOARD_SAFE_FRAC = { left: 0.6, right: 0.05, top: 0.15, bottom: 0.15 };
    static BOARD_SAFE_PX = { left: 16, right: 16, top: 16, bottom: 16 };
    static USE_FIXED_PANEL = true;
    // Taller panel so 4-row boards keep VSTEP >= ~card height (~70) and do not stack.
    static FIXED_PANEL_640x360 = { left: 184, top: 40, width: 272, height: 292 };
    static ELITE_HIGHLIGHT_TINT = 0xeef2fa;
    static OFFS_EVEN = [
      [+1,  0], [ 0, +1], [-1, +1],
      [-1,  0], [-1, -1], [ 0, -1],
    ];
    static OFFS_ODD = [
      [+1,  0], [+1, +1], [ 0, +1],
      [-1,  0], [ 0, -1], [+1, -1],
    ];
    static BOARD_CENTER_BRICK = { x: 0, y: 0 };
    static MIN_CARDS = 6;
    static MAX_CARDS = 16;
    static ELITE_MULT = 1.15;

    constructor(scene) {
        this.scene = scene;
        this.boardCards = new Array(8).fill(null);
        this.cardDataGenerator = new CardDataGenerator();
        this.floorBoardPanel = null;
        this.layout = new BoardLayout(this);
        this.spawner = new FloorSpawner(this);
        this.combat = new BoardCombat(this);
        this.fx = new BoardCardFx(this);
        // Handed straight to Phaser as a tween onUpdate callback, which invokes
        // it with the tween as scope — so the facade hop below needs `this`
        // pinned here or it lands on an object with no .layout.
        this.snapYOnUpdate = this.snapYOnUpdate.bind(this);
    }

    isMeleeWeapon(...args) { return this.combat.isMeleeWeapon(...args); }
    isRangedWeapon(...args) { return this.combat.isRangedWeapon(...args); }
    isVenomousWeapon(...args) { return this.combat.isVenomousWeapon(...args); }
    applyWeaponPoison(...args) { return this.combat.applyWeaponPoison(...args); }
    getEnemyPoisonSummary(...args) { return this.combat.getEnemyPoisonSummary(...args); }
    applyShockStatus(...args) { return this.combat.applyShockStatus(...args); }
    attachFrozenFrame(...args) { return this.combat.attachFrozenFrame(...args); }
    removeFrozenFrame(...args) { return this.combat.removeFrozenFrame(...args); }
    processEnemyPoisonEffects(...args) { return this.combat.processEnemyPoisonEffects(...args); }
    _aliveEnemyIndices(...args) { return this.combat._aliveEnemyIndices(...args); }
    _anyMeleeAlive(...args) { return this.combat._anyMeleeAlive(...args); }
    currentFrontRowR(...args) { return this.combat.currentFrontRowR(...args); }
    maxHiddenMeleeRowR(...args) { return this.combat.maxHiddenMeleeRowR(...args); }
    canMeleeHit(...args) { return this.combat.canMeleeHit(...args); }
    _revealOneBehindAfterFrontClears(...args) { return this.combat._revealOneBehindAfterFrontClears(...args); }
    buildBrickGrid(...args) { return this.layout.buildBrickGrid(...args); }
    pickConnectedBrick(...args) { return this.layout.pickConnectedBrick(...args); }
    buildCompactBrickCluster(...args) { return this.layout.buildCompactBrickCluster(...args); }
    computePlacement(...args) { return this.layout.computePlacement(...args); }
    brickToPixel(...args) { return this.layout.brickToPixel(...args); }
    clearFloorBoardPanel(...args) { return this.layout.clearFloorBoardPanel(...args); }
    createSideExtraPanel(...args) { return this.layout.createSideExtraPanel(...args); }
    killCardTweens(...args) { return this.layout.killCardTweens(...args); }
    snapYOnUpdate(...args) { return this.layout.snapYOnUpdate(...args); }
    clearBoard(...args) { return this.layout.clearBoard(...args); }
    createFloorBoardPanel(...args) { return this.layout.createFloorBoardPanel(...args); }
    createBossBoardPanel(...args) { return this.layout.createBossBoardPanel(...args); }
    _brickSizeForCount(...args) { return this.layout._brickSizeForCount(...args); }
    brickToPixelLegacy(...args) { return this.layout.brickToPixelLegacy(...args); }
    brickNeighbors(...args) { return this.layout.brickNeighbors(...args); }
    computeRowBands(...args) { return this.layout.computeRowBands(...args); }
    frontBandCount(...args) { return this.layout.frontBandCount(...args); }
    _baseCardsForFloor(...args) { return this.spawner._baseCardsForFloor(...args); }
    _effectiveCardCount(...args) { return this.spawner._effectiveCardCount(...args); }
    spawnFloorCards(...args) { return this.spawner.spawnFloorCards(...args); }
    spawnTutorialCards(...args) { return this.spawner.spawnTutorialCards(...args); }
    revealTutorialLightningTargets(...args) { return this.spawner.revealTutorialLightningTargets(...args); }
    findTutorialCard(...args) { return this.spawner.findTutorialCard(...args); }
    getSerializableBoardLayout(...args) { return this.layout.getSerializableBoardLayout(...args); }
    restoreSavedBoard(...args) { return this.spawner.restoreSavedBoard(...args); }
    restoreEnemyStatusMarkers(...args) { return this.combat.restoreEnemyStatusMarkers(...args); }
    convertCardToFood(...args) { return this.spawner.convertCardToFood(...args); }
    spawnBossRewardBoard(...args) { return this.spawner.spawnBossRewardBoard(...args); }
    takeRewardCard(...args) { return this.spawner.takeRewardCard(...args); }
    clearBossRewardChest(...args) { return this.spawner.clearBossRewardChest(...args); }
    spawnDeathDrop(...args) { return this.spawner.spawnDeathDrop(...args); }
    previewTrapAt(...args) { return this.spawner.previewTrapAt(...args); }
    ensureWeaponSupply(...args) { return this.spawner.ensureWeaponSupply(...args); }
    limitEnemyDensity(...args) { return this.spawner.limitEnemyDensity(...args); }
    ensureEnemyMinimum(...args) { return this.spawner.ensureEnemyMinimum(...args); }
    assignEliteMiniBoss(...args) { return this.spawner.assignEliteMiniBoss(...args); }
    assignEliteHighlightCards(...args) { return this.spawner.assignEliteHighlightCards(...args); }
    injectAngryNestmother(...args) { return this.spawner.injectAngryNestmother(...args); }
    spawnBoss(...args) { return this.spawner.spawnBoss(...args); }
    playBossEntrance(...args) { return this.fx.playBossEntrance(...args); }
    pickCardType(...args) { return this.spawner.pickCardType(...args); }
    generateRandomCard(...args) { return this.spawner.generateRandomCard(...args); }
    revealCard(index, freeAction = false) {
        const card = this.boardCards[index];
        if (!card || card.revealed || !card.data) return;
        // Reveals do not spend AP. Floor-start free reveals also skip the enemy
        // response; player-initiated flips still wake enemies (with justRevealed grace).
        if (!freeAction) {
            if (this.scene.isEnemyTurn) return;
            this.scene.scheduleEnemyTurn?.();
        }
        
        SoundHelper.playSound(this.scene, 'card_flip', 0.7);
        // Flipping a legendary item gets its own reveal fanfare.
        if (card.data?.rarity === 'legendary') {
            SoundHelper.playVariant(this.scene, 'legendary_reveal', 0.6);
        }
        card.revealed = true;
        // Elite "mystery" card being flipped — drop the gold back highlight so
        // the real card (or the mini-boss's own yellow tint) shows cleanly.
        if (card.data?.highlightedBack) {
            card.sprite?.clearTint?.();
            card.data.highlightedBack = false;
        }
        if (card.data?.tutorialTag) {
            this.scene.events.emit('tutorialProgress', `revealed:${card.data.tutorialTag}`);
            this.scene.tutorialManager?._handleProgress?.(`revealed:${card.data.tutorialTag}`);
        }
        // Per-enemy grace: when YOU flip a hidden card mid-floor and it's an enemy, it
        // sits out the action that revealed it (no instant zap), then attacks from the
        // next action onward. Set this immediately (not in the flip-animation callback)
        // so the enemy turn this action schedules sees the flag before it fires.
        // NOTE: only for real player reveals — the floor-start auto-reveals pass
        // freeAction=true and schedule NO enemy turn, so flagging them would leave the
        // grace unconsumed and steal the enemies' attack on the player's first action.
        if (!freeAction && this.isEnemyType(card.data.type)) {
            card.justRevealed = true;
        }
        if (card.glow) card.glow.destroy();

        // Gems and relics/amulets aren't cards — skip the rectangular card
        // shadow for them (gems get their own hand-painted shadow instead).
        if (card.shadow) {
            const t = card.data?.type;
            // No card-shaped shadow under gems/amulets/relics (they have
            // their own art) or under the "Nothing" card (we want the slot
            // to read as visually empty).
            const notACard = t === 'gem' || t === 'amulet' || t === 'relic' || t === 'empty';
            card.shadow.setAlpha(notACard ? 0 : 1);
        }

        card.sprite.off('pointerover');
        card.sprite.off('pointerout');
        card.sprite.play('card_flip_anim');
        
        card.sprite.once('animationcomplete', () => {
            if (card.data.sprite) {
                // Set sprite based on type
                let spriteKey = card.data.sprite || 'default_enemy';
                if (card.data.name === 'Mimic') spriteKey = 'mimic';
                card.sprite.setTexture(spriteKey, card.data.spriteFrame);
                snapOriginToPixelGrid(card.sprite);
            } else if (card.data.type === 'empty') {
                // "Nothing" card: don't render any tile body. Replace the
                // flipped sprite with an invisible hit target so the slot
                // remains clickable (interactWithCard fires the floating
                // "Nothing..." text), but the space looks empty.
                const px = card.sprite.x;
                const py = card.sprite.y;
                card.sprite.destroy();
                // Nothing under the card — whoosh paired with the empty poof.
                SoundHelper.playSound(this.scene, 'empty_whoosh', 0.6);
                // Poof effect
                if (this.scene.anims.exists('poof_empty_anim')) {
                    const poof = this.scene.add.sprite(px, py, 'poofEmpty').setDepth(5);
                    poof.play('poof_empty_anim');
                    poof.once('animationcomplete', () => poof.destroy());
                }
                card.sprite = this.scene.add.rectangle(px, py, 70, 90, 0x000000, 0);
            } else {
                card.sprite.destroy();
                const colors = {
                    coin: 0xffd700,
                    crystal: 0x00ffff,
                    trap: 0xff4500,
                    armor: 0x888888,
                    potion: 0xff69b4,
                    gem: card.data.color || 0xffe066
                };
                card.sprite = this.scene.add.rectangle(
                    card.sprite.x, card.sprite.y, 70, 90,
                    colors[card.data.type] || 0x666666
                );
            }
            card.sprite.setScale(1);
            this.applyEliteMiniBossVisual(card);
            
            this.createCardInfoText(card);
            card.sprite.setInteractive();
            card.sprite.on('pointerdown', () => this.interactWithCard(index));
            // Hover tooltip for board items — same renderer the shop / chest
            // rooms use. Skipped for things that already self-describe (enemies
            // show HP/ATK text; coins/crystals are obvious) or have nothing
            // useful to read (traps shouldn't be spoiled, empty cards are
            // literally nothing).
            this._attachBoardItemTooltip(card);
            if (card.data.type === 'gem') {
                this.attachGemShadow(card);
                this.enableGemDrag(card, index);
            }
            
            // Mimic: start the escape timer. Player must kill it before it runs.
            if (card.data.isMimic) {
                card.data.escapeTurnsLeft = card.data.escapeTurns || 3;
                this.scene.createFloatingText(
                    card.sprite.x, card.sprite.y - 32,
                    `Mimic! Kill in ${card.data.escapeTurnsLeft} turns`,
                    0xffaa00
                );
            }

            if (card.data.type === 'trap') {
                this.scene.cameras.main.shake(120, 0.006);
                this.handleTrap(card, index);
            }
        });
    }

    getEliteSpriteKey(...args) { return this.fx.getEliteSpriteKey(...args); }
    applyEliteMiniBossVisual(...args) { return this.fx.applyEliteMiniBossVisual(...args); }
    handleTrap(card, index) {
        const trapName = card.data.name || 'Trap';
        if (card.data.subType === 'spike') {
            SoundHelper.playSound(this.scene, 'trap_woosh', 0.7);
            const { actualDamage, tookDamage } = this.scene.gameState.takeDamage(card.data.damage, -1, 'trap');
            if (this.scene.gameState.playerHealth <= 0) this.scene.killedBy = trapName;
            if (tookDamage) {
                SoundHelper.playVariant(this.scene, 'player_hurt', 0.5);
            }
            if (actualDamage > 0) {
                this.scene.createFloatingText(card.sprite.x, card.sprite.y, `-${actualDamage}`, 0xff0000);
            }
        } else if (card.data.subType === 'poison') {
            // Acid trap opens with its smoke-poof SFX (paired with the poof anim below).
            SoundHelper.playSound(this.scene, 'poison_trap', 0.6);
            // Immediate hit on top of the lingering poison-over-time.
            const hit = card.data.damage || 0;
            if (hit > 0) {
                const { actualDamage, tookDamage } = this.scene.gameState.takeDamage(hit, -1, 'trap');
                if (this.scene.gameState.playerHealth <= 0) this.scene.killedBy = trapName;
                if (tookDamage) {
                    SoundHelper.playVariant(this.scene, 'player_hurt', 0.5);
                }
                if (actualDamage > 0) {
                    this.scene.createFloatingText(card.sprite.x, card.sprite.y, `-${actualDamage}`, 0xff0000);
                }
            }
            if (this.scene.anims.exists('poison_poof_anim')) {
                const poof = this.scene.add.sprite(card.sprite.x, card.sprite.y, 'poisonPoof').setDepth(6);
                poof.play('poison_poof_anim');
                poof.once('animationcomplete', () => poof.destroy());
            }
            if (this.scene.gameState.addPlayerEffect({ ...card.data.abilities[0], killedBy: trapName })) {
                this.scene.createFloatingText(this.scene.playerAvatar.x, this.scene.playerAvatar.y, 'Poisoned!', 0x00ff00);
            }
        } else if (card.data.subType === 'reveal') {
            SoundHelper.playSound(this.scene, 'trap_spring', 0.6);
            // Light nick before it reveals the neighbours.
            const hit = card.data.damage || 0;
            if (hit > 0) {
                const { actualDamage, tookDamage } = this.scene.gameState.takeDamage(hit, -1, 'trap');
                if (this.scene.gameState.playerHealth <= 0) this.scene.killedBy = trapName;
                if (tookDamage) {
                    SoundHelper.playVariant(this.scene, 'player_hurt', 0.5);
                }
                if (actualDamage > 0) {
                    this.scene.createFloatingText(card.sprite.x, card.sprite.y, `-${actualDamage}`, 0xff0000);
                }
            }
            this.revealAdjacentCards(index);
        }
        this.scene.updateUI();
        this.scene.time.delayedCall(1000, () => this.removeCard(index));
    }

    revealAdjacentCards(index) {
        const currentCard = this.boardCards[index];
        if (!currentCard || !currentCard.data.brick) return;
        
        const currentBrick = currentCard.data.brick;
        const adjacent = [];
        
        // Find brick neighbors using brick coordinates
        const neigh = this.brickNeighbors(currentBrick.r, currentBrick.c);
        for (const [nr, nc] of neigh) {
            // Find card at this brick position
            for (let i = 0; i < this.boardCards.length; i++) {
                const card = this.boardCards[i];
                if (card && card.data.brick && 
                    card.data.brick.r === nr && 
                    card.data.brick.c === nc) {
                    adjacent.push(i);
                    break;
                }
            }
        }
        
        adjacent.forEach(adjIndex => {
            const card = this.boardCards[adjIndex];
            if (card && !card.revealed && card.data.type === 'enemy') {
                this.revealCard(adjIndex, true);
            }
        });
    }

    createCardInfoText(...args) { return this.fx.createCardInfoText(...args); }
    _buildEnemyCornerStats(...args) { return this.fx._buildEnemyCornerStats(...args); }
    _buildBossStats(...args) { return this.fx._buildBossStats(...args); }
    getGemLabel(...args) { return this.fx.getGemLabel(...args); }
    attachGemShadow(...args) { return this.fx.attachGemShadow(...args); }
    enableGemDrag(...args) { return this.fx.enableGemDrag(...args); }
    tryApplyBoardGem(...args) { return this.combat.tryApplyBoardGem(...args); }
    _attachBoardItemTooltip(card) {
        if (!card?.sprite || !card.data) return;
        const t = card.data.type;
        const tooltipped = new Set([
            'weapon', 'armor', 'amulet', 'gem', 'potion',
            'food', 'magic', 'thorns', 'key'
        ]);
        if (!tooltipped.has(t)) return;

        const sprite = card.sprite;
        const data = card.data;
        const scene = this.scene;

        sprite.on('pointerover', () => {
            // Re-derive position each time — gems/animations can shift y.
            showItemTooltip(scene, data, sprite.x, sprite.y);
        });
        sprite.on('pointerout', () => {
            hideItemTooltip(scene);
        });
        // Belt-and-suspenders: if the card is destroyed mid-hover, kill any
        // lingering tooltip so it doesn't stick on screen.
        sprite.once('destroy', () => hideItemTooltip(scene));
    }

    _attachBossTooltip(card) {
        if (!card?.sprite || card.data?.type !== 'boss') return;
        const sprite = card.sprite;
        const data = card.data;
        const scene = this.scene;

        sprite.on('pointerover', () => {
            showBossTooltip(scene, data, sprite.x, sprite.y);
        });
        sprite.on('pointerout', () => hideItemTooltip(scene));
        sprite.once('destroy', () => hideItemTooltip(scene));
    }

    removeCard(index) {
        const card = this.boardCards[index];
        if (card) {
            if (card.data?.tutorialTag) {
                this.scene.events.emit('tutorialProgress', `removed:${card.data.tutorialTag}`);
                this.scene.tutorialManager?._handleProgress?.(`removed:${card.data.tutorialTag}`);
            }
            card.gemIdleTimer?.remove?.(false);
            this.killCardTweens(card);
            if (card.sprite) card.sprite.destroy();
            if (card.shadow) card.shadow.destroy();
            if (card.gemShadow) card.gemShadow.destroy();
            if (card.hoverSprite) { card.hoverSprite.destroy(); card.hoverSprite = null; }
            if (card.roleMarker) { card.roleMarker.destroy(); card.roleMarker = null; }
            if (card.poisonMarker) { card.poisonMarker.destroy(); card.poisonMarker = null; }
            if (card.shockMarker) { card.shockMarker.destroy(); card.shockMarker = null; }
            if (card.frozenFrame) { card.frozenFrame.destroy(); card.frozenFrame = null; }
            if (card.infoText) {
                if (card.infoText.list) {
                    card.infoText.destroy(true);
                } else {
                    card.infoText.destroy();
                }
            }
            this.boardCards[index] = null;
        }
    }

    interactWithCard(index) {
        const card = this.boardCards[index];
        if (!card || !card.revealed) return;
        
        switch (card.data.type) {
            case 'coin':
                SoundHelper.playSound(this.scene, 'coin_collect', 0.4);
                
                // Apply gold modifier from amulets
                const coinAmount = this.scene.amuletManager ? 
                    this.scene.amuletManager.modifyGoldFound(card.data.amount) : card.data.amount;
                
                this.scene.gameState.coins += coinAmount;
                this.scene.createFloatingText(card.sprite.x, card.sprite.y, `+${coinAmount}`, 0xffd700);
                this.removeCard(index);
                break;
                
            case 'crystal': {
                SoundHelper.playSound(this.scene, 'crystal_pickup', 0.5);
                const crystalAmount = this.scene.amuletManager
                    ? this.scene.amuletManager.modifyCrystalFound(card.data.amount)
                    : card.data.amount;
                this.scene.gameState.crystals += crystalAmount;
                this.scene.createFloatingText(card.sprite.x, card.sprite.y, `+${crystalAmount}`, 0x00ffff);
                this.removeCard(index);
                break;
            }
                
            case 'potion':
            case 'weapon':
            case 'armor':
            case 'key':
                SoundHelper.playSound(this.scene, 'key_pickup', 0.5);
                // falls through to the shared pickup handling below
            case 'magic':
            case 'thorns':
            case 'gem':
                if (card.data.type === 'gem') SoundHelper.playSound(this.scene, 'gem_pickup', 0.5);
                if (this.scene.inventorySystem.addCard(card.data)) {
                    this.removeCard(index);
                    // Board loot pickup does not spend AP.
                }
                break;

            case 'food': {
                SoundHelper.playVariant(this.scene, 'bread_eaten', 0.5);
                // Apply amulet food AP modifiers
                const baseAP = card.data.actionAmount;
                const modifiedAP = this.scene.amuletManager ?
                    this.scene.amuletManager.modifyFoodAP(baseAP) : baseAP;

                this.scene.gameState.actionsLeft = Math.min(
                    this.scene.gameState.maxActions,
                    this.scene.gameState.actionsLeft + modifiedAP
                );
                this.scene.createFloatingText(card.sprite.x, card.sprite.y, `+${modifiedAP} AP`, 0x00ff00);
                this.removeCard(index);
                this.scene.scheduleEnemyTurn?.();
                break;
            }

            case 'amulet':
                this.consumeAmulet(card.data, index);
                // Equipping a board amulet does not spend AP.
                break;

            case 'empty':
                // Nothing here — clear the card, no reward.
                this.scene.createFloatingText(card.sprite.x, card.sprite.y, 'Nothing...', 0x999999);
                this.removeCard(index);
                break;
        }

        this.scene.updateUI();
        // Defensive: a few death paths (fire splash on hidden enemies, etc.)
        // can take the last enemy off the board without then triggering the
        // clear check. Re-validating after any card interaction guarantees
        // that picking up a coin / "Nothing" / etc. unsticks a phantom
        // "still in combat" state if the board is actually clear.
        this.checkFloorClear();
        this.scene.queueStalemateEnemyTurn?.();
    }

    consumeAmulet(amulet, index) {
        // Rarity-first offer: open a 3-pick overlay instead of granting a fixed id.
        if (amulet?.pendingChoice || (amulet?.options?.length && !amulet?.id)) {
            const floor = this.scene.gameState?.currentFloor || 1;
            const offer = amulet.pendingChoice && amulet.options?.length
                ? amulet
                : this.cardDataGenerator.createAmuletOffer(amulet.source || 'floor', floor, this.scene.gameState);
            if (!offer?.options?.length) {
                this.removeCard(index);
                return;
            }
            // A stale offer can be entirely owned by now — say so instead of
            // opening a window whose every choice would be refused.
            const takeable = this.scene.amuletManager?.takeableOptions?.(offer.options)
                ?? offer.options;
            if (!takeable.length) {
                this.removeCard(index);
                this.scene.createFloatingText?.(320, 180, 'Nothing new to offer', 0xaaaaaa);
                return;
            }
            // Remove the board token first so it can't be double-clicked.
            if (index != null) this.removeCard(index);
            openAmuletChoiceOverlay(this.scene, {
                rarity: offer.rarity,
                options: takeable,
                amuletManager: this.scene.amuletManager,
                onPicked: () => this.scene.updateUI?.(),
            });
            return;
        }

        // Concrete amulet (events / legacy).
        if (this.scene.amuletManager && amulet.id) {
            const success = this.scene.amuletManager.addAmulet(amulet.id);
            if (success) {
                this.removeCard(index);
            }
        } else {
            // Fallback to old system for legacy amulets without IDs
            if (amulet.effect === 'health') {
                this.scene.gameState.maxHealth += amulet.value;
                this.scene.gameState.playerHealth += amulet.value;
                this.scene.createFloatingText(
                    this.scene.playerAvatar.x, 
                    this.scene.playerAvatar.y, 
                    `+${amulet.value} Max HP`, 
                    0x00ff00
                );
            } else if (amulet.effect === 'max_actions') {
                this.scene.gameState.maxActions += amulet.value;
                this.scene.createFloatingText(
                    this.scene.playerAvatar.x, 
                    this.scene.playerAvatar.y, 
                    `+${amulet.value} Max Actions`, 
                    0x00ff00
                );
            }
            
            this.scene.gameState.activeAmulets.push(amulet);
            this.removeCard(index);
        }
    }

    summonEnemy(...args) { return this.spawner.summonEnemy(...args); }
    respawnCardOnBoard(...args) { return this.spawner.respawnCardOnBoard(...args); }
    _rebuildBrickNeighbors(...args) { return this.layout._rebuildBrickNeighbors(...args); }
    dropWaveCards(...args) { return this.spawner.dropWaveCards(...args); }
    rollEvade(...args) { return this.combat.rollEvade(...args); }
    attackEnemy(...args) { return this.combat.attackEnemy(...args); }
    getFireSplashRadius(...args) { return this.combat.getFireSplashRadius(...args); }
    applyWeaponGemEffect(...args) { return this.combat.applyWeaponGemEffect(...args); }
    isEnemyType(...args) { return this.combat.isEnemyType(...args); }
    isOpenEnemyCard(...args) { return this.combat.isOpenEnemyCard(...args); }
    hasHolographicOmen(...args) { return this.combat.hasHolographicOmen(...args); }
    applyHolographicOmenStartEffect(...args) { return this.combat.applyHolographicOmenStartEffect(...args); }
    isAnyEnemyCard(...args) { return this.combat.isAnyEnemyCard(...args); }
    burnEnemy(...args) { return this.combat.burnEnemy(...args); }
    playEnemyHitEffect(...args) { return this.fx.playEnemyHitEffect(...args); }
    playLightningShine(...args) { return this.fx.playLightningShine(...args); }
    playLightningArc(...args) { return this.fx.playLightningArc(...args); }
    damageGemTarget(...args) { return this.combat.damageGemTarget(...args); }
    applyRelicSlow(...args) { return this.combat.applyRelicSlow(...args); }
    removeDefeatedEnemy(...args) { return this.combat.removeDefeatedEnemy(...args); }
    checkFloorClear(...args) { return this.combat.checkFloorClear(...args); }
    updateEnemyInfoText(...args) { return this.fx.updateEnemyInfoText(...args); }
    updateBossInfoText(...args) { return this.fx.updateBossInfoText(...args); }
    createCardData(...args) { return this.spawner.createCardData(...args); }
    capRewardRarity(...args) { return this.spawner.capRewardRarity(...args); }
    playKillLootPickup(...args) { return this.fx.playKillLootPickup(...args); }
    playBossDeathEffect(...args) { return this.fx.playBossDeathEffect(...args); }
    playCardDisappearEffect(...args) { return this.fx.playCardDisappearEffect(...args); }
    playMergeEffect(...args) { return this.fx.playMergeEffect(...args); }
    mimicTreasureExplosion(...args) { return this.fx.mimicTreasureExplosion(...args); }
    mimicEscape(...args) { return this.fx.mimicEscape(...args); }
}
