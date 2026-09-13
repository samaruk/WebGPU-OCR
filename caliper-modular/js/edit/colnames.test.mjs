// node colnames.test.mjs — a column name set on one page found at the same place on another
import { columnFractions, columnAtFraction, mergeRecord } from './colnames.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const C=xs=>({columns:xs.map(([a,b])=>({gutterX0:a, gutterX1:b}))});
console.log('[1] a column\'s place, and the column at a place on another page');
{
  const page1=C([[100,400],[410,500],[510,600],[610,700]]);             // 4 columns over 100..700
  const f=columnFractions(page1,2); check(Math.abs(f.x0f-410/600)<1e-9 && Math.abs(f.x1f-500/600)<1e-9, 'column 3 of page 1 spans 0.683..0.833 of the table ('+f.x0f.toFixed(3)+'..'+f.x1f.toFixed(3)+')');
  const page2=C([[200,800],[820,1000],[1020,1200],[1220,1400]]);         // the same layout, wider, 4 columns
  check(columnAtFraction(page2,f.x0f,f.x1f)===2, 'the same place on a page twice as wide is column 3 again');
  const page3=C([[200,500],[510,800],[820,1000],[1020,1200],[1220,1400]]);   // the name column split in two here: 5 columns
  check(columnAtFraction(page3,f.x0f,f.x1f)===3, 'on a page where the name column was split, the place is column 4');
  const f0=columnFractions(page1,0); check(columnAtFraction(page3,f0.x0f,f0.x1f)===0, 'the name column\'s place lands on the first of its two halves');
  const page4=C([[200,1400]]); check(columnAtFraction(page4,f.x0f,f.x1f)===-1, 'a page whose single column overlaps the place by little of itself: no column');
}
console.log('[2] the records: one per key, one per place');
{
  let r=[]; r=mergeRecord(r,{key:'batch',x0f:0.68,x1f:0.83}); r=mergeRecord(r,{key:'qty',x0f:0.85,x1f:1.0});
  check(r.length===2, 'two names, two places');
  r=mergeRecord(r,{key:'batch',x0f:0.85,x1f:1.0}); check(r.length===1 && r[0].key==='batch' && r[0].x0f===0.85, 'batch moved to the qty column: the old batch record and the qty record both go');
  r=mergeRecord(r,{key:null,x0f:0.85,x1f:1.0}); check(r.length===1 && r[0].key===null, 'unnamed at that place replaces the name there');
}
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
