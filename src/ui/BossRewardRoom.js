// Boss reward room flow kept inside GameScene (roomType BOSS_REWARD for saves/Continue).
// Extracted here so GameScene stays thin; not a separate Phaser.Scene.

import { exitToSandboxHub } from '../sandbox/SandboxMode.js';
import { scaleGoldReward } from '../content/economy/gold.js';
import { looseGemCard } from '../content/cards/gems.js';
import { isLocationDoorTexture } from '../content/assets/locationCards.js';
import { EXIT_DOOR_Y } from './ExitDoor.js';
import { setHoverLight } from './HoverLight.js';
import { companionPowerUpDuration } from './CompanionPowerUp.js';

// `onRewardsShown` runs once the reward cards are on the board (after the
// companions' swirl, when there is one): a save there keeps the cards.
export function setupBossRewardRoom(scene, { onRewardsShown = null } = {}) {
    scene._bossVictoryPending = false;
    scene.gameState.roomType = 'BOSS_REWARD';
    scene.roomType = 'BOSS_REWARD';
    scene.updateRoomTitle();
    // The fight's log stays up here: the companions' attack gains go in it.
    scene.refreshCombatLogVisibility?.();

    // Full restore as the act boss bonus
    const healedHP = scene.gameState.maxHealth - scene.gameState.playerHealth;
    const refilledAP = scene.gameState.maxActions - scene.gameState.actionsLeft;
    const apBefore = scene.gameState.actionsLeft;
    scene.gameState.playerHealth = scene.gameState.maxHealth;
    scene.gameState.actionsLeft = scene.gameState.maxActions;
    scene.playActionPointGain?.(apBefore, scene.gameState.actionsLeft);
    if (healedHP > 0) {
        scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y, `+${healedHP} HP`, 0x4a884f);
    }
    if (refilledAP > 0) {
        scene.createFloatingText(scene.playerAvatar.x, scene.playerAvatar.y + 14, `+${refilledAP} AP`, 0x71b1ae);
    }

    // Currency reward — scales with floor
    const floor = scene.gameState.currentFloor;
    const coinBonus = scaleGoldReward(25 + floor);
    const crystalBonus = 4 + Math.floor(floor / 6);
    scene.gameState.coins += coinBonus;
    scene.gameState.crystals += crystalBonus;
    scene.createFloatingText(320, 140, `+${coinBonus} Coins  +${crystalBonus} Crystals`, 0xfbad19);
    scene.playCurrencyGainFlight?.(320, 140, 'coins');
    scene.time?.delayedCall?.(120, () => scene.playCurrencyGainFlight?.(320, 140, 'crystals'));

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

    // The companions grow first (+1 attack for the act ahead, a golden swirl on
    // each card, ui/CompanionPowerUp.js), then the reward is offered (Taya).
    const nextAct = Math.floor(floor / 15) + 1;
    const grown = scene.upgradeCompanionsForNextAct(nextAct, { celebrate: true });
    const offerReward = () => {
        if (!scene.sys?.isActive?.() && !scene.sys?.isPaused?.()) return;
        // Spawn chest + reward cards on the existing board
        scene.cardSystem.spawnBossRewardBoard(items);

        // Re-enable the Next button so the player can leave when ready
        scene._transitioning = false;
        scene.enemiesCleared = true;
        scene.showNextFloorButton();

        scene.updateUI();
        onRewardsShown?.();
    };
    if (grown > 0) scene.time.delayedCall(companionPowerUpDuration(grown), offerReward);
    else offerReward();
}

export function restoreSavedBossRewardRoom(scene) {
    scene._bossVictoryPending = false;
    scene.gameState.roomType = 'BOSS_REWARD';
    scene.roomType = 'BOSS_REWARD';
    scene.updateRoomTitle();
    scene.refreshCombatLogVisibility?.();

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
        { effect: 'fire',      name: 'Fire Gem',      frame: 0,  color: 0xef7c4b },
        { effect: 'poison',    name: 'Poison Gem',    frame: 6,  color: 0x71800b },
        { effect: 'lightning', name: 'Lightning Gem', frame: 12, color: 0xffcf7f }
    ];
    const gem = gems[Math.floor(Math.random() * gems.length)];
    return {
        ...looseGemCard(gem)
    };
}

export function leaveBossRewardRoom(scene) {
    scene._transitioning = true;
    if (scene.nextFloorButton) {
        const button = scene.nextFloorButton;
        button.disableInteractive();
        if (isLocationDoorTexture(button.texture?.key)) {
            button.clearTint();
            setHoverLight(button, false);
            button.y = EXIT_DOOR_Y;
        } else {
            button.setVisible(false);
        }
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
    // Already done (with its swirl) when the room opened; this only catches up
    // a save made in the reward room before that existed.
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
        // MapView owns the inter-act sequence. It consumes pendingActShop
        // first, then opens LocationPick; bypassing it here left the shop queued
        // until after the new act's opening fight.
        scene.scene.launch('MapViewScene', { gameState: scene.gameState });
    });
}
