import { areAmuletsDisabled } from '../../config/TestOptions.js';
import { resolveArmorSpawnTypes } from '../../content/characters/CharacterClasses.js';
import { applyArmorTalentMods } from '../../content/talents/index.js';
import {
    FLOOR_WEIGHTS,
    balanceCardWeights as balanceCardWeightsFn,
    calculateFormulaWeights as calculateFormulaWeightsFn,
    getCardWeights as getCardWeightsFn,
} from '../../content/balance/FloorWeights.js';
import {
    AMULET_RARITY_RATES,
    AMULET_SOURCE_MIN_FLOOR,
    AMULET_UPGRADE_REPLACES,
} from '../../content/amulets/rarityRates.js';
import {
    ENEMIES,
    BOSSES,
    BOSS_TIERS,
    WEAPONS,
    WEAPON_SPAWN_MIN_FLOOR,
    WEAPON_UNLOCKS,
    ARMORS,
    ARMOR_SPAWN_MIN_FLOOR,
    ARMOR_UNLOCKS,
    ARMOR_DURABILITY_BY_TYPE,
    armorDurability as armorDurabilityFn,
    TRAPS,
    POTIONS,
    FOOD,
    MAGIC,
    GEMS,
    GEM_SLOTS_BY_RARITY,
    gemSlotsForRarity as gemSlotsForRarityFn,
    AMULETS,
    SUMMON_ONLY_ENEMY_TYPES,
    weaponSpawnMinFloor,
    createWeaponCardData,
    createArmorCardData,
    getThornStats as getThornStatsFn,
    THORNS_SPRITE_BY_RARITY,
} from '../../content/cards/index.js';

export class CardDataGenerator {
    // Re-export content tables as statics for existing callers.
    static GEM_SLOTS_BY_RARITY = GEM_SLOTS_BY_RARITY;
    static ARMOR_DURABILITY_BY_TYPE = ARMOR_DURABILITY_BY_TYPE;
    static AMULET_RARITY_RATES = AMULET_RARITY_RATES;
    static AMULET_SOURCE_MIN_FLOOR = AMULET_SOURCE_MIN_FLOOR;
    static AMULET_UPGRADE_REPLACES = AMULET_UPGRADE_REPLACES;
    static SUMMON_ONLY_ENEMY_TYPES = SUMMON_ONLY_ENEMY_TYPES;

    static armorDurability(armorType, rarity) {
        return armorDurabilityFn(armorType, rarity);
    }

    static gemSlotsForRarity(rarity) {
        return gemSlotsForRarityFn(rarity);
    }

    static weaponGemSlots(weapon) {
        if (!weapon) return 1;
        if (weapon.gemSlots != null) return weapon.gemSlots;
        return CardDataGenerator.gemSlotsForRarity(weapon.rarity);
    }

    static weaponGemStack(weapon) {
        const slots = CardDataGenerator.weaponGemSlots(weapon);
        return Math.max(1, Math.min(slots, weapon?.gemCount || 1));
    }

    constructor() {
        this.weapons = WEAPONS;
        this.weaponSpawnMinFloor = WEAPON_SPAWN_MIN_FLOOR;
        this.armors = ARMORS;
        this.armorSpawnMinFloor = ARMOR_SPAWN_MIN_FLOOR;
        // Merged stats+floor view for older callers (merge identity, EventScene).
        this.weaponUnlocks = WEAPON_UNLOCKS;
        this.armorUnlocks = ARMOR_UNLOCKS;
        this.enemyData = ENEMIES;
        this.bossData = BOSSES;
        this.bossTiers = BOSS_TIERS;
        this.trapTypes = TRAPS;
        this.amuletTypes = AMULETS;
        this.potionTiers = POTIONS;
        this.foodTiers = FOOD;
        this.magicCards = MAGIC;
        this.floorWeights = FLOOR_WEIGHTS;
        this.useFormulaWeights = false;
    }

    getCardWeights(floor) {
        return getCardWeightsFn(floor, this.floorWeights);
    }

