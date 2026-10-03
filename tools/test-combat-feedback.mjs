import assert from 'node:assert/strict';
import { CombatFeedback, damageFontSize, describeFeedback, FEEDBACK_COLORS } from '../src/ui/CombatFeedback.js';
import { wrapUiText } from '../src/ui/wrapText.js';

// An identical raw hit must have identical size on every enemy and on a crit.
for (const amount of [1, 5, 15, 30, 100, 99999]) {
    const normal = describeFeedback('-' + amount, { targetMaxHealth: 10 });
    const bossCrit = describeFeedback('-' + amount, { targetMaxHealth: 5000, critical: true });
    assert.equal(normal.size, bossCrit.size);
    assert(normal.size >= 11 && normal.size <= 18);
}
assert(damageFontSize(30) > damageFontSize(15));
assert(damageFontSize(15) > damageFontSize(5));
assert.equal(describeFeedback({key:'float.damage',vars:{amount:30}}).color, FEEDBACK_COLORS.damage);
assert.equal(describeFeedback('Miss!').type, 'miss');
assert.equal(describeFeedback('Immune!').type, 'defense');
assert.equal(describeFeedback('Weapon Broke!').priority, 2);
assert.equal(describeFeedback('+2 Max HP').type, 'reward');
assert.equal(describeFeedback('-5 coins stolen!').type, 'reward');
assert.equal(describeFeedback('-1 Poison').type, 'tick');
assert.equal(describeFeedback('-30').priority, 2);

function fixture() {
    const tweens = [];
    const log = [];
    const events = new Map();
    const scene = {
        time: {now:0}, game:{language:'en'},
        events: {on(name,fn,ctx){events.set(name,()=>fn.call(ctx));},once(){},off(){}},
        addCombatLog: text => log.push(text),
        add: {
            text(x,y,text,style) {
                const size=parseFloat(style.fontSize);
                return { x,y,text,style,width:Math.min(130,[...text].length*size*.55+6),height:size+7,
                    setOrigin(){return this;},destroy(){this.active=false;},active:true };
            },
            container(x,y,list) {return {x,y,list,active:true,setDepth(){return this;},setScale(){return this;},destroy(){this.active=false;list.forEach(t=>t.destroy());}};},
        },
        tweens: {add(tween){tweens.push({...tween,at:scene.time.now+(tween.delay||0)+tween.duration});},
            killTweensOf(target){for(let i=tweens.length-1;i>=0;i--) if(tweens[i].targets===target)tweens.splice(i,1);}},
    };
    const manager = new CombatFeedback(scene);
    function advance(ms) {
        scene.time.now+=ms;
        for(const tween of [...tweens]) if(tween.at<=scene.time.now && tween.targets.active) {
            tweens.splice(tweens.indexOf(tween),1);tween.onComplete?.();
        }
        manager.update();
    }
    return {scene,manager,advance,log,events};
}
{
    const {manager,advance,log,events}=fixture();
    const target={x:275,y:190,displayHeight:70};
    for(let i=0;i<4;i++) manager.emit(275,190,'-1 Poison',{target});
    assert.equal(log.length,4,'the log must retain every damage event');
    assert.equal(manager.queue.length,1,'same-target ticks may combine');
    assert.equal(manager.queue[0].amount,4);
    manager.emit(275,180,'Miss!',{target});
    manager.emit(275,160,'Miss!',{target});
    assert.equal(manager.queue.length,3,'misses must stay separate');
    advance(1);
    assert.equal(manager.live.length,1);
    advance(100);
    assert.equal(manager.live.length,1,'same-target messages need a readable interval');
    advance(70);
    assert.equal(manager.live.length,2);
    const [a,b]=manager.live.map(e=>e.bounds);
    assert(a.bottom<=b.top || b.bottom<=a.top || a.right<=b.left || b.right<=a.left,'measured boxes cannot overlap');
    advance(500);
    assert(manager.live.every(e=>e.object.active),'text must not disappear during reading');
    events.get('sleep')();
    assert.equal(manager.live.length,0);
    assert.equal(manager.queue.length,0);
    advance(5000);
    assert.equal(manager.live.length,0,'old effects must not appear in a new room');
}
{
    const {manager,advance}=fixture();
    const left={x:200,y:180},right={x:410,y:180};
    manager.emit(200,180,'-2 Poison',{target:left,delayMs:100});
    manager.emit(410,180,'-2 Poison',{target:right,delayMs:100});
    advance(50);assert.equal(manager.live.length,0);
    advance(50);assert.equal(manager.live.length,2,'different actors have independent lanes');
    advance(1600);assert.equal(manager.live.length,0,'expired objects and slots must be released');
}
{
    const object={style:{wordWrapWidth:2},context:{measureText:s=>({width:[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(s)].length})}};
    assert.equal(wrapUiText('攻撃回避',object),'攻撃\n回避');
    assert.equal(wrapUiText('e\u0301e\u0301e\u0301',object),'e\u0301e\u0301\ne\u0301','combining marks must remain with their letters');
}
console.log('Combat feedback checks passed: raw damage sizing, semantics, pacing, merging, collision bounds, cleanup and Unicode wrapping.');
