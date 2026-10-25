// Central asset load list for PreloadScene.
// Paths resolve from site root (assets/...).
// type: 'image' | 'spritesheet' | 'atlas' | 'audio' | 'bitmapFont'

/** @typedef {{ key: string, path: string, type: 'image'|'spritesheet'|'audio'|'bitmapFont', frameWidth?: number, frameHeight?: number, xmlPath?: string }} AssetEntry */

import { ENEMY_DEATH_SOUND_ASSETS } from '../audio/enemyDeathSounds.js';
import { BOSS_SOUND_ASSETS } from '../audio/bossSounds.js';
import { ITEM_SHEETS } from './itemSheets.js';
import { ARMOR_EQUIP_SOUND_ASSETS } from '../audio/armorSounds.js';
import { PACKED_SHEETS } from './packedSprites.js';
import { SIGIL_ICONS_NEW_SHEET } from '../sigils/sigils.js';
import { LOCATION_CARD_BACK_SHEET } from './locationCardArt.js';
import { BOSS_ATTACK_FRAME_FILES } from '../cards/bossAttackFrames.js';

/** @type {AssetEntry[]} */
export const ASSET_MANIFEST = [
    // Weapon and armor card art: two sprite sheets, cut back into one texture
    // per item (sword_C, chain_L...) at boot (content/assets/itemSheets.js).
    ...ITEM_SHEETS.map((sheet) => ({ ...sheet, type: 'atlas' })),
    { key: 'stoneFloor', path: 'assets/art/dungeon.png', type: 'image' },
    // Each location's room painting and boards are not here: a run loads its current
    // location's set (content/assets/locationAssets.js).
    { key: 'cardBack', path: 'assets/art/cardBack.png', type: 'image' },
    // Loose card-sized sprites, the fireball frames, the banners and the small UI pieces, packed into sheets
    // (tools/pack-sprites.py); buildPackedSprites cuts each back into its own key at boot.
    ...PACKED_SHEETS.map(({ key, path, frameWidth, frameHeight }) => ({ key, path, frameWidth, frameHeight, type: 'spritesheet' })),
    // Each location's own face-down back, one frame each (content/assets/locationCardArt.js).
    { ...LOCATION_CARD_BACK_SHEET, type: 'spritesheet' },
    { key: 'panelCards', path: 'assets/art/panelCards.png', type: 'image' },
    { key: 'gamingBoard', path: 'assets/art/gamingBoard.png', type: 'image' },
    { key: 'gamingBoard2', path: 'assets/art/gamingBoard2.png', type: 'image' },
    { key: 'rareShopBoard', path: 'assets/art/rareShopBoard.png', type: 'image' },
    { key: 'gamingBoardSideExtra', path: 'assets/art/gamingBoardSIdewaysExtra.png', type: 'image' },
    { key: 'gamingBoardSideSmall', path: 'assets/art/gamingBoardSIdewaysSmall.png', type: 'spritesheet', frameWidth: 208, frameHeight: 144 },
    // Location boards (content/locations/boardArt.js): the Tollroad's goblin planks.
    // Frame order: 0 rogue, 1 warrior — matches CHARACTER_PORTRAIT_FRAME.
    { key: 'characterPortraits', path: 'assets/art/portraits.png', type: 'spritesheet', frameWidth: 64, frameHeight: 64 },
    // Frame order: rest floor, defeat UI, victory UI, blacksmith floor.
    { key: 'restRooms', path: 'assets/art/rest.png', type: 'spritesheet', frameWidth: 144, frameHeight: 122 },
    // Full-screen art for the rest room: cave, fire, cooking pot, shrine.
    { key: 'restFire', path: 'assets/art/restFire.png', type: 'image' },
    // Frame order: defeat info, defeat detail, victory info, victory detail.
    { key: 'resultPanels', path: 'assets/art/defeatWin9x9panels.png', type: 'spritesheet', frameWidth: 96, frameHeight: 96 },
    { key: 'resultBanners', path: 'assets/art/bannerLostWin.png', type: 'spritesheet', frameWidth: 160, frameHeight: 32 },
    { key: 'eventPaper9Slice', path: 'assets/art/paper9Slice.png', type: 'image' },
    // Hover-tooltip frame. 48x48 with a 5px border on three sides and a taller
    // 7px decorative bottom edge — see TOOLTIP_PANEL_SLICE in ui/NineSlicePanel.js.
    // Top-left selection bracket; mirrored on both axes to make all 4 corners.

    // Shared minigame chrome, in assets/ui/ rather than assets/art/ because it
    // is window furniture rather than anything the game world contains.
    //
    // uiPanelDark and uiBar are both sliced at runtime and drawn at whatever
    // size the window needs — see ui/NineSlicePanel.js for the insets. The
    // banner is not sliced: its ribbon carries painted highlights and drawn
    // tails, so it rides at its authored 256px and the title sits on top.

    // Full-screen light sheet, laid over the finished frame in Aseprite's
    // Overlay mode by ui/OverlayLightPipeline.js. Authored at the world size
    // (640x360) so it maps 1:1 onto the world and scales with everything else.
    { key: 'overLight', path: 'assets/ui/overLight.png', type: 'image' },
    // Choose Your Road's own light sheet, same Overlay blend.
    { key: 'pathOverlayLight', path: 'assets/ui/pathOverlayLight.png', type: 'image' },
    // The panel painted into the foot of dungeon.png, as its own 640x100 piece,
    // laid under the inventory during events (GameScene.setEventBackdrop).
    { key: 'panelUnderInventory', path: 'assets/ui/panelUnderInventory.png', type: 'image' },

    // Village screen. Four painted layers stacked back to front (wood board,
    // metal plate, lower wood rail, thorns), then the ribbon, the slate name
    // plate and the footer button. Sizes are deliberately larger than the
    // 640x360 screen where the art runs off the bottom edge — see VillageScene.
    { key: 'villageBoardWood', path: 'assets/ui/boardWoodVillage.png', type: 'image' },
    { key: 'villageBoardMetal', path: 'assets/ui/boardMetalVillage.png', type: 'image' },
    { key: 'villageBoardWood2', path: 'assets/ui/boardWoodVillage2.png', type: 'image' },
    { key: 'villageThorn', path: 'assets/ui/villageThorn.png', type: 'image' },

    // Six building cards, drawn card-sized so they can use the board's own
    // hover and flip sheets. Frame order matches VILLAGE_FRAME in VillageScene.
    { key: 'villageBuildings', path: 'assets/art/buildings.png', type: 'spritesheet', frameWidth: 52, frameHeight: 70 },

    // The plain (non-location) hover shine and flip sheets, 5 frames each.
    // The board uses the "All" variants; the village wants the base pair.
    { key: 'villageCardHover', path: 'assets/art/cardHover52x72Sheet.png', type: 'spritesheet', frameWidth: 52, frameHeight: 72 },
    { key: 'villageCardFlip', path: 'assets/art/cardFlip54x86Sheet.png', type: 'spritesheet', frameWidth: 54, frameHeight: 86 },
    { key: 'eventsShops', path: 'assets/art/eventsShops80x80.png', type: 'spritesheet', frameWidth: 80, frameHeight: 80 },
    { key: 'rareShopSeller', path: 'assets/art/rareShopSeller.png', type: 'image' },
    // Arm Wrestling minigame art (human vs ogre locked hands).
    { key: 'armWrestlingHands', path: 'assets/art/armWrestlingHands.png', type: 'image' },
    // Nest raid minigame. 12 frames of 32x32: frame 0 is the brass cog the
    // player is digging for, frames 1-11 are the junk buried over it — see
    // NEST_JUNK_FRAMES in ui/BirdNestMinigame.js.
    // The bowl the whole thing sits in. Its pebbled floor is an ellipse about
    // 150x96 centred 3px below the image's middle; NEST_FLOOR in the minigame
    // is that measurement, and every piece is placed inside it.
    { key: 'nestBowl', path: 'assets/art/nest.png', type: 'image' },
    // The bird that keeps passing over the nest, seen from below. Drawn facing
    // UP at rest, so the minigame rotates it to the heading it is flying. The
    // art carries its own 52% alpha — it is already a shadow, so nothing should
    // dim it further.
    { key: 'shadowBird', path: 'assets/art/shadowBird.png', type: 'image' },
    { key: 'nestMiniGame', path: 'assets/art/nestMiniGame.png', type: 'spritesheet', frameWidth: 32, frameHeight: 32 },
    // The other prize, drawn larger than a junk piece because it is the thing
    // the whole nest is built around.
    { key: 'eggMiniGame', path: 'assets/art/eggMiniGame.png', type: 'image' },
    { key: 'musicBoxLockWafers', path: 'assets/art/musicBoxLockWafers.png', type: 'spritesheet', frameWidth: 58, frameHeight: 72 },
    // The movement itself — disc, pinned barrel, comb and gears. Shown on the
    // lock minigame's brief, where the wafers beside it are those same parts.
    { key: 'musicBoxOpen', path: 'assets/art/musicBoxOpen.png', type: 'image' },
    { key: 'statueHead', path: 'assets/art/statueHead.png', type: 'image' },
    { key: 'panelArmor', path: 'assets/art/panelArmor.png', type: 'image' },
    { key: 'anvilDropAnim', path: 'assets/art/anvilDropAnim.png', type: 'spritesheet', frameWidth: 69, frameHeight: 89 },
    { key: 'anvilClankAnim', path: 'assets/art/anvilClanckAnim80x86.png', type: 'spritesheet', frameWidth: 80, frameHeight: 86 },
    // The rest room's title ribbon — same 262x48 shape as the anvil's, so both
    // rooms put their name in the same place.
    { key: 'anvilIllustration', path: 'assets/art/anvil1.png', type: 'image' },
    // Silkslinger's web, two 60x78 frames: 0 the silk over a webbed bag card,
    // 1 the web in flight as it is thrown (CombatTurnController.applyWebHand).
    // Soul Drain: the soul leaving the enemy for the hero, five 48x48 frames
    // looping as it flies, drawn head to the left, tail trailing right
    // (InventoryCombatUse.createSoulDrainEffect).
    { key: 'soulWisp', path: 'assets/art/soulAnim.png', type: 'spritesheet', frameWidth: 48, frameHeight: 48 },
    // Ink Wraith's lock on a bag card, two 48x32 frames like the web's:
    // 0 the ink left on the card, 1 the blob in flight
    // (content/combat/handLock.js).
    { key: 'inkBlob', path: 'assets/art/inkBlob.png', type: 'spritesheet', frameWidth: 48, frameHeight: 32 },
    { key: 'webCardOverlay', path: 'assets/art/web.png', type: 'spritesheet', frameWidth: 60, frameHeight: 78 },
    // Little banner behind each shop item's price (32x18)
    // Dedicated crisp 16px title font (rasterized 1-bit from Able5.ttf).
    // Tutorial coach-mark pointer (16x16 cursor-style arrow).
    // Load item sprites
    // Load Uncommon / Rare / Epic / Legendary item sprites
    // Silk Cache cocoon shell. Loading this under the key ensureSilkCocoonTexture
    // uses means the drawn-in-code placeholder in CocoonCacheBoard.js never runs.
    // Cocoon cracking open: 7 frames, played once between the damaging hit and
    // whatever was inside appearing. Slightly taller than a card on purpose.
    { key: 'cocoonAnim', path: 'assets/art/cocoonAnim.png', type: 'spritesheet', frameWidth: 54, frameHeight: 78 },
    // Enemy trait icons, 176x32 laid out as a 16x16 grid: 11 columns, 2 rows.
    // The three tall icons in the first columns are drawn across both rows.
    { key: 'enemyIcons', path: 'assets/art/enemyIcons.png', type: 'spritesheet', frameWidth: 16, frameHeight: 16 },
    // The sigils' flat coloured icons (content/sigils/sigils.js).
    { ...SIGIL_ICONS_NEW_SHEET, type: 'spritesheet' },
    // Coins, potions, food, key and crystals in three rarities, plus the card
    // face they sit on. Composited into per-card textures at boot — see
    // content/assets/resourceCards.js.
    { key: 'resourceCards', path: 'assets/art/resourcesSpriteSheet.png', type: 'spritesheet', frameWidth: 52, frameHeight: 70 },
    // One row per month: five enemies then three card faces (normal, veteran,
    // elite). Composited with the icon strip at boot — see assets/enemyCards.js.
    { key: 'enemyCards', path: 'assets/art/enemiesSpriteSheet.png', type: 'spritesheet', frameWidth: 52, frameHeight: 70 },
    { key: 'carnivalTray', path: 'assets/art/tray.png', type: 'image' },
    { key: 'wizardTray', path: 'assets/art/trayWizard.png', type: 'image' },
    { key: 'luckyClover', path: 'assets/art/clover.png', type: 'spritesheet', frameWidth: 53, frameHeight: 70 },
    { key: 'mapNodes', path: 'assets/art/mapNodes42x42.png', type: 'spritesheet', frameWidth: 42, frameHeight: 42 },
    // Fog of war over the map (the HoMM in Pixel Art fog atlas; map/MapFog.js).
    { key: 'mapFog', path: 'assets/art/mapFog.png', type: 'spritesheet', frameWidth: 32, frameHeight: 32 },
    // A gem's size IS its level: 5 tiers across, 3 colours down — see
    // gemTierFrame in content/cards/gems.js.
    { key: 'gemsTiered', path: 'assets/art/gemsTiered.png', type: 'spritesheet', frameWidth: 18, frameHeight: 18 },
    // The socket a gem sets into: shown empty on cards that could take a
    // dragged gem, and drawn under the gem once one is set.
    // 7-frame shine that sweeps across a gem on hover, masked to its silhouette.
    { key: 'gemLightAnim', path: 'assets/art/gemLightAnim.png', type: 'spritesheet', frameWidth: 18, frameHeight: 18 },
    // Enemy role marker: frame 0 = melee, frame 1 = ranged | 'enemyCardType' sprite sheet was the old melee/ranged/poison badge | overlay. The new enemy art bakes those icons into the cards, and | HP / ATK now render as corner numbers, so we no longer load it.
    { key: 'gemEffectsOnCards', path: 'assets/art/gemEffectsOnCards64x80.png', type: 'spritesheet', frameWidth: 64, frameHeight: 80 },
    { key: 'enemiesHitEffects', path: 'assets/art/enemiesHitEffects64x80.png', type: 'spritesheet', frameWidth: 64, frameHeight: 80 },
    { key: 'shadowsGems', path: 'assets/art/shadowsGems.png', type: 'spritesheet', frameWidth: 16, frameHeight: 20 },
    // player_hurt now rotates through 3 male-hurt variants (loaded in the SFX batch below)
    { key: 'item_discard_1', path: 'assets/music/Card_Discard_01.mp3', type: 'audio' },
    // The Cure (Antidote) drunk: a gulp and a clean shimmer (ElevenLabs events poison_cure 1).
    { key: 'poison_cure', path: 'assets/music/Poison_Cure_01.mp3', type: 'audio' },
    // The map's fog drawing back as it opens: a soft poof (ElevenLabs events fog_poof 4, 5).
    { key: 'fog_poof_1', path: 'assets/music/Fog_Poof_01.mp3', type: 'audio' },
    { key: 'fog_poof_2', path: 'assets/music/Fog_Poof_02.mp3', type: 'audio' },
    { key: 'item_discard_2', path: 'assets/music/Card_Discard_02.mp3', type: 'audio' },
    { key: 'trap_spring', path: 'assets/music/trap_spring1.mp3', type: 'audio' },
    { key: 'trap_woosh', path: 'assets/music/fast-woosh-230497.mp3', type: 'audio' },
    { key: 'armor_equip', path: 'assets/music/metal_clank.mp3', type: 'audio' },
    // Raising a block (a block weapon dropped on the hero): two takes that rotate.
    { key: 'block_ready_1', path: 'assets/music/Block_Ready_01.mp3', type: 'audio' },
    { key: 'block_ready_2', path: 'assets/music/Block_Ready_02.mp3', type: 'audio' },
    { key: 'crystal_collect', path: 'assets/music/crystal_pick_up.mp3', type: 'audio' },
    // Main menu
    { key: 'mainBG', path: 'assets/art/mainBG.png', type: 'image' },
    // Path choice
    { key: 'pathsBackground', path: 'assets/art/pathsBackground.png', type: 'image' },
    { key: 'pathsBackgroundLight', path: 'assets/art/pathsBackgroundLight.png', type: 'image' },
    // Food
    // New Cards
    { key: 'amulet', path: 'assets/art/amulet.png', type: 'image' },
    { key: 'relicsOthers', path: 'assets/art/relicsOthers.png', type: 'spritesheet', frameWidth: 32, frameHeight: 32 },
    // Tactician's Pin stuck in the face-down enemy it marked (BoardCombat's
    // syncControlMarkers): the pin's head, needle and shadow, 22x34.
    { key: 'tacticianPin', path: 'assets/art/pin.png', type: 'image' },
    // The pin redrawn at 28px tall for the equipped-amulet strip (hudAmuletTexture picks "<key>Small").
    { key: 'tacticianPinSmall', path: 'assets/art/pinSmall.png', type: 'image' },
    // The same sheet redrawn at 28px, same 12x7 layout so frame numbers carry
    // over. Only for equipped amulets in the battle HUD's corner strip.
    { key: 'relicsOthersSmall', path: 'assets/art/relicsOthersSmall.png', type: 'spritesheet', frameWidth: 28, frameHeight: 28 },
    // Amulets with their own icon file (PixelLab, the crystal spider stories),
    // each with a 28px copy for the battle HUD: "<key>Small".
    { key: 'spiderCrystalShardIcon', path: 'assets/art/spiderCrystalShardIcon.png', type: 'spritesheet', frameWidth: 32, frameHeight: 32 },
    { key: 'spiderCrystalShardIconSmall', path: 'assets/art/spiderCrystalShardIconSmall.png', type: 'spritesheet', frameWidth: 28, frameHeight: 28 },
    { key: 'crystalSpiderlingIcon', path: 'assets/art/crystalSpiderlingIcon.png', type: 'spritesheet', frameWidth: 32, frameHeight: 32 },
    { key: 'crystalSpiderlingIconSmall', path: 'assets/art/crystalSpiderlingIconSmall.png', type: 'spritesheet', frameWidth: 28, frameHeight: 28 },
    // Load flip animation frames
    // Per-location card art: 5 columns by 7 rows, one row per location in the
    // same order as enemiesSpriteSheet. See content/assets/locationCardArt.js,
    // which also cuts each location's resting card back out of flip column 0.
    { key: 'cardFlipSheet', path: 'assets/art/cardFlip54x86SheetAll.png', type: 'spritesheet', frameWidth: 54, frameHeight: 86 },
    { key: 'cardHoverSheet', path: 'assets/art/cardHover52x72SheetAll.png', type: 'spritesheet', frameWidth: 52, frameHeight: 72 },
    // The standard flip and hover (a room with no location resolved, or a
    // location whose row is not drawn yet) play off villageCardFlip and
    // villageCardHover above: the same five frames the old single images held.
    { key: 'discardSprite', path: 'assets/art/discard.png', type: 'image' },
    // Card hover when in inventory effects (5 frames, 54x70 each)
    { key: 'hoverCardsUpSheet', path: 'assets/art/hoverCardsUp54x70Sheet.png', type: 'spritesheet', frameWidth: 54, frameHeight: 70 },
    // Card disappear dissolve (6 frames, 54x70 each) â€” plays on top of a card | as it is removed (enemy defeated, weapon pips spent).
    { key: 'cardDisappearSheet', path: 'assets/art/cardDissappearAnimation54x70.png', type: 'spritesheet', frameWidth: 54, frameHeight: 70 },
    // Taya's dedicated dissolve for the PLAYER's cards — a weapon, armor or
    // thorns card that spent its last pip. Played exactly like the enemy death
    // above; only the frames differ.
    { key: 'cardBreakSheet', path: 'assets/art/cardDissappear2Animation54x70.png', type: 'spritesheet', frameWidth: 54, frameHeight: 70 },
    // A slash arc played over the player's weapon card as it strikes (4 frames).
    { key: 'playerAttackAnim', path: 'assets/art/playerAttackAnim.png', type: 'spritesheet', frameWidth: 54, frameHeight: 70 },
    // Card merge flicker (2 frames, 54x70 each) â€” plays on top of the merged | card. `mergeLegendarySheet` is the legendary-tier variant.
    { key: 'mergeSheet', path: 'assets/art/merge.png', type: 'spritesheet', frameWidth: 54, frameHeight: 70 },
    { key: 'mergeLegendarySheet', path: 'assets/art/mergeLegendary.png', type: 'spritesheet', frameWidth: 54, frameHeight: 70 },
    // Empty card poof effect (4 frames, 32x48 each)
    { key: 'poofEmpty', path: 'assets/art/poofEmpty32x48frames.png', type: 'spritesheet', frameWidth: 32, frameHeight: 48 },
    // Poison status indicator (5 frames, 16x32 each) â€” shown on poisoned enemies/hero
    { key: 'poisonedStatus', path: 'assets/art/poisonedStatus.png', type: 'spritesheet', frameWidth: 16, frameHeight: 32 },
    // Shock marker (6 frames, 16x32 each), positioned like poisonedStatus.
    { key: 'shockedStatus', path: 'assets/art/shockedStatus.png', type: 'spritesheet', frameWidth: 16, frameHeight: 32 },
    // Poison trap trigger poof (5 frames, 92x92 each)
    { key: 'poisonPoof', path: 'assets/art/poisonPoof92x92.png', type: 'spritesheet', frameWidth: 92, frameHeight: 92 },
    // Frozen frame overlay (66x80) â€” drawn on top of a frozen card in place | of the old blue tint.
    // A soft glow behind the tiny gem and amulet rewards of a boss (32x32).
    { key: 'rewardSpot', path: 'assets/art/spot.png', type: 'image' },
    { key: 'frozenFrame', path: 'assets/art/frozen.png', type: 'image' },
    { key: 'bossFrozenFrame', path: 'assets/art/bossFrozen.png', type: 'image' },
    { key: 'healthOrb', path: 'assets/art/healthOrbFullEmpty62x54.png', type: 'spritesheet', frameWidth: 62, frameHeight: 54 },
    // Cog button skin â€” frame 0 = up, frame 1 = pressed.
    { key: 'optionsButton', path: 'assets/art/optionsButtonUpDown32x32.png', type: 'spritesheet', frameWidth: 32, frameHeight: 32 },
    // Options screen skin, one 128x32 button per row:
    // 0 language, 1 empty volume bar, 2 filled volume bar, 3 back, 4 reset.
    { key: 'uiButtons', path: 'assets/art/uiButtons.png', type: 'spritesheet', frameWidth: 128, frameHeight: 32 },
    // Draggable knob that rides the volume bars.
    { key: 'MainPlayerAvatar', path: 'assets/art/MainPlayerAvatar.png', type: 'image' },
    // Silkdeep roster. Silkslinger is still on the placeholder face.
    // Temporary face for month enemies without dedicated card art (53×70).
    // Elite mini-boss portraits â€” same 53x70 footprint as the base art they
    // replace. Only some enemies have one; see ELITE_SPRITE_KEYS below.
    // Load twinkle animation frames
    { key: 'twinkle', path: 'assets/art/twinkle60x78Sheet.png', type: 'spritesheet', frameWidth: 60, frameHeight: 78 },
    // Bosses
    { key: 'lightningBoss', path: 'assets/art/lightningBoss.png', type: 'image' },
    { key: 'frostGiant', path: 'assets/art/frosthollow/frostGiant.png', type: 'image' },
    // The Green Warden, Goblin King, Giant Skeleton, Soul Eater, Mire Bride, Cerberus and Sandscale Chieftain have
    // no idle file: their idle pose is frame 0 of their attack sheet (bossAttackFrames.js).
    { key: 'SpiderQween', path: 'assets/art/spiderBoss.png', type: 'image' },
    { key: 'Lich', path: 'assets/art/lich.png', type: 'image' },
    // Bosses' attack art (content/cards/bossAttackFrames.js): a sheet (frameWidth set)
    // loads as a spritesheet, a single attack picture as an image.
    ...BOSS_ATTACK_FRAME_FILES.map(({ key, path, frameWidth, frameHeight }) => (frameWidth
        ? { key, path, frameWidth, frameHeight, type: 'spritesheet' }
        : { key, path, type: 'image' })),
    // The door you walk through to choose a road. One 64x64 frame per
    // location, in the order LOCATION_DOOR_FRAMES declares.
    { key: 'locationDoors', path: 'assets/art/paths.png', type: 'spritesheet', frameWidth: 64, frameHeight: 64 },
    // Animated doors, one road per row, six frames each from shut to open:
    // row 0 Boneflood's skull door, row 1 Mireturn's bog door, row 2
    // Thornwake's briar door, row 3 Silkdeep's web door, row 4 Tollroad's
    // goblin door; row 5 Frosthollow's ice door. See
    // LOCATION_DOOR_SHEETS in locationCards.js.
    { key: 'locationDoorAnims', path: 'assets/ui/doorAnim68x70.png', type: 'spritesheet', frameWidth: 68, frameHeight: 70 },
    { key: 'AncientCerberus', path: 'assets/art/ancientCerberus.png', type: 'image' },
    // Smoke burst — 11 frames, played by the Smoke Screen spell and by the toll
    // goblins escaping. See PreloadScene's 'smoke_bomb_anim'.
    { key: 'smokeBombAnim', path: 'assets/art/smokeBombAnim82x82.png', type: 'spritesheet', frameWidth: 82, frameHeight: 82 },
    // Ogre's Gauntlet — one row of 52x70 card faces, common..legendary.
    // Frame per rarity is mapped in content/balance/Gauntlet.js.
    { key: 'gauntletCards', path: 'assets/art/gauntletSheet.png', type: 'spritesheet', frameWidth: 52, frameHeight: 70 },
    // Normal spell cards and their glowing Reliquary variants share frame order.
    // Preload exposes the normal frames under existing spell keys for saves.
    { key: 'magicCards', path: 'assets/art/magicCardsOriginalSheet1.png', type: 'spritesheet', frameWidth: 52, frameHeight: 69 },
    { key: 'glowingMagicCards', path: 'assets/art/glowingMagicCardsSheetNew1.png', type: 'spritesheet', frameWidth: 52, frameHeight: 69 },
    { key: 'glassCase', path: 'assets/art/glassCase.png', type: 'image' },
    { key: 'trap_spring1', path: 'assets/music/trap_spring1.mp3', type: 'audio' },
    // UI currency animations â€” the little coin/crystal flip shown when the | value changes. Now single spritesheets (6 frames each) instead of the | old crystalAnimation1-6 / coinAnimation1-6 individual PNGs.
    { key: 'coinAnimSheet', path: 'assets/art/coinAnimation20x24.png', type: 'spritesheet', frameWidth: 20, frameHeight: 24 },
    { key: 'crystalAnimSheet', path: 'assets/art/crystalAnimation14x24.png', type: 'spritesheet', frameWidth: 14, frameHeight: 24 },
    // Board defeat-loot animations â€” a coin jump / crystal scatter played on | the spot an enemy died when Prospector's Pick drops currency.
    { key: 'coinJumpSheet', path: 'assets/art/coinAnimationJump58x38.png', type: 'spritesheet', frameWidth: 58, frameHeight: 38 },
    { key: 'crystalScatterSheet', path: 'assets/art/crystalAnimationSheet56x30.png', type: 'spritesheet', frameWidth: 56, frameHeight: 30 },
    // Bespoke boss death: a 5-frame mask played over the boss sprite.
    { key: 'bossDeathMask', path: 'assets/art/bossDeathMask232x194.png', type: 'spritesheet', frameWidth: 232, frameHeight: 194 },
    // Animation for Magic cards
    // treasure
    { key: 'bigChestAnimation', path: 'assets/art/bigChestAnimation98x98.png', type: 'spritesheet', frameWidth: 98, frameHeight: 98 },
    // Close Order's grappling hook (Taya): 9 frames of 96x170, the rope rising
    // from below, the hook flying up and catching (AmuletManager).
    { key: 'hookAnim', path: 'assets/art/hookAnim.png', type: 'spritesheet', frameWidth: 96, frameHeight: 170 },
    // Frame 0 is closed; frame 1 is open. Original chest animation stays available.
    { key: 'treasureChest', path: 'assets/art/chests/regularChest.png', type: 'spritesheet', frameWidth: 98, frameHeight: 98 },
    { key: 'eliteChest', path: 'assets/art/chests/eliteChest.png', type: 'spritesheet', frameWidth: 98, frameHeight: 98 },
    // Animation for MIMIC â€” merged 7-frame splash spritesheet (was splash1-7).
    { key: 'splashSheet', path: 'assets/art/splashShee118x62t.png', type: 'spritesheet', frameWidth: 118, frameHeight: 62 },
    // ---- New SFX batch (variants rotate via SoundHelper.playVariant) ---- | Multi-variant groups
    { key: 'enemy_hit_1', path: 'assets/music/Enemy_Hit_01.mp3', type: 'audio' },
    // Close Order's grappling hook: the throw and the catch (made in code).
    { key: 'hook_swish', path: 'assets/music/Hook_Swish.mp3', type: 'audio' },
    { key: 'hook_clunk', path: 'assets/music/Hook_Clunk.mp3', type: 'audio' },
    // A companion's egg hatching: two taps, the shell splitting, a bright
    // chime (made in code; take 2 of six, picked by Taya).
    { key: 'egg_hatch', path: 'assets/music/Egg_Hatch.mp3', type: 'audio' },
    { key: 'enemy_hit_2', path: 'assets/music/Enemy_Hit_02.mp3', type: 'audio' },
    { key: 'enemy_hit_3', path: 'assets/music/Enemy_Hit_03.mp3', type: 'audio' },
    { key: 'enemy_hit_4', path: 'assets/music/Enemy_Hit_04.mp3', type: 'audio' },
    { key: 'card_place_1', path: 'assets/music/Card_Pick_Up_Place_01.mp3', type: 'audio' },
    { key: 'card_place_2', path: 'assets/music/Card_Pick_Up_Place_02.mp3', type: 'audio' },
    { key: 'card_place_3', path: 'assets/music/Card_Pick_Up_Place_03.mp3', type: 'audio' },
    { key: 'card_place_4', path: 'assets/music/Card_Pick_Up_Place_04.mp3', type: 'audio' },
    { key: 'key_pickup', path: 'assets/music/Key_Pickup_04.mp3', type: 'audio' },
    { key: 'dodge_miss_1', path: 'assets/music/Dodge_Miss_01.mp3', type: 'audio' },
    { key: 'dodge_miss_2', path: 'assets/music/Dodge_Miss_02.mp3', type: 'audio' },
    { key: 'dodge_miss_3', path: 'assets/music/Dodge_Miss_03.mp3', type: 'audio' },
    { key: 'map_select_1', path: 'assets/music/Map_Select_01.mp3', type: 'audio' },
    { key: 'map_select_2', path: 'assets/music/Map_Select_02.mp3', type: 'audio' },
    { key: 'armor_break_1', path: 'assets/music/Armor_Break_01.mp3', type: 'audio' },
    { key: 'armor_break_2', path: 'assets/music/Armor_Break_02.mp3', type: 'audio' },
    { key: 'armor_break_3', path: 'assets/music/Armor_Break_03.mp3', type: 'audio' },
    // Every button in the game presses with this one click. The two older
    // Button_Click_0*.mp3 takes are no longer loaded — nothing referenced them
    // but the button_click group, and that now points here.
    { key: 'ui_click', path: 'assets/music/UI_Click_01.mp3', type: 'audio' },
    // The same click pitched a touch up and down, rotated at random so a run
    // of button presses doesn't repeat one identical sample.
    { key: 'ui_click_hi', path: 'assets/music/UI_Click_01_hi.mp3', type: 'audio' },
    { key: 'ui_click_lo', path: 'assets/music/UI_Click_01_lo.mp3', type: 'audio' },
    // Tick under the volume sliders. Short on purpose: it fires once per step
    // while a slider is being dragged.
    { key: 'ui_slider_tick', path: 'assets/music/UI_Slider_Tick_01.mp3', type: 'audio' },
    // Cards answering the pointer: board backs, the bag, shop and anvil rows.
    // Quieter and softer than the button click, because sweeping a mouse across
    // a full board fires it a dozen times — and two takes rotating at random so
    // that sweep doesn't machine-gun one sample. Call sites ask for the group
    // name 'ui_card_hover'; see SFX_VARIANTS in audio/SoundHelper.js.
    { key: 'ui_card_hover_1', path: 'assets/music/UI_Card_Hover_01.mp3', type: 'audio' },
    { key: 'ui_card_hover_2', path: 'assets/music/UI_Card_Hover_02.mp3', type: 'audio' },
    // The road opening when a floor is cleared.
    { key: 'door_open', path: 'assets/music/Door_Open_01.mp3', type: 'audio' },
    // Stays at boot: it plays the moment the first fight starts.
    { key: 'new_level_1', path: 'assets/music/New_Level_01.mp3', type: 'audio' },
    { key: 'new_level_3', path: 'assets/music/New_Level_03.mp3', type: 'audio' },
    // Action points coming back: food, rest, a full restore, the boss reward
    // (CombatHud.playActionPointGain, and the campfire).
    { key: 'ap_restore', path: 'assets/music/AP_Restore.mp3', type: 'audio' },
    // The road doors creaking as they settle into their arches as "Choose the road" opens
    // (LocationPickScene).
    // A road door under the pointer: a small creak of its hinge.
    { key: 'door_hover_1', path: 'assets/music/Door_Hover_01.mp3', type: 'audio' },
    { key: 'door_hover_2', path: 'assets/music/Door_Hover_02.mp3', type: 'audio' },
    { key: 'door_hover_3', path: 'assets/music/Door_Hover_03.mp3', type: 'audio' },
    { key: 'door_hover_4', path: 'assets/music/Door_Hover_04.mp3', type: 'audio' },
    { key: 'door_hover_5', path: 'assets/music/Door_Hover_05.mp3', type: 'audio' },
    { key: 'door_hover_6', path: 'assets/music/Door_Hover_06.mp3', type: 'audio' },
    // The treasure chest under the pointer: its lid rattling on the latch.
    { key: 'chest_hover_1', path: 'assets/music/Chest_Hover_01.mp3', type: 'audio' },
    { key: 'invalid_action_1', path: 'assets/music/Invalid_Action_01.mp3', type: 'audio' },
    { key: 'invalid_action_2', path: 'assets/music/Invalid_Action_02.mp3', type: 'audio' },
    { key: 'player_hurt_1', path: 'assets/music/Player_Hurt_01.mp3', type: 'audio' },
    { key: 'player_hurt_2', path: 'assets/music/Player_Hurt_02.mp3', type: 'audio' },
    { key: 'player_hurt_3', path: 'assets/music/Player_Hurt_03.mp3', type: 'audio' },
    // Soft UI hover clicks. Buttons and map nodes both use Hover_Click_01.
    { key: 'hover_node', path: 'assets/music/Hover_Click_01.mp3', type: 'audio' },
    { key: 'hover_button_1', path: 'assets/music/Hover_Click_01.mp3', type: 'audio' },
    { key: 'hover_button_2', path: 'assets/music/Hover_Click_03.mp3', type: 'audio' },
    // Pitched copies of the two, for the same reason as the click's.
    { key: 'hover_button_3', path: 'assets/music/Hover_Click_01_hi.mp3', type: 'audio' },
    { key: 'hover_button_4', path: 'assets/music/Hover_Click_01_lo.mp3', type: 'audio' },
    { key: 'hover_button_5', path: 'assets/music/Hover_Click_03_hi.mp3', type: 'audio' },
    // Gem picked off the board / socketed into a weapon
    { key: 'gem_socket', path: 'assets/music/Gem_Socket_01.mp3', type: 'audio' },
    // Crystal card picked off the board. Distinct from 'crystal_collect', | which the amulet equip still uses.
    // A soft, warm crystal tone generated with ElevenLabs (tools/death-sounds.json,
    // 'pickups' set); it replaced the brighter Glass_Clink_03.
    { key: 'crystal_pickup', path: 'assets/music/Crystal_Pickup.mp3', type: 'audio' },
    // Hero drinks a potion dropped onto him (or drunk from inventory). | Swapped from the old Potion_Drink_01.mp3 gulp to this fuller swallow.
    { key: 'potion_drink', path: 'assets/music/Potion_Drink_02.mp3', type: 'audio' },
    // Key card dropped back into the inventory
    { key: 'key_drop', path: 'assets/music/Key_Drop_02.mp3', type: 'audio' },
    // Lightning-gem zap â€” 3 variants, loudness-normalized
    { key: 'lightning_zap_1', path: 'assets/music/Lightning_Zap_01.mp3', type: 'audio' },
    { key: 'lightning_zap_2', path: 'assets/music/Lightning_Zap_02.mp3', type: 'audio' },
    { key: 'lightning_zap_3', path: 'assets/music/Lightning_Zap_03.mp3', type: 'audio' },
    // "Nothing" card revealed â€” empty-slot whoosh
    { key: 'empty_whoosh', path: 'assets/music/Folder_Whoosh_01.mp3', type: 'audio' },
    // Single-shot effects
    { key: 'bow_shot', path: 'assets/music/Bow_Shot_01.mp3', type: 'audio' },
    { key: 'enemy_death_1', path: 'assets/music/Enemy_Death_01.mp3', type: 'audio' },
    { key: 'enemy_death_2', path: 'assets/music/Enemy_Death_02.mp3', type: 'audio' },
    { key: 'heavy_swing', path: 'assets/music/Heavy_Attack_Swing_01.mp3', type: 'audio' },
    { key: 'thorns_hit', path: 'assets/music/Thorns_Retaliation_01.mp3', type: 'audio' },
    // The thorns card hitting back: two takes that rotate, since it repeats
    // every enemy turn (tools/death-sounds.json, 'combat' set). thorns_hit
    // above stays for the Twinned Mirror's reflection.
    { key: 'thorns_retaliate_1', path: 'assets/music/Thorns_Hit_01.mp3', type: 'audio' },
    { key: 'thorns_retaliate_2', path: 'assets/music/Thorns_Hit_02.mp3', type: 'audio' },
    { key: 'card_merge', path: 'assets/music/Card_Merge_Success_01.mp3', type: 'audio' },
    // ---- New SFX drop (2026-07): multi-take groups ---- | Loaded under _vN keys; SoundHelper.SFX_VARIANTS maps the canonical | key (card_flip, coin_collect, â€¦) onto these so playSound rotates them | at random. Old single-file loads above stay put but go unused.
    { key: 'card_flip_v1', path: 'assets/music/Card_Flip_01.mp3', type: 'audio' },
    { key: 'card_flip_v2', path: 'assets/music/Card_Flip_02.mp3', type: 'audio' },
    { key: 'card_flip_v3', path: 'assets/music/Card_Flip_03.mp3', type: 'audio' },
    { key: 'card_flip_v4', path: 'assets/music/Card_Flip_04.mp3', type: 'audio' },
    { key: 'coin_collect_v1', path: 'assets/music/Coin_Pickup_01.mp3', type: 'audio' },
    { key: 'coin_collect_v2', path: 'assets/music/Coin_Pickup_02.mp3', type: 'audio' },
    { key: 'shop_buy_v1', path: 'assets/music/Purchase_01.mp3', type: 'audio' },
    { key: 'shop_buy_v2', path: 'assets/music/Purchase_02.mp3', type: 'audio' },
    { key: 'gem_pickup_v1', path: 'assets/music/Gem_01.mp3', type: 'audio' },
    { key: 'gem_pickup_v2', path: 'assets/music/Gem_02.mp3', type: 'audio' },
    { key: 'gem_pickup_v3', path: 'assets/music/Gem_03.mp3', type: 'audio' },
    { key: 'gem_pickup_v4', path: 'assets/music/Gem_04.mp3', type: 'audio' },
    // Hero eats food (bread) â€” restores actions. 3 variants rotate.
    { key: 'bread_eaten_1', path: 'assets/music/Bread_Eaten_01.mp3', type: 'audio' },
    { key: 'bread_eaten_2', path: 'assets/music/Bread_Eaten_02.mp3', type: 'audio' },
    { key: 'bread_eaten_3', path: 'assets/music/Bread_Eaten_03.mp3', type: 'audio' },
    // Out of actions â€” hero acts while exhausted ("Weakened!"). 2 variants.
    { key: 'empty_stomach_1', path: 'assets/music/Empty_Stomach_01.mp3', type: 'audio' },
    { key: 'empty_stomach_2', path: 'assets/music/Empty_Stomach_02.mp3', type: 'audio' },
    // Arriving on a fresh combat floor. 3 variants rotate.
    // The looping music tracks are NOT here — see DEFERRED_AUDIO below.
];