    balanceCardWeights(weights, floor = 1) {
        return balanceCardWeightsFn(weights, floor);
    }

    calculateFormulaWeights(floor) {
        return calculateFormulaWeightsFn(floor);
    }

    createCardData(type, floor, isElite = false, gameState = null, targetRarity = null, preferredRole = null) {
        switch (type) {
            case 'boss':
                return this.createBossCard(floor);
            case 'enemy':
                return this.createEnemyCard(floor, isElite, preferredRole);
            case 'mimic':
                return this.createMimicCard(floor);
            case 'coin':
                return this.createCoinCard(floor);
            case 'crystal':
                return this.createCrystalCard(floor);
            case 'trap':
                return this.createTrapCard(floor);
            case 'weapon':
                return this.createWeaponCard(floor, targetRarity);
            case 'armor':
                return this.createArmorCard(floor, targetRarity, gameState);
            case 'amulet':
                if (areAmuletsDisabled()) return null;
                // targetRarity here is overloaded as the SOURCE key when it's one of
                // floor/shop/rare_shop/boss; otherwise treat as a literal rarity filter.
                if (targetRarity && CardDataGenerator.AMULET_RARITY_RATES[targetRarity]) {
                    return this.createAmuletOffer(targetRarity, floor, gameState);
                }
                if (targetRarity) {
                    return this.createAmuletOffer(null, floor, gameState, targetRarity);
                }
                return this.createAmuletOffer('floor', floor, gameState);
            case 'potion':
                return this.createPotionCard(floor);
            case 'food':
                return this.createFoodCard(floor);
            case 'magic':
                return this.createMagicCard(floor);
            case 'thorns':
                return this.createThornsCard(floor, targetRarity);
            case 'gem':
                return this.createGemCard(floor);
            case 'key':
                return this.createKeyCard(floor);
            case 'empty':
                return this.createEmptyCard(floor);
            default:
                return null;
        }
    }

    // An "empty" card — reveals to nothing. Adds reveal risk and thins out
    // reward density (you can waste an action flipping a blank).
    createEmptyCard() {
        return { type: 'empty', name: 'Nothing', sprite: null };
    }

    createBossCard(floor) {
        // The act determines the tier; roll one boss at random from that tier's pool.
        const act = Math.max(1, Math.min(3, Math.floor((floor - 1) / 15) + 1));
        const pool = this.bossTiers[act] || this.bossTiers[1];
        const id = pool[Math.floor(Math.random() * pool.length)];
        // Deep-copy so per-fight mutations (health dropping, rage flag) never corrupt
        // the shared template for the next spawn/run.
        // Boss stats are used verbatim from bossData (pure-runs-v1: no knob
        // multipliers) — tune the tier tables directly.
        const boss = JSON.parse(JSON.stringify(this.bossData[id]));
        return boss;
    }

    createEnemyCard(floor, isElite = false, preferredRole = null) {
        // Fallback in case no enemies are available
        let availableEnemies = Object.keys(this.enemyData).filter(key =>
            floor >= this.enemyData[key].minFloor
            && !CardDataGenerator.SUMMON_ONLY_ENEMY_TYPES.has(key)
        );
        if (availableEnemies.length === 0) {
            return this.createFallbackEnemy(floor);
        }
        // Position-based typing: front rows draw only MELEE-type enemies, back rows
        // only RANGED (archers), so the sprite always matches where it sits. Fall
        // back to the full pool if no enemy of the requested role is unlocked yet.
        if (preferredRole) {
            const byRole = availableEnemies.filter(key => (this.enemyData[key].role || 'MELEE') === preferredRole);
            if (byRole.length > 0) availableEnemies = byRole;
        }
        const enemyType = availableEnemies[Math.floor(Math.random() * availableEnemies.length)];
        return this.createTieredEnemy(enemyType, floor, isElite);
    }

