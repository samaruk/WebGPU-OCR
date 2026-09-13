// node ruledrows.test.mjs — one table row per band between the printed rules
import { ruleLinesY, mergeRowsByRules, readingOrder, mergeOverlappingRows } from './ruledrows.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const row=(yp0,yp1,ri,source='local')=>({yp0, yp1, y0:yp0, y1:yp1, localRis:[ri], source});
console.log('[1] the rules in the de-skewed frame');
{
  const ys=ruleLinesY([{y:300,x0:100,x1:1100},{y:100,x0:100,x1:1100},{y:200,x0:100,x1:1100}], 0.01);
  check(JSON.stringify(ys)===JSON.stringify([94,194,294]), 'sorted, the slope taken out at the rule\'s middle ('+JSON.stringify(ys)+')');
}
console.log('[2] rows folded into their ruled band');
{
  // rules every 40 px, one band of 70 px holding a wrapped name (two text lines of 28 px)
  const ys=[0,40,80,150,190,230];
  const rows=[row(6,34,0), row(46,74,1), row(86,114,2,'api'), row(118,146,3), row(156,184,4), row(196,224,5)];
  const {rows:out, merged}=mergeRowsByRules(rows, ys);
  check(merged===1 && out.length===5, 'the two lines of the tall band are one row ('+merged+' folded, '+out.length+' rows)');
  check(out[2].yp0===86 && out[2].yp1===146 && JSON.stringify(out[2].localRis)==='[2,3]' && out[2].source==='api' && out[2].folded===1, 'the folded row spans both lines, keeps both local rows, and is an API row when either was');
  check(out[0].localRis[0]===0 && out[4].localRis[0]===5, 'the other rows stand');
}
{
  // a sparse rule: one rule every three rows must not fold three items into one
  const ys=[0,120,240];
  const rows=[row(6,34,0), row(46,74,1), row(86,114,2), row(126,154,3), row(166,194,4), row(206,234,5)];
  const {rows:out, merged}=mergeRowsByRules(rows, ys);
  check(merged===0 && out.length===6, 'bands of four lines are not trusted: nothing folded');
}
{
  const ys=[0,40,80];
  const rows=[row(6,34,0), row(96,124,1)];
  const {merged}=mergeRowsByRules(rows, ys);
  check(merged===0, 'a row outside every band stands');
  check(mergeRowsByRules([], ys).merged===0 && mergeRowsByRules(rows, []).rows.length===2 && mergeRowsByRules(rows, [0]).rows.length===2, 'no rows, or fewer than two rules: nothing to do');
}
console.log('[3] words of a two-line cell in reading order');
{
  const w=(t,x0,y0,x1,y1)=>({text:t, bbox:{x0,y0,x1,y1}});
  const ws=[w('(60s)',10,40,60,58), w('500mg/200IU',200,10,300,28), w('Coralcal-D',10,10,100,28), w('FC',110,11,130,27), w('Tab',140,10,180,29)];
  check(readingOrder(ws).map(x=>x.text).join(' ')==='Coralcal-D FC Tab 500mg/200IU (60s)', 'line one left to right, then line two');
  check(readingOrder([w('b',50,0,60,10), w('a',0,2,10,12)]).map(x=>x.text).join('')==='ab' && readingOrder([]).length===0, 'one line: by x; nothing: nothing');
}
console.log('[5] one line read twice: two rows over the same band fold into one');
{ const rows=[{yp0:100,yp1:130,y0:100,y1:130,localRis:[4],source:'local'},{yp0:101,yp1:160,y0:101,y1:160,localRis:[5],source:'api',apiRow:7},{yp0:162,yp1:192,y0:162,y1:192,localRis:[6],source:'local'}];
  const m=mergeOverlappingRows(rows);
  check(m.merged===1 && m.rows.length===2 && m.rows[0].source==='api' && m.rows[0].apiRow===7 && m.rows[0].localRis.join()==='4,5' && m.rows[0].yp1===160, 'the SubTotal line read twice (a local row over the API row top) is one row, the API row kept, both local rows in it');
  const curl=[{yp0:100,yp1:130,y0:100,y1:130,localRis:[1],source:'local'},{yp0:124,yp1:154,y0:124,y1:154,localRis:[2],source:'local'}];
  check(mergeOverlappingRows(curl).merged===0, 'two curled neighbours overlapping by a fifth stay two rows');
  const tall=[{yp0:100,yp1:170,y0:100,y1:170,localRis:[1],source:'api',apiRow:3},{yp0:135,yp1:165,y0:135,y1:165,localRis:[2],source:'api',apiRow:4}];
  check(mergeOverlappingRows(tall).merged===0, 'a PaddleOCR row spanning two lines (Ceftron over Cinaron) does not swallow the next line’s own row');
  const two=[{yp0:100,yp1:170,y0:100,y1:170,localRis:[1],source:'api',apiRow:3,sl:'31'},{yp0:135,yp1:165,y0:135,y1:165,localRis:[2],source:'local',sl:'32'}];
  check(mergeOverlappingRows(two,0.6,(a,b)=>!!(a.sl&&b.sl)).merged===0 && mergeRowsByRules(two,[95,175],3.2,(a,b)=>!!(a.sl&&b.sl)).merged===0, 'two rows each with a serial number are two items for both folds'); }
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
