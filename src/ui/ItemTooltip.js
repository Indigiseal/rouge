// utils/ItemTooltip.js
// Shared hover tooltip for items shown anywhere on screen: gaming board,
// shop rooms, chest rewards, etc.

import { t, translateCardType, translateDescription, translateGemEffect, translateItemName, translateRarity } from '../i18n/i18n.js';
import { getDisplayedWeaponDamage } from '../content/characters/CharacterClasses.js';
import { createTooltipPanel, TOOLTIP_TEXT_COLOR } from './NineSlicePanel.js';

// Default tooltip depth — above the board and its card FX, below the modal
// overlays. Callers that render higher pass their own depth.
export const TOOLTIP_DEPTH = 2000;

// Vertical distance between the anchor point and the tooltip box. Callers
// anchor at the card's CENTRE, so this has to clear half a card before it
// clears anything at all.
//
// Shops, chests and the amulet overlay lay their cards out with plenty of
// room, so the roomy default reads fine there. The combat board packs cards
// 48–60px apart, where 60px pushes the box a full card-height clear of the
// one you're pointing at and it stops feeling attached to the cursor — hence
// the tighter board value, which leaves the box just above the card's top edge.
export const TOOLTIP_GAP = 60;
export const BOARD_TOOLTIP_GAP = 32;

// Shop, rare shop, blacksmith and treasure lay items out on 52x70 cards, so the
// anchor sits 35px below the card's top edge and the card lifts 5px on hover.
// 44 clears both and leaves the box a few pixels clear of the raised card —
// close enough to read as attached to what the cursor is pointing at.
export const STATION_TOOLTIP_GAP = 44;

function rarityFill(rarity) {
    switch (rarity) {
        case 'uncommon':  return '#66dd66';
        case 'rare':      return '#66aaff';
        case 'epic':      return '#cc88ff';
        case 'legendary': return '#ffcc33';
        case 'cursed':    return '#ff6666';
        // Commons have no rarity hue to carry, so they take the body ink.
        default:          return TOOLTIP_TEXT_COLOR;
    }
}

function describeWeaponKindKey(data) {
    const text = `${data.name || ''} ${data.sprite || ''} ${data.weaponType || ''}`.toLowerCase();
    if (data.isRanged || data.range > 1 || text.includes('bow') || text.includes('chain')) {
        return 'tooltip.ranged';
    }
    return 'tooltip.melee';
}

