import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('rogueDevTools','0');localStorage.setItem('gameLanguage','ru');});
 await page.goto('http://localhost:4173');
 await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'),{timeout:60000});
 await page.evaluate(()=>window.__game.scene.start('GameScene',{}));
 await page.waitForFunction(()=>window.__game.scene.getScene('GameScene')?.cardSystem?.boardCards?.length>0);
 let release;const hold=new Promise(resolve=>release=resolve);const requests=[];
 await page.route(/\/assets\/art\/(backgrounds|boards)\//,async route=>{requests.push(route.request().url());await hold;await route.continue();});
 await page.evaluate(async()=>{
  const game=window.__game,scene=game.scene.getScene('GameScene'),gs=scene.gameState;
  const {MapGenerator}=await import('/src/map/MapGenerator.js');
  gs.actLocationIds=['thornwake',null,null];gs.currentFloor=15;
  gs.dungeonMap=new MapGenerator().generateFullMap(gs.actLocationIds);
  scene.scene.launch('LocationPickScene',{mode:'nextAct',act:2,gameState:gs});
  scene.scene.sleep();
 });
 await page.waitForFunction(()=>window.__game.scene.getScene('LocationPickScene')?._cards?.length>0);
 await page.evaluate(()=>{const scene=window.__game.scene.getScene('LocationPickScene');scene.confirm(scene._cards[0]);});
 await page.waitForFunction(()=>window.__game.scene.getScene('LocationPickScene').hintText?.text==='Загрузка следующей области…',{timeout:10000});
 assert(requests.length>0,'download already started while door was opening');
 const waiting=await page.evaluate(()=>{const scene=window.__game.scene.getScene('LocationPickScene');return {floor:scene.gameState.currentFloor,fade:scene.cameras.main.fadeEffect.isRunning,active:scene.sys.isActive()};});
 assert.equal(waiting.floor,15);assert.equal(waiting.fade,false);assert.equal(waiting.active,true);
 release();
 await page.waitForFunction(()=>window.__game.scene.isActive('GameScene')&&window.__game.scene.getScene('GameScene').gameState.currentFloor===16,{timeout:15000});
 assert.deepEqual(errors,[]);
 console.log('Slow-network act transition passed: early downloads, localized visible loading message, no fade to black while waiting, Act 2 enters after assets arrive.');
}finally{await browser.close();}
