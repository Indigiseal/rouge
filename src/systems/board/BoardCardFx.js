// BoardCardFx — VFX/FX helpers, info text, kill loot presentation
import { SoundHelper } from '../../audio/SoundHelper.js';
import { snapOriginToPixelGrid } from '../../ui/PixelSnap.js';
import { getDisplayedWeaponDamage } from '../../content/characters/CharacterClasses.js';
import { getMagic } from '../../content/cards/index.js';
import { ELITE_SPRITE_KEYS } from '../../content/assets/AssetManifest.js';

export class BoardCardFx {
    constructor(cs) {
        this.playBossEntrance = playBossEntrance.bind(cs);
        this.createCardInfoText = createCardInfoText.bind(cs);
        this._buildEnemyCornerStats = _buildEnemyCornerStats.bind(cs);
        this._buildBossStats = _buildBossStats.bind(cs);
        this.getGemLabel = getGemLabel.bind(cs);
        this.attachGemShadow = attachGemShadow.bind(cs);
        this.enableGemDrag = enableGemDrag.bind(cs);
        this.getEliteSpriteKey = getEliteSpriteKey.bind(cs);
        this.applyEliteMiniBossVisual = applyEliteMiniBossVisual.bind(cs);
        this.playEnemyHitEffect = playEnemyHitEffect.bind(cs);
        this.playLightningShine = playLightningShine.bind(cs);
        this.playLightningArc = playLightningArc.bind(cs);
        this.updateEnemyInfoText = updateEnemyInfoText.bind(cs);
        this.updateBossInfoText = updateBossInfoText.bind(cs);
        this.playKillLootPickup = playKillLootPickup.bind(cs);
        this.playBossDeathEffect = playBossDeathEffect.bind(cs);
        this.playCardDisappearEffect = playCardDisappearEffect.bind(cs);
        this.playMergeEffect = playMergeEffect.bind(cs);
        this.mimicTreasureExplosion = mimicTreasureExplosion.bind(cs);
        this.mimicEscape = mimicEscape.bind(cs);
    }
}

function playBossEntrance(cardSprite, bossData) {
    if (!cardSprite || bossData.name !== 'Spider Queen') return;

    const targetY = cardSprite.y;
    cardSprite.y = targetY - 70;
    cardSprite.setAlpha(0);
    this.scene.tweens.add({
        targets: cardSprite,
        y: targetY + 8,
        alpha: 1,
        duration: 420,
        ease: 'Sine.easeOut',
        onComplete: () => {
            this.scene.tweens.add({
                targets: cardSprite,
                y: targetY,
                duration: 180,
                ease: 'Back.easeOut'
            });
        }
    });
}

