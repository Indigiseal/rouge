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
        //this.load.image('warrior', 'assets/playerAvatarWarrior.png');
        this.load.image('stoneFloor', 'assets/dungeon.png');
        this.load.image('cardBack', 'assets/cardBack.png');
        this.load.image('panelCards', 'assets/panelCards.png');
        this.load.image('gamingBoard', 'assets/gamingBoard.png');
        this.load.image('gamingBoard2', 'assets/gamingBoard2.png');
        this.load.image('gamingBoardSideExtra', 'assets/gamingBoardSIdewaysExtra.png');
        this.load.spritesheet('gamingBoardSideSmall', 'assets/gamingBoardSIdewaysSmall.png', { frameWidth: 208, frameHeight: 144 });
        // Frame order: rest floor, defeat UI, victory UI, blacksmith floor.
        this.load.spritesheet('restRooms', 'assets/rest.png', { frameWidth: 144, frameHeight: 122 });
        // Frame order: defeat info, defeat detail, victory info, victory detail.
        this.load.spritesheet('resultPanels', 'assets/defeatWin9x9panels.png', { frameWidth: 96, frameHeight: 96 });
        this.load.spritesheet('resultBanners', 'assets/bannerLostWin.png', { frameWidth: 160, frameHeight: 32 });
        this.load.image('eventPaper', 'assets/paper.png');
        this.load.image('eventPaper9Slice', 'assets/paper9Slice.png');
        this.load.image('scrollHandle', 'assets/scroll.png');
        this.load.spritesheet('eventsShops', 'assets/eventsShops80x80.png', { frameWidth: 80, frameHeight: 80 });
        this.load.image('panelArmor', 'assets/panelArmor.png');
        this.load.bitmapFont('pixel-font', 'assets/fonts/minogram_6x10.png', 'assets/fonts/minogram_6x10.xml');
        this.load.bitmapFont('cyrillic-ui-font', 'assets/fonts/probly12NEW_crisp.png', 'assets/fonts/probly12NEW_crisp.xml');
        // Dedicated crisp 16px title font (rasterized 1-bit from Able5.ttf) so
        // event titles are pixel-sharp at a size the body bitmap font can't hit.
        this.load.bitmapFont('title-font', 'assets/fonts/title16.png', 'assets/fonts/title16.xml');
        this.load.image('goblin_c', 'assets/goblin_c.png');
        this.load.image('skeletonSprite', 'assets/skeleton_c.png');
        // Tutorial coach-mark pointer (16x16 cursor-style arrow).
        this.load.image('tutorialPointer', 'assets/pointer.png');
        this.load.image('angryNestmother', 'assets/bird.png');
        
        // Load item sprites
        this.load.image('leather_C', 'assets/leatherCommon.png');
        this.load.image('leather_U', 'assets/leather_U.png');
        this.load.image('leather_R', 'assets/leather_R.png');
        this.load.image('leather_E', 'assets/leather_E.png');
        this.load.image('leather_L', 'assets/leather_L.png');
        this.load.image('chain_C', 'assets/chain_C.png');
        this.load.image('plate_C', 'assets/plate_C.png');
        this.load.image('boneArmor_U', 'assets/boneArmor_U.png');
        this.load.image('sword_C', 'assets/sword_C.png');
        this.load.image('dagger_C', 'assets/dagger_c.png');
        this.load.image('axe_C', 'assets/axe_C.png');
        this.load.image('bow_c', 'assets/bow_c.png');
        // Load Uncommon / Rare / Epic / Legendary item sprites
        this.load.image('axe_U', 'assets/axe_U.png');
        this.load.image('axe_R', 'assets/axe_R.png');
        this.load.image('axe_E', 'assets/axe_E.png');
        this.load.image('axe_L', 'assets/axe_L.png');
        this.load.image('dagger_U', 'assets/dagger_u.png');
        this.load.image('dagger_R', 'assets/dagger_r.png');
        this.load.image('dagger_E', 'assets/dagger_e.png');
        this.load.image('dagger_L', 'assets/dagger_l.png');
        this.load.image('bow_U', 'assets/bow_U.png');
        this.load.image('bow_R', 'assets/bow_R.png');
        this.load.image('bow_E', 'assets/bow_E.png');
        this.load.image('bow_L', 'assets/bow_L.png');
        this.load.image('sword_U', 'assets/sword_u.png');
        this.load.image('sword_R', 'assets/sword_R.png');
        this.load.image('sword_E', 'assets/sword_E.png');
        this.load.image('sword_L', 'assets/sword_L.png');
        this.load.image('chain_U', 'assets/chain_U.png');
        this.load.image('chain_R', 'assets/chain_R.png');
        this.load.image('chain_E', 'assets/chain_E.png');
        this.load.image('chain_L', 'assets/chain_L.png');
        this.load.image('plate_U', 'assets/plate_U.png');
        this.load.image('plate_R', 'assets/plate_R.png');
        this.load.image('plate_E', 'assets/plate_E.png');
        this.load.image('plate_L', 'assets/plate_L.png');
        this.load.image('potionCardCommon', 'assets/potionCardCommon.png');
        this.load.image('potionCardUncommon', 'assets/potionCardUncommon.png');
        this.load.image('trap', 'assets/trap.png');
        this.load.image('trap2', 'assets/trap2.png');
        this.load.image('coin', 'assets/coin.png');
        this.load.image('crystalCard', 'assets/crystalCard.png');
        this.load.image('keyCard', 'assets/keyCard.png');
        this.load.image('trapTriggers', 'assets/trapTriggers.png');
        this.load.image('thornsCard', 'assets/thornsCard.png');
        this.load.image('thornsCard_U', 'assets/thornsCard_U.png');
        this.load.image('thornsCard_R', 'assets/thornsCard_R.png');
        this.load.image('thornsCard_E', 'assets/thornsCard_E.png');
        this.load.image('carnivalPipe', 'assets/pipe.png');
        this.load.image('carnivalDucky', 'assets/ducky.png');
        this.load.image('holographicOmen', 'assets/omen.png');
        this.load.spritesheet('luckyClover', 'assets/clover.png', { frameWidth: 53, frameHeight: 70 });
        this.load.spritesheet('mapNodes', 'assets/mapNodes42x42.png', { frameWidth: 42, frameHeight: 42 });
        this.load.spritesheet('gemsRGY', 'assets/gemsRGY-Sheet.png', { frameWidth: 16, frameHeight: 16 });
        // Enemy role marker: frame 0 = melee, frame 1 = ranged
        // 'enemyCardType' sprite sheet was the old melee/ranged/poison badge
        // overlay. The new enemy art bakes those icons into the cards, and
        // HP / ATK now render as corner numbers, so we no longer load it.
        this.load.spritesheet('gemEffectsOnCards', 'assets/gemEffectsOnCards64x80.png', { frameWidth: 64, frameHeight: 80 });
        this.load.spritesheet('enemiesHitEffects', 'assets/enemiesHitEffects64x80.png', { frameWidth: 64, frameHeight: 80 });
        this.load.spritesheet('shadowsGems', 'assets/shadowsGems.png', { frameWidth: 16, frameHeight: 20 });
        this.load.audio('sword_swoosh', 'assets/knife-slice-41231.mp3');
        this.load.audio('coin_collect', 'assets/coin-recieved.mp3');
        this.load.audio('player_hurt', 'assets/male_hurt.mp3');
        this.load.audio('anvil_upgrade', 'assets/anvil-hit-2-14845.mp3');
        this.load.audio('item_discard', 'assets/discard-sound-effect-221455.mp3');
        this.load.audio('trap_spring', 'assets/trap_spring1.mp3');
        this.load.audio('trap_woosh', 'assets/fast-woosh-230497.mp3');
        this.load.audio('armor_equip', 'assets/metal_clank.mp3');
        this.load.audio('crystal_collect', 'assets/crystal_pick_up.mp3');
        // Main menu
        this.load.image('mainBG', 'assets/mainBG.png');
        // Food
        this.load.image('berries', 'assets/foodCommon4AP.png');
        this.load.image('bread', 'assets/bread.png');
        this.load.image('egg', 'assets/egg.png');
        this.load.image('chickCompanion', 'assets/chickCompanion.png');
        this.load.image('chickCompanionUP', 'assets/chickCompanionUP.png');
        this.load.image('skeletonCompanion', 'assets/skeletonCompanion.png');
        this.load.image('skeletonCompanionUP', 'assets/skeletonCompanionUP.png');
        // New Cards
        this.load.image('amulet', 'assets/amulet.png');
        this.load.image('key', 'assets/key.png');
        this.load.spritesheet('relicsOthers', 'assets/relicsOthers.png', { frameWidth: 32, frameHeight: 32 });
        this.load.audio('shop_buy', 'assets/dropInBagStore.mp3');
        this.load.audio('card_flip', 'assets/flipcard-91468.mp3');
        // Load flip animation frames
        this.load.image('cardFlip1', 'assets/cardFlip1.png');
        this.load.image('cardFlip2', 'assets/cardFlip2.png');
        this.load.image('cardFlip3', 'assets/cardFlip3.png');
        this.load.image('cardFlip4', 'assets/cardFlip4.png');
        this.load.image('cardFlip5', 'assets/cardFlip5.png');
        // Load card hover animation frames
        this.load.image('cardHover1', 'assets/cardHover1.png');
        this.load.image('cardHover2', 'assets/cardHover2.png');
        this.load.image('cardHover3', 'assets/cardHover3.png');
        this.load.image('cardHover4', 'assets/cardHover4.png');
        this.load.image('cardHover5', 'assets/cardHover5.png');
        this.load.image('discardSprite', 'assets/discard.png');
        this.load.image('thornFrame', 'assets/thornFrame.png');
        // Card hover when in inventory effects (5 frames, 54x70 each)
        this.load.spritesheet('hoverCardsUpSheet', 'assets/hoverCardsUp54x70Sheet.png', { frameWidth: 54, frameHeight: 70 });
        // Card disappear dissolve (6 frames, 54x70 each) — plays on top of a card
        // as it is removed (enemy defeated, weapon pips spent).
        this.load.spritesheet('cardDisappearSheet', 'assets/cardDissappearAnimation54x70.png', { frameWidth: 54, frameHeight: 70 });
        // Card merge flicker (2 frames, 54x70 each) — plays on top of the merged
        // card. `mergeLegendarySheet` is the legendary-tier variant.
        this.load.spritesheet('mergeSheet', 'assets/merge.png', { frameWidth: 54, frameHeight: 70 });
        this.load.spritesheet('mergeLegendarySheet', 'assets/mergeLegendary.png', { frameWidth: 54, frameHeight: 70 });
        // Empty card poof effect (4 frames, 32x48 each)
        this.load.spritesheet('poofEmpty', 'assets/poofEmpty32x48frames.png', { frameWidth: 32, frameHeight: 48 });
        // Poison status indicator (5 frames, 16x32 each) — shown on poisoned enemies/hero
        this.load.spritesheet('poisonedStatus', 'assets/poisonedStatus.png', { frameWidth: 16, frameHeight: 32 });
        // Shock marker (6 frames, 16x32 each), positioned like poisonedStatus.
        this.load.spritesheet('shockedStatus', 'assets/shockedStatus.png', { frameWidth: 16, frameHeight: 32 });
        // Poison trap trigger poof (5 frames, 92x92 each)
        this.load.spritesheet('poisonPoof', 'assets/poisonPoof92x92.png', { frameWidth: 92, frameHeight: 92 });
        // Frozen frame overlay (66x80) — drawn on top of a frozen card in place
        // of the old blue tint.
        this.load.image('frozenFrame', 'assets/frozen.png');
        this.load.image('bossFrozenFrame', 'assets/bossFrozen.png');

        this.load.image('healthBar', 'assets/healthBar.png');
        this.load.image('healthBarEmpty', 'assets/healthBarEmpty2.png');
        this.load.spritesheet('healthOrb', 'assets/healthOrbFullEmpty62x54.png', { frameWidth: 62, frameHeight: 54 });
        this.load.image('actionPoint', 'assets/actionPoint.png');
        this.load.image('nextTurnUp', 'assets/nextTurnUp.png');
        this.load.image('nextTurnDown', 'assets/nextTurnDown.png');
        this.load.image('MainPlayerAvatar', 'assets/MainPlayerAvatar.png');
        this.load.image('coinUI', 'assets/coinUI.png');
        this.load.image('CrystalUI', 'assets/CrystalUI.png');
        this.load.image('skeleton_c', 'assets/skeleton_c.png');
        this.load.image('spider_c', 'assets/spider_c.png');
        this.load.image('lostSoul', 'assets/ghostlyEnemy.png');
        this.load.image('cerberusHead', 'assets/dogHead.png');
        this.load.image('sword_c_reworked', 'assets/sword_c_r.png');
        this.load.image('durability_dot', 'assets/durability_dot.png');
        this.load.image('ten_durability', 'assets/ten_durability.png');
        // Load twinkle animation frames
        this.load.spritesheet('twinkle', 'assets/twinkle60x78Sheet.png', { frameWidth: 60, frameHeight: 78 });
        // Bosses
        this.load.image('giantSkeleton', 'assets/giantSkeleton.png');
        this.load.image('GoblinKingSprite', 'assets/goblinKing.png');
        this.load.image('SpiderQween', 'assets/spiderBoss.png');

        this.load.image('goblin_archer', 'assets/goblinArcher_c.png');
        this.load.image('skeleton_archer', 'assets/skeletonArcher_c.png');
        this.load.image('Lich', 'assets/lich.png');
        this.load.image('SoulEater', 'assets/soulEater.png');
        this.load.image('Cerberus', 'assets/cerberus.png');
        this.load.image('AncientCerberus', 'assets/ancientCerberus.png');
         // Magic Cards
        this.load.image('fireBall', 'assets/magicBallCard.png');
        this.load.image('frozenRing', 'assets/forzenRing.png');
        this.load.image('recovery', 'assets/recovery.png');
        this.load.image('soulSucking', 'assets/soulSucking.png');
        this.load.image('shadowDagger', 'assets/shadowDagger.png');
        this.load.image('weakening', 'assets/weakening.png');
        this.load.image('boneWall', 'assets/boneWall.png');
        this.load.image('macigShield', 'assets/macicShield.png');
        this.load.image('mirrorShield', 'assets/mirrorShield.png');
        this.load.image('smokeBomb', 'assets/smokeBomb.png');
        this.load.audio('magic_cast', 'assets/fast-woosh-230497.mp3');
        this.load.audio('recovery', 'assets/recovery.mp3');
        this.load.audio('boneWall', 'assets/boneWall.mp3');
        this.load.audio('mirrorShield', 'assets/mirrorShield.mp3');
        this.load.audio('fireball_whoosh', 'assets/fireball-whoosh-1-179125.mp3');
        this.load.audio('smoke_bomb', 'assets/smoke-bomb-6761.mp3');
        this.load.audio('frozenRing', 'assets/frozenRing.mp3');
        this.load.audio('shadowDagger', 'assets/shadowDagger.mp3');
        this.load.audio('soulSucking', 'assets/soulSucking.mp3');
        this.load.audio('magicShield', 'assets/magicShield.mp3');
        this.load.audio('weakening', 'assets/weakening.mp3');
        this.load.audio('trap_spring1', 'assets/trap_spring1.mp3');

        // UI currency animations — the little coin/crystal flip shown when the
        // value changes. Now single spritesheets (6 frames each) instead of the
        // old crystalAnimation1-6 / coinAnimation1-6 individual PNGs.
        this.load.spritesheet('coinAnimSheet', 'assets/coinAnimation20x24.png', { frameWidth: 20, frameHeight: 24 });
        this.load.spritesheet('crystalAnimSheet', 'assets/crystalAnimation14x24.png', { frameWidth: 14, frameHeight: 24 });
        // Board defeat-loot animations — a coin jump / crystal scatter played on
        // the spot an enemy died when Prospector's Pick drops currency.
        this.load.spritesheet('coinJumpSheet', 'assets/coinAnimationJump58x38.png', { frameWidth: 58, frameHeight: 38 });
        this.load.spritesheet('crystalScatterSheet', 'assets/crystalAnimationSheet56x30.png', { frameWidth: 56, frameHeight: 30 });
        //Animation for Magic cards
        this.load.image('fireBall1', 'assets/fireBall1.png');
        this.load.image('fireBall2', 'assets/fireBall2.png');
        this.load.image('fireBall3', 'assets/fireBall3.png');
        this.load.image('fireBall4', 'assets/fireBall4.png');
        //treasure
        this.load.spritesheet('bigChestAnimation', 'assets/bigChestAnimation98x98.png', { frameWidth: 98, frameHeight: 98 });
        this.load.audio('chest_open', 'assets/wooden-trunk-latch-1-183944.mp3');
        this.load.audio('trap_trigger', 'assets/trap_spring1.mp3');
        this.load.image('mimic', 'assets/mimic.png'); 
        this.load.audio('treasure_explode', 'assets/coin-flip-37787.mp3'); 
        //Animation for MIMIC — merged 7-frame splash spritesheet (was splash1-7).
        this.load.spritesheet('splashSheet', 'assets/splashShee118x62t.png', { frameWidth: 118, frameHeight: 62 });

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
