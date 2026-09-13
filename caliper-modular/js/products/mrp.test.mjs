// node mrp.test.mjs — the row's units per pack, its pack MRP (typed or from the list), the profit range
import { rowConversion, rowPackMrp, profitRange, profitOk, profitColor } from './mrp.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const g=t=>({text:t});
const F={keys:['sl','name','pack','tp'], grid:[[g('1'),g('Ace 250 Supp'),g("4X5'S"),g('75.40')],[g('2'),g('Ace Syp 60ml'),g("1X1'S"),g('15.52')]], rowMeta:{}};
const P={results:[{status:'match', product:{name:'ACE', mrp:5}}, {status:'match', product:{name:'ACE SYP', mrp:20}}]};
console.log('[1] the pack MRP from the list');
check(rowConversion(F,0).value===20 && rowConversion(F,1).value===1, "4X5'S → 20 units per pack, 1X1'S → 1");
const m0=rowPackMrp(F,P,0); check(m0.value===100 && m0.source==='list' && m0.unit===5 && m0.conv===20, 'pack MRP 100 = 5 × 20 ('+JSON.stringify(m0)+')');
check(rowPackMrp(F,{results:[{status:'none'}]},0).value===null, 'no product: no MRP');
console.log('[2] typed over');
F.rowMeta[0]={mrp:120}; check(rowPackMrp(F,P,0).value===120 && rowPackMrp(F,P,0).source==='typed', 'a pack MRP typed by hand stands');
F.rowMeta[1]={unitConversion:12}; check(rowConversion(F,1).value===12 && rowPackMrp(F,P,1).value===240, 'units per pack typed by hand: the MRP follows (20 × 12)');
console.log('[3] the profit range');
const R=profitRange(); check(R.min===10 && R.max===30, 'defaults 10 / 30 without a page');
check(profitOk(15,R) && !profitOk(5,R) && !profitOk(35,R) && !profitOk(null,R), 'inside the range only');
check(profitColor(15,R)==='#54dd7e' && profitColor(35,R)==='#ff5a5a' && profitColor(null,R)==='#8fa39a', 'green inside, danger outside, grey unknown');
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
