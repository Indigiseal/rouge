// BoardCardFx — VFX/FX helpers, info text, kill loot presentation
import { SoundHelper } from '../../audio/SoundHelper.js';
import { snapOriginToPixelGrid } from '../../ui/PixelSnap.js';
import { playCardDissolve } from '../../ui/CardDissolve.js';
import { hideGemSockets, showGemSockets } from '../../ui/GemSockets.js';
import { attachGemShine } from '../../ui/GemShine.js';
import { getDisplayedWeaponDamage } from '../../content/characters/CharacterClasses.js';
import { ELITE_SPRITE_KEYS } from '../../content/assets/AssetManifest.js';
import { effectiveArmorProtection, isArmorWarded } from '../combat/ArmorMath.js';
import { getEnemyHitAttack } from '../../content/combat/enemyAttack.js';
import { isSilkCocoonCard } from './CocoonCacheBoard.js';
import { t, translateItemName } from '../../i18n/i18n.js';
import { enemySigils } from '../../content/sigils/sigils.js';
import { artBodyTop, buildSigilIcons, sigilCornerOffset } from '../../ui/SigilIcons.js';
import { handLockKindOf } from '../../content/combat/handLock.js';
import { weaponFlatSigilBonus, companionStrengthBonus } from '../combat/SigilEffects.js';
import { scaleGoldReward } from '../../content/economy/gold.js';
import { cardStars } from '../../content/cards/legendaryStars.js';

// The one value slot painted into the bottom-right of every card that shows a
// single number — weapon damage, armor protection, thorn damage, trap damage.
// These used to be four separate hand-typed offsets that had drifted apart
// (18,23 / 19,26 / 17,22 / 17,22); they are one constant now so they can't.
export const CARD_VALUE_SLOT = { x: 18, y: 24 };
// Step between single durability dots, top to bottom. The dot art is 5px with
// a clear row above it, so 5 sets them touching; 6 left a 1px gap, and a high
// count ran off the bottom of the card. Thorns, weapons and armor share it.
const DURABILITY_DOT_SPACING = 5;
// Where the pip column starts, from the card's centre. A ten-marker's top
// edge meets the card frame; a card with only single dots starts them on the
// first row inside the frame. Weapons, armor and thorns all start here — armor
// used to start 2px lower than the others.
const PIP_TOP_TEN = -27;
const PIP_TOP_DOT = -29;
// The first dot under a ten-marker sits this much higher than the ten-marker
// step would put it: 1px of gap below the marker instead of 4.
const DOT_AFTER_TEN_TUCK = -3;

// Where a resource card's name sits. Coins and crystals used to print it at
// y=7 with the amount under it; the amount now lives in CARD_VALUE_SLOT like
// every other card's single number, so the name drops into the lower band and
// all of them line up.
const RESOURCE_LABEL_Y = 19;
// The name along a card's bottom ("Potion", "Food", "Soul Drain"...). 9px, the
// size the gem label already used; these were 11-12px and crowded the art.
const CARD_LABEL_SIZE = '9px';
// An enemy card's size before board scaling (the stats container scales with it).
const ENEMY_CARD_W = 52;
const ENEMY_CARD_H = 70;
// The number on a card (damage, protection, heal, HP/ATK on enemies...): one
// size for every card type, on the board, in the bag and in the shops.
export const CARD_VALUE_SIZE = '10px';

export class BoardCardFx {
    constructor(cs) {
        this.playBossEntrance = playBossEntrance.bind(cs);
        this.createCardInfoText = createCardInfoText.bind(cs);
        this.destroyCardInfoText = destroyCardInfoText.bind(cs);
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
        this.refreshEnemyAttackLabels = refreshEnemyAttackLabels.bind(cs);
        this.updateBossInfoText = updateBossInfoText.bind(cs);
        this.playKillLootPickup = playKillLootPickup.bind(cs);
        this.playBossDeathEffect = playBossDeathEffect.bind(cs);
        this.playCardDisappearEffect = playCardDisappearEffect.bind(cs);
        this.playCardBreakEffect = playCardBreakEffect.bind(cs);
        this.playCardDiscardEffect = playCardDiscardEffect.bind(cs);
        this.playMergeEffect = playMergeEffect.bind(cs);
        this.mimicTreasureExplosion = mimicTreasureExplosion.bind(cs);
        this.mimicEscape = mimicEscape.bind(cs);
    }
}

// A weapon's damage number, live: its printed damage (class and talent
// bonuses included) plus the flat sigil bonuses it has right now (Honed,
// Bloodlust, Kinship...) while it sits in the bag, in green when raised.
const WEAPON_VALUE_COLOR = '#ffcf7f';
const WEAPON_VALUE_BOOSTED = '#a8e07a';
export function refreshWeaponValueText(scene, container) {
    const text = container?._weaponDamageText;
    const weapon = container?._weaponData;
    if (!text?.scene || !weapon) return;
    const gs = scene?.gameState;
    const base = getDisplayedWeaponDamage(gs?.characterId, weapon, gs?.talentEffects || null);
    const inBag = (scene?.inventorySystem?.slots || []).includes(weapon);
    const bonus = inBag ? weaponFlatSigilBonus(scene, weapon).bonus
        + (scene?.amuletManager?.getBowDamageBonus?.(weapon) || 0) : 0;
    const label = `${base + bonus}`;
    if (text.text !== label) text.setText(label);
    text.setColor(bonus > 0 ? WEAPON_VALUE_BOOSTED : WEAPON_VALUE_COLOR);
}

