// node quadedit.test.mjs — the page's corners moved by hand
import { nearestCorner, moveCorner, defaultQuad, quadIsConvex, sameQuad, CORNERS } from './quadedit.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const q={tl:{x:100,y:80}, tr:{x:1500,y:90}, br:{x:1490,y:2000}, bl:{x:110,y:1990}};
console.log('[1] picking a corner');
check(nearestCorner(q,105,84,20)==='tl' && nearestCorner(q,1485,1995,20)==='br', 'the corner within reach is picked');
check(nearestCorner(q,800,1000,20)===null, 'nothing within reach: null');
check(nearestCorner(q,1495,1000,20)===null && nearestCorner(q,1496,95,20)==='tr', 'the tolerance is a distance, not a box');
console.log('[2] moving a corner');
const m=moveCorner(q,'tl',-30,50,1600,2100);
check(m.tl.x===0 && m.tl.y===50 && m.tr.x===1500 && q.tl.x===100, 'the corner moves and is clamped to the image; the other corners and the old quad stay');
check(moveCorner(q,'br',9999,9999,1600,2100).br.x===1600 && moveCorner(q,'br',9999,9999,1600,2100).br.y===2100, 'clamped to the far edge');
console.log('[3] the fallback quad, convexity, equality');
const d=defaultQuad(1000,2000); check(d.tl.x===20 && d.br.x===980 && d.br.y===1960 && CORNERS.every(k=>d[k]), 'the frame inset two percent');
check(quadIsConvex(q) && quadIsConvex(d), 'a page quad winds one way');
check(!quadIsConvex({tl:{x:0,y:0}, tr:{x:100,y:100}, br:{x:100,y:0}, bl:{x:0,y:100}}), 'a bow-tie is not convex');
check(sameQuad(q,{...q}) && !sameQuad(q,m) && !sameQuad(null,q), 'same to the pixel or not');
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
