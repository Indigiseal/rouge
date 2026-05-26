// main.js
import Phaser from 'phaser';
import { PreloadScene } from './scenes/PreloadScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { GameScene } from './gameScene.js';
import { MapViewScene } from './scenes/MapViewScene.js'; // REMOVE InterFloorScene
import { RestScene } from './scenes/RestScene.js';
import { AnvilScene } from './scenes/AnvilScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { RareShopScene } from './scenes/RareShopScene.js';
import { PauseMenuScene } from './scenes/PauseMenuScene.js';
import { DeathRewardScene } from './scenes/DeathRewardScene.js';
import { EventScene } from './scenes/EventScene.js';
import { TreasureScene } from './scenes/TreasureScene.js';

const config = {
    type: Phaser.AUTO,
    width: 640,
    height: 360,
    parent: 'phaser-game-container',
    backgroundColor: '#2c1810',
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    antialiasGL: false,
    render: {
        pixelArt: true,
        antialias: false,
        antialiasGL: false,
        roundPixels: true
    },
    scene: [
        PreloadScene,
        MainMenuScene,
        GameScene, 
        MapViewScene, 
        RestScene, 
        AnvilScene, 
        ShopScene, 
        RareShopScene,
        PauseMenuScene,
        DeathRewardScene,
        EventScene,
        TreasureScene
    ],
    scale: {
        mode: Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        zoom: 2
    }
};

if (document.fonts?.load) {
    await document.fonts.load('12px "HoMM Pixel"');
}

new Phaser.Game(config);
