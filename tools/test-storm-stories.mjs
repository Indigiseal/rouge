import assert from 'node:assert/strict';
import { MockScene } from '../sim/mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { SaveManager } from '../src/managers/SaveManager.js';
import { createDefaultStoryRun } from '../src/content/story/StoryDefaults.js';
import { stormStoryEventIds, legacyNestHasCog } from '../src/content/story/StormStories.js';
import nest, { NEST_LEFT_NO_BOX, NEST_LEFT, NEST_TOOK_EGG } from '../src/content/events/monster_bird_nest.js';
import { canStartMusicBox } from '../src/content/events/broken_music_box.js';
import { getEvent } from '../src/content/events/index.js';

globalThis.Phaser.Scene = class {};
const { EventScene } = await import('../src/scenes/EventScene.js');

function fixture(location = 'stormhatch', story = {}) {
    const scene = Object.create(EventScene.prototype);
    scene.gameState = { coins: 30, playerHealth: 100, maxHealth: 100, currentFloor: 1,
        actLocationIds: [location, location, location], inventory: [null, null],
        heroMemory: {}, storyRun: { ...createDefaultStoryRun(), ...story } };
    scene.rewards = [];
    scene.deliveries = [];
    Object.assign(scene, {
        ensureStoryState() {}, getEventById: getEvent, _getForcedEventId: () => null,
        getArmWrestleCoinStake: () => 10, hasArmWrestleCard: () => false,
        hasEnchantableWeapon: () => false, getQualifyingCompanions: () => [], hasAmulet: () => false,
        isRobbedTravellerDue: () => false, isWebbedCorridorDue: () => false,
        markHeroMemory(key) { this.gameState.heroMemory[key] = true; },
        clearPendingEvent(id) { this.gameState.storyRun.pendingEvents = this.gameState.storyRun.pendingEvents.filter(value => value !== id); },
        addPendingEvent(id) { if (!this.gameState.storyRun.pendingEvents.includes(id)) this.gameState.storyRun.pendingEvents.push(id); },
        _reward(value) { this.rewards.push(value); },
        _deliverCardReward(card) { this.deliveries.push(card); return true; },
        loseHealthCapped(amount) { this.gameState.playerHealth -= amount; },
        _resolve(choice) { this.lastOutcome = choice.outcome(this.gameState, this); },
    });
    return scene;
}
const originalRandom = Math.random;
try {
    // Exercise the real picker, with shared one-off fillers already seen.
    const seen = Object.fromEntries(['mirrorSeen', 'abandonedCampSeen', 'oldChuteSeen', 'soupStandSeen',
        'tooNiceRoomSeen', 'wellSeen', 'slimyPrisonSeen', 'bookWormSeen', 'briarRoomSeen',
        'silkCocoonCacheSeen', 'lostPorterSeen', 'mirrorTwinSeen', 'tollCollectorsSeen',
        'armWrestlingSeen', 'screamingHeadSeen'].map(key => [key, true]));
    for (const location of ['stormhatch', 'thornwake', 'silkdeep', 'tollroad', 'boneflood',
        'mireturn', 'veilbleed', 'ashhowl', 'frosthollow', 'sandreach']) {
        for (const floor of [1, 16, 31]) {
            const scene = fixture(location, seen);
            scene.gameState.currentFloor = floor;
            const ids = stormStoryEventIds(scene.gameState, location);
            assert.deepEqual(ids, location === 'stormhatch' ? ['monster_bird_nest', 'something_wicked'] : []);
            for (const roll of [0, 0.99]) {
                Math.random = () => roll;
                const picked = scene._pickEvent().id;
                if (location === 'stormhatch') assert.equal(picked, roll === 0 ? 'monster_bird_nest' : 'something_wicked');
                else assert.ok(!['monster_bird_nest', 'something_wicked', 'brass_wizard'].includes(picked));
            }
        }
    }
    assert.deepEqual(stormStoryEventIds(fixture('stormhatch', { birdNestSeen: true, carnivalVisited: true }).gameState, 'stormhatch'), ['brass_wizard']);
    assert.deepEqual(stormStoryEventIds(fixture('stormhatch', { stoleBirdEgg: true, carnivalVisited: true, brassWizardSeen: true }).gameState, 'stormhatch'), []);

    // A fresh nest is independent even while a newer music-box chain is active.
    for (const boxState of ['unknown', 'opened', 'following', 'exploded', 'repaired']) {
        const scene = fixture('stormhatch', { boxState, pendingEvents: ['goblin_engineer'] });
        assert.equal(legacyNestHasCog(scene.gameState), false);
        assert.doesNotMatch(nest.description(scene.gameState), /music box|brass cog/);
        const result = scene.resolveBirdNestRaid({ tookCog: true, tookEgg: true });
        assert.equal(result.tookCog, false, 'stale minigame flags cannot grant a fresh nest a cog');
        assert.equal(scene.gameState.storyRun.boxState, boxState);
        assert.equal(scene.gameState.storyRun.birdNestSeen, true);
        assert.equal(scene.gameState.storyRun.birdAngry, true);
        assert.equal(scene.deliveries.length, 1);
        assert.equal(scene.deliveries[0].id, 'monsterEgg');
        assert.ok(!scene.gameState.heroMemory.learnedBirdNestHasCog);
    }
    const fresh = fixture();
    fresh._finishBirdNestSearch({ tookCog: true, tookEgg: true });
    assert.equal(fresh.lastOutcome, NEST_TOOK_EGG);
    assert.deepEqual(fresh.gameState.storyRun.pendingEvents, [], 'egg theft does not start the engineer');
    const left = fixture();
    const leave = nest.choices.find(choice => choice.id === 'nest_leave');
    leave.action(left.gameState, left);
    assert.equal(leave.outcome(left.gameState, left), NEST_LEFT_NO_BOX);
    assert.equal(left.gameState.storyRun.birdAngry, false);
    const timeout = fixture();
    timeout.resolveBirdNestRaid({ tookCog: true, tookEgg: true, timedOut: true });
    assert.equal(timeout.deliveries.length, 0);
    assert.equal(timeout.gameState.storyRun.birdAngry, true);

    // Old pending chains still resolve outside Storm and retain the cog repair path.
    for (const location of ['thornwake', 'tollroad', 'sandreach']) {
        const scene = fixture(location, { boxState: 'following', pendingEvents: ['monster_bird_nest'] });
        assert.equal(scene._pickEvent().id, 'monster_bird_nest');
        assert.equal(legacyNestHasCog(scene.gameState), true);
        assert.match(nest.description(scene.gameState), /music box/);
        scene.resolveBirdNestRaid({ tookCog: true });
        assert.equal(scene.gameState.storyRun.boxState, 'has_cog');
        assert.equal(scene.gameState.storyRun.boxHasCog, true);
        assert.deepEqual(scene.gameState.storyRun.pendingEvents, ['goblin_engineer']);
        assert.equal(scene.deliveries.length, 0);
    }
    const legacyLeave = fixture('thornwake', { boxState: 'opened', pendingEvents: ['monster_bird_nest'] });
    leave.action(legacyLeave.gameState, legacyLeave);
    assert.equal(leave.outcome(legacyLeave.gameState, legacyLeave), NEST_LEFT);
    const exploded = fixture('thornwake', { boxState: 'exploded', pendingEvents: ['monster_bird_nest'] });
    assert.equal(legacyNestHasCog(exploded.gameState), false);
    exploded.resolveBirdNestRaid({ tookCog: true });
    assert.equal(exploded.gameState.storyRun.boxState, 'exploded');
    assert.deepEqual(exploded.gameState.storyRun.pendingEvents, ['goblin_engineer'], 'old exploded-box chain retains its farewell');

    // The carnival's existing cost, refusal and queued Wizard follow-up remain.
    const carnival = fixture();
    carnival.refuseCarnivalHag();
    assert.equal(carnival.gameState.playerHealth, 97);
    assert.equal(carnival.gameState.storyRun.carnivalVisited, true);
    assert.deepEqual(carnival.gameState.storyRun.pendingEvents, ['brass_wizard']);
    carnival.gameState.actLocationIds.fill('sandreach');
    assert.equal(carnival._pickEvent().id, 'brass_wizard', 'queued follow-up survives moving away');
    assert.equal(canStartMusicBox(fixture().gameState, 'stormhatch'), false);

    // Existing angry-mother behavior remains portable, and story state saves intact.
    const game = new MockScene();
    game.gameState = new GameState(game);
    Object.assign(game.gameState.storyRun, fresh.gameState.storyRun);
    game.cardSystem = new CardSystem(game);
    game.cardSystem.boardCards = [{ data: { type: 'enemy', role: 'MELEE', brick: { r: 1, c: 0 } } }];
    Math.random = () => 0;
    assert.equal(game.cardSystem.injectAngryNestmother(3, 'COMBAT'), true);
    assert.equal(game.cardSystem.boardCards[0].data.storyEnemy, 'angry_nestmother');
    assert.equal(game.cardSystem.injectAngryNestmother(3, 'COMBAT'), false, 'no repeated spawn roll on re-entry');
    const saves = new SaveManager();
    saves.saveCurrentRun(game.gameState, { slots: [] }, game.cardSystem);
    const loaded = saves.loadCurrentRun();
    assert.equal(loaded.story.storyRun.birdNestSeen, true);
    assert.equal(loaded.story.storyRun.birdAngry, true);
    assert.deepEqual(loaded.story.storyRun.pendingEvents, []);
} finally { Math.random = originalRandom; }
console.log('Storm story checks passed: all-act location starts, independent nest/egg outcomes, legacy cog chains, carnival follow-ups, mother pursuit and saves.');