// Returns { name, body } strings for the tooltip. Body may be empty.
export function getTooltipLines(scene, data) {
    if (!data) return { name: '', body: '' };
    const name = translateItemName(scene, data) || translateCardType(scene, data.type) || t(scene, 'tooltip.item');
    let body = '';

    if (data.type === 'amulet') {
        const def = scene?.amuletManager?.amuletDefinitions?.[data.id];
        body = translateDescription(scene, def?.description || data.description || '');
        const rarityWord = data.rarity ? translateRarity(scene, data.rarity) : '';
        if (rarityWord) body = `${rarityWord}\n${body}`.trim();
    } else if (data.type === 'weapon') {
        const dmg = getDisplayedWeaponDamage(
            scene?.gameState?.characterId,
            data,
            scene?.gameState?.talentEffects || null
        );
        const dur = data.durability ?? data.maxDurability ?? 0;
        const rarityWord = data.rarity ? `${translateRarity(scene, data.rarity)} ` : '';
        body = `${rarityWord}${t(scene, describeWeaponKindKey(data))}\n${t(scene, 'tooltip.dmgDur', { dmg, dur })}`;
    } else if (data.type === 'armor') {
        const def = data.protection ?? 0;
        const dur = data.durability ?? data.maxDurability ?? 0;
        const rarityWord = data.rarity ? translateRarity(scene, data.rarity) : '';
        const lines = [t(scene, 'tooltip.armorBody', { rarity: rarityWord })];
        if (def > 0) lines.push(t(scene, 'tooltip.defDur', { def, dur }));
        else lines.push(t(scene, 'tooltip.pips', { value: `${dur}/${data.maxDurability ?? dur}` }));
        if (data.dodgeChance) {
            lines.push(t(scene, 'tooltip.dodge', { percent: Math.round(data.dodgeChance * 100) }));
        }
        if (data.meleeCounterChance) {
            lines.push(`Melee counter: ${Math.round(data.meleeCounterChance * 100)}% (50% blocked)`);
        }
        if (data.rangedIgnoreChance) {
            lines.push(`Ignore ranged: ${Math.round(data.rangedIgnoreChance * 100)}%`);
        }
        body = lines.join('\n');
    } else if (data.type === 'potion') {
        body = t(scene, 'tooltip.heals', { amount: data.healAmount ?? 0 });
    } else if (data.type === 'food') {
        body = t(scene, 'tooltip.restores', { amount: data.actionAmount ?? 0 });
    } else if (data.type === 'companion') {
        const damageType = data.damageType === 'physical' ? 'physical' : 'lightning';
        const attackStyle = data.attackStyle === 'melee' || data.range === 'melee' ? 'Melee' : 'Ranged';
        body = `${attackStyle} companion\nDeals ${data.attack ?? 0} ${damageType} damage after enemies`;
        if (data.shockChance) body += `\nShock chance: ${Math.round(data.shockChance * 100)}%`;
        if (data.guardProtection) body += `\nGuard: +${data.guardProtection} protection`;
    } else if (data.type === 'magic') {
        body = data.description ? translateDescription(scene, data.description) : t(scene, 'tooltip.magicSpell');
    } else if (data.type === 'gem') {
        const effect = data.gemEffect || data.effect;
        body = t(scene, 'tooltip.socket', { effect: effect ? translateGemEffect(scene, effect) : t(scene, 'tooltip.gem') });
    } else if (data.type === 'thorns') {
        const rarityWord = data.rarity ? `${translateRarity(scene, data.rarity)} ` : '';
        body = t(scene, 'tooltip.thornBody', { rarity: rarityWord, amount: data.thornDamage ?? 0, dur: data.durability ?? 0 });
    } else if (data.type === 'key') {
        body = t(scene, 'tooltip.keyBody');
    } else if (data.description) {
        body = translateDescription(scene, data.description);
    }

    return { name, body };
}

// Builds a tooltip container parented to the given scene. Stored on the
// scene as `_itemTooltip` so subsequent shows hide the previous one.
export function showItemTooltip(scene, data, anchorX, anchorY, depth = TOOLTIP_DEPTH, gap = TOOLTIP_GAP) {
    if (!scene || !scene.add) return;
    hideItemTooltip(scene);

    const lines = getTooltipLines(scene, data);
    if (!lines.name && !lines.body) return;

    const nameColor = data.type === 'amulet' && data.rarity === 'cursed'
        ? '#ff8888'
        : rarityFill(data.rarity);

    renderTooltipBox(scene, lines.name, lines.body, nameColor, anchorX, anchorY, depth, gap);
}

// Describes a boss's abilities as human-readable lines. Reads the same
// `abilities` array the combat code consumes, so the tooltip can never drift
// from what the boss actually does.
export function getBossAbilityLines(scene, data) {
    const abilities = Array.isArray(data?.abilities) ? data.abilities : [];
    const lines = [];
    abilities.forEach(ab => {
        switch (ab?.type) {
            case 'lifesteal':
                lines.push(t(scene, 'boss.lifesteal', { pct: Math.round((ab.percentage || 0) * 100) }));
                break;
            case 'summon':
                lines.push(t(scene, 'boss.summon', { enemy: translateEnemyName(scene, ab.enemyType) }));
                break;
            case 'poison':
                lines.push(t(scene, 'boss.poison', { dmg: ab.damage || 0, turns: ab.turns || 0 }));
                break;
            case 'armor_break':
                lines.push(t(scene, 'boss.armorBreak', { amount: ab.amount || 0 }));
                break;
            case 'rage':
                lines.push(t(scene, 'boss.rage', {
                    mult: ab.damageBoost || 1.5,
                    pct: Math.round((ab.threshold ?? 0.3) * 100)
                }));
                break;
            case 'evade':
                lines.push(t(scene, 'boss.evade', { pct: Math.round((ab.chance || 0) * 100) }));
                break;
            case 'coin_steal':
                lines.push(t(scene, 'boss.coinSteal', { amount: ab.amount || 0 }));
                break;
            default:
                break;
        }
    });
    return lines;
}

