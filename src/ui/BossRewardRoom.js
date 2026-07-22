// Boss reward room flow kept inside GameScene (roomType BOSS_REWARD for saves/Continue).
// Extracted here so GameScene stays thin; not a separate Phaser.Scene.

import { exitToSandboxHub } from '../sandbox/SandboxMode.js';

export function setupBossRewardRoom(scene) {
    scene.gameState.roomType = 'BOSS_REWARD';
    scene.roomType = 'BOSS_REWARD';
    scene.updateRoomTitle();

    // Full restore as the act boss bonus
    const healedHP = scene.gameState.maxHealth - scene.gameState.playerHealth;
    const refilledAP = scene.gameState.maxActions - scene.gameState.actionsLeft;
    scene.gameState.playerHealth = scene.gameState.maxHealth;
    scene.gameState.actionsLeft = scene.gameState.maxActions;
    if (healedHP > 0) {
        scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, `+${healedHP} HP`, 0x66ff88);
    }
    if (refilledAP > 0) {
        scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y + 14, `+${refilledAP} AP`, 0x66ddff);
    }

    // Currency reward — scales with floor
    const floor = scene.gameState.currentFloor;
    const coinBonus = 25 + floor;
    const crystalBonus = 4 + Math.floor(floor / 6);
    scene.gameState.coins += coinBonus;
    scene.gameState.crystals += crystalBonus;
    scene.createFloatingText(320, 140, `+${coinBonus} Coins  +${crystalBonus} Crystals`, 0xffd700);

    // Generate 3 reward items: amulet, weapon/armor (boss-quality), gem.
    // Quality is the "natural" boss-act tier, then run through capRewardRarity
    // so act-1 boss gives UNCOMMON (was rare), act-2 boss gives RARE (was epic),
    // and act-3 boss still gives LEGENDARY. Earned epics/legendaries are now
    // reserved for endgame instead of trivializing mid-run.
    const gen = scene.cardSystem.cardDataGenerator;
    const rawQuality = floor >= 31 ? 'legendary' : floor >= 16 ? 'epic' : 'rare';
    const quality = gen.capRewardRarity(rawQuality, floor);
    const items = [
        gen.createCardData('amulet', floor, false, scene.gameState, 'boss'),
        gen.createCardData(Math.random() < 0.5 ? 'weapon' : 'armor', floor, false, scene.gameState, quality),
        makeBossRewardGem(scene)
    ].filter(Boolean);

    // Spawn chest + reward cards on the existing board
    scene.cardSystem.spawnBossRewardBoard(items);

    // Re-enable the Next button so the player can leave when ready
    scene._transitioning = false;
    scene.enemiesCleared = true;
    scene.showNextFloorButton();

    scene.updateUI();
}

export function restoreSavedBossRewardRoom(scene) {
    scene.gameState.roomType = 'BOSS_REWARD';
    scene.roomType = 'BOSS_REWARD';
    scene.updateRoomTitle();

    const items = (scene._loadedBoardCards || [])
        .filter(card => card?.data)
        .map(card => card.data);
    scene.cardSystem.spawnBossRewardBoard(items);
    scene._loadedBoardCards = null;
    scene._transitioning = false;
    scene.enemiesCleared = true;
    scene.showNextFloorButton();
    scene.updateUI();
}

export function makeBossRewardGem(scene) {
    const gems = [
        { effect: 'fire',      name: 'Fire Gem',      frame: 0,  color: 0xff7040 },
        { effect: 'poison',    name: 'Poison Gem',    frame: 6,  color: 0x66ff66 },
        { effect: 'lightning', name: 'Lightning Gem', frame: 12, color: 0xffe066 }
    ];
    const gem = gems[Math.floor(Math.random() * gems.length)];
    return {
        type: 'gem',
        gemEffect: gem.effect,
        name: gem.name,
        sprite: 'gemsRGY',
        spriteFrame: gem.frame,
        color: gem.color,
        rarity: 'common'
    };
}

export function leaveBossRewardRoom(scene) {
    scene._transitioning = true;
    if (scene.nextFloorButton) {
        scene.nextFloorButton.disableInteractive();
        scene.nextFloorButton.setVisible(false);
    }
    scene.nextFloorButtonText?.setVisible(false);

    // Clean up the chest visual
    scene.cardSystem?.clearBossRewardChest?.();

    if (scene.sandboxMode) {
        scene.time.delayedCall(300, () => exitToSandboxHub(scene));
        return;
    }

    // Advance to next act now that the player is done picking
    scene.gameState.currentFloor++;
    const nextAct = Math.floor((scene.gameState.currentFloor - 1) / 15) + 1;
    scene.upgradeCompanionsForNextAct(nextAct);
    scene.gameState.mapCursor = { act: nextAct, floor: 0, node: 0 };
    const nextActMap = scene.gameState.dungeonMap?.[`act${nextAct}`];
    if (nextActMap?.floors?.[0]?.[0]) {
        nextActMap.floors[0][0].visited = true;
    }
    scene.createFloatingText(320, 120, `Act ${nextAct}`, 0xf2d3aa);

    // Reset roomType so MapViewScene can set the next node's type
    scene.gameState.roomType = 'COMBAT';

    // Queue a post-act shop: player gets to visit a shop before the new act begins.
    // 35% chance of a Rare Shop, otherwise a normal Shop.
    scene.gameState.pendingActShop = Math.random() < 0.35 ? 'RARE_SHOP' : 'SHOP';

    scene.saveCurrentRun();

    scene.time.delayedCall(500, () => {
        scene.scene.sleep();
        scene.scene.stop('MapViewScene');
        scene.scene.launch('MapViewScene', { gameState: scene.gameState });
    });
}

