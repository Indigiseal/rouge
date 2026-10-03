import { t } from '../i18n/i18n.js';
import { feedbackStyle } from './uiFont.js';

// Drawn sizes, in world pixels on the 640x360 stage. The bold, outlined Noto
// Sans reads much larger than the old pixel font did at the same nominal size,
// so these are set against how they actually look rather than carried over.
// They keep the ranking: a major event outsizes an ordinary one, which outsizes
// a minor one, and the caption under a number stays the smallest thing on
// screen without dropping out of legibility.
export const NORMAL_PX = 12;
export const MAJOR_PX = 14;
export const MINOR_PX = 10;
export const CAPTION_PX = 9;

export const FEEDBACK_COLORS = Object.freeze({
    damage: '#ff9a88', heal: '#9ee8ad', defense: '#9ddcff',
    bonus: '#ffda7a', neutral: '#f6efe1', magic: '#d5afff', minor: '#d0c7b8',
});

// Raw damage alone controls number size. No target-health or critical multiplier.
// 11px for a scratch, 18px by the time a hit is around 50. Logarithmic, so the
// early numbers still separate from each other instead of all sitting at the
// floor: 1 -> 11, 5 -> 14, 10 -> 15, 20 -> 16, 50 -> 18.
export const DAMAGE_PX_MIN = 11;
export const DAMAGE_PX_MAX = 18;
export function damageFontSize(amount) {
    return Math.min(DAMAGE_PX_MAX,
        Math.max(DAMAGE_PX_MIN, DAMAGE_PX_MIN + 1.25 * Math.log2(Math.max(1, Number(amount) || 1))));
}

