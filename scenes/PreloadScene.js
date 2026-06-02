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
        this.load.image('axeCard', 'assets/commonAxeCard.png');
        this.load.image('goblinCard', 'assets/goblinEnemyCard.png');
        this.load.image('stoneFloor', 'assets/dungeon.png');
        this.load.image('cardBack', 'assets/cardBack.png');
        this.load.image('panelCards', 'assets/panelCards.png');
        this.load.image('gamingBoard', 'assets/gamingBoard.png');
        this.load.image('gamingBoard2', 'assets/gamingBoard2.png');
        this.load.image('gamingBoardSideExtra', 'assets/gamingBoardSIdewaysExtra.png');
        this.load.spritesheet('gamingBoardSideSmall', 'assets/gamingBoardSIdewaysSmall.png', { frameWidth: 208, frameHeight: 144 });
        this.load.image('eventPaper', 'assets/paper.png');
        this.load.image('eventPaper9Slice', 'assets/paper9Slice.png');
        this.load.spritesheet('eventsShops', 'assets/eventsShops80x80.png', { frameWidth: 80, frameHeight: 80 });
        this.load.image('panelArmor', 'assets/panelArmor.png');
        this.load.bitmapFont('pixel-font', 'assets/fonts/minogram_6x10.png', 'assets/fonts/minogram_6x10.xml');
        this.load.bitmapFont('cyrillic-ui-font', 'assets/fonts/probly12NEW_crisp.png', 'assets/fonts/probly12NEW_crisp.xml');
        this.load.image('goblin_c', 'assets/goblin_c.png');
        this.load.image('skeletonSprite', 'assets/skeleton_c.png');
        
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
        this.load.image('spear_c', 'assets/spear_c.png');
        // Load Uncommon / Rare / Epic / Legendary item sprites
        this.load.image('axe_U', 'assets/axe_U.png');
        this.load.image('axe_R', 'assets/axe_R.png');
        this.load.image('axe_E', 'assets/axe_E.png');
        this.load.image('axe_L', 'assets/axe_L.png');
        this.load.image('dagger_U', 'assets/dagger_u.png');
        this.load.image('dagger_R', 'assets/dagger_r.png');
        this.load.image('dagger_E', 'assets/dagger_e.png');
        this.load.image('dagger_L', 'assets/dagger_l.png');
        this.load.image('spear_u', 'assets/spear_u.png');
        this.load.image('spear_R', 'assets/spear_R.png');
        this.load.image('spear_E', 'assets/spear_E.png');
        this.load.image('spear_L', 'assets/spear_L.png');
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
        this.load.image('crystalSmall', 'assets/crystalSmall.png');
        this.load.image('trapTriggers', 'assets/trapTriggers.png');
        this.load.image('thornsCard', 'assets/thornsCard.png');
        this.load.image('thornsCard_U', 'assets/thornsCard_U.png');
        this.load.image('thornsCard_R', 'assets/thornsCard_R.png');
        this.load.image('thornsCard_E', 'assets/thornsCard_E.png');
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
        // New Cards
        this.load.image('amulet', 'assets/amulet.png');
        this.load.image('key', 'assets/key.png');
        this.load.image('AmuletOfVigor', 'assets/AmuletOfVigor.png');
        this.load.image('MaskOfHollowWispers', 'assets/MaskOfHollowWispers.png');
        this.load.spritesheet('relicsOthers', 'assets/relicsOthers.png', { frameWidth: 32, frameHeight: 32 });
        // Load specific amulet sprites
        this.load.image('Healing Ring', 'assets/HealingRing.png');
        this.load.image('Boots of Evasion', 'assets/BootsOfEvasion.png');
        this.load.image('dragonClaw', 'assets/dragonClaw.png');
        this.load.image('Bottomless Bag', 'assets/BottomlessBag.png');
        this.load.image('amulet_scales_of_basilisk', 'assets/amulet_scales_of_basilisk.png');
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
        // Card hover when in inventory effects
        this.load.image('hoverCardsUp1', 'assets/hoverCardsUp1.png');
        this.load.image('hoverCardsUp2', 'assets/hoverCardsUp2.png');
        this.load.image('hoverCardsUp3', 'assets/hoverCardsUp3.png');
        this.load.image('hoverCardsUp4', 'assets/hoverCardsUp4.png');
        this.load.image('hoverCardsUp5', 'assets/hoverCardsUp5.png');

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
        this.load.image('sword_c_reworked', 'assets/sword_c_r.png');
        this.load.image('durability_dot', 'assets/durability_dot.png');
        this.load.image('ten_durability', 'assets/ten_durability.png');
        // Load twinkle animation frames
        this.load.image('twinkle1', 'assets/twinkle1.png');
        this.load.image('twinkle2', 'assets/twinkle2.png');
        this.load.image('twinkle3', 'assets/twinkle3.png');
        this.load.image('twinkle4', 'assets/twinkle4.png');
        // Bosses
        this.load.image('giantSkeleton', 'assets/giantSkeleton.png');
        this.load.image('GoblinKingSprite', 'assets/goblinKing.png');
        this.load.image('SpiderQween', 'assets/spiderBoss.png');

        // Placeholder aliases for art that was never drawn or exported.
        this.load.image('amulet_regen', 'assets/amulet.png');
        this.load.image('amulet_healing', 'assets/HealingRing.png');
        this.load.image('amulet_invuln', 'assets/amulet.png');
        this.load.image('amulet_boots', 'assets/BootsOfEvasion.png');
        this.load.image('amulet_claw', 'assets/dragonClaw.png');
        this.load.image('amulet_pouch', 'assets/BottomlessBag.png');
        this.load.image('amulet_golem', 'assets/AmuletOfVigor.png');
        this.load.image('amulet_hammer', 'assets/AmuletOfVigor.png');
        this.load.image('amulet_chronos', 'assets/amulet_scales_of_basilisk.png');
        this.load.image('amulet_speed', 'assets/BootsOfEvasion.png');
        this.load.image('amulet_hourglass', 'assets/amulet_scales_of_basilisk.png');
        this.load.image('amulet_steel', 'assets/AmuletOfVigor.png');
        this.load.image('amulet_kitchen', 'assets/BottomlessBag.png');
        this.load.image('amulet_vampiric', 'assets/HealingRing.png');
        this.load.image('amulet_soul', 'assets/MaskOfHollowWispers.png');
        this.load.image('amulet_hungry', 'assets/BottomlessBag.png');
        this.load.image('amulet_blood', 'assets/HealingRing.png');
        this.load.image('amulet_rage', 'assets/dragonClaw.png');
        this.load.image('amulet_berserker', 'assets/dragonClaw.png');
        this.load.image('goblin_archer', 'assets/goblinArcher_c.png');
        this.load.image('skeleton_archer', 'assets/skeletonArcher_c.png');
        this.load.image('Lich', 'assets/giantSkeleton.png');
        this.load.image('SoulEater', 'assets/giantSkeleton.png');
        this.load.image('Cerberus', 'assets/goblinKing.png');
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

        // UI animations
       this.load.image('crystalAnimation1', 'assets/crystalAnimation1.png');
       this.load.image('crystalAnimation2', 'assets/crystalAnimation2.png');
       this.load.image('crystalAnimation3', 'assets/crystalAnimation3.png');
       this.load.image('crystalAnimation4', 'assets/crystalAnimation4.png');
       this.load.image('crystalAnimation5', 'assets/crystalAnimation5.png');
       this.load.image('crystalAnimation6', 'assets/crystalAnimation6.png');
       this.load.image('coinAnimation1', 'assets/coinAnimation1.png');
       this.load.image('coinAnimation2', 'assets/coinAnimation2.png');
       this.load.image('coinAnimation3', 'assets/coinAnimation3.png');
       this.load.image('coinAnimation4', 'assets/coinAnimation4.png');
       this.load.image('coinAnimation5', 'assets/coinAnimation5.png');
       this.load.image('coinAnimation6', 'assets/coinAnimation6.png');
        //Animation for Magic cards
        this.load.image('fireBall1', 'assets/fireBall1.png');
        this.load.image('fireBall2', 'assets/fireBall2.png');
        this.load.image('fireBall3', 'assets/fireBall3.png');
        this.load.image('fireBall4', 'assets/fireBall4.png');
        //treasure
        this.load.image('chest', 'assets/treasureCHest.png');
        this.load.spritesheet('bigChestAnimation', 'assets/bigChestAnimation98x98.png', { frameWidth: 98, frameHeight: 98 });
        this.load.audio('chest_open', 'assets/wooden-trunk-latch-1-183944.mp3');
        this.load.audio('trap_trigger', 'assets/trap_spring1.mp3');
        this.load.image('mimic', 'assets/mimic.png'); 
        this.load.audio('treasure_explode', 'assets/coin-flip-37787.mp3'); 
        //Animation for MIMIC
        this.load.image('splash1', 'assets/splash1.png');
        this.load.image('splash2', 'assets/splash2.png');
        this.load.image('splash3', 'assets/splash3.png');
        this.load.image('splash4', 'assets/splash4.png');        
        this.load.image('splash5', 'assets/splash5.png');
        this.load.image('splash6', 'assets/splash6.png');
        this.load.image('splash7', 'assets/splash7.png');  
     
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
            frames: [
                { key: 'twinkle1' },
                { key: 'twinkle2' },
                { key: 'twinkle3' },
                { key: 'twinkle4' }
            ],
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
            frames: [
                { key: 'splash1' },
                { key: 'splash2' },
                { key: 'splash3' },
                { key: 'splash4' },
                { key: 'splash5' },
                { key: 'splash6' },
                { key: 'splash7' }
            ],
            frameRate: 12, // Adjust speed (10fps)
            repeat: 0 // Play once
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