    createTieredEnemy(enemyType, floor, isElite = false) {
        const enemy = this.enemyData[enemyType];
        if (!enemy) return this.createFallbackEnemy(floor);

        // Find appropriate tier
        let selectedTier = enemy.tiers[0];
        for (let i = enemy.tiers.length - 1; i >= 0; i--) {
            if (floor >= enemy.tiers[i].minFloor) {
                selectedTier = enemy.tiers[i];
                break;
            }
        }

        // Tier stats are used verbatim (pure-runs-v1: no knob multipliers) —
        // difficulty is tuned directly in the enemyData tier tables above.
        const enemyCard = {
            type: 'enemy',
            name: enemy.name,
            health: selectedTier.health,
            attack: selectedTier.damage,
            sprite: enemy.sprite,
            role: enemy.role || 'MELEE', // Default to MELEE if role is missing
            // Intrinsic ranged flag from the enemy TYPE (archers). The board later
            // overrides `role` by row position, but this flag is preserved so
            // thorns/melee-only effects can tell a real archer from a front-row melee.
            isRangedType: enemy.role === 'RANGED'
        };

        if (enemy.abilities) {
            enemyCard.abilities = [...enemy.abilities];
        }
        return enemyCard;
    }

    createFallbackEnemy(floor) {
        return {
            type: 'enemy',
            name: 'Unknown Enemy',
            health: 5 + floor,
            attack: 2 + Math.floor(floor / 2),
            sprite: 'goblin_c',
            role: 'MELEE'
        };
    }

    createAngryNestmotherCard(floor) {
        // She's a ranged ARCHER (attacks from the back row, so thorns can't
        // reflect her) but noticeably sturdier and harder-hitting than a normal
        // enemy. Base her off the baseline MELEE enemy (skeleton) at THIS floor,
        // then bump. Using a fixed reference type — instead of the old random
        // createEnemyCard roll — makes her stats scale smoothly with depth
        // instead of swinging with whichever enemy type happened to be rolled.
        const baseEnemy = this.createTieredEnemy('skeleton', floor);
        return {
            ...baseEnemy,
            type: 'enemy',
            name: 'Angry Nestmother',
            health: Math.max(1, Math.ceil((baseEnemy.health || 1) * 1.2)),
            attack: Math.max(1, (baseEnemy.attack || 1) + 2),
            sprite: 'angryNestmother',
            role: 'RANGED',
            isRangedType: true,
            storyEnemy: 'angry_nestmother'
        };
    }

    // Mimic — a treasure that bites back. Normal HP, small attack. The player
    // must kill it within 3 turns of revealing it; otherwise it escapes.
    // On a successful kill it bursts into coins and crystals.
    createMimicCard(floor) {
        return {
            type: 'enemy',
            name: 'Mimic',
            health: 8 + Math.floor(floor / 2),
            attack: 2,
            sprite: 'mimic',
            role: 'MELEE',
            isMimic: true,
            escapeTurns: 3
        };
    }
    // This method is no longer needed as role assignment is handled in cardSystem.js
    /*
    createEnemyWithPreferredRole(floor, isElite = false, preferredRole = null) {
        // ... implementation ...
    }
    */

    createCoinCard(floor) {
        return {
            type: 'coin',
            // Coin cards remain meaningful as store prices rise.
            amount: 3 + Math.floor(floor / 8) + Math.floor(Math.random() * 4),
            name: 'Coins',
            sprite: 'coin'
        };
    }

    createCrystalCard(floor) {
        return {
            type: 'crystal',
            amount: 1, // flat 1 (was 1-2) — crystals were piling up unspent
            name: 'Crystal',
            sprite: 'crystalCard'
        };
    }

    createTrapCard(floor) {
        const totalWeight = this.trapTypes.reduce((sum, trap) => sum + trap.weight, 0);
        let random = Math.random() * totalWeight;

        for (let trapType of this.trapTypes) {
            random -= trapType.weight;
            if (random <= 0) {
                return {
                    type: 'trap',
                    subType: trapType.subType,
                    name: trapType.name,
                    sprite: trapType.sprite,
                    ...trapType.createData(floor)
                };
            }
        }
    }

