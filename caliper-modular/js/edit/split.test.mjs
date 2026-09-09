// node split.test.mjs — where a column splits
import { findSplitGap } from './split.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
console.log('[1] two words with a gap between them');
{
  const spans=[]; for(let r=0;r<10;r++){ spans.push([100+r%3,140]); spans.push([170,205-r%2]); }
  const g=findSplitGap(spans,100,205,{minGap:4,edgeFrac:0.12});
  check(g && g.x0===141 && g.x1===169, 'the gap 141–169 is found ('+JSON.stringify(g)+')');
}
console.log('[2] one word: only margins, no gap');
{
  const spans=[[110,190],[108,192]];
  check(findSplitGap(spans,100,200,{minGap:4})===null, 'no split');
}
console.log('[3] the widest inner gap wins over a narrower one');
{
  const spans=[[100,120],[126,150],[165,200]];
  const g=findSplitGap(spans,100,200,{minGap:3});
  check(g && g.x0===151 && g.x1===164, 'gap 151–164 ('+JSON.stringify(g)+')');
}
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