function translateEnemyName(scene, enemyType) {
    const key = String(enemyType || '').toLowerCase();
    const byType = {
        skeleton: 'tooltip.skeleton',
        goblin: 'tooltip.goblin',
        spider: 'tooltip.spider',
    };
    // Fall back to a capitalized raw type if there's no dedicated string.
    const translated = byType[key] ? t(scene, byType[key]) : '';
    if (translated && translated !== byType[key]) return translated;
    return key ? key.charAt(0).toUpperCase() + key.slice(1) : t(scene, 'tooltip.card');
}

// Boss hover tooltip: name in boss gold, then attack and one line per ability.
export function showBossTooltip(scene, data, anchorX, anchorY, gap = TOOLTIP_GAP) {
    if (!scene || !scene.add || !data) return;
    hideItemTooltip(scene);

    const name = data.name || t(scene, 'tooltip.card');
    const abilityLines = getBossAbilityLines(scene, data);
    const bodyParts = [t(scene, 'boss.attack', { atk: data.attack ?? 0 })];
    if (abilityLines.length) {
        bodyParts.push(`${t(scene, 'boss.abilitiesTitle')}:`, ...abilityLines);
    } else {
        bodyParts.push(t(scene, 'boss.noAbilities'));
    }

    renderTooltipBox(scene, name, bodyParts.join('\n'), '#ffcc33', anchorX, anchorY, TOOLTIP_DEPTH, gap);
}

function getEnemyFeatureLines(scene, data) {
    const lines = [];
    const features = Array.isArray(data?.features) ? data.features : [];
    if (features.includes('wolf_pack')) {
        lines.push(t(scene, 'tooltip.wolfPack'));
    }
    if (features.includes('spore_on_hit')) {
        lines.push(t(scene, 'tooltip.sporeOnHit'));
    }
    if (features.includes('thorns_reflect')) {
        lines.push(t(scene, 'tooltip.thornsReflect'));
    }
    if (features.includes('veil_flip')) {
        lines.push(t(scene, 'tooltip.veilFlip'));
    }
    if (features.includes('ranged_immune')) {
        lines.push(t(scene, 'tooltip.rangedImmune'));
    }
    if (features.includes('gnaw')) {
        lines.push(t(scene, 'tooltip.gnaw'));
    }
    if (features.includes('taunt')) {
        lines.push(t(scene, 'tooltip.taunt'));
    }
    if (features.includes('poison_amp')) {
        lines.push(t(scene, 'tooltip.poisonAmp'));
    }
    if (features.includes('web_hand')) {
        lines.push(t(scene, 'tooltip.webHand'));
    }
    if (features.includes('club_stun')) {
        lines.push(t(scene, 'tooltip.clubStun'));
    }
    if (features.includes('coin_steal')) {
        lines.push(t(scene, 'tooltip.coinSteal'));
    }
    if (features.includes('goblin_rally')) {
        lines.push(t(scene, 'tooltip.goblinRally'));
    }
    if (features.includes('ignore_armor')) {
        lines.push(t(scene, 'tooltip.ignoreArmor'));
    }
    if (features.includes('heavy_shot')) {
        lines.push(t(scene, 'tooltip.heavyShot'));
    }
    if (features.includes('cocoon_shell')) {
        lines.push(t(scene, 'tooltip.cocoonShell'));
    }
    if (data?.isEliteMiniBoss) {
        lines.push(t(scene, 'tooltip.eliteMiniBoss'));
    }
    if (data?.isMimic) {
        lines.push(t(scene, 'tooltip.mimicEscape', { turns: data.escapeTurnsLeft ?? data.escapeTurns ?? 3 }));
    }
    return lines;
}