/**
 * Sounds only heard mid-fight, loaded in the background behind the main menu
 * (scenes/BackgroundAudioScene.js) instead of before the first screen: every
 * enemy's own death, the armor types, blocks, Bone Wall and the rarer combat
 * moments — about fifty files the boot no longer waits to decode. Each falls
 * back to an older sound until it lands.
 *
 * @type {AssetEntry[]}
 */
export const LATE_AUDIO = [
    // Every enemy's own death (content/audio/enemyDeathSounds.js); until one
    // lands, that death plays the shared enemy_death pair.
    ...ENEMY_DEATH_SOUND_ASSETS,
    // The location bosses' own attack and death (content/audio/bossSounds.js).
    ...BOSS_SOUND_ASSETS,
    // Equip sounds per armor type (content/audio/armorSounds.js); the shared
    // clank, armor_equip, stands in until they land.
    ...ARMOR_EQUIP_SOUND_ASSETS,
    // A raised block stopping an attack ("Blocked!"), two takes that rotate,
    // and Bone Wall catching a hit. Generated with ElevenLabs
    // (tools/death-sounds.json, 'combat' set); both used to be the armor_equip
    // clank, which stands in until they land.
    { key: 'block_hit_1', path: 'assets/music/Block_Hit_01.mp3', type: 'audio' },
    { key: 'block_hit_2', path: 'assets/music/Block_Hit_02.mp3', type: 'audio' },
    { key: 'bone_wall_hit', path: 'assets/music/Bone_Wall_Hit.mp3', type: 'audio' },
    // One-off combat moments (tools/death-sounds.json, 'events' set): a boss
    // crossing its rage threshold, and a mimic getting away.
    { key: 'boss_enraged', path: 'assets/music/Boss_Enraged.mp3', type: 'audio' },
    { key: 'mimic_escaped', path: 'assets/music/Mimic_Escaped.mp3', type: 'audio' },
    // The Mimic's cry as the Summon Mimic spell drops it onto the board.
    { key: 'mimic_cry', path: 'assets/music/Mimic_Cry.mp3', type: 'audio' },
    // An enemy's hit piercing the hero's armor ("Armor Broken!").
    { key: 'armor_broken', path: 'assets/music/Armor_Broken.mp3', type: 'audio' },
    // The hero rising again: Temple / Second Wind, and the Invulnerable amulet.
    { key: 'revival', path: 'assets/music/Revival_Shimmer.mp3', type: 'audio' },
    // Venom in the hero: as it takes hold ("Poisoned!") and each turn it
    // burns HP away. Two takes ('poison_tick' group).
    { key: 'poison_tick_1', path: 'assets/music/Poison_Tick_01.mp3', type: 'audio' },
    { key: 'poison_tick_2', path: 'assets/music/Poison_Tick_02.mp3', type: 'audio' },
    // A card taken by something in an event: the mirror, the well, the
    // screaming head... (InventorySystem's event drop zones).
    { key: 'card_offered', path: 'assets/music/Card_Offered.mp3', type: 'audio' },
    // A statue restored in the Sanctuary (ElevenLabs, tools/death-sounds.json set "sanctuary").
    // The Tactician's Pin going into its card (ElevenLabs, tools/death-sounds.json set "pins").
    { key: 'tactician_pin', path: 'assets/music/Tactician_Pin.mp3', type: 'audio' },
    // A new bag slot lighting up (ElevenLabs, tools/death-sounds.json set "bag").
    { key: 'bag_slot_unlock', path: 'assets/music/Bag_Slot_Unlock.mp3', type: 'audio' },
    // The crow's caw as the Trinket Keeper is restored (ElevenLabs, set "sanctuary").
    { key: 'sanctuary_crow', path: 'assets/music/Sanctuary_Crow.mp3', type: 'audio' },
    // Scorched Land's wave of heat (ElevenLabs, tools/death-sounds.json set "spells").
    { key: 'scorched_wave', path: 'assets/music/Scorched_Wave.mp3', type: 'audio' },
    { key: 'sanctuary_restore', path: 'assets/music/Sanctuary_Restore.mp3', type: 'audio' },
    // The bird's nest minigame: the bird's cry as its shadow sweeps over, and
    // the trinkets clicking as they are moved ('nest_screech'/'nest_rummage').
    // The Broken Music Box lock: a wafer flipped, a pin seated (four chimes,
    // each a note higher, so solving it climbs a scale), a pair that won't
    // fit, the wafers shuffling, the box blowing apart, and its tune once it
    // opens. tools/death-sounds.json, 'events' set, mbox_*.
    { key: 'mbox_tick_1', path: 'assets/music/MusicBox_Tick_01.mp3', type: 'audio' },
    { key: 'mbox_tick_2', path: 'assets/music/MusicBox_Tick_02.mp3', type: 'audio' },
    { key: 'mbox_pin_1', path: 'assets/music/MusicBox_Pin_01.mp3', type: 'audio' },
    { key: 'mbox_pin_2', path: 'assets/music/MusicBox_Pin_02.mp3', type: 'audio' },
    { key: 'mbox_pin_3', path: 'assets/music/MusicBox_Pin_03.mp3', type: 'audio' },
    { key: 'mbox_pin_4', path: 'assets/music/MusicBox_Pin_04.mp3', type: 'audio' },
    { key: 'mbox_nofit', path: 'assets/music/MusicBox_NoFit.mp3', type: 'audio' },
    { key: 'mbox_shuffle', path: 'assets/music/MusicBox_Shuffle.mp3', type: 'audio' },
    { key: 'mbox_detonate', path: 'assets/music/MusicBox_Detonate.mp3', type: 'audio' },
    { key: 'mbox_solved', path: 'assets/music/MusicBox_Solved.mp3', type: 'audio' },
    { key: 'nest_screech_1', path: 'assets/music/Nest_Screech_01.mp3', type: 'audio' },
    { key: 'nest_screech_2', path: 'assets/music/Nest_Screech_02.mp3', type: 'audio' },
    { key: 'nest_rummage_1', path: 'assets/music/Nest_Rummage_01.mp3', type: 'audio' },
    { key: 'nest_rummage_2', path: 'assets/music/Nest_Rummage_02.mp3', type: 'audio' },
    // Moved from boot: heard only well into a run (spells, chests, the anvil,
    // boss and death stings, the campfire), so the menu does not wait
    // on them.
    { key: 'magic_cast', path: 'assets/music/fast-woosh-230497.mp3', type: 'audio' },
    { key: 'boneWall', path: 'assets/music/Bone_Wall_01.mp3', type: 'audio' },
    { key: 'smoke_bomb', path: 'assets/music/Smoke_Screen_02.mp3', type: 'audio' },
    { key: 'frozenRing', path: 'assets/music/Ice_Cast_01.mp3', type: 'audio' },
    { key: 'shadowDagger', path: 'assets/music/shadowDagger.mp3', type: 'audio' },
    { key: 'soulSucking', path: 'assets/music/Soul_Drain_01.mp3', type: 'audio' },
    { key: 'magicShield', path: 'assets/music/Magic_Shield_01.mp3', type: 'audio' },
    { key: 'weakening', path: 'assets/music/weakening.mp3', type: 'audio' },
    { key: 'fireball_whoosh_v1', path: 'assets/music/Fireball_01.mp3', type: 'audio' },
    { key: 'fireball_whoosh_v2', path: 'assets/music/Fireball_02.mp3', type: 'audio' },
    { key: 'recovery_v1', path: 'assets/music/Heal_01.mp3', type: 'audio' },
    { key: 'recovery_v2', path: 'assets/music/Heal_02.mp3', type: 'audio' },
    { key: 'legendary_reveal_1', path: 'assets/music/Legendary_Relic_Reveal_01.mp3', type: 'audio' },
    { key: 'legendary_reveal_2', path: 'assets/music/Legendary_Relic_Reveal_02.mp3', type: 'audio' },
    { key: 'boss_defeated', path: 'assets/music/Boss_Defeated_01.mp3', type: 'audio' },
    { key: 'hero_death_1', path: 'assets/music/Death_01.mp3', type: 'audio' },
    { key: 'hero_death_2', path: 'assets/music/Death_02.mp3', type: 'audio' },
    { key: 'hero_death_3', path: 'assets/music/Death_03.mp3', type: 'audio' },
    { key: 'campfire_loop', path: 'assets/music/Campfire_Loop_01.mp3', type: 'audio' },
    { key: 'dice_roll', path: 'assets/music/dice-throw-1.ogg', type: 'audio' },
    { key: 'treasure_explode', path: 'assets/music/coin-flip-37787.mp3', type: 'audio' },
    { key: 'chest_open_v1', path: 'assets/music/Chest_Open_01.mp3', type: 'audio' },
    { key: 'chest_open_v2', path: 'assets/music/Chest_Open_02.mp3', type: 'audio' },
    { key: 'anvil_upgrade_v1', path: 'assets/music/Anvil_Strike_01.mp3', type: 'audio' },
    { key: 'anvil_upgrade_v2', path: 'assets/music/Anvil_Strike_02.mp3', type: 'audio' },
    { key: 'enemy_freeze', path: 'assets/music/Enemy_Freeze_01.mp3', type: 'audio' },
    { key: 'poison_trap', path: 'assets/music/Poison_Trap_01.mp3', type: 'audio' },
];