// Legacy callers are classified BEFORE translation; new callers pass semantic
// options (type, amount, critical, lethal, target). No translated-word matching.
export function describeFeedback(message, options = {}) {
    const english = t({ language: 'en' }, message);
    const number = english.match(/^[-−+]\s*(\d+(?:\.\d+)?)/);
    const amount = options.amount ?? (number ? Number(number[1]) : undefined);
    let type = options.type;
    if (!type) {
        if (/coins?|crystals?|pips|actions?|\bAP\b/i.test(english) && number) type = 'reward';
        else if (/^[-−]/.test(english) && number) type = /poison|burn|fire|plague|thorns|reflect|mirrored|zap/i.test(english) ? 'tick' : 'damage';
        else if (/^\+/.test(english) && number) type = /max hp/i.test(english) ? 'reward' : /\bHP\b|heal|leech/i.test(english) ? 'heal' : 'reward';
        else if (/miss|dodg|evad/i.test(english)) type = 'miss';
        else if (/broke|broken|execut|devoured|assassinat/i.test(english)) type = 'major';
        else if (/crit|double damage|war horn|heavy strike|first blood|keen edge|dual wield|cleave|volley|pierce|lucky/i.test(english)) type = 'bonus';
        else if (/wore off|faded|thawed|left!|^frozen \(/i.test(english)) type = 'minor';
        else if (/block|immune|shield|frozen|shock|bulwark|armory/i.test(english)) type = 'defense';
        else if (/poison|spored|curse|weak|slow|stun|charm|web|shadow/i.test(english)) type = 'magic';
        else type = 'status';
    }
    const critical = Boolean(options.critical);
    const lethal = Boolean(options.lethal);
    const damaging = ['damage', 'tick'].includes(type);
    const priority = critical || lethal || type === 'major' || (damaging && amount >= 16) ? 2 : ['tick', 'minor', 'reward'].includes(type) ? 0 : 1;
    const color = critical || ['bonus', 'reward', 'major'].includes(type) ? FEEDBACK_COLORS.bonus
        : damaging ? FEEDBACK_COLORS.damage : type === 'heal' ? FEEDBACK_COLORS.heal
        : type === 'defense' ? FEEDBACK_COLORS.defense : type === 'magic' ? FEEDBACK_COLORS.magic
        : type === 'minor' ? FEEDBACK_COLORS.minor : FEEDBACK_COLORS.neutral;
    return {
        ...options, message, english, type, amount, critical, lethal, priority, color,
        size: damaging ? damageFontSize(amount) : type === 'major' ? MAJOR_PX : priority === 0 ? MINOR_PX : NORMAL_PX,
        hold: priority === 2 ? 1750 : priority === 0 ? 950 : 1350,
        fade: 350, pop: 110, drift: 10,
        mergeable: type === 'tick' && !critical && !lethal,
        mergeKey: type + ':' + english.replace(/\d+(?:\.\d+)?/g, '#'),
    };
}

const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

export class CombatFeedback {
    constructor(scene) {
        this.scene = scene;
        this.queue = [];
        this.live = [];
        this.lanes = new Map();
        this.ids = new WeakMap();
        this.nextId = 0;
        scene.events.on('update', this.update, this);
        scene.events.on('sleep', this.clear, this);
        scene.events.once('shutdown', this.destroy, this);
    }

    anchor(x, y, target) {
        const scene = this.scene;
        let entity = target;
        if (!entity) {
            // boardCards keeps null slots where cards were removed, and a removed
            // card's sprite is destroyed; skipping both is what lets a kill be
            // followed by any other floating text without throwing.
            const candidates = [scene.playerAvatar, ...(scene.cardSystem?.boardCards || []).filter(c => c?.revealed && c.sprite?.active).map(c => c.sprite)].filter(Boolean);
            let distance = 68;
            for (const candidate of candidates) {
                const d = Math.hypot(candidate.x - x, (candidate.y - y) * 0.8);
                if (d < distance) { distance = d; entity = candidate; }
            }
        }
        if (entity && typeof entity === 'object') {
            if (!this.ids.has(entity)) this.ids.set(entity, `target-${++this.nextId}`);
            const sprite = entity.sprite || entity;
            return { lane: this.ids.get(entity), x: sprite.x ?? x, y: (sprite.y ?? y) - Math.min(42, (sprite.displayHeight || 70) / 2) - 12 };
        }
        return { lane: `area-${Math.round(x / 72)}-${Math.round(y / 64)}`, x, y: y - 16 };
    }

    emit(x, y, message, options = {}) {
        const scene = this.scene;
        const event = { ...describeFeedback(message, options), ...this.anchor(x, y, options.target),
            createdAt: scene.time.now, readyAt: scene.time.now + (options.delayMs || 0), count: 1 };
        // The transcript remains exact, even if repeated ticks are combined on screen.
        if (!options.skipLog) scene.addCombatLog?.(t(scene, message), x, y);
        const previous = this.queue.find(e => event.mergeable && e.mergeable && e.lane === event.lane
            && e.mergeKey === event.mergeKey && event.createdAt - e.createdAt <= 300);
        if (previous) {
            previous.amount += event.amount;
            previous.count++;
            previous.size = damageFontSize(previous.amount);
            return;
        }
        // Minor repeats are the only events allowed to overflow into the log.
        if (event.priority === 0 && this.queue.filter(e => e.lane === event.lane).length >= 6) return;
        this.queue.push(event);
    }

    update() {
        const now = this.scene.time.now;
        this.live = this.live.filter(entry => entry.object.active);
        for (const event of [...this.queue].sort((a, b) => b.priority - a.priority || a.readyAt - b.readyAt)) {
            if (event.priority === 0 && now - event.createdAt > 1800) {
                this.queue.splice(this.queue.indexOf(event), 1);
                continue;
            }
            if (event.readyAt > now || (this.lanes.get(event.lane) || 0) > now) continue;
            const inLane = this.live.filter(e => e.event.lane === event.lane);
            // Never replace something before it has had a real reading interval.
            const replaceable = this.live.find(e => e.event.priority < event.priority && now - e.shownAt >= 900
                && (e.event.lane === event.lane || this.live.length >= 12));
            if ((inLane.length >= 3 || this.live.length >= 12) && replaceable) this.remove(replaceable);
            else if (inLane.length >= 3 || this.live.length >= 12) continue;
            const rendered = this.render(event);
            if (!rendered) { event.readyAt = now + 80; continue; }
            this.queue.splice(this.queue.indexOf(event), 1);
            this.lanes.set(event.lane, now + 170);
        }
        for (const [lane, until] of this.lanes) if (until < now && !this.queue.some(e => e.lane === lane)) this.lanes.delete(lane);
    }

    findSpace(event, width, height) {
        // Keep the reading log and upper controls clear; all bounds use the
        // entire measured label, including outline, pop, and its later drift.
        const left = event.x < 145 ? 6 : 150;
        const right = event.x < 145 ? 150 : 506;
        const maxX = right - width / 2;
        const minX = left + width / 2;
        const minY = height / 2 + 34;
        const maxY = 312 - height / 2;
        for (const dy of [0, -height - 6, height + 6, -2 * (height + 6), 2 * (height + 6), -3 * (height + 6)]) {
            for (const dx of [0, -32, 32]) {
                const x = Math.max(minX, Math.min(maxX, event.x + dx));
                const y = Math.max(minY, Math.min(maxY, event.y + dy));
                const bounds = { left: x - width / 2, right: x + width / 2, top: y - height / 2 - event.drift, bottom: y + height / 2 };
                if (!this.live.some(entry => overlap(bounds, entry.bounds))) return { x, y, bounds };
            }
        }
        return null;
    }

    render(event) {
        const scene = this.scene;
        let primary = t(scene, event.message);
        let caption = '';
        if (['damage', 'tick', 'heal'].includes(event.type) && Number.isFinite(event.amount)) {
            caption = primary.replace(/^[-−+]\s*\d+(?:\.\d+)?\s*/, '');
            primary = `${event.type === 'heal' ? '+' : '−'}${event.amount}`;
            if (event.count > 1) caption = `${caption} ×${event.count}`.trim();
            if (event.critical) caption = t(scene, 'float.crit');
            else if (event.label) caption = t(scene, event.label);
        }
        const style = {
            ...feedbackStyle(`${Math.round(event.size)}px`, event.color),
            fontStyle: event.priority === 2 ? '700' : '600',
            stroke: '#201715', strokeThickness: event.priority === 2 ? 3 : 2,
            align: 'center', padding: { x: 3, y: 2 },
            wordWrap: { width: 126, useAdvancedWrap: true },
        };
        const label = scene.add.text(0, 0, primary, style).setOrigin(0.5);
        const parts = [label];
        let height = label.height;
        let width = label.width;
        if (caption) {
            const detail = scene.add.text(0, 0, caption, { ...style, fontSize: `${CAPTION_PX}px`, fontStyle: '600', strokeThickness: 2 }).setOrigin(0.5);
            height += detail.height;
            width = Math.max(width, detail.width);
            label.y = -detail.height / 2;
            detail.y = label.height / 2;
            parts.push(detail);
        }
        const position = this.findSpace(event, width * 1.06 + 4, height * 1.06 + 4);
        if (!position) { parts.forEach(p => p.destroy()); return false; }
        const object = scene.add.container(position.x, position.y, parts).setDepth(10000);
        const entry = { object, event, bounds: position.bounds, shownAt: scene.time.now };
        this.live.push(entry);
        const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduceMotion) {
            object.setScale(event.priority === 2 ? 1.06 : 0.92);
            scene.tweens.add({ targets: object, scale: 1, duration: event.pop, ease: 'Cubic.easeOut' });
            scene.tweens.add({ targets: object, y: object.y - event.drift, duration: 260, ease: 'Cubic.easeOut' });
        }
        scene.tweens.add({ targets: object, alpha: 0, delay: 260 + event.hold, duration: event.fade,
            onComplete: () => this.remove(entry) });
        return true;
    }

    remove(entry) {
        this.scene.tweens.killTweensOf(entry.object);
        entry.object.destroy();
        this.live = this.live.filter(other => other !== entry);
    }

    clear() {
        this.live.slice().forEach(entry => this.remove(entry));
        this.queue = [];
        this.lanes.clear();
    }

    destroy() {
        this.clear();
        this.scene.events.off('update', this.update, this);
        this.scene.events.off('sleep', this.clear, this);
        if (this.scene.combatFeedback === this) this.scene.combatFeedback = null;
    }
}
