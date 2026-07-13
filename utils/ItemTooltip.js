// utils/ItemTooltip.js
// Shared hover tooltip for items shown anywhere on screen: gaming board,
// shop rooms, chest rewards, etc.

import { t, translateCardType, translateDescription, translateGemEffect, translateItemName, translateRarity } from './i18n.js';

function rarityFill(rarity) {
    switch (rarity) {
        case 'uncommon':  return '#66dd66';
        case 'rare':      return '#66aaff';
        case 'epic':      return '#cc88ff';
        case 'legendary': return '#ffcc33';
        case 'cursed':    return '#ff6666';
        default:          return '#ffffff';
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
        const dmg = data.damage ?? 0;
        const dur = data.durability ?? data.maxDurability ?? 0;
        const rarityWord = data.rarity ? `${translateRarity(scene, data.rarity)} ` : '';
        body = `${rarityWord}${t(scene, describeWeaponKindKey(data))}\n${t(scene, 'tooltip.dmgDur', { dmg, dur })}`;
    } else if (data.type === 'armor') {
        const def = data.protection ?? 0;
        const dur = data.durability ?? data.maxDurability ?? 0;
        const rarityWord = data.rarity ? translateRarity(scene, data.rarity) : '';
        body = `${t(scene, 'tooltip.armorBody', { rarity: rarityWord })}\n${t(scene, 'tooltip.defDur', { def, dur })}`;
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
export function showItemTooltip(scene, data, anchorX, anchorY) {
    if (!scene || !scene.add) return;
    hideItemTooltip(scene);

    const lines = getTooltipLines(scene, data);
    if (!lines.name && !lines.body) return;

    const nameColor = data.type === 'amulet' && data.rarity === 'cursed'
        ? '#ff8888'
        : rarityFill(data.rarity);

    renderTooltipBox(scene, lines.name, lines.body, nameColor, anchorX, anchorY);
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
export function showBossTooltip(scene, data, anchorX, anchorY) {
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

    renderTooltipBox(scene, name, bodyParts.join('\n'), '#ffcc33', anchorX, anchorY);
}

// Shared box renderer for item and boss tooltips. Stored on the scene as
// `_itemTooltip` so any subsequent show (and hideItemTooltip) clears it.
function renderTooltipBox(scene, name, body, nameColor, anchorX, anchorY) {
    if (!name && !body) return;

    const padX = 6;
    const padY = 5;
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
            fill: '#dddddd',
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
    const boxHeight = Math.ceil(contentHeight + padY * 2);

    const bg = scene.add.rectangle(0, 0, boxWidth, boxHeight, 0x1a120a, 0.95)
        .setStrokeStyle(1, 0xb89968)
        .setOrigin(0, 0);

    let tipY = Math.round(anchorY) - 60 - boxHeight;
    if (tipY < 4) tipY = Math.round(anchorY) + 60;
    const cam = scene.cameras?.main;
    const screenW = cam?.width || 640;
    const tipX = Math.round(Phaser.Math.Clamp(
        Math.round(anchorX) - Math.round(boxWidth / 2),
        4,
        screenW - boxWidth - 4
    ));

    nameText.setPosition(Math.round((boxWidth - nameWidth) / 2), padY);
    if (bodyText) {
        bodyText.setPosition(Math.round((boxWidth - bodyWidth) / 2), padY + nameHeight + 3);
    }

    const children = [bg, nameText];
    if (bodyText) children.push(bodyText);

    scene._itemTooltip = scene.add.container(tipX, tipY, children).setDepth(2000);
}

export function hideItemTooltip(scene) {
    if (scene && scene._itemTooltip) {
        scene._itemTooltip.destroy(true);
        scene._itemTooltip = null;
    }
}