    // Reward-rarity cap: shops/chests/boss rooms used to hand out epics and
    // legendaries far too early — by mid-act-2 you already had a legendary
    // axe from a chest. The cap shifts each rarity DOWN one tier in earlier
    // acts so the reward chain is:
    //   Act 1 (floors 1-15):  max UNCOMMON (legendary → epic → rare → uncommon)
    //   Act 2 (floors 16-30): max RARE     (legendary → epic → rare)
    //   Act 3 (floors 31+):   max LEGENDARY (no cap)
    // Result: act-1 boss room gives uncommon (was rare), act-2 boss room
    // gives rare (was epic), act-3 boss room still gives legendary.
    capRewardRarity(rarity, floor) {
        const order = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        const idx = order.indexOf(rarity);
        if (idx < 0) return rarity;
        let maxIdx = 4; // legendary by default
        if (floor <= 15)      maxIdx = 1; // act 1: uncommon
        else if (floor <= 30) maxIdx = 2; // act 2: rare
        return order[Math.min(idx, maxIdx)];
    }

    // Floor-weighted rarity roll for ad-hoc loot drops (when no explicit
    // targetRarity is requested). Returns one of common/uncommon/rare/epic.
    // Tuned so that:
    //   - Act 1 (1-15) is mostly commons with a sprinkle of uncommons.
    //   - Act 2 (16-30) drops uncommons regularly and starts seeing rares —
    //     the player has epic gear at this point and needs merge fodder.
    //   - Act 3 (31-45) drops rares and the occasional epic so endgame loot
    //     keeps pace with the player's merged gear.
    pickFloorRarity(floor) {
        // [common, uncommon, rare, epic] weights — caller will downgrade if
        // the picked rarity has no unlocked tier yet at this floor.
        let weights;
        // Slow rarity pipeline through act 2 so legendaries arrive closer to
        // act 3. High-tier weapons are the merge fodder for legendaries, so the
        // act-2 rare weights were cut (floors 23-30) and epic drops pushed fully
        // into act 3 (floor 31+). Rares are still present as merge fodder, just
        // scarcer, which stretches the rare→epic→legendary climb past act 2.
        // (Softer than a hard merge gate — see lever-1 tuning.)
        if (floor <= 10)       weights = [100, 0,  0,  0];
        else if (floor <= 17)  weights = [90,  10, 0,  0];
        else if (floor <= 22)  weights = [68,  29, 3,  0];
        else if (floor <= 27)  weights = [50,  40, 10, 0];
        else if (floor <= 30)  weights = [38,  47, 15, 0];
        // Act 3 (rebalance): playtest showed the old weights flooded act 3
        // with epics & rares. The new curve keeps uncommons + rares dominant
        // through act 3, with epics as a slow-arriving treat — boss room is
        // still where you reliably see a legendary.
        else if (floor <= 35)  weights = [25, 50, 22, 3];   // early act 3 — uncommons still dominant
        else if (floor <= 40)  weights = [15, 45, 33, 7];   // mid act 3   — balanced uncommon/rare
        else                   weights = [5,  35, 45, 15];  // late act 3  — rares lead, epics scarce
        const total = weights.reduce((s, w) => s + w, 0);
        let pick = Math.random() * total;
        const tiers = ['common', 'uncommon', 'rare', 'epic'];
        for (let i = 0; i < tiers.length; i++) {
            pick -= weights[i];
            if (pick <= 0) return tiers[i];
        }
        return 'common';
    }

