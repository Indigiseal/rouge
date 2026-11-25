import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try {
 for(const language of ['es','fr','ru']){
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.addInitScript(lang=>{localStorage.setItem('gameLanguage',lang);localStorage.setItem('rogueDevTools','0');},language);
  await page.goto(process.env.HUD_TEST_URL||'http://localhost:4173');
  await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'),{timeout:60000});
  await page.evaluate(lang=>{window.__game.language=lang;window.__game.scene.start('GameScene',{});},language);
  await page.waitForFunction(()=>window.__game.scene.isActive('GameScene')&&window.__game.scene.getScene('GameScene').floorText?.text,{timeout:20000});
  const result=await page.evaluate(async language=>{
   const {t}=await import('/src/i18n/i18n.js');
   const scene=window.__game.scene.getScene('GameScene'),gs=scene.gameState;
   gs.actLocationIds=['thornwake','silkdeep','tollroad'];gs.currentFloor=1;scene.updateUI();
   const header=scene.floorText.text;
   const expected=t(scene,'ui.hud.floorBanner',{month:t(scene,'location.thornwake.name'),act:1,floor:1});
   gs.actionsLeft=0;gs.playerEffects=[{type:'poison',turns:3},{type:'burn',burn:2},{type:'stun',turns:2},{type:'weakness',turns:3}];
   Object.assign(gs,{shadowBlade:{turns:2,multiplier:1.5},magicShield:{turns:2,multiplier:1.2},boneWall:2,briarShield:2,blockNextAttack:true,playerStunnedTurns:1,playerSpored:true,playerSapped:true,playerFrozenAttacks:2,playerShocked:true,playerSandstormed:true,discardCritChance:.05});
   const entries=scene.collectPlayerEffectEntries().map(e=>e.text);
   window.__game.language='en';const english=scene.collectPlayerEffectEntries().map(e=>e.text);window.__game.language=language;
   const rewards=[];
   const originalFeedback=scene.createFloatingText;
   scene.createFloatingText=(x,y,text)=>rewards.push(text);
   for(const source of ['Pick','Lucky','Crystal Seeker']) for(const kind of ['coin','crystal']) {
    scene.cardSystem.playKillLootPickup(320,100,{kind,amount:1},source);
   }
   scene.createFloatingText=originalFeedback;
   return {header,expected,entries,english,rewards};
  },language);
  assert.equal(result.header,result.expected);
  assert(!/\bAct\s+1|\bFloor\s+1/.test(result.header),language+' header stays localized');
  assert.equal(result.entries.length,result.english.length);
  for(let i=0;i<result.entries.length;i++){
   // Poison is spelled identically in French and English.
   if(language==='fr' && /^Poison \d+$/.test(result.entries[i])) continue;
   assert.notEqual(result.entries[i],result.english[i],language+' effect '+result.english[i]);
  }
  assert(!result.entries.some(text=>/\{\w+\}/.test(text)),language+' placeholders filled');
  assert.equal(result.rewards.length,6);
  for(const reward of result.rewards) assert(!/\b(?:Coin|Crystal|Pick|Lucky)\b/.test(reward),language+' reward '+reward);
  console.log(language+': '+result.header+'; '+result.entries.length+' HUD effects localized.');
  await page.close();
 }
}finally{await browser.close();}
