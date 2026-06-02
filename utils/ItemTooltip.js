// utils/ItemTooltip.js
// Shared hover tooltip for items shown anywhere on screen — gaming board,
// shop rooms, chest rewards, etc. Renders a small dark panel above the
// hovered card with the item name (in rarity colour) and a description
// tailored to the item type. The amulet description is pulled from the
// AmuletManager runtime (where the effect callbacks live), not from the
// card data itself.

function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

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

// Best-effort guess at whether a weapon is ranged. Avoids importing
// CardSystem; mirrors the heuristic used elsewhere.
function describeWeaponKind(data) {
    const text = `${data.name || ''} ${data.sprite || ''} ${data.weaponType || ''}`.toLowerCase();
    if (data.isRanged || data.range > 1 || text.includes('spear') || text.includes('bow') || text.includes('chain')) {
        return 'Ranged';
    }
    return 'Melee';
}

// Returns { name, body } strings for the tooltip. Body may be empty.
export function getTooltipLines(scene, data) {
    if (!data) return { name: '', body: '' };
    const name = data.name || capitalize(data.type) || 'Item';
    let body = '';

    if (data.type === 'amulet') {
        const def = scene?.amuletManager?.amuletDefinitions?.[data.id];
        body = def?.description || data.description || '';
        const rarityWord = data.rarity ? capitalize(data.rarity) : '';
        if (rarityWord) body = `${rarityWord}\n${body}`.trim();
    } else if (data.type === 'weapon') {
        const dmg = data.damage ?? 0;
        const dur = data.durability ?? data.maxDurability ?? 0;
        const rarityWord = data.rarity ? capitalize(data.rarity) + ' ' : '';
        body = `${rarityWord}${describeWeaponKind(data)}\n${dmg} DMG  •  ${dur} DUR`;
    } else if (data.type === 'armor') {
        const def = data.protection ?? 0;
        const dur = data.durability ?? data.maxDurability ?? 0;
        const rarityWord = data.rarity ? capitalize(data.rarity) + ' Armor' : 'Armor';
        body = `${rarityWord}\n${def} DEF  •  ${dur} DUR`;
    } else if (data.type === 'potion') {
        body = `Heals ${data.healAmount ?? 0} HP`;
    } else if (data.type === 'food') {
        body = `Restores ${data.actionAmount ?? 0} AP`;
    } else if (data.type === 'magic') {
        body = data.description || 'Magic spell';
    } else if (data.type === 'gem') {
        const effect = data.gemEffect || data.effect;
        body = `Socket: ${effect ? capitalize(effect) : 'Gem'}`;
    } else if (data.type === 'thorns') {
        const rarityWord = data.rarity ? capitalize(data.rarity) + ' ' : '';
        body = `${rarityWord}${data.thornDamage ?? 0} Thorn DMG  •  ${data.durability ?? 0} DUR`;
    } else if (data.type === 'key') {
        body = 'Opens locked treasure chests';
    } else if (data.description) {
        body = data.description;
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

    const padX = 6;
    const padY = 5;
    const maxWidth = 200;

    const nameColor = data.type === 'amulet' && data.rarity === 'cursed'
        ? '#ff8888'
        : rarityFill(data.rarity);

    const nameText = scene.add.text(0, 0, lines.name, {
        fontSize: '11px',
        fill: nameColor,
        fontFamily: '"HoMM Pixel"',
        wordWrap: { width: maxWidth },
        align: 'center',
    }).setOrigin(0, 0);

    const bodyText = lines.body
        ? scene.add.text(0, Math.ceil(nameText.height) + 3, lines.body, {
            fontSize: '10px',
            fill: '#dddddd',
            fontFamily: '"HoMM Pixel"',
            wordWrap: { width: maxWidth },
            align: 'center',
            lineSpacing: 2,
        }).setOrigin(0, 0)
        : null;

    // Round ALL dimensions and positions to whole pixels. Phaser's text
    // measureText returns sub-pixel widths (e.g. 92.4 px), which cascade
    // into fractional container positions. With pixelArt/roundPixels on,
    // adding a fractional-positioned object on hover causes Phaser's
    // renderer to nudge the camera by a half-pixel as it re-snaps the
    // frame, visually shifting every other sprite by 1 px to the left.
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