// A companion's damage number, live: its attack plus the Companion Strength
// sigils carried right now, in green when raised. Same number its tooltip shows.
const COMPANION_VALUE_COLOR = '#ffcf7f';
export function refreshCompanionValueText(scene, container) {
    const text = container?._companionDamageText;
    const companion = container?._companionData;
    if (!text?.scene || !companion) return;
    const bonus = companionStrengthBonus(scene?.gameScene || scene);
    const label = `${(Number(companion.attack) || 0) + bonus}`;
    if (text.text !== label) text.setText(label);
    text.setColor(bonus > 0 ? WEAPON_VALUE_BOOSTED : COMPANION_VALUE_COLOR);
}

function playBossEntrance(cardSprite, bossData) {
    if (!cardSprite || bossData.name !== 'Spider Queen') return;

    const targetY = cardSprite.y;
    cardSprite.y = targetY - 70;
    cardSprite.setAlpha(0);
    const syncBossStats = () => {
        const info = cardSprite.getData?.('infoText');
        if (!info?.scene) return;
        info.x = Math.round(cardSprite.x);
        info.y = Math.round(cardSprite.y + (cardSprite.displayHeight || cardSprite.height || 100) / 2 + 18);
    };
    syncBossStats();
    this.scene.tweens.add({
        targets: cardSprite,
        y: targetY + 8,
        alpha: 1,
        duration: 420,
        ease: 'Sine.easeOut',
        onUpdate: syncBossStats,
        onComplete: () => {
            this.scene.tweens.add({
                targets: cardSprite,
                y: targetY,
                duration: 180,
                ease: 'Back.easeOut',
                onUpdate: syncBossStats,
                onComplete: syncBossStats,
            });
        }
    });
}

// Phaser can re-parent container children onto the scene display list while
// destroying the container, which leaves HP/ATK labels stuck on screen after
// death and makes setText() on stale refs a silent no-op. Tear children down
// explicitly before the container itself.
function destroyCardInfoText(card) {
    const info = card?.infoText;
    if (!info) {
        card?.sprite?.setData?.('infoText', null);
        return;
    }

    // Snapshot tagged refs before removeAll clears list.
    const tagged = [
        info._hpText,
        info._atkText,
        info._nameText,
        info._bossHpFill,
        info._bossHpText,
        info._bossAtkText,
        info._bossEmptyBar,
    ].filter(Boolean);

    try {
        if (typeof info.removeAll === 'function') {
            info.removeAll(true);
        }
    } catch (_) { /* already gone */ }

    // Belt-and-braces: any tagged child that survived removeAll.
    for (const child of tagged) {
        try { if (child.scene || child.active) child.destroy?.(); } catch (_) { /* already gone */ }
    }

    info._hpText = null;
    info._atkText = null;
    info._nameText = null;
    info._bossHpFill = null;
    info._bossHpText = null;
    info._bossAtkText = null;
    info._bossEmptyBar = null;

    try { info.destroy?.(false); } catch (_) { /* already gone */ }

    if (card) card.infoText = null;
    card?.sprite?.setData?.('infoText', null);
}

function _makeCornerText(scene, x, y, value, style) {
    // Must go through scene.add.text — PreloadScene patches that factory to
    // crisp BitmapText. scene.make.text bypasses the patch and falls back to
    // soft canvas text (exactly the muddy HP/ATK digits we were seeing).
    const text = scene.add.text(Math.round(x), Math.round(y), String(value), style);
    text.setOrigin(0.5);
    return text;
}

