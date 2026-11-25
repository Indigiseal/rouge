import fs from 'node:fs';
import {runCombatProbe} from '../sim/combat-probe.js';
const base={type:'weapon',weaponType:'bow',range:'ranged',damage:8,durability:20,maxDurability:20,rarity:'rare'};
const scenarios=[
 ['Plain bow',{},{}],['Fire bow - 1 gem',{gemEffect:'fire',gemCount:1},{}],
 ['Lightning bow - 1 gem',{gemEffect:'lightning',gemCount:1},{}],
 ['Sword cleave',{weaponType:'sword',range:'melee',special:'cleave'},{}],
 ['Axe cross',{weaponType:'axe',range:'melee',special:'specialAttack'},{}],
 ['Sword + 2 fire gems',{weaponType:'sword',range:'melee',special:'cleave',gemEffect:'fire',gemCount:2},{}],
 ['Axe + 2 lightning gems',{weaponType:'axe',range:'melee',special:'specialAttack',gemEffect:'lightning',gemCount:2},{}],
 ['Fire + gem amulets',{gemEffect:'fire',gemCount:3},{floor:31,amulets:['runeOfFire','greaterRuneOfFire','glovesOfHermitWizard']}],
 ['Lightning + Conductive + amulets',{gemEffect:'lightning',gemCount:3,sigils:[{id:'conductive'}]},{floor:31,amulets:['runeOfZap','greaterRuneOfZap','glovesOfHermitWizard']}],
];
const original=Math.random;Math.random=()=>.99;
try{fs.writeFileSync('docs/balance/2026-10-28/controlled-damage.json',JSON.stringify(scenarios.map(([label,mods,opts])=>({label,floor:opts.floor||1,amulets:opts.amulets||[],weapon:{...base,...mods},...runCombatProbe({...base,...mods},opts)})),null,2));}finally{Math.random=original;}
