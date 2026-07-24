// Central asset load list for PreloadScene.
// Paths resolve from site root (assets/...).
// type: 'image' | 'spritesheet' | 'audio' | 'bitmapFont'

/** @typedef {{ key: string, path: string, type: 'image'|'spritesheet'|'audio'|'bitmapFont', frameWidth?: number, frameHeight?: number, xmlPath?: string }} AssetEntry */

/** @type {AssetEntry[]} */
export const ASSET_MANIFEST = [
    { key: 'stoneFloor', path: 'assets/art/dungeon.png', type: 'image' },
    { key: 'cardBack', path: 'assets/art/cardBack.png', type: 'image' },
    { key: 'panelCards', path: 'assets/art/panelCards.png', type: 'image' },
    { key: 'gamingBoard', path: 'assets/art/gamingBoard.png', type: 'image' },
    { key: 'gamingBoard2', path: 'assets/art/gamingBoard2.png', type: 'image' },
    { key: 'gamingBoardSideExtra', path: 'assets/art/gamingBoardSIdewaysExtra.png', type: 'image' },
    { key: 'gamingBoardSideSmall', path: 'assets/art/gamingBoardSIdewaysSmall.png', type: 'spritesheet', frameWidth: 208, frameHeight: 144 },
    // Frame order: rest floor, defeat UI, victory UI, blacksmith floor.
    { key: 'restRooms', path: 'assets/art/rest.png', type: 'spritesheet', frameWidth: 144, frameHeight: 122 },
    // Frame order: defeat info, defeat detail, victory info, victory detail.
    { key: 'resultPanels', path: 'assets/art/defeatWin9x9panels.png', type: 'spritesheet', frameWidth: 96, frameHeight: 96 },
    { key: 'resultBanners', path: 'assets/art/bannerLostWin.png', type: 'spritesheet', frameWidth: 160, frameHeight: 32 },
    { key: 'eventPaper', path: 'assets/art/paper.png', type: 'image' },
    { key: 'eventPaper9Slice', path: 'assets/art/paper9Slice.png', type: 'image' },
    { key: 'scrollHandle', path: 'assets/art/scroll.png', type: 'image' },
    { key: 'eventsShops', path: 'assets/art/eventsShops80x80.png', type: 'spritesheet', frameWidth: 80, frameHeight: 80 },
    { key: 'statueHead', path: 'assets/art/statueHead.png', type: 'image' },
    { key: 'panelArmor', path: 'assets/art/panelArmor.png', type: 'image' },
    // Little banner behind each shop item's price (30x14)
    { key: 'priceTag', path: 'assets/art/priceTag.png', type: 'image' },
    { key: 'pixel-font', path: 'assets/fonts/minogram_6x10.png', xmlPath: 'assets/fonts/minogram_6x10.xml', type: 'bitmapFont' },
    { key: 'cyrillic-ui-font', path: 'assets/fonts/probly12NEW_crisp.png', xmlPath: 'assets/fonts/probly12NEW_crisp.xml', type: 'bitmapFont' },
    // Dedicated crisp 16px title font (rasterized 1-bit from Able5.ttf).
    { key: 'title-font', path: 'assets/fonts/title16.png', xmlPath: 'assets/fonts/title16.xml', type: 'bitmapFont' },
    { key: 'goblin_c', path: 'assets/art/goblin_c.png', type: 'image' },
    { key: 'skeletonSprite', path: 'assets/art/skeleton_c.png', type: 'image' },
    // Tutorial coach-mark pointer (16x16 cursor-style arrow).
    { key: 'tutorialPointer', path: 'assets/art/pointer.png', type: 'image' },
    { key: 'angryNestmother', path: 'assets/art/bird.png', type: 'image' },
    // Load item sprites
    { key: 'leather_C', path: 'assets/art/leatherCommon.png', type: 'image' },
    { key: 'leather_U', path: 'assets/art/leather_U.png', type: 'image' },
    { key: 'leather_R', path: 'assets/art/leather_R.png', type: 'image' },
    { key: 'leather_E', path: 'assets/art/leather_E.png', type: 'image' },
    { key: 'leather_L', path: 'assets/art/leather_L.png', type: 'image' },
    { key: 'chain_C', path: 'assets/art/chain_C.png', type: 'image' },
    { key: 'plate_C', path: 'assets/art/plate_C.png', type: 'image' },
    { key: 'boneArmor_U', path: 'assets/art/boneArmor_U.png', type: 'image' },
    { key: 'sword_C', path: 'assets/art/sword_C.png', type: 'image' },
    { key: 'dagger_C', path: 'assets/art/dagger_c.png', type: 'image' },
    { key: 'axe_C', path: 'assets/art/axe_C.png', type: 'image' },
    { key: 'bow_c', path: 'assets/art/bow_c.png', type: 'image' },
    // Load Uncommon / Rare / Epic / Legendary item sprites
    { key: 'axe_U', path: 'assets/art/axe_U.png', type: 'image' },
    { key: 'axe_R', path: 'assets/art/axe_R.png', type: 'image' },
    { key: 'axe_E', path: 'assets/art/axe_E.png', type: 'image' },
    { key: 'axe_L', path: 'assets/art/axe_L.png', type: 'image' },
    { key: 'dagger_U', path: 'assets/art/dagger_u.png', type: 'image' },
    { key: 'dagger_R', path: 'assets/art/dagger_r.png', type: 'image' },
    { key: 'dagger_E', path: 'assets/art/dagger_e.png', type: 'image' },
    { key: 'dagger_L', path: 'assets/art/dagger_l.png', type: 'image' },
    { key: 'bow_U', path: 'assets/art/bow_U.png', type: 'image' },
    { key: 'bow_R', path: 'assets/art/bow_R.png', type: 'image' },
    { key: 'bow_E', path: 'assets/art/bow_E.png', type: 'image' },
    { key: 'bow_L', path: 'assets/art/bow_L.png', type: 'image' },
    { key: 'sword_U', path: 'assets/art/sword_u.png', type: 'image' },
    { key: 'sword_R', path: 'assets/art/sword_R.png', type: 'image' },
    { key: 'sword_E', path: 'assets/art/sword_E.png', type: 'image' },
    { key: 'sword_L', path: 'assets/art/sword_L.png', type: 'image' },
    { key: 'chain_U', path: 'assets/art/chain_U.png', type: 'image' },
    { key: 'chain_R', path: 'assets/art/chain_R.png', type: 'image' },
    { key: 'chain_E', path: 'assets/art/chain_E.png', type: 'image' },
    { key: 'chain_L', path: 'assets/art/chain_L.png', type: 'image' },
    { key: 'plate_U', path: 'assets/art/plate_U.png', type: 'image' },
    { key: 'plate_R', path: 'assets/art/plate_R.png', type: 'image' },
    { key: 'plate_E', path: 'assets/art/plate_E.png', type: 'image' },
    { key: 'plate_L', path: 'assets/art/plate_L.png', type: 'image' },
    { key: 'potionCardCommon', path: 'assets/art/potionCardCommon.png', type: 'image' },
    { key: 'potionCardUncommon', path: 'assets/art/potionCardUncommon.png', type: 'image' },
    { key: 'trap', path: 'assets/art/trap.png', type: 'image' },
    { key: 'trap2', path: 'assets/art/trap2.png', type: 'image' },
    { key: 'coin', path: 'assets/art/coin.png', type: 'image' },
    { key: 'crystalCard', path: 'assets/art/crystalCard.png', type: 'image' },
    { key: 'keyCard', path: 'assets/art/keyCard.png', type: 'image' },
    { key: 'trapTriggers', path: 'assets/art/trapTriggers.png', type: 'image' },
    { key: 'thornsCard', path: 'assets/art/thornsCard.png', type: 'image' },
    { key: 'thornsCard_U', path: 'assets/art/thornsCard_U.png', type: 'image' },
    { key: 'thornsCard_R', path: 'assets/art/thornsCard_R.png', type: 'image' },
    { key: 'thornsCard_E', path: 'assets/art/thornsCard_E.png', type: 'image' },
    { key: 'carnivalPipe', path: 'assets/art/pipe.png', type: 'image' },
    { key: 'carnivalDucky', path: 'assets/art/ducky.png', type: 'image' },
    { key: 'carnivalRing', path: 'assets/art/brokenRing.png', type: 'image' },
    { key: 'carnivalTray', path: 'assets/art/tray.png', type: 'image' },
    { key: 'wizardTray', path: 'assets/art/trayWizard.png', type: 'image' },
    { key: 'holographicOmen', path: 'assets/art/omen.png', type: 'image' },
    { key: 'luckyClover', path: 'assets/art/clover.png', type: 'spritesheet', frameWidth: 53, frameHeight: 70 },
    { key: 'mapNodes', path: 'assets/art/mapNodes42x42.png', type: 'spritesheet', frameWidth: 42, frameHeight: 42 },
    { key: 'gemsRGY', path: 'assets/art/gemsRGY-Sheet.png', type: 'spritesheet', frameWidth: 16, frameHeight: 16 },
    // Enemy role marker: frame 0 = melee, frame 1 = ranged | 'enemyCardType' sprite sheet was the old melee/ranged/poison badge | overlay. The new enemy art bakes those icons into the cards, and | HP / ATK now render as corner numbers, so we no longer load it.
    { key: 'gemEffectsOnCards', path: 'assets/art/gemEffectsOnCards64x80.png', type: 'spritesheet', frameWidth: 64, frameHeight: 80 },
    { key: 'enemiesHitEffects', path: 'assets/art/enemiesHitEffects64x80.png', type: 'spritesheet', frameWidth: 64, frameHeight: 80 },
    { key: 'shadowsGems', path: 'assets/art/shadowsGems.png', type: 'spritesheet', frameWidth: 16, frameHeight: 20 },
    { key: 'coin_collect', path: 'assets/music/coin-recieved.mp3', type: 'audio' },
    // player_hurt now rotates through 3 male-hurt variants (loaded in the SFX batch below)
    { key: 'anvil_upgrade', path: 'assets/music/anvil-hit-2-14845.mp3', type: 'audio' },
    { key: 'item_discard', path: 'assets/music/discard-sound-effect-221455.mp3', type: 'audio' },
    { key: 'trap_spring', path: 'assets/music/trap_spring1.mp3', type: 'audio' },
    { key: 'trap_woosh', path: 'assets/music/fast-woosh-230497.mp3', type: 'audio' },
    { key: 'armor_equip', path: 'assets/music/metal_clank.mp3', type: 'audio' },
    { key: 'crystal_collect', path: 'assets/music/crystal_pick_up.mp3', type: 'audio' },
    // Main menu
    { key: 'mainBG', path: 'assets/art/mainBG.png', type: 'image' },
    // Food
    { key: 'berries', path: 'assets/art/foodCommon4AP.png', type: 'image' },
    { key: 'bread', path: 'assets/art/bread.png', type: 'image' },
    { key: 'egg', path: 'assets/art/egg.png', type: 'image' },
    { key: 'chickCompanion', path: 'assets/art/chickCompanion.png', type: 'image' },
    { key: 'chickCompanionUP', path: 'assets/art/chickCompanionUP.png', type: 'image' },
    { key: 'skeletonCompanion', path: 'assets/art/skeletonCompanion.png', type: 'image' },
    { key: 'skeletonCompanionUP', path: 'assets/art/skeletonCompanionUP.png', type: 'image' },
    // New Cards
    { key: 'amulet', path: 'assets/art/amulet.png', type: 'image' },
    { key: 'relicsOthers', path: 'assets/art/relicsOthers.png', type: 'spritesheet', frameWidth: 32, frameHeight: 32 },
    { key: 'shop_buy', path: 'assets/music/dropInBagStore.mp3', type: 'audio' },
    { key: 'card_flip', path: 'assets/music/flipcard-91468.mp3', type: 'audio' },
    // Load flip animation frames
    { key: 'cardFlip1', path: 'assets/art/cardFlip1.png', type: 'image' },
    { key: 'cardFlip2', path: 'assets/art/cardFlip2.png', type: 'image' },
    { key: 'cardFlip3', path: 'assets/art/cardFlip3.png', type: 'image' },
    { key: 'cardFlip4', path: 'assets/art/cardFlip4.png', type: 'image' },
    { key: 'cardFlip5', path: 'assets/art/cardFlip5.png', type: 'image' },
    // Load card hover animation frames
    { key: 'cardHover1', path: 'assets/art/cardHover1.png', type: 'image' },
    { key: 'cardHover2', path: 'assets/art/cardHover2.png', type: 'image' },
    { key: 'cardHover3', path: 'assets/art/cardHover3.png', type: 'image' },
    { key: 'cardHover4', path: 'assets/art/cardHover4.png', type: 'image' },
    { key: 'cardHover5', path: 'assets/art/cardHover5.png', type: 'image' },
    { key: 'discardSprite', path: 'assets/art/discard.png', type: 'image' },
    { key: 'thornFrame', path: 'assets/art/thornFrame.png', type: 'image' },
    // Card hover when in inventory effects (5 frames, 54x70 each)
    { key: 'hoverCardsUpSheet', path: 'assets/art/hoverCardsUp54x70Sheet.png', type: 'spritesheet', frameWidth: 54, frameHeight: 70 },
    // Card disappear dissolve (6 frames, 54x70 each) — plays on top of a card | as it is removed (enemy defeated, weapon pips spent).
    { key: 'cardDisappearSheet', path: 'assets/art/cardDissappearAnimation54x70.png', type: 'spritesheet', frameWidth: 54, frameHeight: 70 },
    // Card merge flicker (2 frames, 54x70 each) — plays on top of the merged | card. `mergeLegendarySheet` is the legendary-tier variant.
    { key: 'mergeSheet', path: 'assets/art/merge.png', type: 'spritesheet', frameWidth: 54, frameHeight: 70 },
    { key: 'mergeLegendarySheet', path: 'assets/art/mergeLegendary.png', type: 'spritesheet', frameWidth: 54, frameHeight: 70 },
    // Empty card poof effect (4 frames, 32x48 each)
    { key: 'poofEmpty', path: 'assets/art/poofEmpty32x48frames.png', type: 'spritesheet', frameWidth: 32, frameHeight: 48 },
    // Poison status indicator (5 frames, 16x32 each) — shown on poisoned enemies/hero
    { key: 'poisonedStatus', path: 'assets/art/poisonedStatus.png', type: 'spritesheet', frameWidth: 16, frameHeight: 32 },
    // Shock marker (6 frames, 16x32 each), positioned like poisonedStatus.
    { key: 'shockedStatus', path: 'assets/art/shockedStatus.png', type: 'spritesheet', frameWidth: 16, frameHeight: 32 },
    // Poison trap trigger poof (5 frames, 92x92 each)
    { key: 'poisonPoof', path: 'assets/art/poisonPoof92x92.png', type: 'spritesheet', frameWidth: 92, frameHeight: 92 },
    // Frozen frame overlay (66x80) — drawn on top of a frozen card in place | of the old blue tint.
    { key: 'frozenFrame', path: 'assets/art/frozen.png', type: 'image' },
    { key: 'bossFrozenFrame', path: 'assets/art/bossFrozen.png', type: 'image' },
    { key: 'healthBar', path: 'assets/art/healthBar.png', type: 'image' },
    { key: 'healthBarEmpty', path: 'assets/art/healthBarEmpty2.png', type: 'image' },
    { key: 'healthOrb', path: 'assets/art/healthOrbFullEmpty62x54.png', type: 'spritesheet', frameWidth: 62, frameHeight: 54 },
    { key: 'actionPoint', path: 'assets/art/actionPoint.png', type: 'image' },
    { key: 'nextTurnUp', path: 'assets/art/nextTurnUp.png', type: 'image' },
    { key: 'nextTurnDown', path: 'assets/art/nextTurnDown.png', type: 'image' },
    // Cog button skin — frame 0 = up, frame 1 = pressed.
    { key: 'optionsButton', path: 'assets/art/optionsButtonUpDown32x32.png', type: 'spritesheet', frameWidth: 32, frameHeight: 32 },
    { key: 'MainPlayerAvatar', path: 'assets/art/MainPlayerAvatar.png', type: 'image' },
    { key: 'coinUI', path: 'assets/art/coinUI.png', type: 'image' },
    { key: 'CrystalUI', path: 'assets/art/CrystalUI.png', type: 'image' },
    { key: 'skeleton_c', path: 'assets/art/skeleton_c.png', type: 'image' },
    { key: 'spider_c', path: 'assets/art/spider_c.png', type: 'image' },
    { key: 'lostSoul', path: 'assets/art/ghostlyEnemy.png', type: 'image' },
    { key: 'cerberusHead', path: 'assets/art/dogHead.png', type: 'image' },
    // Elite mini-boss portraits — same 53x70 footprint as the base art they
    // replace. Only some enemies have one; see ELITE_SPRITE_KEYS below.
    { key: 'spider_c_elite', path: 'assets/art/spiderElite.png', type: 'image' },
    { key: 'lostSoul_elite', path: 'assets/art/ghostlyEnemyElite.png', type: 'image' },
    { key: 'cerberusHead_elite', path: 'assets/art/dogHeadElite.png', type: 'image' },
    { key: 'sword_c_reworked', path: 'assets/art/sword_c_r.png', type: 'image' },
    { key: 'durability_dot', path: 'assets/art/durability_dot.png', type: 'image' },
    { key: 'ten_durability', path: 'assets/art/ten_durability.png', type: 'image' },
    // Load twinkle animation frames
    { key: 'twinkle', path: 'assets/art/twinkle60x78Sheet.png', type: 'spritesheet', frameWidth: 60, frameHeight: 78 },
    // Bosses
    { key: 'giantSkeleton', path: 'assets/art/giantSkeleton.png', type: 'image' },
    { key: 'GoblinKingSprite', path: 'assets/art/goblinKing.png', type: 'image' },
    { key: 'SpiderQween', path: 'assets/art/spiderBoss.png', type: 'image' },
    { key: 'goblin_archer', path: 'assets/art/goblinArcher_c.png', type: 'image' },
    { key: 'skeleton_archer', path: 'assets/art/skeletonArcher_c.png', type: 'image' },
    { key: 'Lich', path: 'assets/art/lich.png', type: 'image' },
    { key: 'SoulEater', path: 'assets/art/soulEater.png', type: 'image' },
    { key: 'Cerberus', path: 'assets/art/cerberus.png', type: 'image' },
    { key: 'AncientCerberus', path: 'assets/art/ancientCerberus.png', type: 'image' },
    // Magic Cards
    { key: 'fireBall', path: 'assets/art/magicBallCard.png', type: 'image' },
    { key: 'frozenRing', path: 'assets/art/forzenRing.png', type: 'image' },
    { key: 'recovery', path: 'assets/art/recovery.png', type: 'image' },
    { key: 'soulSucking', path: 'assets/art/soulSucking.png', type: 'image' },
    { key: 'shadowDagger', path: 'assets/art/shadowDagger.png', type: 'image' },
    { key: 'weakening', path: 'assets/art/weakening.png', type: 'image' },
    { key: 'boneWall', path: 'assets/art/boneWall.png', type: 'image' },
    { key: 'macigShield', path: 'assets/art/macicShield.png', type: 'image' },
    { key: 'mirrorShield', path: 'assets/art/mirrorShield.png', type: 'image' },
    { key: 'smokeBomb', path: 'assets/art/smokeBomb.png', type: 'image' },
    { key: 'magic_cast', path: 'assets/music/fast-woosh-230497.mp3', type: 'audio' },
    { key: 'recovery', path: 'assets/music/recovery.mp3', type: 'audio' },
    { key: 'boneWall', path: 'assets/music/Bone_Wall_01.wav', type: 'audio' },
    { key: 'mirrorShield', path: 'assets/music/Mirror_Shield_01.wav', type: 'audio' },
    { key: 'fireball_whoosh', path: 'assets/music/fireball-whoosh-1-179125.mp3', type: 'audio' },
    { key: 'smoke_bomb', path: 'assets/music/Smoke_Screen_02.wav', type: 'audio' },
    { key: 'frozenRing', path: 'assets/music/Ice_Cast_01.wav', type: 'audio' },
    { key: 'shadowDagger', path: 'assets/music/shadowDagger.mp3', type: 'audio' },
    { key: 'soulSucking', path: 'assets/music/Soul_Drain_01.wav', type: 'audio' },
    { key: 'magicShield', path: 'assets/music/Magic_Shield_01.wav', type: 'audio' },
    { key: 'weakening', path: 'assets/music/weakening.mp3', type: 'audio' },
    { key: 'trap_spring1', path: 'assets/music/trap_spring1.mp3', type: 'audio' },
    // UI currency animations — the little coin/crystal flip shown when the | value changes. Now single spritesheets (6 frames each) instead of the | old crystalAnimation1-6 / coinAnimation1-6 individual PNGs.
    { key: 'coinAnimSheet', path: 'assets/art/coinAnimation20x24.png', type: 'spritesheet', frameWidth: 20, frameHeight: 24 },
    { key: 'crystalAnimSheet', path: 'assets/art/crystalAnimation14x24.png', type: 'spritesheet', frameWidth: 14, frameHeight: 24 },
    // Board defeat-loot animations — a coin jump / crystal scatter played on | the spot an enemy died when Prospector's Pick drops currency.
    { key: 'coinJumpSheet', path: 'assets/art/coinAnimationJump58x38.png', type: 'spritesheet', frameWidth: 58, frameHeight: 38 },
    { key: 'crystalScatterSheet', path: 'assets/art/crystalAnimationSheet56x30.png', type: 'spritesheet', frameWidth: 56, frameHeight: 30 },
    // Bespoke boss death: a 5-frame mask played over the boss sprite.
    { key: 'bossDeathMask', path: 'assets/art/bossDeathMask232x194.png', type: 'spritesheet', frameWidth: 232, frameHeight: 194 },
    // Animation for Magic cards
    { key: 'fireBall1', path: 'assets/art/fireBall1.png', type: 'image' },
    { key: 'fireBall2', path: 'assets/art/fireBall2.png', type: 'image' },
    { key: 'fireBall3', path: 'assets/art/fireBall3.png', type: 'image' },
    { key: 'fireBall4', path: 'assets/art/fireBall4.png', type: 'image' },
    // treasure
    { key: 'bigChestAnimation', path: 'assets/art/bigChestAnimation98x98.png', type: 'spritesheet', frameWidth: 98, frameHeight: 98 },
    { key: 'chest_open', path: 'assets/music/wooden-trunk-latch-1-183944.mp3', type: 'audio' },
    { key: 'trap_trigger', path: 'assets/music/trap_spring1.mp3', type: 'audio' },
    { key: 'mimic', path: 'assets/art/mimic.png', type: 'image' },
    { key: 'treasure_explode', path: 'assets/music/coin-flip-37787.mp3', type: 'audio' },
    // Animation for MIMIC — merged 7-frame splash spritesheet (was splash1-7).
    { key: 'splashSheet', path: 'assets/art/splashShee118x62t.png', type: 'spritesheet', frameWidth: 118, frameHeight: 62 },
    // ---- New SFX batch (variants rotate via SoundHelper.playVariant) ---- | Multi-variant groups
    { key: 'enemy_hit_1', path: 'assets/music/Enemy_Hit_01.mp3', type: 'audio' },
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
    { key: 'map_select_3', path: 'assets/music/Map_Node_Select_03.mp3', type: 'audio' },
    { key: 'armor_break_1', path: 'assets/music/Armor_Break_01.mp3', type: 'audio' },
    { key: 'armor_break_2', path: 'assets/music/Armor_Break_02.mp3', type: 'audio' },
    { key: 'armor_break_3', path: 'assets/music/Armor_Break_03.mp3', type: 'audio' },
    { key: 'button_click_1', path: 'assets/music/Button_Click_01.mp3', type: 'audio' },
    { key: 'button_click_2', path: 'assets/music/Button_Click_02.mp3', type: 'audio' },
    { key: 'invalid_action_1', path: 'assets/music/Invalid_Action_01.mp3', type: 'audio' },
    { key: 'invalid_action_2', path: 'assets/music/Invalid_Action_02.mp3', type: 'audio' },
    { key: 'legendary_reveal_1', path: 'assets/music/Legendary_Relic_Reveal_01.mp3', type: 'audio' },
    { key: 'legendary_reveal_2', path: 'assets/music/Legendary_Relic_Reveal_02.mp3', type: 'audio' },
    { key: 'player_hurt_1', path: 'assets/music/Player_Hurt_01.wav', type: 'audio' },
    { key: 'player_hurt_2', path: 'assets/music/Player_Hurt_02.wav', type: 'audio' },
    { key: 'player_hurt_3', path: 'assets/music/Player_Hurt_03.wav', type: 'audio' },
    // Soft UI hover clicks. Buttons and map nodes both use Hover_Click_01.
    { key: 'hover_node', path: 'assets/music/Hover_Click_01.mp3', type: 'audio' },
    { key: 'hover_button_1', path: 'assets/music/Hover_Click_01.mp3', type: 'audio' },
    { key: 'hover_button_2', path: 'assets/music/Hover_Click_03.mp3', type: 'audio' },
    // Gem picked off the board / socketed into a weapon
    { key: 'gem_pickup', path: 'assets/music/Gem_Pickup_01.mp3', type: 'audio' },
    { key: 'gem_socket', path: 'assets/music/Gem_Socket_01.mp3', type: 'audio' },
    // Crystal card picked off the board. Distinct from 'crystal_collect', | which the amulet equip still uses.
    { key: 'crystal_pickup', path: 'assets/music/Glass_Clink_03.mp3', type: 'audio' },
    // Hero drinks a potion dropped onto him (or drunk from inventory). | Swapped from the old Potion_Drink_01.mp3 gulp to this fuller swallow.
    { key: 'potion_drink', path: 'assets/music/Potion_Drink_02.wav', type: 'audio' },
    // Key card dropped back into the inventory
    { key: 'key_drop', path: 'assets/music/Key_Drop_02.mp3', type: 'audio' },
    // Lightning-gem zap — 3 variants, loudness-normalized
    { key: 'lightning_zap_1', path: 'assets/music/Lightning_Zap_01.mp3', type: 'audio' },
    { key: 'lightning_zap_2', path: 'assets/music/Lightning_Zap_02.mp3', type: 'audio' },
    { key: 'lightning_zap_3', path: 'assets/music/Lightning_Zap_03.mp3', type: 'audio' },
    // Acid/poison trap
    { key: 'poison_trap', path: 'assets/music/Poison_Trap_01.mp3', type: 'audio' },
    // "Nothing" card revealed — empty-slot whoosh
    { key: 'empty_whoosh', path: 'assets/music/Folder_Whoosh_01.mp3', type: 'audio' },
    // Enemies frozen (Frost Ring) — icy magic cast
    { key: 'enemy_freeze', path: 'assets/music/Enemy_Freeze_01.mp3', type: 'audio' },
    // Single-shot effects
    { key: 'bow_shot', path: 'assets/music/Bow_Shot_01.mp3', type: 'audio' },
    { key: 'enemy_death_1', path: 'assets/music/Enemy_Death_01.mp3', type: 'audio' },
    { key: 'enemy_death_2', path: 'assets/music/Enemy_Death_02.mp3', type: 'audio' },
    { key: 'heavy_swing', path: 'assets/music/Heavy_Attack_Swing_01.mp3', type: 'audio' },
    { key: 'thorns_hit', path: 'assets/music/Thorns_Retaliation_01.mp3', type: 'audio' },
    { key: 'card_merge', path: 'assets/music/Card_Merge_Success_01.mp3', type: 'audio' },
    // ---- New SFX drop (2026-07): multi-take groups ---- | Loaded under _vN keys; SoundHelper.SFX_VARIANTS maps the canonical | key (card_flip, coin_collect, …) onto these so playSound rotates them | at random. Old single-file loads above stay put but go unused.
    { key: 'card_flip_v1', path: 'assets/music/Card_Flip_01.wav', type: 'audio' },
    { key: 'card_flip_v2', path: 'assets/music/Card_Flip_02.wav', type: 'audio' },
    { key: 'card_flip_v3', path: 'assets/music/Card_Flip_03.wav', type: 'audio' },
    { key: 'card_flip_v4', path: 'assets/music/Card_Flip_04.wav', type: 'audio' },
    { key: 'coin_collect_v1', path: 'assets/music/Coin_Pickup_01.wav', type: 'audio' },
    { key: 'coin_collect_v2', path: 'assets/music/Coin_Pickup_02.wav', type: 'audio' },
    { key: 'shop_buy_v1', path: 'assets/music/Purchase_01.wav', type: 'audio' },
    { key: 'shop_buy_v2', path: 'assets/music/Purchase_02.wav', type: 'audio' },
    { key: 'chest_open_v1', path: 'assets/music/Chest_Open_01.wav', type: 'audio' },
    { key: 'chest_open_v2', path: 'assets/music/Chest_Open_02.wav', type: 'audio' },
    { key: 'anvil_upgrade_v1', path: 'assets/music/Anvil_Strike_01.wav', type: 'audio' },
    { key: 'anvil_upgrade_v2', path: 'assets/music/Anvil_Strike_02.wav', type: 'audio' },
    { key: 'fireball_whoosh_v1', path: 'assets/music/Fireball_01.wav', type: 'audio' },
    { key: 'fireball_whoosh_v2', path: 'assets/music/Fireball_02.wav', type: 'audio' },
    { key: 'recovery_v1', path: 'assets/music/Heal_01.wav', type: 'audio' },
    { key: 'recovery_v2', path: 'assets/music/Heal_02.wav', type: 'audio' },
    { key: 'gem_pickup_v1', path: 'assets/music/Gem_01.wav', type: 'audio' },
    { key: 'gem_pickup_v2', path: 'assets/music/Gem_02.wav', type: 'audio' },
    { key: 'gem_pickup_v3', path: 'assets/music/Gem_03.wav', type: 'audio' },
    { key: 'gem_pickup_v4', path: 'assets/music/Gem_04.wav', type: 'audio' },
    // Hero eats food (bread) — restores actions. 3 variants rotate.
    { key: 'bread_eaten_1', path: 'assets/music/Bread_Eaten_01.wav', type: 'audio' },
    { key: 'bread_eaten_2', path: 'assets/music/Bread_Eaten_02.wav', type: 'audio' },
    { key: 'bread_eaten_3', path: 'assets/music/Bread_Eaten_03.wav', type: 'audio' },
    // Out of actions — hero acts while exhausted ("Weakened!"). 2 variants.
    { key: 'empty_stomach_1', path: 'assets/music/Empty_Stomach_01.wav', type: 'audio' },
    { key: 'empty_stomach_2', path: 'assets/music/Empty_Stomach_02.wav', type: 'audio' },
    // Arriving on a fresh combat floor. 3 variants rotate.
    { key: 'new_level_1', path: 'assets/music/New_Level_01.wav', type: 'audio' },
    { key: 'new_level_3', path: 'assets/music/New_Level_03.wav', type: 'audio' },
    // Hero death / defeat screen. 3 variants rotate.
    { key: 'hero_death_1', path: 'assets/music/Death_01.wav', type: 'audio' },
    { key: 'hero_death_2', path: 'assets/music/Death_02.wav', type: 'audio' },
    { key: 'hero_death_3', path: 'assets/music/Death_03.wav', type: 'audio' },
    // Act boss defeated — plays over the bespoke boss death animation.
    { key: 'boss_defeated', path: 'assets/music/Boss_Defeated_01.wav', type: 'audio' },
    // Looping campfire ambience for the Rest room.
    { key: 'campfire_loop', path: 'assets/music/Campfire_Loop_01.wav', type: 'audio' },
    // Looping music tracks
    { key: 'menu_music', path: 'assets/music/TOE_Campfire.mp3', type: 'audio' },
    { key: 'boss_music', path: 'assets/music/TOE_BattleDrums.mp3', type: 'audio' },
    { key: 'map_music', path: 'assets/music/TOE_Peaceful.mp3', type: 'audio' },
];

/**
 * Base enemy sprite key -> elite portrait key, for enemies that have dedicated
 * elite art. Enemies missing an entry here fall back to the tint highlight, so
 * this map can be filled in one enemy at a time as art lands.
 * @type {Record<string, string>}
 */
export const ELITE_SPRITE_KEYS = {
    spider_c: 'spider_c_elite',
    lostSoul: 'lostSoul_elite',
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
            case 'bitmapFont':
                loader.bitmapFont(asset.key, asset.path, asset.xmlPath);
                break;
            default:
                console.warn('Unknown asset type in manifest:', asset);
        }
    }
}
