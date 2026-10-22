import { cameraWorldSize } from '../../config/renderScale.js';
import { snapOriginToPixelGrid } from '../../ui/PixelSnap.js';
import { SoundHelper } from '../../audio/SoundHelper.js';
import { noteCardDiscovered } from '../../content/codex/Discoveries.js';
import { t } from '../../i18n/i18n.js';

// A spell occupies genuinely empty space, including after cards have moved.
// A boss room has lanes instead of the regular board's grid.
export function mimicSummonSpot(cardSystem) {
    const scene = cardSystem?.scene;
    if (!scene || scene._transitioning || scene.enemiesCleared) return null;
    const roomType = scene.gameState?.roomType || scene.roomType;
    if (roomType && !['COMBAT', 'ELITE', 'HARD', 'BOSS', 'AMBUSH'].includes(roomType)) return null;
    const board = cardSystem.boardCards || [];
    const boss = board.find(card => card?.data?.type === 'boss' && card.data.health > 0);
    if (boss) {
        const slot = board.findIndex(card => !card);
        if (slot < 0 || !boss.sprite) return null;
        const { width, height } = cameraWorldSize(scene.cameras?.main);
        const y = Math.min(height - 125, boss.sprite.y + 102) - 6;
        for (const lane of [-1, 1, -2, 2, -3, 3]) {
            const x = boss.sprite.x + lane * 76;
            if (x < 28 || x > width - 28) continue;
            if (board.some(card => card && card !== boss
                && Math.abs((card.restX ?? card.sprite?.x ?? -999) - x) < 56
                && Math.abs((card.restY ?? card.sprite?.y ?? -999) - y) < 70)) continue;
            return { slot, cell: { r: 1, c: lane }, x, y };
        }
        return null;
    }
    const spot = cardSystem.freeBoardSpots?.()[0];
    if (!spot) return null;
    return { ...spot, ...cardSystem.brickToPixel(spot.cell.r, spot.cell.c, cardSystem._boardPlace) };
}

export function summonMimic(cardSystem) {
    const spot = mimicSummonSpot(cardSystem);
    if (!spot) return false;
    const scene = cardSystem.scene;
    const data = cardSystem.cardDataGenerator.createMimicCard(scene.gameState.currentFloor || 1);
    data.maxHealth = data.health;
    data.brick = { ...spot.cell };
    const shadow = scene.add.rectangle(spot.x, spot.y + 28, 52, 15, 0x000000, 0.6).setAlpha(0);
    const sprite = snapOriginToPixelGrid(scene.add.sprite(spot.x, spot.y, data.sprite));
    sprite.setScale(cardSystem._boardPlace?.cardScale || 1).setDepth(2).setInteractive();
    sprite.on('pointerdown', () => cardSystem.interactWithCard(spot.slot));
    const card = { data, sprite, shadow, revealed: true, justRevealed: true, restX: spot.x, restY: spot.y };
    cardSystem.boardCards[spot.slot] = card;
    // Do not let later random reinforcement generation add a second natural
    // Mimic. Consumed spells remain explicit summons, not random room rolls.
    cardSystem._roomMimicSpawned = true;
    cardSystem._rebuildBrickNeighbors?.();
    cardSystem.createCardInfoText(card);
    cardSystem._attachEnemyBoardHover?.(card);
    cardSystem.refreshEnemyAttackLabels?.();
    if (!scene.sandboxMode) noteCardDiscovered(data);
    scene.tweens.add({ targets: sprite, alpha: { from: 0, to: 1 }, duration: 250 });
    SoundHelper.playSound(scene, 'magic_cast', 0.5);
    scene.createFloatingText?.(spot.x, spot.y - 30, t(scene, 'magic.summonMimic.appeared'), 0xfbad19);
    return true;
}