// A Legendary's stars (legendaryStars.js): small pale pixel stars along the
// bottom of the card, left of the number circle (the top is where a socketed
// gem sits). The 7x7 star is drawn once into a texture.
const STAR_KEY = 'legendaryStarPip';
const STAR_ROW_Y = 27;
const STAR_ROW_CENTER_X = -6;
const STAR_GAP = 8;
function addCardStars(scene, container, data) {
    const stars = cardStars(data);
    if (!stars || !scene?.add) return;
    if (!scene.textures.exists(STAR_KEY) && scene.textures.generate) {
        scene.textures.generate(STAR_KEY, {
            data: [
                '...1...',
                '..121..',
                '1112111',
                '1222221',
                '.12221.',
                '.12121.',
                '.11.11.',
            ],
            pixelWidth: 1,
            // Near-white on a dark outline: gold on the gold Legendary card
            // disappeared.
            palette: { 1: '#3b2414', 2: '#fef0cf' },
        });
    }
    if (!scene.textures.exists(STAR_KEY)) return;
    const left = STAR_ROW_CENTER_X - ((stars - 1) * STAR_GAP) / 2;
    for (let i = 0; i < stars; i++) {
        container.add(snapOriginToPixelGrid(scene.add.image(Math.round(left + i * STAR_GAP), STAR_ROW_Y, STAR_KEY)));
    }
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
            const coinLabel = this.scene.add.text(0, RESOURCE_LABEL_Y, t(this.scene, 'tooltip.coins'), {
                fontSize: CARD_LABEL_SIZE, fill: '#f8ab2e', fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            const coinAmount = this.scene.add.text(
                CARD_VALUE_SLOT.x, CARD_VALUE_SLOT.y, `${card.data.amount}`, {
                    fontSize: CARD_VALUE_SIZE, fill: '#ffcf7f', fontFamily: '"HoMM Pixel"'
                }
            ).setOrigin(0.5);
            container.add([coinLabel, coinAmount]);
            attachInfoText(container);
            return;
        }

        case 'crystal': {
            const container = this.scene.add.container(card.sprite.x, card.sprite.y);
            const crystalLabel = this.scene.add.text(0, RESOURCE_LABEL_Y, t(this.scene, 'ui.shop.currencyCrystals'), {
                fontSize: CARD_LABEL_SIZE, fill: '#4e1e45', fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            const crystalAmount = this.scene.add.text(
                CARD_VALUE_SLOT.x, CARD_VALUE_SLOT.y, `${card.data.amount}`, {
                    fontSize: CARD_VALUE_SIZE, fill: '#a83c69', fontFamily: '"HoMM Pixel"'
                }
            ).setOrigin(0.5);
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
                trapDamage = this.trapDamage?.(trapDamage) ?? trapDamage;
                const container = this.scene.add.container(card.sprite.x, card.sprite.y);
                const damageText = this.scene.add.text(CARD_VALUE_SLOT.x, CARD_VALUE_SLOT.y, `${trapDamage}`, {
                    fontSize: CARD_VALUE_SIZE,
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
            const foodLabel = this.scene.add.text(0, RESOURCE_LABEL_Y, t(this.scene, isEgg ? 'ui.card.egg' : 'tooltip.food'), {
                fontSize: CARD_LABEL_SIZE, fill: '#a55119', fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            container.add(foodLabel);
            // The Egg is a story item, not a snack — it deliberately shows no
            // action count, the way it never showed "+30 AP".
            if (!isEgg) {
                container.add(this.scene.add.text(
                    CARD_VALUE_SLOT.x, CARD_VALUE_SLOT.y, `${card.data.actionAmount}`, {
                        fontSize: CARD_VALUE_SIZE, fill: '#a55119', fontFamily: '"HoMM Pixel"'
                    }
                ).setOrigin(0.5));
            }
            attachInfoText(container);
            return;
        }

        case 'potion': {
            // Potions had no board label at all — no name, no number — while
            // every other resource carried both. Same shape as the rest: the
            // category name low, the heal in the shared value slot.
            const container = this.scene.add.container(card.sprite.x, card.sprite.y);
            // The Antidote is labelled a Cure, not a Potion.
            const potionLabel = this.scene.add.text(0, RESOURCE_LABEL_Y, t(this.scene, card.data.curesPoison ? 'tooltip.cure' : 'tooltip.potion'), {
                fontSize: CARD_LABEL_SIZE, fill: '#600f18', fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            // The Antidote heals nothing: no number on it.
            const potionAmount = this.scene.add.text(
                CARD_VALUE_SLOT.x, CARD_VALUE_SLOT.y, card.data.curesPoison ? '' : `${card.data.healAmount ?? 0}`, {
                    fontSize: CARD_VALUE_SIZE, fill: '#71800b', fontFamily: '"HoMM Pixel"'
                }
            ).setOrigin(0.5);
            container.add([potionLabel, potionAmount]);
            attachInfoText(container);
            return;
        }

        case 'key': {
            const container = this.scene.add.container(card.sprite.x, card.sprite.y);
            const keyLabel = this.scene.add.text(0, 18, t(this.scene, 'tooltip.key'), {
                fontSize: CARD_LABEL_SIZE, fill: '#51484b', fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            container.add(keyLabel);
            attachInfoText(container);
            return;
        }

        case 'magic': {
            // The texture holds the arcane face and symbol only. Keep the name
            // live (and translated), in the clear bottom band below the symbol.
            // Damage and effect values continue to come from the hover tooltip.
            const container = this.scene.add.container(card.sprite.x, card.sprite.y);
            // 20 (was 25): the name sits 5px higher (Taya).
            const magicLabel = this.scene.add.text(0, 20, translateItemName(this.scene, card.data), {
                fontSize: CARD_LABEL_SIZE,
                fill: '#71b1ae',
                fontFamily: '"HoMM Pixel"',
                align: 'center'
            }).setOrigin(0.5);
            // Use whole font sizes rather than scaling the card or its pixels.
            for (const size of [8, 7, 6]) {
                if (magicLabel.width <= 42) break;
                magicLabel.setFontSize(`${size}px`);
            }
            // Longer translations use two tight lines in the same name band.
            if (magicLabel.width > 42) {
                magicLabel.setWordWrapWidth(42, true).setLineSpacing(-3);
            }

            container.add(magicLabel);
            attachInfoText(container);
            return;
        }

        case 'companion': {
            // The companion art leaves a name plate along the bottom and a
            // weapon icon in the lower right corner, so the card carries its
            // name on the plate and its damage in the corner, like a weapon.
            // The Crystal Spiderling does no damage: it webs, so the corner
            // says so instead of printing a 0.
            const container = this.scene.add.container(card.sprite.x, card.sprite.y);
            // The skeleton's art has no plate, so its name gets an outline.
            const plateless = String(card.data.sprite || '').startsWith('skeletonCompanion');
            const nameLabel = this.scene.add.text(-1, 21, translateItemName(this.scene, card.data), {
                fontSize: CARD_LABEL_SIZE,
                fill: plateless ? '#fef0cf' : '#51484b',
                fontFamily: '"HoMM Pixel"',
                align: 'center'
            }).setOrigin(0.5);
            if (plateless) nameLabel.setStroke('#2b2332', 3);
            // Whole font sizes, kept clear of the weapon icon on the right.
            for (const size of [8, 7, 6]) {
                if (nameLabel.width <= 34) break;
                nameLabel.setFontSize(`${size}px`);
            }
            if (nameLabel.width > 34) nameLabel.setWordWrapWidth(34, true).setLineSpacing(-3);
            container.add(nameLabel);

            const webs = Boolean(card.data.websEnemies || card.data.id === 'crystalSpiderlingCompanion');
            const valueText = this.scene.add.text(CARD_VALUE_SLOT.x, CARD_VALUE_SLOT.y,
                webs ? t(this.scene, 'ui.card.web') : '', {
                    fontSize: webs ? '8px' : CARD_VALUE_SIZE,
                    fill: webs ? '#d6e8f0' : COMPANION_VALUE_COLOR,
                    fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
            if (webs) valueText.setStroke('#2b2332', 2);
            container.add(valueText);
            if (!webs) {
                container._companionDamageText = valueText;
                container._companionData = card.data;
                refreshCompanionValueText(this.scene, container);
            }
            container.setDepth(1001);
            attachInfoText(container);
            return;
        }

        case 'thorns': {
            const container = this.scene.add.container(card.sprite.x, card.sprite.y);
            const damageText = this.scene.add.text(CARD_VALUE_SLOT.x, CARD_VALUE_SLOT.y, `${card.data.thornDamage}`, {
                fontSize: CARD_VALUE_SIZE,
                fill: '#71800b',
                fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            container.add(damageText);

            const startY = PIP_TOP_TEN;
            const dotSpacing = DURABILITY_DOT_SPACING;
            const tenDurabilitySpacing = 11;
            const tensCount = Math.floor(card.data.durability / 10);
            const remainingDots = card.data.durability % 10;
            let currentY = startY;

            for (let i = 0; i < tensCount; i++) {
                const tenSprite = snapOriginToPixelGrid(this.scene.add.image(-19, currentY, 'ten_durability'));
                container.add(tenSprite);
                currentY += tenDurabilitySpacing;
            }

            const dotsAfterTens = tensCount > 0 ? DOT_AFTER_TEN_TUCK : PIP_TOP_DOT - PIP_TOP_TEN;
            for (let i = 0; i < remainingDots; i++) {
                const dot = snapOriginToPixelGrid(this.scene.add.image(-19, currentY + dotsAfterTens + (i * dotSpacing), 'durability_dot'));
                container.add(dot);
            }

            container.setDepth(1001);
            attachInfoText(container);
            return;
        }

        case 'gem': {
            const label = this.scene.add.text(card.sprite.x, card.sprite.y + 22, this.getGemLabel(card.data), {
                fontSize: '9px',
                fill: '#fee8b5',
                fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            attachInfoText(label);
            return;
        }
            
        case 'weapon': {
            const container = this.scene.add.container(card.sprite.x, card.sprite.y);
            const damageText = this.scene.add.text(CARD_VALUE_SLOT.x, CARD_VALUE_SLOT.y, '', {
                fontSize: CARD_VALUE_SIZE,
                fill: WEAPON_VALUE_COLOR,
                fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            container.add(damageText);
            container._weaponDamageText = damageText;
            container._weaponData = card.data;
            refreshWeaponValueText(this.scene, container);

            // Durability display with 10-point sprites and individual dots
            const startY = PIP_TOP_TEN;
            const dotSpacing = DURABILITY_DOT_SPACING;
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
            
            // Add remaining individual dots. Below a ten-marker they tuck up
            // to the same 1px gap the ten-markers keep between themselves.
            const dotsAfterTens = tensCount > 0 ? DOT_AFTER_TEN_TUCK : PIP_TOP_DOT - PIP_TOP_TEN;
            for (let i = 0; i < remainingDots; i++) {
                const dot = snapOriginToPixelGrid(this.scene.add.image(-19, currentY + dotsAfterTens + (i * dotSpacing), 'durability_dot'));
                container.add(dot);
            }

            addCardStars(this.scene, container, card.data);
            container.setDepth(1001);
            attachInfoText(container);
            return;
        }
        
        case 'armor': {
            const container = this.scene.add.container(card.sprite.x, card.sprite.y);
            // While Magic Shield / Warding is up, the worn armor shows the boosted
            // number it is actually protecting for (5 -> 6), tinted blue so the
            // player can see it is temporary. Bag armor is never boosted.
            const gs = this.scene.gameState;
            const isWorn = Boolean(gs?.equippedArmor) && card.data === gs.equippedArmor;
            const warded = isWorn && isArmorWarded(gs, card.data);
            const shownProtection = warded
                ? effectiveArmorProtection(gs, card.data)
                : card.data.protection;
            const protectionText = this.scene.add.text(CARD_VALUE_SLOT.x, CARD_VALUE_SLOT.y, `${shownProtection}`, {
                // 11px to match weapon/thorns/trap — armor was the odd one out.
                fontSize: CARD_VALUE_SIZE,
                fill: warded ? '#71b1ae' : '#ffcf7f',
                fontFamily: '"HoMM Pixel"'
            }).setOrigin(0.5);
            container.add(protectionText);
            
            // Durability display with 10-point sprites and individual dots
            const startY = PIP_TOP_TEN;
            const dotSpacing = DURABILITY_DOT_SPACING;
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
            
            // Add remaining individual dots. Below a ten-marker they tuck up
            // to the same 1px gap the ten-markers keep between themselves.
            const dotsAfterTens = tensCount > 0 ? DOT_AFTER_TEN_TUCK : PIP_TOP_DOT - PIP_TOP_TEN;
            for (let i = 0; i < remainingDots; i++) {
                const dot = snapOriginToPixelGrid(this.scene.add.image(-22, currentY + dotsAfterTens + (i * dotSpacing), 'durability_dot'));
                container.add(dot);
            }

            addCardStars(this.scene, container, card.data);
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
            ? '#c45c45' : '#fef0cf';
            
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

// An enemy's sigils, with the Arrest look matching what it throws (web or ink).
function boardEnemySigils(data) {
    return enemySigils(data, { lockKind: handLockKindOf(data) });
}

function _buildEnemyCornerStats(card) {
    if (!card?.sprite || !card.data) return;
    if (card.data.type === 'boss') {
        this._buildBossStats(card);
        return;
    }

    // Drop any previous overlay first — reveal/refresh can rebuild, and
    // leftover labels are what stick after damage/death.
    this.destroyCardInfoText(card);

    // Corner inset (px from the card centre). Tuned to drop into the
    // little stat-plate slots painted onto the new card art — HP to the
    // bottom-left, ATK to the bottom-right.
    const dx = 18;   // pulled further inward so the digits sit in the slots
    const dy = 27;   // raised 5px from the original bottom edge

    // Warm parchment cream, shared by both stats.
    const STAT_FILL = '#fef0cf';
    const style = {
        fontSize: CARD_VALUE_SIZE,
        fill: STAT_FILL,
        fontFamily: '"HoMM Pixel"',
    };

    const hpText = _makeCornerText(this.scene, -dx, dy, card.data.health ?? 0, style);
    // A cocoon is a container, not a fighter: it has no attack, so it shows no
    // attack number rather than a meaningless 0. Real enemies still print a 0
    // if something has weakened them that far — that is worth knowing.
    const atkText = isSilkCocoonCard(card.data) || card.data.isBonePile
        ? null
        : _makeCornerText(this.scene, dx, dy, getEnemyHitAttack(card, this.boardCards), style);

    const children = atkText ? [hpText, atkText] : [hpText];
    let nameText = null;
    // Placeholder art: stamp the enemy name on the silhouette until real cards exist.
    if (card.data.placeholderArt || card.data.isBonePile) {
        const label = card.data.isBonePile ? 'Bone Pile\nReforms: 1'
            : String(card.data.name || card.data.enemyType || 'Enemy');
        nameText = _makeCornerText(this.scene, 0, -6, label, {
            fontSize: label.length > 12 ? '8px' : '9px',
            fill: '#fef0cf',
            fontFamily: '"HoMM Pixel"',
            align: 'center',
            wordWrap: { width: 44 },
            stroke: '#1b0b09',
            strokeThickness: 3,
        });
        children.push(nameText);
    }

    // The enemy's sigils (its traits), down the card's top-right corner.
    const corner = sigilCornerOffset(ENEMY_CARD_W, ENEMY_CARD_H);
    children.push(...buildSigilIcons(this.scene, boardEnemySigils(card.data), corner.x, corner.y));

    const container = this.scene.add.container(
        Math.round(card.sprite.x),
        Math.round(card.sprite.y),
        children
    );
    container.setDepth((card.sprite.depth || 1) + 2);
    // Follow the card's scale, or the digits drift out of the stat plates
    // painted on the art whenever a crowded board shrinks the cards.
    container.setScale(card.sprite.scaleX || 1);

    // Tag the child texts so updateEnemyInfoText can refresh in place
    // without rebuilding the whole container.
    container._hpText = hpText;
    container._atkText = atkText;
    container._nameText = nameText;

    card.infoText = container;
    card.sprite?.setData?.('infoText', container);
}

function _buildBossStats(card) {
    if (!card?.sprite || !card.data) return;

    this.destroyCardInfoText(card);

    const maxHealth = Math.max(1, card.data.maxHealth || card.data.health || 1);
    card.data.maxHealth = maxHealth;

    const barFrame = this.scene.textures.getFrame('healthBar');
    const barWidth = barFrame?.width || 84;
    const bossBottom = (card.sprite.displayHeight || card.sprite.height || 100) / 2;
    const barGap = card.data.name === 'Spider Queen' ? 18 : 10;
    const y = card.sprite.y + bossBottom + barGap;

    const emptyBar = this.scene.make.image({ x: 0, y: 0, key: 'healthBarEmpty', add: false }).setOrigin(0.5);
    const fillBar = this.scene.make.image({ x: -barWidth / 2, y: 0, key: 'healthBar', add: false }).setOrigin(0, 0.5);
    const hpText = _makeCornerText(this.scene, 0, -1, '', {
        fontSize: '9px',
        fill: '#fef0cf',
        fontFamily: '"HoMM Pixel"',
        stroke: '#250d08',
        strokeThickness: 2
    });
    const atkText = _makeCornerText(this.scene, 0, 14, '', {
        fontSize: '10px',
        fill: '#ffcf7f',
        fontFamily: '"HoMM Pixel"',
        stroke: '#361808',
        strokeThickness: 2
    });

    // The boss's sigils in the top-right corner of its art. The container sits
    // under the art (at y), so the corner is measured back up from there —
    // and down past any thread the art hangs from (the Spider Queen).
    const bossW = card.sprite.displayWidth || card.sprite.width || 100;
    const bossH = card.sprite.displayHeight || card.sprite.height || 100;
    const bossCorner = sigilCornerOffset(bossW, bossH);
    const bodyTop = artBodyTop(this.scene, card.sprite.texture?.key, card.sprite.frame?.name)
        * (card.sprite.scaleY || 1);
    const sigilIcons = buildSigilIcons(this.scene, boardEnemySigils(card.data),
        bossCorner.x, bossCorner.y + bodyTop + (card.sprite.y - y));

    const container = this.scene.add.container(card.sprite.x, y, [emptyBar, fillBar, hpText, atkText, ...sigilIcons]);
    container.setDepth((card.sprite.depth || 1) + 8);
    container._bossEmptyBar = emptyBar;
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
    // A revealed board item normally receives the generic pickup handler
    // before its type-specific behavior is attached. Gems are socket-only, so
    // remove that handler everywhere (combat, cocoons, restored saves, rewards).
    card.sprite.off('pointerdown');
    card.sprite.setInteractive({ draggable: true, useHandCursor: true });
    // Phaser's interactive config does not consistently register an object
    // with the drag manager after it has already been interactive (reward
    // gems are initialized that way). Make the registration explicit.
    this.scene.input?.setDraggable?.(card.sprite, true);
    const home = { x: card.sprite.x, y: card.sprite.y };
    // Masked to the stone, so the streak never spills onto the board.
    const shine = attachGemShine(this.scene, card.sprite);
    const animKey = `gem_${card.data.gemEffect}_sparkle`;
    const hoverAnimKey = `gem_${card.data.gemEffect}_hover`;
    let idleTimer = null;
    let dragged = false;
    card.sprite.on('pointerdown', () => {
        const selectingSwap = this.scene.amuletManager?.handleActiveBoardCardSelection?.(index) || false;
        card.sprite.setData('amuletSwapSelecting', selectingSwap);
        dragged = false;
    });
    // Hover belongs to the gem, NOT to the old sparkle animation. These used to
    // live inside the anims.exists(animKey) guard below, which was fine while
    // gem_*_sparkle existed — it no longer does, so the guard is false and
    // everything inside it is never registered. The socket hint and the shine
    // would have gone with it.
    card.sprite.on('pointerover', () => {
        // Every card that could take this gem shows an empty socket, so "where
        // does this go?" is answered before anything is dragged.
        showGemSockets(this.scene, card.data);
        shine?.start();
    });
    card.sprite.on('pointerout', () => {
        // Not while dragging: the pointer leaves the gem the moment it is
        // picked up, and both the hint and the shine are most useful then.
        if (card.sprite.getData('boardGemDragging')) return;
        hideGemSockets(this.scene);
        shine?.stop();
    });

    if (this.scene.anims.exists(animKey)) {
        card.sprite.on('pointerover', () => {
            if (this.scene.anims.exists(hoverAnimKey)) {
                card.sprite.play(hoverAnimKey);
            } else {
                card.sprite.play(animKey);
            }
        });
        card.sprite.on('pointerout', () => {
            if (card.sprite.getData('boardGemDragging')) return;
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
        if (card.sprite.getData('amuletSwapSelecting')) return;
        dragged = true;
        card.sprite.setData('boardGemDragging', true);
        showGemSockets(this.scene, card.data);
        shine?.start();
        this.scene.tweens.killTweensOf(card.sprite);
        if (card.infoText?.scene) this.scene.tweens.killTweensOf(card.infoText);
        card.sprite.stop();
        card.sprite.setDepth(2500);
        if (card.shadow) card.shadow.setAlpha(0);
        if (card.gemShadow) card.gemShadow.setVisible(false);
    });
    card.sprite.on('drag', (pointer, dragX, dragY) => {
        if (card.sprite.getData('amuletSwapSelecting')) return;
        card.sprite.x = Phaser.Math.Clamp(dragX, 0, 640);
        card.sprite.y = Phaser.Math.Clamp(dragY, 0, 360);
        shine?.sync();
        if (card.infoText?.scene) {
            card.infoText.x = card.sprite.x;
            card.infoText.y = card.sprite.y + 22;
        }
    });
    card.sprite.on('dragend', () => {
        // The hint goes down however the drag ends — socketed, dropped short,
        // or abandoned. Before the early returns below, so none can skip it.
        hideGemSockets(this.scene);
        shine?.stop();
        if (card.sprite.getData('amuletSwapSelecting')) {
            card.sprite.setData('amuletSwapSelecting', false);
            return;
        }
        if (this.tryApplyBoardGem(card, index)) return;
        card.sprite.setData('boardGemDragging', false);
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
    card.sprite.on('pointerup', () => {
        if (card.sprite.getData('amuletSwapSelecting')) {
            card.sprite.setData('amuletSwapSelecting', false);
            return;
        }
        if (!dragged && card.sprite?.scene) {
            this.scene.createFloatingText(
                card.sprite.x,
                card.sprite.y - 30,
                'Drag onto a weapon to socket',
                0xffcf7f
            );
        }
        dragged = false;
        card.sprite?.setData?.('boardGemDragging', false);
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

    // Month-sheet enemies already wear their elite card face — applyEnemyTier
    // swapped the sprite when it promoted them. Tinting on top would wash out
    // art that is already saying "elite".
    if (card.data.monthId && Number.isInteger(card.data.sheetColumn)) {
        card.sprite.clearTint?.();
        return;
    }

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
    const glow = scene.add.circle(x, y, 24, 0xfee093, 0.9)
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
        stroke(4, 0xffcf7f, 0.6);
        stroke(2, 0xfef0cf, 1);
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
    stroke(5, 0xffcf7f, 0.5);
    stroke(2, 0xfef0cf, 1);

    scene.tweens.add({
        targets: bolts, alpha: 0, duration: 180, ease: 'Cubic.easeIn', delay: 60,
        onComplete: () => bolts.destroy()
    });
}

function _infoTextAlive(go) {
    return !!(go && go.scene && go.active !== false && typeof go.setText === 'function');
}

function updateEnemyInfoText(card) {
    if (!card?.data || !card.sprite) return;
    const t = card.data.type;
    if (t !== 'enemy' && t !== 'eliteEnemy' && t !== 'boss') return;

    // Fast path: the corner-stat container we built in createCardInfoText
    // exposes _hpText / _atkText. Refresh those in place when they're
    // still valid Phaser objects (active + still in a scene).
    const container = card.infoText;
    if (card.data.type === 'boss' && container?._bossHpFill?.scene) {
        this.updateBossInfoText(card);
        return;
    }

    const hpText = container?._hpText;
    const atkText = container?._atkText;
    // Cocoons are built without an attack label, so their container is complete
    // with HP alone — requiring both here would rebuild it on every refresh.
    const wantsAttack = !isSilkCocoonCard(card.data);
    if (_infoTextAlive(hpText) && (!wantsAttack || _infoTextAlive(atkText))) {
        try {
            hpText.setText(String(card.data.health ?? 0));
            if (wantsAttack) {
                atkText.setText(String(getEnemyHitAttack(card, this.boardCards)));
            }
            return;
        } catch (_) { /* fall through to rebuild */ }
    }

    // Stale or wrong-shaped container — drop and rebuild via the standard
    // reveal path so styling stays consistent.
    this._buildEnemyCornerStats(card);
}

function refreshEnemyAttackLabels() {
    if (!Array.isArray(this.boardCards)) return;
    for (const card of this.boardCards) {
        if (!card?.revealed || !card.data) continue;
        if (card.data.type !== 'enemy' && card.data.type !== 'eliteEnemy' && card.data.type !== 'boss') continue;
        if ((card.data.health ?? 0) <= 0) continue;
        this.updateEnemyInfoText(card);
    }
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
    container._bossAtkText.setText(`ATK ${getEnemyHitAttack(card, this.boardCards)}`);
}

function playKillLootPickup(x, y, reward, sourceLabel = 'Pick') {
    const isCoin = reward?.kind === 'coin';
    const rawAmount = reward?.amount || 1;
    const amount = isCoin ? scaleGoldReward(rawAmount) : rawAmount;

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
        isCoin ? 0xfbad19 : 0x71b1ae
    );
    this.scene.updateUI?.();
    this.scene.playCurrencyGainFlight?.(x, y, isCoin ? 'coins' : 'crystals');

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

    if (ghost && scene.textures?.exists?.('bossDeathMask') && scene.anims?.exists?.('boss_death_mask')) {
        // The decay rises over the boss itself (Taya): the sheet is clipped to
        // the boss's own pixels, so only the boss rots and the room around it
        // stays clear. Native size, its bottom on the boss's feet, centred.
        const width = ghost.displayWidth || 0;
        const height = ghost.displayHeight || 0;
        const centerX = Math.round(x + (0.5 - ghost.originX) * width);
        const bottomY = Math.round(y + (1 - ghost.originY) * height);
        const decay = scene.add.sprite(centerX, bottomY, 'bossDeathMask', 0)
            .setOrigin(0.5, 1)
            .setDepth(depth + 1);
        decay.setMask(ghost.createBitmapMask());
        decay.play('boss_death_mask');
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            // Boss and decay fade out together; the tint covers any part of a
            // tall boss the tide did not reach.
            if (!ghost?.scene) {
                if (decay.active) decay.destroy();
                return;
            }
            ghost.setTint(0x2f2230);
            scene.tweens.add({
                targets: [ghost, decay],
                alpha: 0,
                duration: 240,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                    if (decay.active) {
                        decay.clearMask(true);
                        decay.destroy();
                    }
                    ghost.destroy();
                }
            });
        };
        decay.once('animationcomplete', finish);
        // Safety net in case the complete event is missed.
        scene.time.delayedCall(1200, finish);
    } else {
        dissolveGhost();
    }
}

function playCardDisappearEffect(cardSprite) {
    if (!cardSprite) return null;
    return playCardDissolve(this.scene, cardSprite, 'enemy', { depth: (cardSprite.depth || 0) + 5 });
}

// A player's card that spent its last pip — weapon, armor or thorns. Exactly
// the enemy death (same lift, same hold, same depth rule); only the animation
// differs, drawn for the player's own cards so a breaking item never reads as
// an enemy dying.
function playCardBreakEffect(cardSprite) {
    if (!cardSprite) return null;
    return playCardDissolve(this.scene, cardSprite, 'break', { depth: (cardSprite.depth || 0) + 5 });
}

// A card dropped into the discard chute. It is pulled to the chute's mouth
// while it shrinks and tilts — both at once, the way something tipping over an
// edge turns as it goes — and only once it has fallen does it fade.
const DISCARD_SHRINK_TO = 0.35;
const DISCARD_TILT_DEG = 18;
const DISCARD_FALL_MS = 260;
const DISCARD_FADE_MS = 140;
const DISCARD_MIN_DEPTH = 20;

function playCardDiscardEffect(cardSprite, chute = null) {
    const texKey = cardSprite?.texture?.key;
    if (!cardSprite || !texKey || texKey === '__MISSING' || texKey === '__DEFAULT') return null;
    const ghost = this.scene.add.sprite(cardSprite.x, cardSprite.y, texKey, cardSprite.frame?.name);
    ghost.setOrigin(cardSprite.originX, cardSprite.originY);
    ghost.setScale(cardSprite.scaleX, cardSprite.scaleY);
    // Never below the bag panel (depth 10). A bag card drops from depth 12, but
    // a gem dragged off the board falls from the board's depth 2 and would go
    // down the chute hidden behind the panel frame.
    ghost.setDepth(Math.max((cardSprite.depth || 0) + 5, DISCARD_MIN_DEPTH));

    const toX = chute?.x ?? cardSprite.x;
    const toY = chute?.y ?? cardSprite.y;
    this.scene.tweens.add({
        targets: ghost,
        x: toX,
        y: toY,
        scaleX: cardSprite.scaleX * DISCARD_SHRINK_TO,
        scaleY: cardSprite.scaleY * DISCARD_SHRINK_TO,
        angle: DISCARD_TILT_DEG,
        duration: DISCARD_FALL_MS,
        // Accelerating, like a fall — not easing into a gentle landing.
        ease: 'Quad.easeIn',
        onComplete: () => {
            if (!ghost.active) return;
            this.scene.tweens.add({
                targets: ghost,
                alpha: 0,
                duration: DISCARD_FADE_MS,
                onComplete: () => { if (ghost.active) ghost.destroy(); },
            });
        },
    });
    // Safety net: never leave a ghost on screen if a tween is killed.
    this.scene.time.delayedCall(DISCARD_FALL_MS + DISCARD_FADE_MS + 400, () => {
        if (ghost.active) ghost.destroy();
    });
    return ghost;
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
    const coinReward = scaleGoldReward(20 + floor * 2);
    const crystalReward = 5 + Math.floor(floor / 5);

    // Create splash sprite
    const splashSprite = this.scene.add.sprite(x, y, 'splashSheet');
    let awarded = false;
    const finish = () => {
        if (awarded) return;
        awarded = true;
        splashSprite.destroy();
        SoundHelper.playSound(this.scene, 'treasure_explode', 0.5);
        this.scene.gameState.coins += coinReward;
        this.scene.gameState.crystals += crystalReward;
        this.scene.createFloatingText(x, y - 20, `+${coinReward} Coins +${crystalReward} Crystals!`, 0xfbad19);
        this.scene.updateUI?.();
        this.scene.playCurrencyGainFlight?.(x, y, 'coins');
        this.scene.time?.delayedCall?.(120, () => this.scene.playCurrencyGainFlight?.(x, y, 'crystals'));
    };
    splashSprite.once('animationcomplete', finish);
    if (this.scene.anims.exists('splash_anim')) splashSprite.play('splash_anim');
    // Award once even if the animation is unavailable or its callback misses.
    this.scene.time.delayedCall(900, finish);
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
    this.scene.createFloatingText(x, y - 20, 'Mimic Escaped!', 0xef7c4b);
    SoundHelper.playSound(this.scene, 'mimic_escaped', 0.5);

    const splash = this.scene.add.sprite(x, y, 'splashSheet');
    if (this.scene.anims.exists('splash_anim')) splash.play('splash_anim');
    splash.once('animationcomplete', () => splash.destroy());
    this.scene.time.delayedCall(900, () => splash.active && splash.destroy());
    SoundHelper.playSound(this.scene, 'card_flip', 0.4);

    this.removeCard(index);
    this.checkFloorClear();
}
