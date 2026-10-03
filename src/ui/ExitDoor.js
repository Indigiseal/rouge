// ui/ExitDoor.js
// The way out of a room: the location's open door, top right.
//
// Fights already left through this door; the shops, treasure, anvil, rest
// and event rooms each had their own plate instead ("Next" in the shops,
// "Leave" or "Continue" elsewhere, the anvil and rest one bottom-right). Every room now leaves
// the same way, from the same spot, so the player always knows where the exit
// is. A location with no door art drawn returns null and the caller keeps its
// plate.

import { SoundHelper } from '../audio/SoundHelper.js';
import { ensureDoorOpenAnim, locationDoorArt } from '../content/assets/locationCards.js';
import { getLocationIdForFloor } from '../content/locations/index.js';
import { setHoverLight } from './HoverLight.js';

// Where every exit stands. GameScene's fight door and CombatHud's exit read
// these too. y 40 (was 50): the door sits 10px higher, in every room.
export const EXIT_DOOR_X = 560;
export const EXIT_DOOR_Y = 40;

/**
 * @param {Phaser.Scene} scene
 * @param {() => void} onClick  runs once, on the press
 * @param {{ gameState?: object, depth?: number, shut?: boolean }} [opts]
 *   `shut`: start closed and unclickable, for a room the player cannot leave
 *   yet (an event before its choice resolves). Call `door.openExit()` when
 *   they can: the door swings open (or shows open, on paths.png) with the
 *   door sound, and becomes the way out.
 * @returns {Phaser.GameObjects.Sprite | null} null when this location has no door art
 */
export function createExitDoor(scene, onClick, opts = {}) {
    const { gameState = scene.gameState, depth = 50, shut = false } = opts;
    if (!gameState) return null;
    // Open by default: a shop or rest room was entered through this door. An
    // animated door (Boneflood and friends) shows its last frame.
    const art = locationDoorArt(scene, getLocationIdForFloor(gameState));
    if (!art) return null;

    // A sprite so an animated door can swing open in place.
    const door = scene.add.sprite(EXIT_DOOR_X, EXIT_DOOR_Y, art.key, shut ? art.shut : art.open)
        .setDepth(depth);

    const rest = () => {
        door.clearTint();
        setHoverLight(door, false);
        door.y = EXIT_DOOR_Y;
    };

    door.on('pointerover', () => {
        SoundHelper.playVariant(scene, 'hover_button', 0.4);
        setHoverLight(door, true);
    });
    door.on('pointerout', rest);
    door.on('pointerdown', () => {
        SoundHelper.playVariant(scene, 'button_click', 0.5);
        // The door stays where it is once used — the player walks through it,
        // it does not vanish — but it cannot be used twice. Disabling input
        // also swallows the pointerup/out that would undo the press, so the
        // press is undone here.
        door.disableInteractive();
        rest();
        onClick?.();
    });

    let opened = !shut;
    door.openExit = () => {
        if (opened || !door.scene) return;
        opened = true;
        const anim = ensureDoorOpenAnim(scene, art);
        if (anim) door.play(anim);
        else door.setFrame(art.open);
        SoundHelper.playSound(scene, 'door_open', 0.6);
        door.setInteractive({ useHandCursor: true });
    };
    if (opened) door.setInteractive({ useHandCursor: true });

    return door;
}