    createWeaponCard(floor, targetRarity = null) {
        const rarityOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
        // Determine which rarity tier to use, falling back to the best available
        const resolveRarity = (weaponType) => {
            // No explicit rarity request → pick one weighted by floor so act 2/3
            // see uncommons/rares regularly instead of nothing but commons.
            const requested = targetRarity || this.pickFloorRarity(floor);
            const candidates = [requested, ...rarityOrder.slice(rarityOrder.indexOf(requested) + 1)];
            for (const r of candidates) {
                if (this.weapons[weaponType]?.[r] && floor >= weaponSpawnMinFloor(weaponType, r)) {
                    return r;
                }
            }
            return 'common';
        };

        const availableWeapons = [];

        Object.keys(this.weapons).forEach((weaponType) => {
            const rarity = resolveRarity(weaponType);
            const data = this.weapons[weaponType]?.[rarity];
            if (data && floor >= weaponSpawnMinFloor(weaponType, rarity)) {
                // Weapons fade out as the player out-levels them.
                // Each floor past their unlock costs 0.07 weight; common-tier fades a bit faster.
                const floorsPast = floor - weaponSpawnMinFloor(weaponType, rarity);
                const decay = rarity === 'common' ? 0.09 : 0.06;
                const weight = Math.max(0.08, 1 - floorsPast * decay);
                availableWeapons.push({
                    type: weaponType,
                    rarity,
                    weight,
                    ...data
                });
            }
        });

        if (availableWeapons.length === 0) {
            return createWeaponCardData('dagger', 'common', { name: 'Makeshift Weapon', special: null });
        }

        // Weighted random pick
        const totalWeight = availableWeapons.reduce((sum, w) => sum + w.weight, 0);
        let pick = Math.random() * totalWeight;
        let selected = availableWeapons[availableWeapons.length - 1];
        for (const candidate of availableWeapons) {
            pick -= candidate.weight;
            if (pick <= 0) {
                selected = candidate;
                break;
            }
        }
        return createWeaponCardData(selected.type, selected.rarity);
    }