/**
 * Music that loads on first use instead of at boot.
 *
 * The browser decodes every preloaded sound to raw PCM before the game can
 * start, and these three are minutes long: 16 MB of mp3 became 186 MB in
 * memory, 110 MB of it these tracks, none of it needed to draw the main menu.
 * MusicManager fetches one the first time something asks to play it.
 *
 * @type {AssetEntry[]}
 */
export const DEFERRED_AUDIO = [
    { key: 'menu_music', path: 'assets/music/TOE_Campfire.mp3', type: 'audio' },
    { key: 'boss_music', path: 'assets/music/TOE_BattleDrums.mp3', type: 'audio' },
    { key: 'map_music', path: 'assets/music/TOE_Peaceful.mp3', type: 'audio' },
    // Regular and elite battle tracks await audition and approval.
];

/** Path for a deferred track, or undefined if the key isn't deferred. */
export function deferredAudioPath(key) {
    return DEFERRED_AUDIO.find(entry => entry.key === key)?.path;
}

/**
 * Base enemy sprite key -> elite portrait key, for enemies that have dedicated
 * elite art. Enemies missing an entry here fall back to the tint highlight, so
 * this map can be filled in one enemy at a time as art lands.
 * @type {Record<string, string>}
 */
export const ELITE_SPRITE_KEYS = {
    cerberusHead: 'cerberusHead_elite',
};

/** Queue every manifest entry onto a Phaser LoaderPlugin (scene.load). */
export function loadAssetManifest(loader) {
    for (const asset of ASSET_MANIFEST) {
        switch (asset.type) {
            case 'image':
                loader.image(asset.key, asset.path);
                break;
            case 'spritesheet':
                loader.spritesheet(asset.key, asset.path, {
                    frameWidth: asset.frameWidth,
                    frameHeight: asset.frameHeight,
                });
                break;
            case 'audio':
                loader.audio(asset.key, asset.path);
                break;
            case 'atlas':
                loader.atlas(asset.key, asset.path, asset.jsonPath);
                break;
            case 'bitmapFont':
                loader.bitmapFont(asset.key, asset.path, asset.xmlPath);
                break;
            default:
                console.warn('Unknown asset type in manifest:', asset);
        }
    }
}
