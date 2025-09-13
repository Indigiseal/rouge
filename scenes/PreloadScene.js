export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        //this.load.image('warrior', 'https://play.rosebud.ai/assets/playerAvatarWarrior.png?cQgd');
        this.load.image('axeCard', 'https://play.rosebud.ai/assets/commonAxeCard.png?ze1n');
        this.load.image('goblinCard', 'https://play.rosebud.ai/assets/goblinEnemyCard.png?8lHq');
        this.load.image('stoneFloor', 'https://play.rosebud.ai/assets/dungeon.png?2pLg');
        this.load.image('cardBack', 'https://play.rosebud.ai/assets/cardBack.png?Jnqe');
        this.load.image('goblin_c', 'https://play.rosebud.ai/assets/goblin_c.png?cg01');
        this.load.image('skeletonSprite', 'https://play.rosebud.ai/assets/skeleton_C.png?c1vY');
        
        // Load item sprites
        this.load.image('leather_C', 'https://rosebud.ai/assets/leatherCommon.png?pqJt');
        this.load.image('chain_C', 'https://play.rosebud.ai/assets/chain_C.png?B1AN');
        this.load.image('plate_C', 'https://play.rosebud.ai/assets/plate_C.png?WWuY');
        this.load.image('sword_C', 'https://rosebud.ai/assets/sword_c_r.png?hBYN');
        this.load.image('dagger_C', 'https://rosebud.ai/assets/dagger_c.png?3J8k');
        this.load.image('axe_C', 'https://play.rosebud.ai/assets/axe_C.png?8znw');
        this.load.image('spear_c', 'https://play.rosebud.ai/assets/spear_c.png?RHDQ');
        // Load Uncommon item sprites
        this.load.image('axe_U', 'https://play.rosebud.ai/assets/axe_U.png?Ucwr');
        this.load.image('dagger_U', 'https://rosebud.ai/assets/dagger_u.png?nFfc');
        this.load.image('spear_u', 'https://play.rosebud.ai/assets/spear_u.png?RlYU');
        this.load.image('sword_U', 'https://rosebud.ai/assets/sword_u.png?6sFR');
        this.load.image('chain_U', 'https://play.rosebud.ai/assets/chain_U.png?a7Yp');
        this.load.image('plate_U', 'https://play.rosebud.ai/assets/plate_U.png?e9O8');
        this.load.image('potionCardCommon', 'https://play.rosebud.ai/assets/potionCardCommon.png?ZnF8');
        this.load.image('potionCardUncommon', 'https://play.rosebud.ai/assets/potionCardUncommon.png?caTH');
        this.load.image('trap', 'https://play.rosebud.ai/assets/trap.png?LoEV');
        this.load.image('trap2', 'https://play.rosebud.ai/assets/trap2.png?y1MT');
        this.load.image('coin', 'https://play.rosebud.ai/assets/coin.png?TyWY');
        this.load.image('crystalCard', 'https://play.rosebud.ai/assets/crystalCard.png?TQf2');
        this.load.image('keyCard', 'https://play.rosebud.ai/assets/keyCard.png?mqmj');
        this.load.image('crystalSmall', 'https://play.rosebud.ai/assets/crystalSmall.png?cdQN');
        this.load.image('trapTriggers', 'https://play.rosebud.ai/assets/trapTriggers.png?Qd9K');
        this.load.audio('sword_swoosh', 'https://play.rosebud.ai/assets/knife-slice-41231.mp3?y3FV');
        this.load.audio('coin_collect', 'https://play.rosebud.ai/assets/coin-recieved.mp3?RPSA');
        this.load.audio('player_hurt', 'https://play.rosebud.ai/assets/male_hurt.mp3?0Y2E');
        this.load.audio('anvil_upgrade', 'https://play.rosebud.ai/assets/anvil-hit-2-14845.mp3?Gzrj');
        this.load.audio('item_discard', 'https://play.rosebud.ai/assets/discard-sound-effect-221455.mp3?DBYn');
        this.load.audio('trap_spring', 'https://rosebud.ai/assets/trap_spring1.mp3?bdfP');
        this.load.audio('trap_woosh', 'https://play.rosebud.ai/assets/fast-woosh-230497.mp3?7jAm');
        this.load.audio('armor_equip', 'https://play.rosebud.ai/assets/metal_clank.mp3?j2gC');
        this.load.audio('crystal_collect', 'https://play.rosebud.ai/assets/crystal_pick_up.mp3?2cXX');
        // Food 
        this.load.image('berries', 'https://rosebud.ai/assets/foodCommon4AP.png?I1wn');
        this.load.image('bread', 'https://play.rosebud.ai/assets/bread.png?zIjg');
        // New Cards
        this.load.image('amulet', 'https://play.rosebud.ai/assets/amulet.png?xx9e');
        this.load.image('key', 'https://play.rosebud.ai/assets/key.png?AYPV');
        this.load.image('AmuletOfVigor', 'https://play.rosebud.ai/assets/AmuletOfVigor.png?ndMh');
        this.load.image('MaskOfHollowWispers', 'https://play.rosebud.ai/assets/MaskOfHollowWispers.png?SJVn');
        // Load specific amulet sprites
        this.load.image('Healing Ring', 'https://rosebud.ai/assets/Healing Ring.png?wEWv');
        this.load.image('Boots of Evasion', 'https://rosebud.ai/assets/Boots of Evasion.png?yt6D');
        this.load.image('dragonClaw', 'https://rosebud.ai/assets/dragonClaw.png?9O5q');
        this.load.image('Bottomless Bag', 'https://rosebud.ai/assets/Bottomless Bag.png?kANB');
        this.load.image('amulet_scales_of_basilisk', 'https://play.rosebud.ai/assets/amulet_scales_of_basilisk.png?sU2i');
        this.load.audio('shop_buy', 'https://play.rosebud.ai/assets/dropInBagStore.mp3?2wqr');
        this.load.audio('card_flip', 'https://play.rosebud.ai/assets/flipcard-91468.mp3?WsGp');
        // Load flip animation frames
        this.load.image('cardFlip1', 'https://play.rosebud.ai/assets/cardFlip1.png?PfQU');
        this.load.image('cardFlip2', 'https://play.rosebud.ai/assets/cardFlip2.png?2o56');
        this.load.image('cardFlip3', 'https://play.rosebud.ai/assets/cardFlip3.png?MYxU');
        this.load.image('cardFlip4', 'https://play.rosebud.ai/assets/cardFlip4.png?8YGs');
        this.load.image('cardFlip5', 'https://play.rosebud.ai/assets/cardFlip5.png?xQPK');
        // Load card hover animation frames
        this.load.image('cardHover1', 'https://play.rosebud.ai/assets/cardHover1.png?aswW');
        this.load.image('cardHover2', 'https://play.rosebud.ai/assets/cardHover2.png?A6Bj');
        this.load.image('cardHover3', 'https://play.rosebud.ai/assets/cardHover3.png?VOfQ');
        this.load.image('cardHover4', 'https://play.rosebud.ai/assets/cardHover4.png?JeDi');
        this.load.image('cardHover5', 'https://play.rosebud.ai/assets/cardHover5.png?i1hY');
        this.load.image('discardSprite', 'https://play.rosebud.ai/assets/discard.png?p4VC');
        // Card hover when in inventory effects
        this.load.image('hoverCardsUp1', 'https://rosebud.ai/assets/hoverCardsUp1.png?ITut');
        this.load.image('hoverCardsUp2', 'https://rosebud.ai/assets/hoverCardsUp2.png?ymLr');
        this.load.image('hoverCardsUp3', 'https://rosebud.ai/assets/hoverCardsUp3.png?WMaU');
        this.load.image('hoverCardsUp4', 'https://rosebud.ai/assets/hoverCardsUp4.png?LrxP');
        this.load.image('hoverCardsUp5', 'https://rosebud.ai/assets/hoverCardsUp5.png?xwhr');

        this.load.image('healthBar', 'https://play.rosebud.ai/assets/healthBar.png?55lG');
        this.load.image('healthBarEmpty', 'https://play.rosebud.ai/assets/healthBarEmpty2.png?058S');
        this.load.image('nextTurnUp', 'https://play.rosebud.ai/assets/nextTurnUp.png?wIZR');
        this.load.image('nextTurnDown', 'https://play.rosebud.ai/assets/nextTurnDown.png?DcB7');
        this.load.image('MainPlayerAvatar', 'https://play.rosebud.ai/assets/MainPlayerAvatar.png?VE0K');
        this.load.image('coinUI', 'https://play.rosebud.ai/assets/coinUI.png?DtvO');
        this.load.image('CrystalUI', 'https://play.rosebud.ai/assets/CrystalUI.png?GsA4');
        this.load.image('skeleton_c', 'https://play.rosebud.ai/assets/skeleton_c.png?7IYa');
        this.load.image('spider_c', 'https://play.rosebud.ai/assets/spider_c.png?lV8p');
        this.load.image('sword_c_reworked', 'https://rosebud.ai/assets/sword_c_r.png?kHez');
        this.load.image('durability_dot', 'https://play.rosebud.ai/assets/durability_dot.png?f10a');
        this.load.image('ten_durability', 'https://rosebud.ai/assets/ten_durability.png?Qtda');
        // Load twinkle animation frames
        this.load.image('twinkle1', 'https://play.rosebud.ai/assets/twinkle1.png?iErn');
        this.load.image('twinkle2', 'https://play.rosebud.ai/assets/twinkle2.png?YGhS');
        this.load.image('twinkle3', 'https://play.rosebud.ai/assets/twinkle3.png?CJ9i');
        this.load.image('twinkle4', 'https://play.rosebud.ai/assets/twinkle4.png?CFKN');
        // Bosses
        this.load.image('giantSkeleton', 'https://rosebud.ai/assets/giantSkeleton.png?6KNu');
        this.load.image('GoblinKingSprite', 'https://rosebud.ai/assets/goblinKing.png?IFRj');
        this.load.image('SpiderQween', 'https://rosebud.ai/assets/spiderBoss.png?yvFL');
         // Magic Cards
        this.load.image('fireBall', 'https://rosebud.ai/assets/magicBallCard.png?Srvc');
        this.load.image('frozenRing', 'https://rosebud.ai/assets/forzenRing.png?hA61');
        this.load.image('recovery', 'https://rosebud.ai/assets/recovery.png?WZxs');
        this.load.image('soulSucking', 'https://rosebud.ai/assets/soulSucking.png?HxiG');
        this.load.image('shadowDagger', 'https://rosebud.ai/assets/shadowDagger.png?qVjW');
        this.load.image('weakening', 'https://rosebud.ai/assets/weakening.png?rGYc');
        this.load.image('boneWall', 'https://rosebud.ai/assets/boneWall.png?tbCv');
        this.load.image('macigShield', 'https://rosebud.ai/assets/macicShield.png?XxHh');
        this.load.image('mirrorShield', 'https://rosebud.ai/assets/mirrorShield.png?9H71');
        this.load.image('smokeBomb', 'https://rosebud.ai/assets/smokeBomb.png?vGQw');
        this.load.audio('magic_cast', 'https://play.rosebud.ai/assets/fast-woosh-230497.mp3?7jAm');
        this.load.audio('recovery', 'https://play.rosebud.ai/assets/recovery.mp3?OnjZ');
        this.load.audio('boneWall', 'https://play.rosebud.ai/assets/boneWall.mp3?Y1lN');
        this.load.audio('mirrorShield', 'https://play.rosebud.ai/assets/mirrorShield.mp3?XAiv');
        this.load.audio('fireball_whoosh', 'https://play.rosebud.ai/assets/fireball-whoosh-1-179125.mp3?6rtu');
        this.load.audio('smoke_bomb', 'https://play.rosebud.ai/assets/smoke-bomb-6761.mp3?hiPC');
        this.load.audio('frozenRing', 'https://play.rosebud.ai/assets/frozenRing.mp3?4gCX');
        this.load.audio('shadowDagger', 'https://play.rosebud.ai/assets/shadowDagger.mp3?sCuW');
        this.load.audio('soulSucking', 'https://play.rosebud.ai/assets/soulSucking.mp3?eOVX');
        this.load.audio('magicShield', 'https://play.rosebud.ai/assets/magicShield.mp3?aHDc');
        this.load.audio('weakening', 'https://play.rosebud.ai/assets/weakening.mp3?e1SP');
        this.load.audio('trap_spring1', 'https://rosebud.ai/assets/trap_spring1.mp3?bdfP');

        // UI animations
       this.load.image('crystalAnimation1', 'https://rosebud.ai/assets/crystalAnimation1.png?Diyr');
       this.load.image('crystalAnimation2', 'https://rosebud.ai/assets/crystalAnimation2.png?l3NI');
       this.load.image('crystalAnimation3', 'https://rosebud.ai/assets/crystalAnimation3.png?vmkj');
       this.load.image('crystalAnimation4', 'https://rosebud.ai/assets/crystalAnimation4.png?y6Vh');
       this.load.image('crystalAnimation5', 'https://rosebud.ai/assets/crystalAnimation5.png?DeYS');
       this.load.image('crystalAnimation6', 'https://rosebud.ai/assets/crystalAnimation6.png?ABR4');
       this.load.image('coinAnimation1', 'https://rosebud.ai/assets/coinAnimation1.png?zqwy');
       this.load.image('coinAnimation2', 'https://rosebud.ai/assets/coinAnimation2.png?9D5t');
       this.load.image('coinAnimation3', 'https://rosebud.ai/assets/coinAnimation3.png?o1LS');
       this.load.image('coinAnimation4', 'https://rosebud.ai/assets/coinAnimation4.png?CbJB');
       this.load.image('coinAnimation5', 'https://rosebud.ai/assets/coinAnimation5.png?vDxg');
       this.load.image('coinAnimation6', 'https://rosebud.ai/assets/coinAnimation6.png?K0Xc');
        //Animation for Magic cards
        this.load.image('fireBall1', 'https://rosebud.ai/assets/fireBall1.png?TPQq');
        this.load.image('fireBall2', 'https://rosebud.ai/assets/fireBall2.png?ZlAB');
        this.load.image('fireBall3', 'https://rosebud.ai/assets/fireBall3.png?FBT6');
        this.load.image('fireBall4', 'https://rosebud.ai/assets/fireBall4.png?iUQw');
        //treasure
        this.load.image('chest', 'https://rosebud.ai/assets/treasureCHest.png?vulT');
        this.load.audio('chest_open', 'https://rosebud.ai/assets/wooden-trunk-latch-1-183944.mp3?l1TN');
        this.load.audio('trap_trigger', 'https://rosebud.ai/assets/trap_spring1.mp3?bdfP');
        this.load.image('mimic', 'https://rosebud.ai/assets/mimic.png?N3bx'); 
        this.load.audio('treasure_explode', 'https://rosebud.ai/assets/coin-flip-37787.mp3?0Riu'); 
        //Animation for MIMIC
        this.load.image('splash1', 'https://rosebud.ai/assets/splash1.png?rGbn');
        this.load.image('splash2', 'https://rosebud.ai/assets/splash2.png?gPUA');
        this.load.image('splash3', 'https://rosebud.ai/assets/splash3.png?zXOv');
        this.load.image('splash4', 'https://rosebud.ai/assets/splash4.png?fx0a');        
        this.load.image('splash5', 'https://rosebud.ai/assets/splash5.png?Qt0P');
        this.load.image('splash6', 'https://rosebud.ai/assets/splash6.png?KJyu');
        this.load.image('splash7', 'https://rosebud.ai/assets/splash7.png?RuHY');  
     
    }

    create() {
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
         
        this.scene.start('MainMenuScene');
    }
}