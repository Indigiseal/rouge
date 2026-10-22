import { sigilLevel } from '../sigils/sigils.js';

/** A first defeat becomes a vulnerable pile, with no kill payout yet. */
export function enterBonePile(data) {
    if (!data || !(data.health <= 0) || data.isBonePile || data.reassembled
        || sigilLevel(data, 'reassemble') <= 0) return false;
    data.reassemblyBody = {
        name: data.name, attack: data.attack, armor: data.armor || 0,
    };
    data.isBonePile = true;
    data.bonePileFresh = true;
    data.reassemblyTurns = 1;
    data.name = 'Bone Pile';
    data.health = 1;
    data.attack = 0;
    data.armor = 0;
    data.statusEffects = [];
    data.burn = 0;
    data.frozen = data.shockedTurns = data.webbedTurns = 0;
    data.dazed = data.charmed = data.sapped = false;
    return true;
}

/** The killing action's enemy phase does not use up the chance to finish it. */
export function advanceBonePile(data) {
    if (!data?.isBonePile || data.health <= 0) return false;
    if (data.bonePileFresh) { data.bonePileFresh = false; return false; }
    data.reassemblyTurns = Math.max(0, (data.reassemblyTurns || 1) - 1);
    if (data.reassemblyTurns > 0) return false;
    const body = data.reassemblyBody;
    data.name = body?.name || 'Bone Heap';
    data.attack = body?.attack || 0;
    data.armor = body?.armor || 0;
    data.health = Math.max(1, Math.ceil((data.maxHealth || 1) / 2));
    data.isBonePile = false;
    data.reassembled = true;
    data.sigils = data.sigils?.filter(sigil => sigil.id !== 'reassemble');
    delete data.reassemblyBody;
    return true;
}

/** Restore armor, never HP or capacity. Return changes for visible feedback. */
export function repairBoneArmor(card, board, random = Math.random) {
    const data = card?.data;
    if (!data || data.health <= 0 || data.isBonePile) return [];
    const changes = [];
    const repair = target => {
        const amount = Math.min(1, (target.data.maxArmor || 0) - (target.data.armor || 0));
        if (amount <= 0) return;
        target.data.armor = (target.data.armor || 0) + amount;
        changes.push({ card: target, amount });
    };
    if (sigilLevel(data, 'warding') > 0) repair(card);
    if (sigilLevel(data, 'mending') > 0) {
        const candidates = [...new Set(board || [])].filter(other => other && other !== card
            && other.revealed && !other.data?.isBonePile && (other.data?.health || 0) > 0
            && (other.data.maxArmor || 0) > (other.data.armor || 0));
        if (candidates.length) repair(candidates[Math.floor(random() * candidates.length)]);
    }
    return changes;
}

/** Failed placement stays pending; spent thresholds survive as card data. */
export function summonAtHealthThresholds(data, ability, summon) {
    if (!Array.isArray(ability?.thresholds) || !(data?.health > 0)) return 0;
    const spent = data.summonThresholdsSpent ||= [];
    const share = data.health / Math.max(1, data.maxHealth || data.health);
    let count = 0;
    for (const threshold of [...ability.thresholds].sort((a, b) => b - a)) {
        if (share > threshold || spent.includes(threshold)) continue;
        if (!summon(ability.enemyType)) break;
        spent.push(threshold);
        count++;
    }
    return count;
}