function createCardInfoText(card) {
    const x = card.sprite.x;
    const y = card.sprite.y + 50;
    let infoText = '';
    const attachInfoText = (info) => {
        card.infoText = info;
        card.sprite?.setData?.('infoText', info);
        return info;
    };
    
    switch (card.data.type) {
        case 'enemy':
        case 'boss':
            // Enemy HP/ATK are rendered as two small numbers tucked into
            // the lower corners of the card art itself — no descriptive
            // text below the card. The new enemy sprites already bake the
            // melee/ranged/poison badges into the art, so the old role
            // and poison marker sprites are gone too.
            this._buildEnemyCornerStats(card);
            return;
            
        case 'coin': {
            // Anchor the container at the card and offset children relative to
            // it (not absolute), so hover/drag can move it as a single unit —
            // matching the weapon pips. Absolute children get flung off-card
            // when the inventory sets infoText.x/y = cardSprite.x/y.
            const container = this.scene.add.container(card.sprite.x, card.sprite.y);
            const coinLabel = this.scene.add.text(0, 7, 'Coins', {
                fontSize: '11px', fill: '#f8ab2e', fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            const coinAmount = this.scene.add.text(0, 20, `${card.data.amount}`, {
                fontSize: '12px', fill: '#ffcf7f', fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            container.add([coinLabel, coinAmount]);
            attachInfoText(container);
            return;
        }

        case 'crystal': {
            const container = this.scene.add.container(card.sprite.x, card.sprite.y);
            const crystalLabel = this.scene.add.text(0, 7, 'Crystals', {
                fontSize: '11px', fill: '#4e1e45', fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            const crystalAmount = this.scene.add.text(0, 20, `${card.data.amount}`, {
                fontSize: '12px', fill: '#a83c69', fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            container.add([crystalLabel, crystalAmount]);
            attachInfoText(container);
            return;
        }
            
        case 'trap': {
            // Traps show their damage in the same value slot weapon cards
            // use (offset 17,22 from card centre). Spike and the pressure
            // plate read their flat hit; poison shows its per-turn tick.
            let trapDamage = null;
            if (card.data.subType === 'spike' || card.data.subType === 'reveal') {
                trapDamage = card.data.damage;
            } else if (card.data.subType === 'poison') {
                trapDamage = card.data.abilities?.[0]?.damage;
            }

            if (trapDamage != null) {
                const container = this.scene.add.container(card.sprite.x, card.sprite.y);
                const damageText = this.scene.add.text(17, 22, `${trapDamage}`, {
                    fontSize: '11px',
                    fill: '#ffcf7f',
                    fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                container.add(damageText);
                container.setDepth(1001);
                attachInfoText(container);
                return;
            }
            break;
        }
            
        case 'food': {
            const container = this.scene.add.container(card.sprite.x, card.sprite.y);
            // The carry-over egg is a food card under the hood, but it reads as
            // an "Egg" to the player rather than a +30 AP snack — label it so.
            const isEgg = card.data.id === 'monsterEgg' || card.data.name === 'Egg';
            const foodLabel = this.scene.add.text(0, 19, isEgg ? 'Egg' : `+${card.data.actionAmount} AP`, {
                fontSize: '12px', fill: '#a55119', fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            container.add(foodLabel);
            attachInfoText(container);
            return;
        }

        case 'key': {
            const container = this.scene.add.container(card.sprite.x, card.sprite.y);
            const keyLabel = this.scene.add.text(0, 18, 'Key', {
                fontSize: '12px', fill: '#51484b', fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            container.add(keyLabel);
            attachInfoText(container);
            return;
        }

        case 'magic': {
            const container = this.scene.add.container(card.sprite.x, card.sprite.y);
            const magicLabel = this.scene.add.text(0, -25, card.data.name, {
                fontSize: '11px',
                fill: '#9932cc',
                fontFamily: '"HoMM Pixel"',
                wordWrap: { width: 60 },
                align: 'center'
            }).setOrigin(0.5);

            // Show abbreviated description
            let shortDesc = '';
            switch(card.data.magicType) {
                case 'fireball': shortDesc = `${getMagic('fireball')?.damage ?? 15} DMG`; break;
                case 'frostRing': shortDesc = 'Freeze 3T'; break;
                case 'restoration': shortDesc = 'Full HP+AP'; break;
                case 'soulDrain': shortDesc = `Kill +${getMagic('soulDrain')?.healAmount ?? 30}HP`; break;
                case 'shadowBlade': shortDesc = '+50% ATK'; break;
                case 'weakness': shortDesc = '-30% Enemy'; break;
                case 'boneWall': shortDesc = 'Reflect x2'; break;
                case 'magicShield': shortDesc = '+20% Armor'; break;
                case 'mirrorShield': shortDesc = 'Reflect x1'; break;
                case 'smokeScreen': shortDesc = 'Hide All'; break;
            }

            const magicDesc = this.scene.add.text(0, 20, shortDesc, {
                fontSize: '10px',
                fill: '#cc99ff',
                fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);

            container.add([magicLabel, magicDesc]);
            attachInfoText(container);
            return;
        }

        case 'thorns': {
            const container = this.scene.add.container(card.sprite.x, card.sprite.y);
            const damageText = this.scene.add.text(17, 22, `${card.data.thornDamage}`, {
                fontSize: '11px',
                fill: '#9dff7a',
                fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            container.add(damageText);

            const startY = -27;
            const dotSpacing = 6;
            const tenDurabilitySpacing = 11;
            const tensCount = Math.floor(card.data.durability / 10);
            const remainingDots = card.data.durability % 10;
            let currentY = startY;

            for (let i = 0; i < tensCount; i++) {
                const tenSprite = snapOriginToPixelGrid(this.scene.add.image(-19, currentY, 'ten_durability'));
                container.add(tenSprite);
                currentY += tenDurabilitySpacing;
            }

            for (let i = 0; i < remainingDots; i++) {
                const dot = snapOriginToPixelGrid(this.scene.add.image(-19, currentY + (i * dotSpacing), 'durability_dot'));
                container.add(dot);
            }

            container.setDepth(1001);
            attachInfoText(container);
            return;
        }

        case 'gem': {
            const label = this.scene.add.text(card.sprite.x, card.sprite.y + 22, this.getGemLabel(card.data), {
                fontSize: '9px',
                fill: '#ffe8b0',
                fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            attachInfoText(label);
            return;
        }
            
        case 'weapon': {
            const container = this.scene.add.container(card.sprite.x, card.sprite.y);
            const characterId = this.scene.gameState?.characterId;
            const talentFx = this.scene.gameState?.talentEffects || null;
            const damageLabel = `${getDisplayedWeaponDamage(characterId, card.data, talentFx)}`;
            const damageText = this.scene.add.text(18, 23, damageLabel, {
                fontSize: '11px',
                fill: '#ffcf7f',
                fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            container.add(damageText);

            // Durability display with 10-point sprites and individual dots
            const startY = -27;
            const dotSpacing = 6;
            const tenDurabilitySpacing = 11; // Space between 10-point sprites
            
            const tensCount = Math.floor(card.data.durability / 10);
            const remainingDots = card.data.durability % 10;
            
            let currentY = startY;
            
            // Add 10-durability sprites
            for (let i = 0; i < tensCount; i++) {
                const tenSprite = snapOriginToPixelGrid(this.scene.add.image(-19, currentY, 'ten_durability'));
                container.add(tenSprite);
                currentY += tenDurabilitySpacing;
            }
            
            // Add remaining individual dots
            for (let i = 0; i < remainingDots; i++) {
                const dot = snapOriginToPixelGrid(this.scene.add.image(-19, currentY + (i * dotSpacing), 'durability_dot'));
                container.add(dot);
            }
            
            container.setDepth(1001);
            attachInfoText(container);
            return;
        }
        
        case 'armor': {
            const container = this.scene.add.container(card.sprite.x, card.sprite.y);
            const protectionText = this.scene.add.text(19, 26, `${card.data.protection}`, {
                fontSize: '12px',
                fill: '#ffcf7f',
                fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            container.add(protectionText);
            
            // Durability display with 10-point sprites and individual dots
            const startY = -25;
            const dotSpacing = 6;
            const tenDurabilitySpacing = 11; // Space between 10-point sprites
            
            const tensCount = Math.floor(card.data.durability / 10);
            const remainingDots = card.data.durability % 10;
            
            let currentY = startY;
            
            // Add 10-durability sprites
            for (let i = 0; i < tensCount; i++) {
                const tenSprite = snapOriginToPixelGrid(this.scene.add.image(-22, currentY, 'ten_durability'));
                container.add(tenSprite);
                currentY += tenDurabilitySpacing;
            }
            
            // Add remaining individual dots
            for (let i = 0; i < remainingDots; i++) {
                const dot = snapOriginToPixelGrid(this.scene.add.image(-22, currentY + (i * dotSpacing), 'durability_dot'));
                container.add(dot);
            }
            
            container.setDepth(1001);
            attachInfoText(container);
            return;
        }
            
        case 'amulet':
            // Amulets show no descriptive text on the board — it just clutters
            // the playfield. The full description is available on hover via the
            // item tooltip, so there's nothing to stamp under the card here.
            return;
    }
    
    // Create default text for cases that didn't return early
    if (infoText) {
        const textColor = card.data.type === 'amulet' && 
            this.scene.amuletManager && 
            card.data.id && 
            this.scene.amuletManager.amuletDefinitions[card.data.id]?.cursed 
            ? '#ff6666' : '#ffffff';
            
        attachInfoText(this.scene.add.text(x, y, infoText, {
            fontSize: '10px',
            fill: textColor,
            fontFamily: '"HoMM Pixel"',
            align: 'center',
            lineSpacing: 2
        }).setOrigin(0.5));
    }

    // Old role/poison markers used the enemyCardType.png sprite sheet. The
    // new enemy artwork already includes those badges, and stat numbers
    // now live in the card corners — so nothing extra to stamp here.
}

function _buildEnemyCornerStats(card) {
    if (!card?.sprite || !card.data) return;
    if (card.data.type === 'boss') {
        this._buildBossStats(card);
        return;
    }

    // Corner inset (px from the card centre). Tuned to drop into the
    // little stat-plate slots painted onto the new card art — HP to the
    // bottom-left, ATK to the bottom-right.
    const dx = 18;   // pulled further inward so the digits sit in the slots
    const dy = 27;   // raised 5px from the original bottom edge

    // Warm parchment cream, shared by both stats.
    const STAT_FILL = '#fef0cf';
    const style = () => ({
        fontSize: '11px',
        fill: STAT_FILL,
        fontFamily: '"HoMM Pixel"',
    });

    const hpText = this.scene.add.text(
        -dx, dy, `${card.data.health ?? 0}`, style()
    ).setOrigin(0.5);
    const atkText = this.scene.add.text(
        dx, dy, `${card.data.attack ?? 0}`, style()
    ).setOrigin(0.5);

    const container = this.scene.add.container(card.sprite.x, card.sprite.y, [hpText, atkText]);
    container.setDepth((card.sprite.depth || 1) + 2);

    // Tag the child texts so updateEnemyInfoText can refresh in place
    // without rebuilding the whole container.
    container._hpText = hpText;
    container._atkText = atkText;

    card.infoText = container;
    card.sprite?.setData?.('infoText', container);
}

function _buildBossStats(card) {
    if (!card?.sprite || !card.data) return;

    const maxHealth = Math.max(1, card.data.maxHealth || card.data.health || 1);
    card.data.maxHealth = maxHealth;

    const barFrame = this.scene.textures.getFrame('healthBar');
    const barWidth = barFrame?.width || 84;
    const bossBottom = (card.sprite.displayHeight || card.sprite.height || 100) / 2;
    const y = card.sprite.y + bossBottom + 18;

    const emptyBar = this.scene.add.image(0, 0, 'healthBarEmpty').setOrigin(0.5);
    const fillBar = this.scene.add.image(-barWidth / 2, 0, 'healthBar').setOrigin(0, 0.5);
    const hpText = this.scene.add.text(0, -1, '', {
        fontSize: '9px',
        fill: '#ffffff',
        fontFamily: '"HoMM Pixel"',
        stroke: '#230000',
        strokeThickness: 2
    }).setOrigin(0.5);
    const atkText = this.scene.add.text(0, 14, '', {
        fontSize: '10px',
        fill: '#ffcf7f',
        fontFamily: '"HoMM Pixel"',
        stroke: '#2b1600',
        strokeThickness: 2
    }).setOrigin(0.5);

    const container = this.scene.add.container(card.sprite.x, y, [emptyBar, fillBar, hpText, atkText]);
    container.setDepth((card.sprite.depth || 1) + 8);
    container._bossHpFill = fillBar;
    container._bossHpText = hpText;
    container._bossAtkText = atkText;
    container._bossBarWidth = barWidth;

    card.infoText = container;
    card.sprite?.setData?.('infoText', container);
    this.updateBossInfoText(card);
}

function getGemLabel(gem) {
    if (gem?.gemEffect === 'fire') return 'Fire';
    if (gem?.gemEffect === 'poison') return 'Poison';
    if (gem?.gemEffect === 'lightning') return 'Zap';
    return 'Gem';
}

function attachGemShadow(card) {
    const shadowFrameByEffect = { fire: 0, poison: 1, lightning: 2 };
    const frame = shadowFrameByEffect[card.data.gemEffect];
    if (frame === undefined || !card.sprite) return;
    const offsetX = 0;
    const offsetY = 3;
    const gemShadow = this.scene.add.sprite(
        card.sprite.x + offsetX,
        card.sprite.y + offsetY,
        'shadowsGems',
        frame
    );
    gemShadow.setDepth((card.sprite.depth || 1) - 0.1);
    card.gemShadow = gemShadow;
    card.gemShadowOffset = { x: offsetX, y: offsetY };
}

function enableGemDrag(card, index) {
    if (!card?.sprite || !card?.data) return;
    card.sprite.setInteractive({ draggable: true, useHandCursor: true });
    const home = { x: card.sprite.x, y: card.sprite.y };
    const animKey = `gem_${card.data.gemEffect}_sparkle`;
    const hoverAnimKey = `gem_${card.data.gemEffect}_hover`;
    let idleTimer = null;
    if (this.scene.anims.exists(animKey)) {
        card.sprite.on('pointerover', () => {
            if (this.scene.anims.exists(hoverAnimKey)) {
                card.sprite.play(hoverAnimKey);
            } else {
                card.sprite.play(animKey);
            }
        });
        card.sprite.on('pointerout', () => {
            card.sprite.stop();
            card.sprite.setFrame(card.data.spriteFrame || 0);
        });
        card.sprite.on('animationcomplete', (animation) => {
            if (animation?.key === animKey) {
                card.sprite.setFrame(card.data.spriteFrame || 0);
            }
        });
        idleTimer = this.scene.time.addEvent({
            delay: 2600 + Math.floor(Math.random() * 1800),
            loop: true,
            callback: () => {
                if (card.sprite?.scene && !card.sprite.input?.dragState && !card.sprite.input?.enabled) return;
                if (card.sprite?.scene && !card.sprite.input?.dragState && !card.sprite.anims?.isPlaying) {
                    card.sprite.play(animKey);
                }
            }
        });
        card.gemIdleTimer = idleTimer;
    }

    card.sprite.on('dragstart', () => {
        card.sprite.stop();
        card.sprite.setDepth(2500);
        if (card.shadow) card.shadow.setAlpha(0);
        if (card.gemShadow) card.gemShadow.setVisible(false);
    });
    card.sprite.on('drag', (pointer, dragX, dragY) => {
        card.sprite.x = Phaser.Math.Clamp(dragX, 0, 640);
        card.sprite.y = Phaser.Math.Clamp(dragY, 0, 360);
        if (card.infoText?.scene) {
            card.infoText.x = card.sprite.x;
            card.infoText.y = card.sprite.y + 22;
        }
    });
    card.sprite.on('dragend', () => {
        if (this.tryApplyBoardGem(card, index)) return;
        card.sprite.setDepth(1);
        card.sprite.x = home.x;
        card.sprite.y = home.y;
        if (card.infoText?.scene) {
            card.infoText.x = home.x;
            card.infoText.y = home.y + 22;
        }
        if (card.gemShadow && card.gemShadow.scene) {
            const off = card.gemShadowOffset || { x: 0, y: 3 };
            card.gemShadow.x = home.x + off.x;
            card.gemShadow.y = home.y + off.y;
            card.gemShadow.setDepth((card.sprite.depth || 1) - 0.1);
            card.gemShadow.setVisible(true);
        }
    });
}

// Elites read one of two ways. If the enemy has dedicated elite art we swap the
// portrait outright — that's the stronger read, so no tint on top of it. Enemies
// whose elite art isn't drawn yet keep the old tint highlight.
function getEliteSpriteKey(card) {
    const base = card?.data?.sprite;
    if (!base) return null;
    const eliteKey = ELITE_SPRITE_KEYS[base];
    if (!eliteKey) return null;
    // Guard the texture actually loaded, so a manifest typo or a missing file
    // degrades to the tint instead of rendering Phaser's green "?" placeholder.
    return this.scene?.textures?.exists(eliteKey) ? eliteKey : null;
}

function applyEliteMiniBossVisual(card) {
    if (!card?.revealed || !card.data?.isEliteMiniBoss || !card.sprite) return;

    const eliteKey = this.getEliteSpriteKey(card);
    if (eliteKey && card.sprite.setTexture) {
        card.sprite.clearTint?.();
        card.sprite.setTexture(eliteKey, card.data.spriteFrame);
        snapOriginToPixelGrid(card.sprite);
        return;
    }

    card.sprite.setTint?.(this.constructor.ELITE_HIGHLIGHT_TINT);
}

function playEnemyHitEffect(card, effect) {
    if (!card?.sprite?.scene) return;
    // Lightning gets an extra electric shine (bright flash + jagged bolts) on
    // top of its sprite animation, so chick zaps and lightning-gem hits crackle.
    if (effect === 'lightning') this.playLightningShine(card.sprite.x, card.sprite.y, card.sprite);
    const animKey = `enemy_hit_${effect}`;
    if (!this.scene.anims.exists(animKey)) return;
    const fx = this.scene.add.sprite(card.sprite.x, card.sprite.y, 'enemiesHitEffects');
    fx.setDepth((card.sprite.depth || 0) + 5);
    // Fire's burst reads as oversized on the card, so shrink it a touch.
    if (effect === 'fire') fx.setScale(0.6);
    fx.play(animKey);
    fx.once('animationcomplete', () => fx.destroy());
    // Safety cleanup in case the complete event is missed
    this.scene.time.delayedCall(600, () => fx.active && fx.destroy());
}

function playLightningShine(x, y, targetSprite) {
    const scene = this.scene;
    const depth = (targetSprite?.depth || 0) + 6;

    // Bright electric burst.
    const glow = scene.add.circle(x, y, 24, 0xfff6a0, 0.9)
        .setBlendMode(Phaser.BlendModes.SCREEN)
        .setDepth(depth)
        .setScale(0.4);
    scene.tweens.add({
        targets: glow, scale: 1.5, alpha: 0, duration: 200, ease: 'Cubic.easeOut',
        onComplete: () => glow.destroy()
    });

    // Jagged bolts striking down into the enemy — a glowing yellow core under a
    // crisp white streak.
    const bolts = scene.add.graphics().setDepth(depth + 1).setBlendMode(Phaser.BlendModes.SCREEN);
    const drawBolt = (startX) => {
        const segs = 5;
        const topY = y - 46;
        const pts = [{ x: startX, y: topY }];
        for (let s = 1; s <= segs; s++) {
            const f = s / segs;
            pts.push({
                x: Math.round(Phaser.Math.Linear(startX, x, f) + (Math.random() - 0.5) * 12),
                y: Math.round(Phaser.Math.Linear(topY, y, f))
            });
        }
        const stroke = (width, color, alpha) => {
            bolts.lineStyle(width, color, alpha);
            bolts.beginPath();
            bolts.moveTo(pts[0].x, pts[0].y);
            for (let k = 1; k < pts.length; k++) bolts.lineTo(pts[k].x, pts[k].y);
            bolts.strokePath();
        };
        stroke(4, 0xffe066, 0.6);
        stroke(2, 0xffffff, 1);
    };
    drawBolt(x - 6);
    drawBolt(x + 8);
    scene.tweens.add({
        targets: bolts, alpha: 0, duration: 170, ease: 'Cubic.easeIn', delay: 70,
        onComplete: () => bolts.destroy()
    });

    // Brief white flash on the struck enemy, then restore its prior tint.
    if (targetSprite?.setTint) {
        const hadTint = targetSprite.isTinted;
        const prevTint = targetSprite.tintTopLeft;
        targetSprite.setTint(0xffffff);
        scene.time.delayedCall(90, () => {
            if (!targetSprite?.scene) return;
            if (hadTint) targetSprite.setTint(prevTint);
            else targetSprite.clearTint();
        });
    }
}

function playLightningArc(fromX, fromY, toX, toY) {
    const scene = this.scene;
    if (!scene?.add) return;
    const bolts = scene.add.graphics().setDepth(10050).setBlendMode(Phaser.BlendModes.SCREEN);

    // Break the line into jagged segments, jittered perpendicular to the
    // travel direction so the crackle follows the path between the two enemies.
    const segs = 7;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len; // unit normal
    const ny = dx / len;
    const pts = [{ x: fromX, y: fromY }];
    for (let s = 1; s < segs; s++) {
        const f = s / segs;
        const jitter = (Math.random() - 0.5) * 22;
        pts.push({
            x: Math.round(Phaser.Math.Linear(fromX, toX, f) + nx * jitter),
            y: Math.round(Phaser.Math.Linear(fromY, toY, f) + ny * jitter)
        });
    }
    pts.push({ x: toX, y: toY });

    const stroke = (width, color, alpha) => {
        bolts.lineStyle(width, color, alpha);
        bolts.beginPath();
        bolts.moveTo(pts[0].x, pts[0].y);
        for (let k = 1; k < pts.length; k++) bolts.lineTo(pts[k].x, pts[k].y);
        bolts.strokePath();
    };
    stroke(5, 0xffe066, 0.5);
    stroke(2, 0xffffff, 1);

    scene.tweens.add({
        targets: bolts, alpha: 0, duration: 180, ease: 'Cubic.easeIn', delay: 60,
        onComplete: () => bolts.destroy()
    });
}

function updateEnemyInfoText(card) {
    if (!card?.data || !card.sprite) return;

    // Fast path: the corner-stat container we built in createCardInfoText
    // exposes _hpText / _atkText. Refresh those in place when they're
    // still valid Phaser objects.
    const container = card.infoText;
    if (card.data.type === 'boss' && container?._bossHpFill) {
        this.updateBossInfoText(card);
        return;
    }

    const hpText = container?._hpText;
    const atkText = container?._atkText;
    if (hpText && atkText
        && typeof hpText.setText === 'function'
        && typeof atkText.setText === 'function') {
        try {
            hpText.setText(`${card.data.health ?? 0}`);
            atkText.setText(`${card.data.attack ?? 0}`);
            return;
        } catch (_) { /* fall through to rebuild */ }
    }

    // Stale or wrong-shaped container — drop and rebuild via the standard
    // reveal path so styling stays consistent.
    try { if (container && typeof container.destroy === 'function') container.destroy(true); } catch (_) {}
    card.infoText = null;
    this._buildEnemyCornerStats(card);
}

function updateBossInfoText(card) {
    const container = card?.infoText;
    if (!container?._bossHpFill || !container._bossHpText || !container._bossAtkText) return;

    const maxHealth = Math.max(1, card.data.maxHealth || card.data.health || 1);
    const health = Phaser.Math.Clamp(card.data.health || 0, 0, maxHealth);
    const barWidth = container._bossBarWidth || 84;
    const fillWidth = Math.max(0, Math.ceil(barWidth * (health / maxHealth)));

    container._bossHpFill.setVisible(fillWidth > 0);
    container._bossHpFill.setCrop(0, 0, fillWidth, container._bossHpFill.height);
    container._bossHpText.setText(`${health}/${maxHealth}`);
    container._bossAtkText.setText(`ATK ${card.data.attack ?? 0}`);
}

function playKillLootPickup(x, y, reward, sourceLabel = 'Pick') {
    const isCoin = reward?.kind === 'coin';
    const amount = reward?.amount || 1;

    // Grant FIRST (and unconditionally) so the reward can never be lost if
    // the sprite/animation is unavailable or the anim event misses.
    if (isCoin) {
        this.scene.gameState.coins = (this.scene.gameState.coins || 0) + amount;
    } else {
        this.scene.gameState.crystals = (this.scene.gameState.crystals || 0) + amount;
    }
    this.scene.createFloatingText(
        x, y - 18,
        isCoin ? `+${amount} Coin (${sourceLabel})` : `+${amount} Crystal (${sourceLabel})`,
        isCoin ? 0xffd700 : 0x00ffff
    );
    this.scene.updateUI?.();

    // Visual flourish (skipped headlessly in the sim, where textures are absent).
    const sheetKey = isCoin ? 'coinJumpSheet' : 'crystalScatterSheet';
    const animKey = isCoin ? 'coin_jump_anim' : 'crystal_scatter_anim';
    if (!this.scene.textures?.exists?.(sheetKey)) return;
    const fx = this.scene.add.sprite(x, y, sheetKey);
    fx.setDepth((this.scene.playerAvatar?.depth || 0) + 50);
    if (this.scene.anims.exists(animKey)) fx.play(animKey);
    fx.once('animationcomplete', () => fx.destroy());
    this.scene.time.delayedCall(1000, () => fx.active && fx.destroy());
}

function playBossDeathEffect(sprite) {
    if (!sprite?.scene) return;
    const scene = this.scene;
    const x = sprite.x;
    const y = sprite.y;
    const depth = (sprite.depth || 0) + 5;

    // Ghost clone so the visual persists after removeCard() destroys the boss.
    let ghost = null;
    const texKey = sprite.texture?.key;
    if (texKey && texKey !== '__MISSING' && texKey !== '__DEFAULT') {
        ghost = scene.add.sprite(x, y, texKey, sprite.frame?.name);
        ghost.setScale(sprite.scaleX, sprite.scaleY);
        ghost.setOrigin(sprite.originX, sprite.originY);
        ghost.setFlipX?.(sprite.flipX);
        ghost.setDepth(depth);
    }

    // Recolor the silhouette to 0x2f2230 and fade it out quickly.
    const dissolveGhost = () => {
        if (!ghost?.scene) return;
        ghost.setTint(0x2f2230);
        scene.tweens.add({
            targets: ghost,
            alpha: 0,
            duration: 240,
            ease: 'Cubic.easeIn',
            onComplete: () => ghost.destroy()
        });
    };

    if (scene.textures?.exists?.('bossDeathMask') && scene.anims?.exists?.('boss_death_mask')) {
        const mask = scene.add.sprite(x, y, 'bossDeathMask');
        mask.setDepth(depth + 1);
        // Overlay the mask exactly on top of the boss, whatever its display size.
        if (sprite.displayWidth && sprite.displayHeight) {
            mask.setDisplaySize(sprite.displayWidth, sprite.displayHeight);
        }
        mask.play('boss_death_mask');
        const finish = () => {
            if (mask.active) mask.destroy();
            dissolveGhost();
        };
        mask.once('animationcomplete', finish);
        // Safety net in case the complete event is missed.
        scene.time.delayedCall(1200, () => { if (mask.active) finish(); });
    } else {
        dissolveGhost();
    }
}

function playCardDisappearEffect(cardSprite, options = {}) {
    if (!cardSprite || !this.scene.textures?.exists?.('cardDisappearSheet')) return;
    const x = cardSprite.x;
    const y = cardSprite.y;
    const depth = options.depth ?? ((cardSprite.depth || 0) + 5);
    const lift = options.lift ?? 4;
    const liftDuration = 220;
    // Short beat where the card hovers (lifted) before the dissolve plays.
    const holdDuration = options.hold ?? 100;

    // Ghost clone that lifts as it dissolves, so the player sees the actual
    // card rise while the dissolve plays over it. Skipped for placeholder
    // textures (rectangles, missing art) which have nothing meaningful to copy.
    let ghost = null;
    const texKey = cardSprite.texture?.key;
    if (texKey && texKey !== '__MISSING' && texKey !== '__DEFAULT') {
        ghost = this.scene.add.sprite(x, y, texKey, cardSprite.frame?.name);
        ghost.setScale(cardSprite.scaleX, cardSprite.scaleY);
        ghost.setOrigin(cardSprite.originX, cardSprite.originY);
        ghost.setDepth(depth);
        this.scene.tweens.add({ targets: ghost, y: y - lift, duration: liftDuration, ease: 'Sine.easeOut' });
    }

    const fx = snapOriginToPixelGrid(this.scene.add.sprite(x, y, 'cardDisappearSheet', 0));
    fx.setDepth(depth + 1);
    this.scene.tweens.add({ targets: fx, y: y - lift, duration: liftDuration, ease: 'Sine.easeOut' });

    const cleanup = () => {
        if (fx.active) fx.destroy();
        if (ghost && ghost.active) ghost.destroy();
    };
    // Let the card hover for the hold beat, then dissolve. The dissolve
    // frames depict the card vanishing on their own, so the ghost is removed
    // the instant it starts — otherwise the intact card underneath shows
    // through the later (near-transparent) frames and flickers back in.
    this.scene.time.delayedCall(holdDuration, () => {
        if (!fx.active) return;
        if (ghost && ghost.active) ghost.destroy();
        if (this.scene.anims.exists('card_disappear_anim')) {
            fx.play('card_disappear_anim');
            fx.once('animationcomplete', cleanup);
        } else {
            cleanup();
        }
    });
    // Safety net in case the animation event is missed (e.g. anim missing).
    this.scene.time.delayedCall(holdDuration + 1000, cleanup);
    return fx;
}

function playMergeEffect(x, y, isLegendary = false, options = {}) {
    const sheetKey = isLegendary ? 'mergeLegendarySheet' : 'mergeSheet';
    const animKey = isLegendary ? 'merge_legendary_anim' : 'merge_anim';
    if (!this.scene.textures?.exists?.(sheetKey)) return;
    const depth = options.depth ?? 1200;

    const fx = snapOriginToPixelGrid(this.scene.add.sprite(x, y, sheetKey, 0));
    fx.setDepth(depth);
    const cleanup = () => { if (fx.active) fx.destroy(); };
    if (this.scene.anims.exists(animKey)) {
        fx.play(animKey);
        fx.once('animationcomplete', cleanup);
    } else {
        cleanup();
        return;
    }
    // Safety net in case the animation event is missed.
    this.scene.time.delayedCall(1000, cleanup);
    return fx;
}

function mimicTreasureExplosion(x, y) {
    // Loot scales a little with depth
    const floor = this.scene.gameState.currentFloor || 1;
    const coinReward = 20 + floor * 2;
    const crystalReward = 5 + Math.floor(floor / 5);

    // Create splash sprite
    const splashSprite = this.scene.add.sprite(x, y, 'splashSheet');
    if (this.scene.anims.exists('splash_anim')) splashSprite.play('splash_anim');

    // On complete: Destroy sprite, add loot
    splashSprite.on('animationcomplete', () => {
        splashSprite.destroy();
        SoundHelper.playSound(this.scene, 'treasure_explode', 0.5);
        this.scene.gameState.coins += coinReward;
        this.scene.gameState.crystals += crystalReward;
        this.scene.createFloatingText(x, y - 20, `+${coinReward} Coins +${crystalReward} Crystals!`, 0xffd700);
        this.scene.updateUI?.();
    });
    // Safety: ensure the splash clears even if the anim event misses
    this.scene.time.delayedCall(900, () => splashSprite.active && splashSprite.destroy());
}

function mimicEscape(index) {
    const card = this.boardCards[index];
    if (!card || !card.sprite) {
        this.removeCard(index);
        this.checkFloorClear();
        return;
    }
    const x = card.sprite.x;
    const y = card.sprite.y;
    this.scene.createFloatingText(x, y - 20, 'Mimic Escaped!', 0xff6600);

    const splash = this.scene.add.sprite(x, y, 'splashSheet');
    if (this.scene.anims.exists('splash_anim')) splash.play('splash_anim');
    splash.once('animationcomplete', () => splash.destroy());
    this.scene.time.delayedCall(900, () => splash.active && splash.destroy());
    SoundHelper.playSound(this.scene, 'card_flip', 0.4);

    this.removeCard(index);
    this.checkFloorClear();
}

