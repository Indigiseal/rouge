// Defeat / victory result overlays for GameScene.
import { MusicManager } from '../audio/MusicManager.js';
import { isMetaProgressionDisabled } from '../config/TestOptions.js';

export function showDefeatFallback(scene, deathStats) {
    const depth = 12000;
    scene.add.rectangle(320, 180, 640, 360, 0x000000, 0.9)
        .setDepth(depth)
        .setInteractive();
    scene.add.text(320, 99, 'DEFEAT', {
        fontSize: '28px',
        fill: '#ffffff',
        fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5).setDepth(depth + 1);
    scene.add.text(320, 160, `Killed by ${deathStats.killedBy}\nReached Floor ${deathStats.floor}`, {
        fontSize: '16px',
        fill: '#d8d1d8',
        fontFamily: 'Arial, sans-serif',
        align: 'center'
    }).setOrigin(0.5).setDepth(depth + 1);
    scene.add.text(320, 245, 'Continue', {
        fontSize: '18px',
        fill: '#ffffff',
        backgroundColor: '#513c2c',
        padding: { x: 18, y: 10 },
        fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5).setDepth(depth + 1).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => scene.leaveSandboxOrMenu());
}

export function addResultPanel(scene, x, y, width, height, frame, depth) {
    const addNineSlice = scene.add.nineslice || scene.add.nineSlice;
    if (addNineSlice) {
        return addNineSlice.call(scene.add, x, y, 'resultPanels', frame, width, height, 12, 12, 12, 12)
            .setOrigin(0.5)
            .setDepth(depth);
    }

    return scene.add.image(x, y, 'resultPanels', frame)
        .setOrigin(0.5)
        .setDisplaySize(width, height)
        .setDepth(depth);
}

export function addResultButton(scene, x, y, label, onClick, depth) {
    const button = scene.add.image(x, y, 'nextTurnUp')
        .setOrigin(0.5)
        .setDepth(depth)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', onClick);

    scene.add.text(x, y - 1, label, {
        fontSize: '16px',
        fill: '#ffffff',
        fontFamily: '"HoMM Pixel", Arial, sans-serif'
    }).setOrigin(0.5).setDepth(depth + 1);

    return button;
}

export function showDefeatResult(scene, deathStats, xpResult) {
    const resultDepth = 11000;
    // Interactive (even with no handlers) so it swallows clicks and stops them
    // reaching buttons underneath, like a still-visible Next Floor button.
    scene.add.rectangle(320, 180, 640, 360, 0x000000, 0.78).setOrigin(0.5).setDepth(resultDepth).setInteractive();
    scene.add.image(320, 36, 'resultBanners', 0).setOrigin(0.5).setDepth(resultDepth + 2);
    scene.add.text(320, 31, 'DEFEAT', {
        fontSize: '24px',
        fill: '#948b9b',
        fontFamily: '"HoMM Pixel", Arial, sans-serif'
    }).setOrigin(0.5).setDepth(resultDepth + 3).setScale(1, 0.75);

    addResultPanel(scene, 320, 154, 304, 188, 0, resultDepth + 1);
    scene.add.text(320, 86, 'YOU HAVE FALLEN', {
        fontSize: '20px',
        fill: '#ffffff',
        fontFamily: '"HoMM Pixel", Arial, sans-serif'
    }).setOrigin(0.5).setDepth(resultDepth + 2);
    scene.add.text(320, 116, `Killed by ${deathStats.killedBy}`, {
        fontSize: '14px',
        fill: '#d8d1d8',
        fontFamily: '"HoMM Pixel", Arial, sans-serif'
    }).setOrigin(0.5).setDepth(resultDepth + 2);
    scene.add.text(320, 142, `Reached Floor ${deathStats.floor}`, {
        fontSize: '14px',
        fill: '#d8d1d8',
        fontFamily: '"HoMM Pixel", Arial, sans-serif'
    }).setOrigin(0.5).setDepth(resultDepth + 2);
    scene.add.text(320, 177, `Total Deaths: ${scene.metaManager?.totalDeaths ?? 0}`, {
        fontSize: '13px',
        fill: '#b8b0b8',
        fontFamily: '"HoMM Pixel", Arial, sans-serif'
    }).setOrigin(0.5).setDepth(resultDepth + 2);
    scene.add.text(320, 199, `Best Floor: ${scene.metaManager?.bestFloor ?? deathStats.floor}`, {
        fontSize: '13px',
        fill: '#b8b0b8',
        fontFamily: '"HoMM Pixel", Arial, sans-serif'
    }).setOrigin(0.5).setDepth(resultDepth + 2);

    addResultPanel(scene, 320, 262, 304, 78, 1, resultDepth + 1);
    const gained = xpResult?.xpGained ?? 0;
    const total = xpResult?.totalXp
        ?? scene.metaManager?.getCharacterXp?.(scene.gameState?.characterId) ?? 0;
    scene.add.text(320, 253, gained > 0 ? `+${gained} character XP` : 'No XP this run', {
        fontSize: '15px',
        fill: '#fed991',
        fontFamily: '"HoMM Pixel", Arial, sans-serif'
    }).setOrigin(0.5).setDepth(resultDepth + 2);
    scene.add.text(320, 279, `Spend it on talents before the next run. Total: ${total}`, {
        fontSize: '11px',
        fill: '#b8b0b8',
        fontFamily: '"HoMM Pixel", Arial, sans-serif',
        wordWrap: { width: 236 },
        align: 'center'
    }).setOrigin(0.5).setDepth(resultDepth + 2);

    addResultButton(scene, 320, 336, 'Continue', () => scene.leaveSandboxOrMenu(), resultDepth + 4);
}

export function addRelicIcon(scene, relic, x, y, depth) {
    scene.add.circle(x, y, 18, 0x2c1810, 0.75).setStrokeStyle(1, 0xfed991).setDepth(depth);
    const usesSheet = relic.iconSheet && scene.textures.exists(relic.iconSheet);
    if (usesSheet) {
        scene.add.image(x, y, relic.iconSheet, relic.iconFrame).setDepth(depth + 1);
    } else if (relic.icon && scene.textures.exists(relic.icon)) {
        scene.add.image(x, y, relic.icon).setDepth(depth + 1);
    }
}

export function createUnlockParticles(scene, depth = 11002) {
    for (let i = 0; i < 10; i++) {
        const particle = scene.add.circle(
            320 + Phaser.Math.Between(-50, 50),
            262 + Phaser.Math.Between(-20, 20),
            3,
            0xfed991
        ).setDepth(depth);

        scene.tweens.add({
            targets: particle,
            y: particle.y - 42,
            alpha: 0,
            duration: 1000,
            delay: i * 50,
            ease: 'Cubic.easeOut',
            onComplete: () => particle.destroy()
        });
    }
}

export function gameWon(scene) {
    scene.stopBossMusic();
    MusicManager.stop(scene, 700);
    scene.clearEnemyTurnTimers();

    let xpResult = null;
    if (!scene.sandboxMode && scene.metaManager && !isMetaProgressionDisabled()) {
        scene.metaManager.totalRuns = (scene.metaManager.totalRuns || 0) + 1;
        const floor = scene.gameState?.currentFloor ?? 45;
        if (floor > scene.metaManager.bestFloor) scene.metaManager.bestFloor = floor;
        xpResult = scene.metaManager.grantRunXp(scene.gameState?.characterId || 'rogue', floor);
        scene.saveManager?.clearCurrentRun?.();
    }

    const resultDepth = 11000;
    // Interactive (even with no handlers) so it swallows clicks and stops them
    // reaching buttons underneath, like a still-visible Next Floor button.
    scene.add.rectangle(320, 180, 640, 360, 0x000000, 0.78).setOrigin(0.5).setDepth(resultDepth).setInteractive();
    scene.add.image(320, 36, 'resultBanners', 1).setOrigin(0.5).setDepth(resultDepth + 2);
    scene.add.text(320, 32, 'VICTORY!', {
        fontSize: '24px',
        fill: '#fed991',
        fontFamily: '"HoMM Pixel", Arial, sans-serif'
    }).setOrigin(0.5).setDepth(resultDepth + 3).setScale(1, 0.75);

    addResultPanel(scene, 320, 160, 304, 200, 2, resultDepth + 1);
    scene.add.text(320, 110, 'The dungeon is conquered.', {
        fontSize: '20px',
        fill: '#ffffff',
        fontFamily: '"HoMM Pixel", Arial, sans-serif'
    }).setOrigin(0.5).setDepth(resultDepth + 2);
    scene.add.text(320, 156, scene.getVictoryStorySummary(), {
        fontSize: '11px',
        fill: '#5b3b26',
        fontFamily: '"HoMM Pixel", Arial, sans-serif',
        wordWrap: { width: 260 },
        align: 'center'
    }).setOrigin(0.5).setDepth(resultDepth + 2);

    addResultPanel(scene, 320, 262, 304, 78, 3, resultDepth + 1);
    const gained = xpResult?.xpGained ?? 0;
    const total = xpResult?.totalXp
        ?? scene.metaManager?.getCharacterXp?.(scene.gameState?.characterId) ?? 0;
    scene.add.text(320, 253, gained > 0 ? `+${gained} character XP` : `Stories: ${scene.getResolvedStoryCount()}/1`, {
        fontSize: '15px',
        fill: '#ffffff',
        fontFamily: '"HoMM Pixel", Arial, sans-serif'
    }).setOrigin(0.5).setDepth(resultDepth + 2);
    scene.add.text(320, 279, gained > 0
        ? `Talents persist. Total XP: ${total}`
        : 'Glory will have to do.', {
        fontSize: '11px',
        fill: '#5b3b26',
        fontFamily: '"HoMM Pixel", Arial, sans-serif',
        wordWrap: { width: 236 },
        align: 'center'
    }).setOrigin(0.5).setDepth(resultDepth + 2);

    // Victory ends the run: clear the saved run so it can't be "continued",
    // then return to the main menu instead of dropping straight into a new game.
    addResultButton(scene, 320, 336, scene.sandboxMode ? 'Test Polygon' : 'Main Menu', () => {
        if (!scene.sandboxMode) scene.saveManager?.clearCurrentRun();
        scene.leaveSandboxOrMenu();
    }, resultDepth + 4);
}

