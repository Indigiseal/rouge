export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        // Append a timestamp to every asset URL so Phaser never serves a
        // stale texture from its internal cache during development.
        // Remove queryURL before shipping (or it bloats itch.io logs).
        this.load.setCORS('anonymous');
        this.load.on('filedatareceived', () => {});
        const _origImage = this.load.image.bind(this.load);
        const _origSheet = this.load.spritesheet.bind(this.load);
        const _origAudio = this.load.audio.bind(this.load);
        const _origBitmap = this.load.bitmapFont.bind(this.load);
        const v = `?v=${Date.now()}`;
        this.load.image = (key, url, ...rest) => _origImage(key, Array.isArray(url) ? url.map(u => u + v) : url + v, ...rest);
        this.load.spritesheet = (key, url, ...rest) => _origSheet(key, url + v, ...rest);
        this.load.audio = (key, url, ...rest) => _origAudio(key, Array.isArray(url) ? url.map(u => u + v) : url + v, ...rest);
        this.load.bitmapFont = (key, textureURL, xmlURL, ...rest) => _origBitmap(key, textureURL + v, xmlURL + v, ...rest);
        //this.load.image('warrior', 'assets/art/playerAvatarWarrior.png');
        this.load.image('stoneFloor', 'assets/art/dungeon.png');
        this.load.image('cardBack', 'assets/art/cardBack.png');
        this.load.image('panelCards', 'assets/art/panelCards.png');
        this.load.image('gamingBoard', 'assets/art/gamingBoard.png');
        this.load.image('gamingBoard2', 'assets/art/gamingBoard2.png');
        this.load.image('gamingBoardSideExtra', 'assets/art/gamingBoardSIdewaysExtra.png');
        this.load.spritesheet('gamingBoardSideSmall', 'assets/art/gamingBoardSIdewaysSmall.png', { frameWidth: 208, frameHeight: 144 });
        // Frame order: rest floor, defeat UI, victory UI, blacksmith floor.
        this.load.spritesheet('restRooms', 'assets/art/rest.png', { frameWidth: 144, frameHeight: 122 });
        // Frame order: defeat info, defeat detail, victory info, victory detail.
        this.load.spritesheet('resultPanels', 'assets/art/defeatWin9x9panels.png', { frameWidth: 96, frameHeight: 96 });
        this.load.spritesheet('resultBanners', 'assets/art/bannerLostWin.png', { frameWidth: 160, frameHeight: 32 });
        this.load.image('eventPaper', 'assets/art/paper.png');
        this.load.image('eventPaper9Slice', 'assets/art/paper9Slice.png');
        this.load.image('scrollHandle', 'assets/art/scroll.png');
        this.load.spritesheet('eventsShops', 'assets/art/eventsShops80x80.png', { frameWidth: 80, frameHeight: 80 });
        this.load.image('panelArmor', 'assets/art/panelArmor.png');
        // Little banner behind each shop item's price (30x14)
        this.load.image('priceTag', 'assets/art/priceTag.png');
        this.load.bitmapFont('pixel-font', 'assets/fonts/minogram_6x10.png', 'assets/fonts/minogram_6x10.xml');
        this.load.bitmapFont('cyrillic-ui-font', 'assets/fonts/probly12NEW_crisp.png', 'assets/fonts/probly12NEW_crisp.xml');
        // Dedicated crisp 16px title font (rasterized 1-bit from Able5.ttf) so
        // event titles are pixel-sharp at a size the body bitmap font can't hit.
        this.load.bitmapFont('title-font', 'assets/fonts/title16.png', 'assets/fonts/title16.xml');
        this.load.image('goblin_c', 'assets/art/goblin_c.png');
        this.load.image('skeletonSprite', 'assets/art/skeleton_c.png');
        // Tutorial coach-mark pointer (16x16 cursor-style arrow).
        this.load.image('tutorialPointer', 'assets/art/pointer.png');
        this.load.image('angryNestmother', 'assets/art/bird.png');
        
        // Load item sprites
        this.load.image('leather_C', 'assets/art/leatherCommon.png');
        this.load.image('leather_U', 'assets/art/leather_U.png');
        this.load.image('leather_R', 'assets/art/leather_R.png');
        this.load.image('leather_E', 'assets/art/leather_E.png');
        this.load.image('leather_L', 'assets/art/leather_L.png');
        this.load.image('chain_C', 'assets/art/chain_C.png');
        this.load.image('plate_C', 'assets/art/plate_C.png');
        this.load.image('boneArmor_U', 'assets/art/boneArmor_U.png');
        this.load.image('sword_C', 'assets/art/sword_C.png');
        this.load.image('dagger_C', 'assets/art/dagger_c.png');
        this.load.image('axe_C', 'assets/art/axe_C.png');
        this.load.image('bow_c', 'assets/art/bow_c.png');
        // Load Uncommon / Rare / Epic / Legendary item sprites
        this.load.image('axe_U', 'assets/art/axe_U.png');
        this.load.image('axe_R', 'assets/art/axe_R.png');
        this.load.image('axe_E', 'assets/art/axe_E.png');
        this.load.image('axe_L', 'assets/art/axe_L.png');
        this.load.image('dagger_U', 'assets/art/dagger_u.png');
        this.load.image('dagger_R', 'assets/art/dagger_r.png');
        this.load.image('dagger_E', 'assets/art/dagger_e.png');
        this.load.image('dagger_L', 'assets/art/dagger_l.png');
        this.load.image('bow_U', 'assets/art/bow_U.png');
        this.load.image('bow_R', 'assets/art/bow_R.png');
        this.load.image('bow_E', 'assets/art/bow_E.png');
        this.load.image('bow_L', 'assets/art/bow_L.png');
        this.load.image('sword_U', 'assets/art/sword_u.png');
        this.load.image('sword_R', 'assets/art/sword_R.png');
        this.load.image('sword_E', 'assets/art/sword_E.png');
        this.load.image('sword_L', 'assets/art/sword_L.png');
        this.load.image('chain_U', 'assets/art/chain_U.png');
        this.load.image('chain_R', 'assets/art/chain_R.png');
        this.load.image('chain_E', 'assets/art/chain_E.png');
        this.load.image('chain_L', 'assets/art/chain_L.png');
        this.load.image('plate_U', 'assets/art/plate_U.png');
        this.load.image('plate_R', 'assets/art/plate_R.png');
        this.load.image('plate_E', 'assets/art/plate_E.png');
        this.load.image('plate_L', 'assets/art/plate_L.png');
        this.load.image('potionCardCommon', 'assets/art/potionCardCommon.png');
        this.load.image('potionCardUncommon', 'assets/art/potionCardUncommon.png');
        this.load.image('trap', 'assets/art/trap.png');
        this.load.image('trap2', 'assets/art/trap2.png');
        this.load.image('coin', 'assets/art/coin.png');
        this.load.image('crystalCard', 'assets/art/crystalCard.png');
        this.load.image('keyCard', 'assets/art/keyCard.png');
        this.load.image('trapTriggers', 'assets/art/trapTriggers.png');
        this.load.image('thornsCard', 'assets/art/thornsCard.png');
        this.load.image('thornsCard_U', 'assets/art/thornsCard_U.png');
        this.load.image('thornsCard_R', 'assets/art/thornsCard_R.png');
        this.load.image('thornsCard_E', 'assets/art/thornsCard_E.png');
        this.load.image('carnivalPipe', 'assets/art/pipe.png');
        this.load.image('carnivalDucky', 'assets/art/ducky.png');
        this.load.image('carnivalRing', 'assets/art/brokenRing.png');
        this.load.image('carnivalTray', 'assets/art/tray.png');
        this.load.image('wizardTray', 'assets/art/trayWizard.png');
        this.load.image('holographicOmen', 'assets/art/omen.png');
        this.load.spritesheet('luckyClover', 'assets/art/clover.png', { frameWidth: 53, frameHeight: 70 });
        this.load.spritesheet('mapNodes', 'assets/art/mapNodes42x42.png', { frameWidth: 42, frameHeight: 42 });
        this.load.spritesheet('gemsRGY', 'assets/art/gemsRGY-Sheet.png', { frameWidth: 16, frameHeight: 16 });
        // Enemy role marker: frame 0 = melee, frame 1 = ranged
        // 'enemyCardType' sprite sheet was the old melee/ranged/poison badge
        // overlay. The new enemy art bakes those icons into the cards, and
        // HP / ATK now render as corner numbers, so we no longer load it.
        this.load.spritesheet('gemEffectsOnCards', 'assets/art/gemEffectsOnCards64x80.png', { frameWidth: 64, frameHeight: 80 });
        this.load.spritesheet('enemiesHitEffects', 'assets/art/enemiesHitEffects64x80.png', { frameWidth: 64, frameHeight: 80 });
        this.load.spritesheet('shadowsGems', 'assets/art/shadowsGems.png', { frameWidth: 16, frameHeight: 20 });
        this.load.audio('coin_collect', 'assets/music/coin-recieved.mp3');
        // player_hurt now rotates through 3 male-hurt variants (loaded in the SFX batch below)
        this.load.audio('anvil_upgrade', 'assets/music/anvil-hit-2-14845.mp3');
        this.load.audio('item_discard', 'assets/music/discard-sound-effect-221455.mp3');
        this.load.audio('trap_spring', 'assets/music/trap_spring1.mp3');
        this.load.audio('trap_woosh', 'assets/music/fast-woosh-230497.mp3');
        this.load.audio('armor_equip', 'assets/music/metal_clank.mp3');
        this.load.audio('crystal_collect', 'assets/music/crystal_pick_up.mp3');
        // Main menu
        this.load.image('mainBG', 'assets/art/mainBG.png');
        // Food
        this.load.image('berries', 'assets/art/foodCommon4AP.png');
        this.load.image('bread', 'assets/art/bread.png');
        this.load.image('egg', 'assets/art/egg.png');
        this.load.image('chickCompanion', 'assets/art/chickCompanion.png');
        this.load.image('chickCompanionUP', 'assets/art/chickCompanionUP.png');
        this.load.image('skeletonCompanion', 'assets/art/skeletonCompanion.png');
        this.load.image('skeletonCompanionUP', 'assets/art/skeletonCompanionUP.png');
        // New Cards
        this.load.image('amulet', 'assets/art/amulet.png');
        this.load.spritesheet('relicsOthers', 'assets/art/relicsOthers.png', { frameWidth: 32, frameHeight: 32 });
        this.load.audio('shop_buy', 'assets/music/dropInBagStore.mp3');
        this.load.audio('card_flip', 'assets/music/flipcard-91468.mp3');
        // Load flip animation frames
        this.load.image('cardFlip1', 'assets/art/cardFlip1.png');
        this.load.image('cardFlip2', 'assets/art/cardFlip2.png');
        this.load.image('cardFlip3', 'assets/art/cardFlip3.png');
        this.load.image('cardFlip4', 'assets/art/cardFlip4.png');
        this.load.image('cardFlip5', 'assets/art/cardFlip5.png');
        // Load card hover animation frames
        this.load.image('cardHover1', 'assets/art/cardHover1.png');
        this.load.image('cardHover2', 'assets/art/cardHover2.png');
        this.load.image('cardHover3', 'assets/art/cardHover3.png');
        this.load.image('cardHover4', 'assets/art/cardHover4.png');
        this.load.image('cardHover5', 'assets/art/cardHover5.png');
        this.load.image('discardSprite', 'assets/art/discard.png');
        this.load.image('thornFrame', 'assets/art/thornFrame.png');
        // Card hover when in inventory effects (5 frames, 54x70 each)
        this.load.spritesheet('hoverCardsUpSheet', 'assets/art/hoverCardsUp54x70Sheet.png', { frameWidth: 54, frameHeight: 70 });
        // Card disappear dissolve (6 frames, 54x70 each) — plays on top of a card
        // as it is removed (enemy defeated, weapon pips spent).
        this.load.spritesheet('cardDisappearSheet', 'assets/art/cardDissappearAnimation54x70.png', { frameWidth: 54, frameHeight: 70 });
        // Card merge flicker (2 frames, 54x70 each) — plays on top of the merged
        // card. `mergeLegendarySheet` is the legendary-tier variant.
        this.load.spritesheet('mergeSheet', 'assets/art/merge.png', { frameWidth: 54, frameHeight: 70 });
        this.load.spritesheet('mergeLegendarySheet', 'assets/art/mergeLegendary.png', { frameWidth: 54, frameHeight: 70 });
        // Empty card poof effect (4 frames, 32x48 each)
        this.load.spritesheet('poofEmpty', 'assets/art/poofEmpty32x48frames.png', { frameWidth: 32, frameHeight: 48 });
        // Poison status indicator (5 frames, 16x32 each) — shown on poisoned enemies/hero
        this.load.spritesheet('poisonedStatus', 'assets/art/poisonedStatus.png', { frameWidth: 16, frameHeight: 32 });
        // Shock marker (6 frames, 16x32 each), positioned like poisonedStatus.
        this.load.spritesheet('shockedStatus', 'assets/art/shockedStatus.png', { frameWidth: 16, frameHeight: 32 });
        // Poison trap trigger poof (5 frames, 92x92 each)
        this.load.spritesheet('poisonPoof', 'assets/art/poisonPoof92x92.png', { frameWidth: 92, frameHeight: 92 });
        // Frozen frame overlay (66x80) — drawn on top of a frozen card in place
        // of the old blue tint.
        this.load.image('frozenFrame', 'assets/art/frozen.png');
        this.load.image('bossFrozenFrame', 'assets/art/bossFrozen.png');

        this.load.image('healthBar', 'assets/art/healthBar.png');
        this.load.image('healthBarEmpty', 'assets/art/healthBarEmpty2.png');
        this.load.spritesheet('healthOrb', 'assets/art/healthOrbFullEmpty62x54.png', { frameWidth: 62, frameHeight: 54 });
        this.load.image('actionPoint', 'assets/art/actionPoint.png');
        this.load.image('nextTurnUp', 'assets/art/nextTurnUp.png');
        this.load.image('nextTurnDown', 'assets/art/nextTurnDown.png');
        // Cog button skin — frame 0 = up, frame 1 = pressed.
        this.load.spritesheet('optionsButton', 'assets/art/optionsButtonUpDown32x32.png', { frameWidth: 32, frameHeight: 32 });
        this.load.image('MainPlayerAvatar', 'assets/art/MainPlayerAvatar.png');
        this.load.image('coinUI', 'assets/art/coinUI.png');
        this.load.image('CrystalUI', 'assets/art/CrystalUI.png');
        this.load.image('skeleton_c', 'assets/art/skeleton_c.png');
        this.load.image('spider_c', 'assets/art/spider_c.png');
        this.load.image('lostSoul', 'assets/art/ghostlyEnemy.png');
        this.load.image('cerberusHead', 'assets/art/dogHead.png');
        this.load.image('sword_c_reworked', 'assets/art/sword_c_r.png');
        this.load.image('durability_dot', 'assets/art/durability_dot.png');
        this.load.image('ten_durability', 'assets/art/ten_durability.png');
        // Load twinkle animation frames
        this.load.spritesheet('twinkle', 'assets/art/twinkle60x78Sheet.png', { frameWidth: 60, frameHeight: 78 });
        // Bosses
        this.load.image('giantSkeleton', 'assets/art/giantSkeleton.png');
        this.load.image('GoblinKingSprite', 'assets/art/goblinKing.png');
        this.load.image('SpiderQween', 'assets/art/spiderBoss.png');

        this.load.image('goblin_archer', 'assets/art/goblinArcher_c.png');
        this.load.image('skeleton_archer', 'assets/art/skeletonArcher_c.png');
        this.load.image('Lich', 'assets/art/lich.png');
        this.load.image('SoulEater', 'assets/art/soulEater.png');
        this.load.image('Cerberus', 'assets/art/cerberus.png');
        this.load.image('AncientCerberus', 'assets/art/ancientCerberus.png');
         // Magic Cards
        this.load.image('fireBall', 'assets/art/magicBallCard.png');
        this.load.image('frozenRing', 'assets/art/forzenRing.png');
        this.load.image('recovery', 'assets/art/recovery.png');
        this.load.image('soulSucking', 'assets/art/soulSucking.png');
        this.load.image('shadowDagger', 'assets/art/shadowDagger.png');
        this.load.image('weakening', 'assets/art/weakening.png');
        this.load.image('boneWall', 'assets/art/boneWall.png');
        this.load.image('macigShield', 'assets/art/macicShield.png');
        this.load.image('mirrorShield', 'assets/art/mirrorShield.png');
        this.load.image('smokeBomb', 'assets/art/smokeBomb.png');
        this.load.audio('magic_cast', 'assets/music/fast-woosh-230497.mp3');
        this.load.audio('recovery', 'assets/music/recovery.mp3');
        this.load.audio('boneWall', 'assets/music/boneWall.mp3');
        this.load.audio('mirrorShield', 'assets/music/mirrorShield.mp3');
        this.load.audio('fireball_whoosh', 'assets/music/fireball-whoosh-1-179125.mp3');
        this.load.audio('smoke_bomb', 'assets/music/smoke-bomb-6761.mp3');
        this.load.audio('frozenRing', 'assets/music/frozenRing.mp3');
        this.load.audio('shadowDagger', 'assets/music/shadowDagger.mp3');
        this.load.audio('soulSucking', 'assets/music/soulSucking.mp3');
        this.load.audio('magicShield', 'assets/music/magicShield.mp3');
        this.load.audio('weakening', 'assets/music/weakening.mp3');
        this.load.audio('trap_spring1', 'assets/music/trap_spring1.mp3');

        // UI currency animations — the little coin/crystal flip shown when the
        // value changes. Now single spritesheets (6 frames each) instead of the
        // old crystalAnimation1-6 / coinAnimation1-6 individual PNGs.
        this.load.spritesheet('coinAnimSheet', 'assets/art/coinAnimation20x24.png', { frameWidth: 20, frameHeight: 24 });
        this.load.spritesheet('crystalAnimSheet', 'assets/art/crystalAnimation14x24.png', { frameWidth: 14, frameHeight: 24 });
        // Board defeat-loot animations — a coin jump / crystal scatter played on
        // the spot an enemy died when Prospector's Pick drops currency.
        this.load.spritesheet('coinJumpSheet', 'assets/art/coinAnimationJump58x38.png', { frameWidth: 58, frameHeight: 38 });
        this.load.spritesheet('crystalScatterSheet', 'assets/art/crystalAnimationSheet56x30.png', { frameWidth: 56, frameHeight: 30 });
        // Bespoke boss death: a 5-frame mask played over the boss sprite.
        this.load.spritesheet('bossDeathMask', 'assets/art/bossDeathMask232x194.png', { frameWidth: 232, frameHeight: 194 });
        //Animation for Magic cards
        this.load.image('fireBall1', 'assets/art/fireBall1.png');
        this.load.image('fireBall2', 'assets/art/fireBall2.png');
        this.load.image('fireBall3', 'assets/art/fireBall3.png');
        this.load.image('fireBall4', 'assets/art/fireBall4.png');
        //treasure
        this.load.spritesheet('bigChestAnimation', 'assets/art/bigChestAnimation98x98.png', { frameWidth: 98, frameHeight: 98 });
        this.load.audio('chest_open', 'assets/music/wooden-trunk-latch-1-183944.mp3');
        this.load.audio('trap_trigger', 'assets/music/trap_spring1.mp3');
        this.load.image('mimic', 'assets/art/mimic.png'); 
        this.load.audio('treasure_explode', 'assets/music/coin-flip-37787.mp3'); 
        //Animation for MIMIC — merged 7-frame splash spritesheet (was splash1-7).
        this.load.spritesheet('splashSheet', 'assets/art/splashShee118x62t.png', { frameWidth: 118, frameHeight: 62 });

        // ---- New SFX batch (variants rotate via SoundHelper.playVariant) ----
        const M = 'assets/music/';
        // Multi-variant groups
        this.load.audio('enemy_hit_1', M + 'Enemy_Hit_01.mp3');
        this.load.audio('enemy_hit_2', M + 'Enemy_Hit_02.mp3');
        this.load.audio('enemy_hit_3', M + 'Enemy_Hit_03.mp3');
        this.load.audio('enemy_hit_4', M + 'Enemy_Hit_04.mp3');
        this.load.audio('card_place_1', M + 'Card_Pick_Up_Place_01.mp3');
        this.load.audio('card_place_2', M + 'Card_Pick_Up_Place_02.mp3');
        this.load.audio('card_place_3', M + 'Card_Pick_Up_Place_03.mp3');
        this.load.audio('card_place_4', M + 'Card_Pick_Up_Place_04.mp3');
        this.load.audio('key_pickup', M + 'Key_Pickup_04.mp3');
        this.load.audio('dodge_miss_1', M + 'Dodge_Miss_01.mp3');
        this.load.audio('dodge_miss_2', M + 'Dodge_Miss_02.mp3');
        this.load.audio('dodge_miss_3', M + 'Dodge_Miss_03.mp3');
        this.load.audio('map_select_3', M + 'Map_Node_Select_03.mp3');
        this.load.audio('armor_break_1', M + 'Armor_Break_01.mp3');
        this.load.audio('armor_break_2', M + 'Armor_Break_02.mp3');
        this.load.audio('armor_break_3', M + 'Armor_Break_03.mp3');
        this.load.audio('button_click_1', M + 'Button_Click_01.mp3');
        this.load.audio('button_click_2', M + 'Button_Click_02.mp3');
        this.load.audio('invalid_action_1', M + 'Invalid_Action_01.mp3');
        this.load.audio('invalid_action_2', M + 'Invalid_Action_02.mp3');
        this.load.audio('legendary_reveal_1', M + 'Legendary_Relic_Reveal_01.mp3');
        this.load.audio('legendary_reveal_2', M + 'Legendary_Relic_Reveal_02.mp3');
        this.load.audio('player_hurt_1', M + 'Player_Hurt_01.wav');
        this.load.audio('player_hurt_2', M + 'Player_Hurt_02.wav');
        this.load.audio('player_hurt_3', M + 'Player_Hurt_03.wav');
        // Soft UI hover clicks — map nodes get their own; buttons rotate 2 variants
        this.load.audio('hover_node', M + 'Hover_Click_01.mp3');
        this.load.audio('hover_button_1', M + 'Hover_Click_02.mp3');
        this.load.audio('hover_button_2', M + 'Hover_Click_03.mp3');
        // Gem picked off the board / socketed into a weapon
        this.load.audio('gem_pickup', M + 'Gem_Pickup_01.mp3');
        this.load.audio('gem_socket', M + 'Gem_Socket_01.mp3');
        // Crystal card picked off the board. Distinct from 'crystal_collect',
        // which the amulet equip still uses.
        this.load.audio('crystal_pickup', M + 'Glass_Clink_03.mp3');
        // Hero drinks a potion dropped onto him. Trimmed from the 1.04s source to
        // 0.56s — everything past that was silence — and re-encoded from 24-bit
        // 48k stereo, which cost 301KB for half a second of gulp.
        this.load.audio('potion_drink', M + 'Potion_Drink_01.mp3');
        // Key card dropped back into the inventory
        this.load.audio('key_drop', M + 'Key_Drop_02.mp3');
        // Lightning-gem zap — 3 variants, loudness-normalized
        this.load.audio('lightning_zap_1', M + 'Lightning_Zap_01.mp3');
        this.load.audio('lightning_zap_2', M + 'Lightning_Zap_02.mp3');
        this.load.audio('lightning_zap_3', M + 'Lightning_Zap_03.mp3');
        // Acid/poison trap
        this.load.audio('poison_trap', M + 'Poison_Trap_01.mp3');
        // "Nothing" card revealed — empty-slot whoosh
        this.load.audio('empty_whoosh', M + 'Folder_Whoosh_01.mp3');
        // Enemies frozen (Frost Ring) — icy magic cast
        this.load.audio('enemy_freeze', M + 'Enemy_Freeze_01.mp3');
        // Single-shot effects
        this.load.audio('bow_shot', M + 'Bow_Shot_01.mp3');
        this.load.audio('enemy_death_1', M + 'Enemy_Death_01.mp3');
        this.load.audio('enemy_death_2', M + 'Enemy_Death_02.mp3');
        this.load.audio('heavy_swing', M + 'Heavy_Attack_Swing_01.mp3');
        this.load.audio('thorns_hit', M + 'Thorns_Retaliation_01.mp3');
        this.load.audio('card_merge', M + 'Card_Merge_Success_01.mp3');
        // Looping music tracks
        this.load.audio('menu_music', M + 'TOE_Campfire.mp3');   // main menu (campfire)
        this.load.audio('boss_music', M + 'TOE_BattleDrums.mp3'); // boss battles
        this.load.audio('map_music', M + 'TOE_Peaceful.mp3');    // map view (peaceful)
    }

    create() {
        this.installCrispTextFactory();

        this.anims.create({
            key: 'card_flip_anim',
            frames: [
                { key: 'cardFlip1' },
                { key: 'cardFlip2' },
                { key: 'cardFlip3' },
                { key: 'cardFlip4' },
                { key: 'cardFlip5' },
            ],
            frameRate: 24,
            repeat: 0
        });
        this.anims.create({
            key: 'card_hover_anim',
            frames: [
                { key: 'cardHover1' },
                { key: 'cardHover2' },
                { key: 'cardHover3' },
                { key: 'cardHover4' },
                { key: 'cardHover5' },
            ],
            frameRate: 24,
            repeat: 0
        });
        // Create twinkle animation for mergeable cards
        this.anims.create({
            key: 'twinkle_anim',
            frames: this.anims.generateFrameNumbers('twinkle', { start: 0, end: 3 }),
            frameRate: 8,
            repeat: -1
        });

        ['fire', 'poison', 'lightning'].forEach((effect, row) => {
            this.anims.create({
                key: `gem_${effect}_sparkle`,
                frames: this.anims.generateFrameNumbers('gemsRGY', { start: row * 6, end: row * 6 + 5 }),
                frameRate: 8,
                repeat: 0
            });
            this.anims.create({
                key: `gem_${effect}_hover`,
                frames: this.anims.generateFrameNumbers('gemsRGY', { start: row * 6, end: row * 6 + 5 }),
                frameRate: 8,
                repeat: -1
            });
        });
        
    
        this.anims.create({
            key: 'splash_anim',
            frames: this.anims.generateFrameNumbers('splashSheet', { start: 0, end: 6 }),
            frameRate: 12, // Adjust speed (10fps)
            repeat: 0 // Play once
        });

        // Board defeat-loot pickups (Prospector's Pick). Play on the tile where
        // an enemy died, like the mimic's treasure scatter.
        this.anims.create({
            key: 'coin_jump_anim',
            frames: this.anims.generateFrameNumbers('coinJumpSheet', { start: 0, end: 8 }),
            frameRate: 15,
            repeat: 0
        });
        this.anims.create({
            key: 'crystal_scatter_anim',
            frames: this.anims.generateFrameNumbers('crystalScatterSheet', { start: 0, end: 10 }),
            frameRate: 15,
            repeat: 0
        });

        if (this.textures.exists('bossDeathMask')) {
            this.anims.create({
                key: 'boss_death_mask',
                frames: this.anims.generateFrameNumbers('bossDeathMask', { start: 0, end: 4 }),
                frameRate: 12,
                repeat: 0
            });
        }

        this.anims.create({
            key: 'poof_empty_anim',
            frames: this.anims.generateFrameNumbers('poofEmpty', { start: 0, end: 3 }),
            frameRate: 10,
            repeat: 0
        });

        this.anims.create({
            key: 'poison_poof_anim',
            frames: this.anims.generateFrameNumbers('poisonPoof', { start: 0, end: 4 }),
            frameRate: 12,
            repeat: 0
        });

        this.anims.create({
            key: 'poison_status_anim',
            frames: this.anims.generateFrameNumbers('poisonedStatus', { start: 0, end: 4 }),
            frameRate: 6,
            repeat: -1
        });

        this.anims.create({
            key: 'shock_status_anim',
            frames: this.anims.generateFrameNumbers('shockedStatus', { start: 0, end: 5 }),
            frameRate: 8,
            repeat: -1
        });

        ['fire', 'poison', 'lightning'].forEach((effect, row) => {
            this.anims.create({
                key: `gem_card_${effect}_loop`,
                frames: this.anims.generateFrameNumbers('gemEffectsOnCards', { start: row * 7, end: row * 7 + 6 }),
                frameRate: 10,
                repeat: -1
            });
        });

        // Enemy hit effects (64x80, 5 frames/row): fire, poison, lightning. Play once.
        ['fire', 'poison', 'lightning'].forEach((effect, row) => {
            this.anims.create({
                key: `enemy_hit_${effect}`,
                frames: this.anims.generateFrameNumbers('enemiesHitEffects', { start: row * 5, end: row * 5 + 4 }),
                frameRate: 14,
                repeat: 0
            });
        });

        this.anims.create({
            key: 'big_chest_open',
            frames: this.anims.generateFrameNumbers('bigChestAnimation', { start: 0, end: 4 }),
            frameRate: 10,
            repeat: 0
        });
         
        this.scene.start('MainMenuScene');
    }

    installCrispTextFactory() {
        const factory = Phaser.GameObjects.GameObjectFactory.prototype;
        if (factory._rogueOriginalTextFactory) return;

        factory._rogueOriginalTextFactory = factory.text;
        const originalTextFactory = factory._rogueOriginalTextFactory;

        const parseColor = (color) => {
            if (typeof color === 'number') return color;
            if (typeof color !== 'string') return 0xffffff;
            if (color.startsWith('#')) return parseInt(color.slice(1), 16);
            if (color.startsWith('0x')) return parseInt(color.slice(2), 16);
            return 0xffffff;
        };

        const parseFontSize = (fontSize) => {
            if (typeof fontSize === 'number') return fontSize;
            const parsed = parseInt(String(fontSize || '12px'), 10);
            return Number.isFinite(parsed) ? parsed : 12;
        };

        const fontSupportsText = (scene, fontKey, text) => {
            const chars = scene.cache?.bitmapFont?.get?.(fontKey)?.data?.chars;
            if (!chars) return false;

            for (const char of String(text)) {
                const code = char.charCodeAt(0);
                if (code === 10 || code === 13) continue;
                if (!chars[code]) return false;
            }

            return true;
        };

        factory.text = function (x, y, text = '', style = {}) {
            const scene = this.scene;
            const value = String(text ?? '');
            const fontKey = fontSupportsText(scene, 'pixel-font', value)
                ? 'pixel-font'
                : fontSupportsText(scene, 'cyrillic-ui-font', value)
                    ? 'cyrillic-ui-font'
                    : null;

            if (!fontKey || style.useCanvasText) {
                return originalTextFactory.call(this, x, y, text, style);
            }

            const resolveBitmapSize = (nextStyle = {}) => {
                const fontSize = parseFontSize(nextStyle.fontSize);
                return fontKey === 'cyrillic-ui-font'
                    ? 12
                    : fontSize >= 18
                        ? 20
                        : 10;
            };
            const fontSize = parseFontSize(style.fontSize);
            const bitmapSize = fontKey === 'cyrillic-ui-font'
                ? 12
                : fontSize >= 18
                    ? 20
                    : 10;
            const align = style.align === 'center' ? 1 : style.align === 'right' ? 2 : 0;
            const bitmapText = this.bitmapText(Math.round(x), Math.round(y), fontKey, value, bitmapSize, align);

            const applyStyle = (nextStyle = {}) => {
                const tintColor = nextStyle.fill ?? nextStyle.color;
                if (tintColor !== undefined) bitmapText.setTint(parseColor(tintColor));
                if (nextStyle.alpha !== undefined) bitmapText.setAlpha(nextStyle.alpha);
                if (nextStyle.fontSize !== undefined) bitmapText.setFontSize(resolveBitmapSize(nextStyle));
                if (nextStyle.lineSpacing !== undefined && bitmapText.setLineSpacing) {
                    bitmapText.setLineSpacing(Math.round(nextStyle.lineSpacing));
                }
                if (nextStyle.wordWrap?.width && bitmapText.setMaxWidth) {
                    bitmapText.setMaxWidth(Math.round(nextStyle.wordWrap.width));
                }
                if ((nextStyle.strokeThickness || 0) > 0 && bitmapText.setDropShadow) {
                    bitmapText.setDropShadow(1, 1, parseColor(nextStyle.stroke || '#000000'), 1);
                }
                return bitmapText;
            };

            applyStyle(style);

            const nativeSetText = bitmapText.setText.bind(bitmapText);
            bitmapText.setText = (nextText = '') => {
                const value = String(nextText ?? '');
                // Phaser's BitmapText.setText reaches into this.fontData.chars
                // during getTextBounds. If the bitmap font isn't (or is no
                // longer) loaded — e.g. scene was destroyed, or the chosen
                // font doesn't cover every char in `value` — that lookup
                // crashes. Re-check the font is still live and supports the
                // text; if not, no-op rather than throwing.
                const fontOk = !!bitmapText.fontData?.chars
                    && fontSupportsText(scene, fontKey, value);
                if (!fontOk) {
                    // Still update the underlying text property so reads see
                    // the latest string, but don't trigger Phaser's bounds
                    // recompute that would crash.
                    try { bitmapText.text = value; } catch (_) {}
                    return bitmapText;
                }
                try {
                    nativeSetText(value);
                } catch (err) {
                    console.warn('BitmapText setText failed; ignoring', err);
                }
                return bitmapText;
            };
            bitmapText.setStyle = (nextStyle = {}) => applyStyle(nextStyle);
            bitmapText.setFill = (color) => applyStyle({ fill: color });
            bitmapText.setColor = bitmapText.setFill;
            bitmapText.setFont = () => bitmapText;
            bitmapText.setFontSize = (nextFontSize) => {
                bitmapText.fontSize = resolveBitmapSize({ fontSize: nextFontSize });
                return bitmapText;
            };
            bitmapText.setResolution = () => bitmapText;
            bitmapText.setFixedSize = (width) => {
                if (width && bitmapText.setMaxWidth) bitmapText.setMaxWidth(Math.round(width));
                return bitmapText;
            };

            return bitmapText;
        };
    }
}
