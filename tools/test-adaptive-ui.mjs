import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
try {
 const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
 const errors = [];
 page.on('pageerror', e => errors.push(e.message));
 await page.addInitScript(() => { localStorage.setItem('gameLanguage','ru'); localStorage.setItem('rogueDevTools','0'); });
 await page.goto('http://localhost:4173');
 await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'), { timeout: 60000 });
 const result = await page.evaluate(async () => {
  const game = window.__game;
  const menu = game.scene.getScene('MainMenuScene');
  const { createTitle } = await import('/src/ui/titleText.js');
  const { createPaintedButton } = await import('/src/ui/PaintedButton.js');
  const { t } = await import('/src/i18n/i18n.js');
  const { horizontalSkin } = await import('/src/ui/AdaptiveSkin.js');
  const rows = [];
  for (const language of ['en','ru','es','fr']) {
   game.language = language; menu.refreshMainMenuText();
   for (const entry of Object.values(menu.mainMenuButtons)) {
    if (!entry.text) continue;
    if (entry.text.width > entry.button.width - 24) throw Error('Menu label overflow: '+entry.text.text);
    if (entry.button.input && entry.button.input.hitArea.width !== entry.button.width) throw Error('Menu hit area did not resize');
   }
   for (const [key, title] of [['villageBanner','ui.treasure.title'],['restBanner','ui.sandbox.encounter.rest'],['villageBanner','ui.sanctuary.title'],['sigilBanner','ui.sigilRoom.title']]) {
    const text = createTitle(menu,320,42,t(menu,title),{bannerKey:key});
    rows.push({ language, text:text.text, width:text.width, height:text.height, banner:text.banner.width, size:text.style.fontSize });
    text.banner.destroy(); text.destroy();
   }
   for (const key of ['ui.sanctuary.restore','ui.village.back','ui.village.leave','ui.village.debugResetMeta']) {
    const button = createPaintedButton(menu,320,342,t(menu,key),()=>{});
    const [plate,label] = button.list;
    rows.push({language,text:label.text,width:label.width,height:label.height,banner:plate.width,size:label.style.fontSize,button:true});
    const before = plate.width;
    plate.emit('pointerdown'); const pressed = plate.width;
    plate.emit('pointerup');
    if (pressed !== before || plate.width !== before) throw new Error('Pressed width changed');
    label.setText(t(menu,'ui.sanctuary.restore')+' 999');
    button.refit();
    if (label.width > plate.width - 24 || plate.input.hitArea.width !== plate.width) throw Error('Updated cost overflow');
    button.destroy();
   }
  }
  // Center crest and both caps must remain byte-identical after expansion.
  for(const key of ['villageBanner','nextTurnUp']) {
   const original=game.textures.get(key), frame=original.get(), source=original.getSourceImage(frame.sourceIndex);
   const enlarged=game.textures.get(horizontalSkin(menu,key,380,key==='villageBanner'?{cap:64,center:80}:{}));
   const probe=document.createElement('canvas');probe.width=frame.cutWidth;probe.height=frame.cutHeight;
   const ctx=probe.getContext('2d');ctx.drawImage(source,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,0,0,frame.cutWidth,frame.cutHeight);
   const cap=key==='villageBanner'?64:16, dest=enlarged.getSourceImage().width;
   const same=(a,b)=>a.every((v,i)=>v===b[i]);
   if(!same(ctx.getImageData(0,0,cap,frame.cutHeight).data,enlarged.context.getImageData(0,0,cap,frame.cutHeight).data))throw Error('Left cap changed');
   if(!same(ctx.getImageData(frame.cutWidth-cap,0,cap,frame.cutHeight).data,enlarged.context.getImageData(dest-cap,0,cap,frame.cutHeight).data))throw Error('Right cap changed');
   if(key==='villageBanner'&&!same(ctx.getImageData(Math.floor((frame.cutWidth-80)/2),0,80,frame.cutHeight).data,enlarged.context.getImageData(Math.floor((dest-80)/2),0,80,frame.cutHeight).data))throw Error('Crest changed');
  }
  game.language='ru';
  return rows;
 });
 for (const row of result) {
  assert(row.width<=row.banner-(row.button?24:56)+1,JSON.stringify(row));
  assert(row.height<=(row.button?26:28),JSON.stringify(row));
 }
 console.log('Verified '+result.length+' localized banner/button layouts and live menu language switching.');
 await page.evaluate(()=>window.__game.scene.start('GameScene',{}));
 await page.waitForFunction(()=>window.__game.scene.getScene('GameScene')?.cardSystem?.boardCards?.length>0);
 await page.evaluate(()=> { const game=window.__game,scene=game.scene.getScene('GameScene'); scene.scene.launch('TreasureScene',{gameState:scene.gameState,rewardMode:'treasure'}); });
 await page.waitForFunction(()=>window.__game.scene.getScene('TreasureScene')?.chest);
 await page.screenshot({path:'.tmp/russian-chest-adaptive.png'});
 await page.evaluate(()=> {
  const game=window.__game,scene=game.scene.getScene('GameScene');
  scene.scene.stop('TreasureScene');
  scene.scene.launch('EventScene',{gameState:scene.gameState,forcedEventId:'arm_wrestling'});
 });
 await page.waitForFunction(()=>window.__game.scene.getScene('EventScene')?._choiceBtns?.length>0);
 const choices=await page.evaluate(()=>window.__game.scene.getScene('EventScene')._choiceBtns.map(({bg,label})=>({text:label.text,width:label.width,height:label.height,boxW:bg.width,boxH:bg.height})));
 for(const row of choices) {
  assert(row.width<=row.boxW,JSON.stringify(row));
  assert(row.height<=row.boxH,JSON.stringify(row));
 }
 assert.deepEqual(errors,[]);
 console.log('Adaptive banner/button bounds, pressed states, unchanged caps and crest passed in en/ru/es/fr; Russian chest screenshot saved.');
} finally { await browser.close(); }

