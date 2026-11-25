import { MockScene } from './mock.js';
import { GameState } from '../src/systems/GameState.js';
import { CardSystem } from '../src/systems/CardSystem.js';
import { AmuletManager } from '../src/managers/AmuletManager.js';
import { InventoryCombatUse } from '../src/systems/inventory/InventoryCombatUse.js';
import { prepareSimWeaponSwing, resolveSimWeaponSwing } from './player-weapon-strike.js';
import { applySwordCleaveSim, applyAxeHeavyCleaveSim, applySpearPierceSim, applyMaceDiagonalSim, applyGauntletSlamSim } from './weapon-specials.js';
import { captureEnemyHealth, recordDamageAction } from './damage-metrics.js';

// Controlled dense-board diagnostic; no claim that every run has this build.
export function runCombatProbe(weapon, {floor=1, amulets=[], forge=0, live=false, sideOnly=false}={}) {
 const scene=new MockScene(); scene.gameState=new GameState(scene); const gs=scene.gameState;
 Object.assign(gs,{currentFloor:floor,playerHealth:100,maxHealth:100,actionsLeft:20,talentEffects:{villageWeaponFlat:forge}});
 scene.cardSystem=new CardSystem(scene);scene.amuletManager=new AmuletManager(scene);
 for(const id of amulets)scene.amuletManager.addAmulet(id,{force:true});
 scene.tutorialMode=true;scene.createDamageEffect=()=>{};
 const wp=structuredClone(weapon);gs.equippedWeapon=wp;
 scene.inventorySystem={slots:[wp],slotSprites:[],playSlotStrikeAnimation(){}};
 gs.inventory=scene._simInventory=scene.inventorySystem.slots;
 const board=[];
 for(let i=0;i<10;i++) {
  const r=Math.floor(i/3),c=i%3,x=i===9?500:200+(c-1)*52,y=i===9?80:80+(r-1)*70;
  if(sideOnly && ![3,4,5].includes(i)){board.push(null);continue;}
  const sprite=scene.add.image(x,y,'enemy');
  board.push({sprite,restX:x,restY:y,revealed:![0,8].includes(i),data:{type:'enemy',name:'Probe enemy',health:1000,maxHealth:1000,attack:5,role:'MELEE',brick:{r,c},features:[]}});
 }
 scene.cardSystem.boardCards=board;
 const before=captureEnemyHealth(board), primary=board[4];
 let prepared;
 if(live){
  const inv={...InventoryCombatUse,scene,slots:scene.inventorySystem.slots,playWeaponStrikeEffect(){},updateWeaponInfoText(){},returnWeaponToSlotDelayed(){},returnWeaponToSlot(){},handleWeaponBreak(){},applyAssassinateTalent(){}};
  inv.useWeapon(0,scene.add.image(200,80,'weapon'));
 }else{
  const actionsBefore=gs.actionsLeft;scene.useAction();
  const swing=prepareSimWeaponSwing(scene,4,wp,{actionsBefore});prepared=swing.damage;
  resolveSimWeaponSwing(scene,4,wp,swing);
  applySwordCleaveSim(scene,gs,4,swing.damage,wp);
  applySpearPierceSim(scene,gs,4,swing.damage,wp,primary);
  applyAxeHeavyCleaveSim(scene,gs,4,swing.damage,wp,primary);
  applyMaceDiagonalSim(scene,gs,4,swing.damage,wp,primary);
  applyGauntletSlamSim(scene,gs,4,swing.damage,wp);
 }
 const samples={};recordDamageAction(samples,floor,before,wp,prepared||0,primary);
 return {...samples[floor][0],health:board.map(c=>c?.data?.health??null),durability:wp.durability};
}
