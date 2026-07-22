import { PreloadScene } from '../scenes/PreloadScene.js';
import { MainMenuScene } from '../scenes/MainMenuScene.js';
import { GameScene } from '../scenes/GameScene.js';
import { MapViewScene } from '../scenes/MapViewScene.js';
import { RestScene } from '../scenes/RestScene.js';
import { AnvilScene } from '../scenes/AnvilScene.js';
import { ShopScene } from '../scenes/ShopScene.js';
import { RareShopScene } from '../scenes/RareShopScene.js';
import { PauseMenuScene } from '../scenes/PauseMenuScene.js';
import { EventScene } from '../scenes/EventScene.js';
import { TreasureScene } from '../scenes/TreasureScene.js';
import { SandboxHubScene } from '../scenes/SandboxHubScene.js';
import { CharacterSelectScene } from '../scenes/CharacterSelectScene.js';
import { TalentTreeScene } from '../scenes/TalentTreeScene.js';
import { ArmorerPickScene } from '../scenes/ArmorerPickScene.js';

/** @param {typeof Phaser} Phaser */
export function createGameConfig(Phaser) {
  return {
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
      roundPixels: true,
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
      EventScene,
      TreasureScene,
      SandboxHubScene,
      CharacterSelectScene,
      TalentTreeScene,
      ArmorerPickScene,
    ],
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      zoom: 2,
    },
  };
}