    // Weapon CHOICE (docs/BALANCE-VISION.md, "Выбор геймплея при дропе"):
    // returns 2-3 weapons of DIFFERENT types but the same rolled rarity band,
    // so picking between them is a play-style decision (melee vs ranged vs
    // merge fodder), not a raw power decision. Intended consumers: the boss
    // reward room now, regular weapon drops once the pick-one UI exists.
    // Falls back to a single createWeaponCard when the floor only has one
    // weapon type unlocked.
    createWeaponChoice(floor, count = 3) {
        const rarity = this.pickFloorRarity(floor);
        const types = Object.keys(this.weapons);
        const options = [];
        for (const type of types) {
            const card = this.createWeaponCardOfType(type, floor, rarity);
            if (card) options.push(card);
        }
        if (options.length <= 1) {
            return [this.createWeaponCard(floor, rarity)];
        }
        // Shuffle so the order carries no signal, then cap at `count`.
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }
        return options.slice(0, count);
    }

    // Build a weapon card of a specific type at the requested rarity,
    // falling down to lower rarities the floor has unlocked. Returns null
    // if the type has no tier available at this floor.
    createWeaponCardOfType(weaponType, floor, targetRarity) {
        if (!this.weapons[weaponType]) return null;
        const rarityOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
        const start = Math.max(0, rarityOrder.indexOf(targetRarity));
        let picked = null;
        for (const r of rarityOrder.slice(start)) {
            if (this.weapons[weaponType][r] && floor >= weaponSpawnMinFloor(weaponType, r)) {
                picked = r;
                break;
            }
        }
        if (!picked) return null;
        return createWeaponCardData(weaponType, picked);
    }

    createArmorCard(floor, targetRarity = null, gameState = null) {
        const rarityOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common'];
        const resolveRarity = (armorType) => {
            // Same floor-weighted rarity as weapons — see pickFloorRarity().
            const requested = targetRarity || this.pickFloorRarity(floor);
            const candidates = [requested, ...rarityOrder.slice(rarityOrder.indexOf(requested) + 1)];
            for (const r of candidates) {
                if (this.armors[armorType]?.[r]
                    && floor >= (ARMOR_SPAWN_MIN_FLOOR[armorType]?.[r] ?? Infinity)) {
                    return r;
                }
            }
            return 'common';
        };

        const characterId = gameState?.characterId || 'rogue';
        const allowedTypes = resolveArmorSpawnTypes(characterId, gameState?.armorPool);
        const availableArmors = [];

        Object.keys(this.armors).forEach((armorType) => {
            if (!allowedTypes.includes(armorType)) return;
            const rarity = resolveRarity(armorType);
            const data = this.armors[armorType]?.[rarity];
            const minFloor = ARMOR_SPAWN_MIN_FLOOR[armorType]?.[rarity];
            if (data && Number.isFinite(minFloor) && floor >= minFloor) {
                availableArmors.push({ type: armorType, rarity });
            }
        });

        // Empty armor slot is valid — never invent a Makeshift fallback.
        if (availableArmors.length === 0) return null;

        const selected = availableArmors[Math.floor(Math.random() * availableArmors.length)];
        const card = createArmorCardData(selected.type, selected.rarity);
        if (card && gameState?.talentEffects) {
            applyArmorTalentMods(card, gameState.talentEffects);
        }
        return card;
    }

    // ── Amulet rarity-first offers ────────────────────────────────────────
    // Flow: roll rarity by source → sample up to 3 amulets of that rarity →
    // UI lets the player pick one. Event-only amulets (teaRoomBell, runes, …)
    // are NOT in amuletTypes and never appear here.

    rollAmuletRarity(source = 'floor') {
        const rates = CardDataGenerator.AMULET_RARITY_RATES[source]
            || CardDataGenerator.AMULET_RARITY_RATES.floor;
        const entries = Object.entries(rates);
        const total = entries.reduce((sum, [, w]) => sum + w, 0);
        let roll = Math.random() * total;
        for (const [rarity, weight] of entries) {
            roll -= weight;
            if (roll <= 0) return rarity;
        }
        return entries[entries.length - 1][0];
    }

    // Amulets of a given rarity the player can still usefully receive.
    // Boss offers ignore minFloor so act-1 boss can award rare/legendary.
    getAmuletsOfRarity(rarity, floor, gameState = null, { ignoreMinFloor = false } = {}) {
        if (rarity === 'old') return [];
        const ownedIds = new Set(
            (gameState?.activeAmulets || []).map((a) => a.id).filter(Boolean)
        );
        const replacedIds = new Set();
        for (const id of ownedIds) {
            const list = CardDataGenerator.AMULET_UPGRADE_REPLACES[id];
            if (list) list.forEach((r) => replacedIds.add(r));
        }

        return (this.amuletTypes || []).filter((amulet) =>
            amulet.rarity === rarity
            && (ignoreMinFloor || floor >= (amulet.minFloor ?? 0))
            && !ownedIds.has(amulet.id)
            && !replacedIds.has(amulet.id)
        );
    }

    // Weighted sample without replacement (uses drop weights + light group steer).
    sampleAmulets(pool, count, gameState = null) {
        if (!pool.length || count <= 0) return [];
        const groupOf = (id) => this.amuletTypes.find((a) => a.id === id)?.group;
        const ownedGroups = (gameState?.activeAmulets || [])
            .map((a) => groupOf(a.id))
            .filter((g) => g && g !== 'utility');
        let steer;
        if (ownedGroups.length === 0) {
            steer = (a) => (a.group === 'utility' ? 0.35 : 1.6);
        } else {
            const counts = {};
            ownedGroups.forEach((g) => { counts[g] = (counts[g] || 0) + 1; });
            const dominant = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
            steer = (a) => (a.group === dominant ? 1.5 : 1);
        }
        const weightOf = (a) => Math.max(0.01, (a.weight || 1) * steer(a));

        const remaining = pool.slice();
        const picked = [];
        while (picked.length < count && remaining.length) {
            const total = remaining.reduce((sum, a) => sum + weightOf(a), 0);
            let roll = Math.random() * total;
            let idx = 0;
            for (; idx < remaining.length; idx++) {
                roll -= weightOf(remaining[idx]);
                if (roll <= 0) break;
            }
            idx = Math.min(idx, remaining.length - 1);
            const [chosen] = remaining.splice(idx, 1);
            picked.push(chosen);
        }
        return picked;
    }

    amuletToCardData(amulet) {
        return {
            type: 'amulet',
            id: amulet.id,
            name: amulet.name,
            rarity: amulet.rarity,
            sprite: amulet.sprite,
            spriteFrame: amulet.spriteFrame,
            group: amulet.group || null,
        };
    }

    // Up to `count` concrete amulet cards of one rarity.
    createAmuletChoice(floor, rarity, count = 3, gameState = null, opts = {}) {
        const pool = this.getAmuletsOfRarity(rarity, floor, gameState, opts);
        return this.sampleAmulets(pool, count, gameState).map((a) => this.amuletToCardData(a));
    }

    // Mystery offer: rarity already rolled, options ready for the choice UI.
    // `forcedRarity` skips the source roll (used when caller already decided).
    createAmuletOffer(source, floor, gameState = null, forcedRarity = null) {
        if (areAmuletsDisabled()) return null;

        const sourceKey = source && CardDataGenerator.AMULET_RARITY_RATES[source] ? source : 'floor';
        const allowed = Object.keys(
            CardDataGenerator.AMULET_RARITY_RATES[sourceKey] || CardDataGenerator.AMULET_RARITY_RATES.floor
        );
        const poolOpts = { ignoreMinFloor: sourceKey === 'boss' };

        let rarity = forcedRarity;
        if (!rarity || !allowed.includes(rarity)) {
            // Prefer a rarity that still has candidates; fall back across the
            // source table if the first roll lands on an empty pool.
            const tried = new Set();
            for (let attempt = 0; attempt < allowed.length; attempt++) {
                const candidate = this.rollAmuletRarity(sourceKey);
                if (tried.has(candidate)) continue;
                tried.add(candidate);
                if (this.getAmuletsOfRarity(candidate, floor, gameState, poolOpts).length > 0) {
                    rarity = candidate;
                    break;
                }
            }
            if (!rarity) {
                for (const candidate of allowed) {
                    if (this.getAmuletsOfRarity(candidate, floor, gameState, poolOpts).length > 0) {
                        rarity = candidate;
                        break;
                    }
                }
            }
        }

        let options = rarity ? this.createAmuletChoice(floor, rarity, 3, gameState, poolOpts) : [];

        // No candidates for this floor/source.
        if (!options.length) return null;

        const label = `${rarity.charAt(0).toUpperCase()}${rarity.slice(1)} Amulet`;
        // Visual: show the first option's art as a stand-in on boards/shops;
        // the real pick happens in the choice overlay.
        const face = options[0];
        return {
            type: 'amulet',
            pendingChoice: true,
            source: sourceKey,
            rarity,
            options,
            id: null,
            name: label,
            sprite: face.sprite,
            spriteFrame: face.spriteFrame,
        };
    }

    // Legacy single-roll helper (events / random grants that still want one id).
    // Now: roll as floor source and return a random option from the choice set.
    createAmuletCard(floor, gameState = null) {
        const offer = this.createAmuletOffer('floor', floor, gameState);
        if (!offer?.options?.length) return null;
        const pick = offer.options[Math.floor(Math.random() * offer.options.length)];
        return pick;
    }

    createPotionCard(floor) {
        // Generated potions stay at base tier. Merging is what creates stronger versions.
        const selectedPotion = this.potionTiers[0];
        
        if (!selectedPotion) {
            // Fallback - should not happen if configured correctly
            return {
                type: 'potion',
                name: 'Minor Healing Potion',
                healAmount: 35,
                sprite: 'potionCardCommon',
                rarity: 'common',
            };
        }
        return {
            type: 'potion',
            name: selectedPotion.name,
            healAmount: selectedPotion.healAmount,
            sprite: selectedPotion.sprite,
            rarity: selectedPotion.rarity,
        };
    }
    
    // Next canonical potion tier up from `baseHealAmount`. Merging two identical
    // potions climbs this ladder (35 -> 70 -> 110 -> 200) so a merged potion is
    // always a real shop-tier potion, never an off-ladder heal value. Tops out
    // at the strongest tier.
    getUpgradedPotion(baseHealAmount) {
        const idx = this.potionTiers.findIndex(p => p.healAmount === baseHealAmount);
        const next = idx === -1
            ? (this.potionTiers.find(p => p.healAmount > baseHealAmount)
                || this.potionTiers[this.potionTiers.length - 1])
            : (this.potionTiers[idx + 1] || this.potionTiers[idx]);
        return {
            type: 'potion',
            name: next.name,
            healAmount: next.healAmount,
            sprite: next.healAmount > this.potionTiers[0].healAmount ? 'potionCardUncommon' : next.sprite,
            rarity: next.rarity,
        };
    }

    createFoodCard(floor) {
        // Generated food stays at base tier. Merging is what creates stronger versions.
        const selectedFood = this.foodTiers[0];
        
        if (!selectedFood) {
            // Fallback - should not happen if configured correctly
            return {
                type: 'food',
                name: 'Bread',
                actionAmount: 25,
                sprite: 'bread',
                rarity: 'common',
            };
        }
        return {
            type: 'food',
            name: selectedFood.name,
            actionAmount: selectedFood.actionAmount,
            sprite: selectedFood.sprite,
            rarity: selectedFood.rarity,
        };
    }

    createEggCard() {
        return {
            id: 'monsterEgg',
            type: 'food',
            name: 'Egg',
            actionAmount: 30,
            sprite: 'egg',
            rarity: 'uncommon',
        };
    }

    createChickCompanionCard() {
        return {
            id: 'chickCompanion',
            type: 'companion',
            name: 'Chick Companion',
            // Tuned down from 3 → 2: at 3 it was too strong even into act 3.
            attack: 2,
            sprite: 'chickCompanion',
            rarity: 'rare',
            unique: true
        };
    }

    createSkeletonWarriorCompanionCard() {
        return {
            id: 'skeletonWarriorCompanion',
            type: 'companion',
            name: 'Skeleton Warrior',
            attack: 3,
            attackStyle: 'melee',
            damageType: 'physical',
            range: 'melee',
            sprite: 'skeletonCompanion',
            rarity: 'rare',
            unique: true
        };
    }
    
    createMagicCard(floor) {
        // Get available magic cards for current floor
        const availableCards = this.magicCards.filter(card => floor >= card.minFloor);
        
        if (availableCards.length === 0) {
            return null; // No magic cards available yet
        }
        
        // Randomly select a magic card
        const selectedCard = availableCards[Math.floor(Math.random() * availableCards.length)];
        
        return {
            type: 'magic',
            magicType: selectedCard.magicType,
            name: selectedCard.name,
            description: selectedCard.description,
            rarity: selectedCard.rarity,
            sprite: selectedCard.sprite,
            damage: selectedCard.damage, // For fireball
            healAmount: selectedCard.healAmount,
        };
    }

    getThornStats(rarity) {
        return getThornStatsFn(rarity);
    }

    createThornsCard(floor, targetRarity = null) {
        const rarity = targetRarity || 'common';
        const thornsSprite = THORNS_SPRITE_BY_RARITY[rarity] || 'thornsCard';
        const tier = this.getThornStats(rarity);
        return {
            type: 'thorns',
            name: 'Thorns Card',
            thornDamage: tier.thornDamage,
            rarity,
            sprite: thornsSprite,
            durability: tier.durability,
            maxDurability: tier.durability,
        };
    }
    
    createKeyCard(floor) {
        return {
            type: 'key',
            name: 'Mysterious Key',
            sprite: 'keyCard',
            rarity: 'rare'
        };
    }

    createGemCard(floor) {
        const gem = GEMS[Math.floor(Math.random() * GEMS.length)];
        return {
            type: 'gem',
            gemEffect: gem.effect,
            name: gem.name,
            sprite: 'gemsRGY',
            spriteFrame: gem.frame,
            color: gem.color,
            rarity: 'common'
        };
    }
}

