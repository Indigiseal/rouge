import { mimicSummonSpot } from './MimicSummon.js';
import { snapOriginToPixelGrid } from '../../ui/PixelSnap.js';
import { noteCardDiscovered } from '../../content/codex/Discoveries.js';

/** A revealed, ordinary food card; never replaces a card or requires bag space. */
export function spawnForagedFood(cardSystem) {
    const spot = mimicSummonSpot(cardSystem);
    if (!spot) return false;
    const scene = cardSystem.scene;
    const data = cardSystem.cardDataGenerator.createFoodCard(scene.gameState.currentFloor || 1);
    data.brick = { ...spot.cell };
    const shadow = scene.add.rectangle(spot.x, spot.y + 28, 52, 15, 0x000000, 0.6).setAlpha(0);
    const sprite = snapOriginToPixelGrid(scene.add.sprite(spot.x, spot.y, data.sprite));
    sprite.setScale(cardSystem._boardPlace?.cardScale || 1).setDepth(2).setInteractive();
    sprite.on('pointerdown', () => cardSystem.interactWithCard(spot.slot));
    const card = { data, sprite, shadow, revealed: true, restX: spot.x, restY: spot.y };
    cardSystem.boardCards[spot.slot] = card;
    cardSystem._rebuildBrickNeighbors?.();
    cardSystem.createCardInfoText(card);
    cardSystem._attachBoardItemTooltip?.(card);
    if (!scene.sandboxMode) noteCardDiscovered(data);
    scene.tweens.add({ targets: sprite, alpha: { from: 0, to: 1 }, duration: 250 });
    return true;
}
