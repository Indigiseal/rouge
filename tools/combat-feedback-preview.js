import { PreloadScene } from '../src/scenes/PreloadScene.js';
import { CombatFeedback } from '../src/ui/CombatFeedback.js';
import { loadUiFonts, fontFamily } from '../src/ui/fontFamilies.js';
import { serifStyle, feedbackStyle } from '../src/ui/uiFont.js';

await loadUiFonts('en');
let scene;
let holdTimer;
let report = { peak: 0, overlaps: 0, shown: [] };
const fixtures = {
    en: ['Miss!', 'Blocked!', '+12 HP', 'Weapon Broke!'],
    fr: ['Raté !', 'Bloqué !', '+12 PV', 'Arme brisée !'],
    ru: ['Промах!', 'Блок!', '+12 ОЗ', 'Оружие сломано!'],
    ja: ['回避！', '無効！', '+12 回復', '攻撃！'],
    zh: ['闪避！', '免疫！', '+12 治疗', '暴击！'],
    'zh-tw': ['閃避！', '免疫！', '+12 治療', '暴擊！'],
    ko: ['회피!', '면역!', '+12 회복', '치명타!'],
};
class Preview extends Phaser.Scene {
    create() {
        scene = this;
        this.game.language = 'en';
        PreloadScene.prototype.installCrispTextFactory.call(this);
        this.cameras.main.setZoom(2).centerOn(320,180);
        this.add.rectangle(320,180,640,360,0x2b2420);
        this.add.rectangle(563,182,124,265,0xe4d1aa).setStrokeStyle(2,0x765843);
        this.add.text(563,66,'Combat log',serifStyle('15px','#513d35')).setOrigin(.5);
        this.logText = this.add.text(511,86,'', {...serifStyle('12px','#513d35'),wordWrap:{width:105}});
        this.targets = [190,275,360,445].map((x,i) => {
            this.add.rectangle(x,201,66,102,[0x544737,0x554546,0x405044,0x47485a][i]).setStrokeStyle(2,0xc3a071);
            this.add.text(x,198,['Wolf','Guard','Sprite','Boss'][i],feedbackStyle('11px','#eee0c3')).setOrigin(.5);
            this.add.text(x,244,['10 HP','40 HP','8 HP','300 HP'][i],feedbackStyle('10px','#ffab97')).setOrigin(.5);
            return { x, y:201, displayHeight:102 };
        });
        this.playerAvatar = {x:65,y:206,displayHeight:70};
        this.add.rectangle(65,206,64,70,0x604038).setStrokeStyle(2,0xc3a071);
        this.add.text(65,206,'Player',feedbackStyle('12px','#eee0c3')).setOrigin(.5);
        this.cardSystem = {boardCards:this.targets.map(sprite=>({revealed:true,sprite}))};
        this.combatFeedback = new CombatFeedback(this);
        this.lines = [];
        this.addCombatLog = text => { this.lines.push(text); this.logText.setText(this.lines.slice(-12).join('\n')); };
        document.querySelector('#state').textContent = 'Ready. Choose a scenario.';
    }
    update() {
        if (!this.combatFeedback) return;
        const live = this.combatFeedback.live;
        report.peak = Math.max(report.peak,live.length);
        for (let i=0;i<live.length;i++) for(let j=i+1;j<live.length;j++) {
            const a=live[i].bounds,b=live[j].bounds;
            if(a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top) report.overlaps++;
        }
        for (const entry of live) if (!report.shown.some(e=>e.id===entry.event.createdAt+':'+entry.event.lane+':'+entry.event.english)) {
            report.shown.push({id:entry.event.createdAt+':'+entry.event.lane+':'+entry.event.english,
                text:entry.object.list.map(t=>t.text).join(' / '), size:entry.event.size,
                color:entry.event.color, weight:entry.object.list[0].style.fontStyle});
        }
        document.querySelector('#metrics').textContent=JSON.stringify({peak:report.peak,overlaps:report.overlaps,pending:this.combatFeedback.queue.length,live:live.length,shown:report.shown.map(({id,...e})=>e)},null,2);
    }
}
new Phaser.Game({type:Phaser.AUTO,width:1280,height:720,parent:'game',backgroundColor:'#2b2420',scene:Preview});
function send(target,message,options={}) { scene.combatFeedback.emit(target.x,target.y,message,{target,...options}); }
async function run(scenario) {
    if (!scene) return;
    clearTimeout(holdTimer);
    scene.scene.resume();
    // Refresh the Phaser clock after an inspection pause before timestamping
    // new events, so wall time spent inspecting isn't treated as queue age.
    await new Promise(resolve => scene.events.once('update', resolve));
    scene.combatFeedback.clear();
    scene.lines=[];scene.logText.setText('');report={peak:0,overlaps:0,shown:[]};
    const locale=document.querySelector('#locale').value;
    await loadUiFonts(locale);
    scene.game.language=locale;
    const specimen=document.querySelector('#specimen');
    specimen.style.fontFamily=fontFamily('reading',locale);
    specimen.textContent=fixtures[locale].join(' — ');
    const targets=scene.targets;
    if (scenario==='damage') [1,5,15,30].forEach((amount,i)=>send(targets[i],'-'+amount,{type:'damage',amount}));
    if (scenario==='critical') {
        send(targets[0],'-30',{type:'damage',amount:30});
        send(targets[3],'-30',{type:'damage',amount:30,critical:true});
    }
    if (scenario==='language') fixtures[locale].forEach((message,i)=>send(targets[i],message,{type:['miss','defense','heal','major'][i],...(i===2?{amount:12}:{})}));
    if (scenario==='burst') {
        for(let i=0;i<4;i++) {
            send(targets[i],'-5',{type:'damage',amount:5});
            for(let n=0;n<4;n++) send(targets[i],'-1 Poison',{type:'tick',amount:1,delayMs:n*60});
            send(targets[i],'Miss!',{type:'miss',delayMs:100});
        }
        send(scene.playerAvatar,'-12',{type:'damage',amount:12});
        send(scene.playerAvatar,'Weapon Broke!',{type:'major',delayMs:120});
    }
    document.querySelector('#state').textContent=scenario==='clear'?'Cleared. No pending feedback.':'Playing…';
    if (document.querySelector('#hold').checked&&scenario!=='clear') holdTimer=setTimeout(()=>{
        scene.scene.pause();document.querySelector('#state').textContent='Held at 650 ms for inspection. Uncheck Hold and replay to inspect timing.';
    },650);
}
document.querySelectorAll('[data-scenario]').forEach(button=>button.addEventListener('click',()=>run(button.dataset.scenario)));
document.querySelector('#locale').addEventListener('change',()=>run('language'));
