import { cameraWorldSize } from '../../config/renderScale.js';
import { snapOriginToPixelGrid } from '../../ui/PixelSnap.js';
import { SoundHelper } from '../../audio/SoundHelper.js';
import { noteCardDiscovered } from '../../content/codex/Discoveries.js';
import { t } from '../../i18n/i18n.js';

// A spell occupies genuinely empty space, including after cards have moved.
// A boss room has lanes instead of the regular board's grid.
export function mimicSummonSpot(cardSystem, { allowCleared = true } = {}) {
    const scene = cardSystem?.scene;
    if (!scene || scene._transitioning || scene.gameState?.playerHealth <= 0) return null;
    if (scene.enemiesCleared && !allowCleared) return null;
    const roomType = scene.gameState?.roomType || scene.roomType;
    if (roomType && !['COMBAT', 'ELITE', 'HARD', 'BOSS', 'AMBUSH'].includes(roomType)) return null;
    // Ordinary cleared boards can host a last loot challenge. A defeated boss
    // is already handing off to rewards/victory and must not be reopened.
    if (scene.enemiesCleared && (roomType === 'BOSS' || scene._bossVictoryPending
        || [15, 30, 45].includes(scene.gameState?.currentFloor))) return null;
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
    if (scene.enemiesCleared) {
        // The room already paid out. Preserve that fact across saves while the
        // Mimic temporarily closes the exit and restores normal combat turns.
        scene._roomClearRewarded = true;
        scene.enemiesCleared = false;
        scene.hideExitUnderStation?.();
        scene.showClosedDoorExit?.();
        scene._doorOpenSounded = false;
        scene.refreshDebugVictoryButton?.();
    }
    data.maxHealth = data.health;
    data.brick = { ...spot.cell };
    const shadow = scene.add.rectangle(spot.x, spot.y + 28, 52, 15, 0x000000, 0.6).setAlpha(0);
    const sprite = snapOriginToPixelGrid(scene.add.sprite(spot.x, spot.y, data.sprite));
    sprite.setScale(cardSystem._boardPlace?.cardScale || 1).setDepth(2);
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
    // Match reinforcement cards: fall from above and bounce into the slot.
    // Move the stats with the card, while saving its settled restX/restY.
    const falling = [sprite, card.infoText].filter(Boolean);
    falling.forEach(object => { object.y -= 280; });
    scene.tweens.add({
        targets: falling,
        y: '+=280',
        duration: 430,
        ease: 'Bounce.easeOut',
        onUpdate: () => falling.forEach(object => { object.y = Math.round(object.y); }),
        onComplete: () => {
            if (!sprite.active || cardSystem.boardCards[spot.slot] !== card) return;
            sprite.setInteractive();
            SoundHelper.playVariant(scene, 'card_place', 0.35);
            // Its cry, once it lands (it loads behind the menu: silent until then).
            if (scene.cache?.audio?.exists?.('mimic_cry')) SoundHelper.playSound(scene, 'mimic_cry', 0.55);
            scene.time.delayedCall(60, () => {
                if (!sprite.active || cardSystem.boardCards[spot.slot] !== card) return;
                if (scene.anims.exists('poof_empty_anim')) {
                    const poof = scene.add.sprite(sprite.x, sprite.y, 'poofEmpty')
                        .setDepth(sprite.depth + 10).setScale(sprite.scaleX);
                    const cleanup = () => poof.destroy();
                    sprite.once('destroy', cleanup);
                    poof.once('destroy', () => sprite.off('destroy', cleanup));
                    poof.play('poof_empty_anim');
                    poof.once('animationcomplete', () => poof.destroy());
                }
                SoundHelper.playSound(scene, 'empty_whoosh', 0.5);
                scene.createFloatingText?.(spot.x, spot.y - 30, t(scene, 'magic.summonMimic.appeared'), 0xfbad19);
            });
        },
    });
    SoundHelper.playSound(scene, 'magic_cast', 0.5);
    return true;
}
