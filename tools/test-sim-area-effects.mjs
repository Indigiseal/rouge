import assert from 'node:assert/strict';
import {runCombatProbe} from '../sim/combat-probe.js';
const basic={type:'weapon',weaponType:'bow',range:'ranged',damage:8,durability:20,maxDurability:20,rarity:'rare'};
const scenarios=[
 ['plain',{},{}], ['fire hidden splash',{gemEffect:'fire',gemCount:1},{}],
 ['mace diagonal',{weaponType:'mace',range:'melee',special:'crush'},{}],
 ['ogre gauntlet',{id:'ogreGauntlet',weaponType:'gauntlet',range:'melee',special:'block'},{}],
 ['lightning chains',{gemEffect:'lightning',gemCount:1},{}],
 ['fire amulets',{gemEffect:'fire',gemCount:3},{floor:31,amulets:['runeOfFire','greaterRuneOfFire','glovesOfHermitWizard']}],
 ['lightning conductive',{gemEffect:'lightning',gemCount:3,sigils:[{id:'conductive'}]},{floor:31,amulets:['runeOfZap','greaterRuneOfZap','glovesOfHermitWizard']}],
 ['sword sides',{weaponType:'sword',range:'melee',special:'cleave'},{}],
 ['axe cross',{weaponType:'axe',range:'melee',special:'specialAttack'},{}],
 ['axe sides without vertical',{weaponType:'axe',range:'melee',special:'specialAttack'},{sideOnly:true}],
 ['sword fire retriggers',{weaponType:'sword',range:'melee',special:'cleave',gemEffect:'fire',gemCount:2},{}],
 ['axe lightning retriggers',{weaponType:'axe',range:'melee',special:'specialAttack',gemEffect:'lightning',gemCount:2},{}],
];
const random=Math.random;Math.random=()=>.99;
try{
 for(const [name,mods,opts] of scenarios){
  const sim=runCombatProbe({...basic,...mods},opts),live=runCombatProbe({...basic,...mods},{...opts,live:true});
  assert.deepEqual(sim.health,live.health,name);assert.equal(sim.durability,live.durability,name+' durability');
  if(name==='fire hidden splash'){assert.equal(sim.hidden,6);assert.equal(sim.total,35);assert.equal(sim.health[9],1000,'out-of-radius enemy must be untouched');}
  if(name==='lightning chains'){assert.equal(sim.hits,3);assert.equal(sim.hidden,0);assert.equal(sim.total,17);}
  if(name==='axe cross')assert.equal(sim.total,24);
  if(name==='axe sides without vertical')assert.equal(sim.total,16);
  console.log(name+': '+sim.total+' total, '+sim.hits+' targets, '+sim.hidden+' hidden');
 }
}finally{Math.random=random;}
console.log('Live/sim multi-target parity passed.');
// Damage statistics cap overkill and include hidden/elite enemies without
// counting replacement loot or negative HP as extra damage.
const { captureEnemyHealth, recordDamageAction } = await import('../sim/damage-metrics.js');
const primary = { revealed: true, data: { type: 'eliteEnemy', health: 3 } };
const hidden = { revealed: false, data: { type: 'enemy', health: 5 } };
const before = captureEnemyHealth([primary, hidden]);
primary.data.health = -20;
hidden.data.health = 2;
const metrics = {};
recordDamageAction(metrics, 20, before, { weaponType: 'sword', gemEffect: 'fire' }, 8, primary);
assert.equal(metrics[20][0].total, 6);
assert.equal(metrics[20][0].hidden, 3);
assert.equal(metrics[20][0].primary, 3);