/** Revealed-enemy tooltip — name + role; abilities as "Poison: …" lines. */
export function showEnemyTooltip(scene, card, gap = BOARD_TOOLTIP_GAP) {
    if (!scene || !scene.add || !card?.data) return;
    hideItemTooltip(scene);

    const data = card.data;
    const baseName = translateItemName(scene, data) || data.name || t(scene, 'tooltip.card');
    const roleKey = (data.role === 'RANGED' || data.isRangedType) ? 'tooltip.ranged' : 'tooltip.melee';
    const title = `${baseName}  ·  ${t(scene, roleKey)}`;
    // HP/ATK live on the card corners — don't duplicate them here.
    const bodyParts = [
        ...getEnemyFeatureLines(scene, data),
        ...getBossAbilityLines(scene, data),
    ];

    const nameColor = data.isEliteMiniBoss ? '#ffcc33' : TOOLTIP_TEXT_COLOR;
    renderTooltipBox(
        scene,
        title,
        bodyParts.join('\n'),
        nameColor,
        card.sprite?.x ?? 0,
        card.sprite?.y ?? 0,
        TOOLTIP_DEPTH,
        gap
    );
}

// Shared box renderer for item and boss tooltips. Stored on the scene as
// `_itemTooltip` so any subsequent show (and hideItemTooltip) clears it.
// `depth` defaults to board level; modal overlays that sit higher pass their
// own so the tooltip lands on top of the window it describes.
function renderTooltipBox(scene, name, body, nameColor, anchorX, anchorY, depth = TOOLTIP_DEPTH, gap = TOOLTIP_GAP) {
    if (!name && !body) return;

    // Padding clears the drawn frame rather than the old 1px stroke: the art's
    // bottom edge is taller than its top, so the two differ.
    const padX = 8;
    const padTop = 7;
    const padBottom = 9;
    const maxWidth = 200;

    const nameText = scene.add.text(0, 0, name, {
        fontSize: '11px',
        fill: nameColor,
        fontFamily: '"HoMM Pixel", Arial, sans-serif',
        wordWrap: { width: maxWidth },
        align: 'center',
    }).setOrigin(0, 0);

    const bodyText = body
        ? scene.add.text(0, Math.ceil(nameText.height) + 3, body, {
            fontSize: '10px',
            fill: TOOLTIP_TEXT_COLOR,
            fontFamily: '"HoMM Pixel", Arial, sans-serif',
            wordWrap: { width: maxWidth },
            align: 'center',
            lineSpacing: 2,
        }).setOrigin(0, 0)
        : null;

    // Round all dimensions/positions to whole pixels to avoid hover jitter.
    const nameWidth = Math.ceil(nameText.width);
    const bodyWidth = Math.ceil(bodyText?.width ?? 0);
    const nameHeight = Math.ceil(nameText.height);
    const bodyHeight = Math.ceil(bodyText?.height ?? 0);
    const contentWidth = Math.max(nameWidth, bodyWidth);
    const contentHeight = nameHeight + (bodyText ? bodyHeight + 3 : 0);
    const boxWidth = Math.ceil(Math.min(maxWidth, contentWidth) + padX * 2);
    const boxHeight = Math.ceil(contentHeight + padTop + padBottom);

    const bg = createTooltipPanel(scene, boxWidth, boxHeight);

    let tipY = Math.round(anchorY) - gap - boxHeight;
    if (tipY < 4) tipY = Math.round(anchorY) + gap;
    const cam = scene.cameras?.main;
    const screenW = cam?.width || 640;
    const tipX = Math.round(Phaser.Math.Clamp(
        Math.round(anchorX) - Math.round(boxWidth / 2),
        4,
        screenW - boxWidth - 4
    ));

    nameText.setPosition(Math.round((boxWidth - nameWidth) / 2), padTop);
    if (bodyText) {
        bodyText.setPosition(Math.round((boxWidth - bodyWidth) / 2), padTop + nameHeight + 3);
    }

    const children = [bg, nameText];
    if (bodyText) children.push(bodyText);

    scene._itemTooltip = scene.add.container(tipX, tipY, children).setDepth(depth);
}

export function hideItemTooltip(scene) {
    if (scene && scene._itemTooltip) {
        scene._itemTooltip.destroy(true);
        scene._itemTooltip = null;
    }
}
