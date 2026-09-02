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
import { SandboxStoryScene } from '../scenes/SandboxStoryScene.js';
import { CharacterSelectScene } from '../scenes/CharacterSelectScene.js';
import { TalentTreeScene } from '../scenes/TalentTreeScene.js';
import { ArmorerPickScene } from '../scenes/ArmorerPickScene.js';
import { WORLD_WIDTH, WORLD_HEIGHT, PIXEL_SCALE } from './renderScale.js';

/** @param {typeof Phaser} Phaser */
export function createGameConfig(Phaser) {
  return {
    type: Phaser.AUTO,
    width: WORLD_WIDTH * PIXEL_SCALE,
    height: WORLD_HEIGHT * PIXEL_SCALE,
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
      SandboxStoryScene,
      CharacterSelectScene,
      TalentTreeScene,
      ArmorerPickScene,
    ],
    scale: {
      mode: Phaser.Scale.NONE,
      // NOT CENTER_BOTH. #phaser-game-container is a flex box that already
      // centres the canvas; CENTER_BOTH then adds its own margin-left on top,
      // and a flex box counts that margin when it centres — so the canvas ended
      // up pushed right by half the margin. Centring is the page's job here.
      autoCenter: Phaser.Scale.NO_CENTER,
      // 1, not 2. The canvas is already full size; the camera does the scaling.
      zoom: 1,
    },
    callbacks: {
      // Every scene writes 640x360 coordinates, so every scene's camera has to
      // zoom by PIXEL_SCALE and look at the middle of that space. Done here
      // rather than in sixteen create() methods so a new scene cannot forget it.
      //
      // Re-applied on START because a scene restart rebuilds its cameras and
      // would otherwise come back at zoom 1, showing the world in the top-left
      // quarter of the screen.
      postBoot: (game) => {
        const focus = (scene) => {
          const cam = scene.cameras?.main;
          if (!cam) return;
          cam.setZoom(PIXEL_SCALE);
          cam.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
        };
        // Literal event names rather than Phaser.Scenes.Events.*: if that
        // constant were ever undefined the listener would attach to nothing and
        // fail silently, and the symptom (a scene rendering in the top-left
        // quarter only after a restart) would be baffling.
        game.scene.scenes.forEach((scene) => {
          scene.sys.events.on('start', () => focus(scene));
          scene.sys.events.on('ready', () => focus(scene));
          focus(scene);
        });
      },
    },
  };
}
