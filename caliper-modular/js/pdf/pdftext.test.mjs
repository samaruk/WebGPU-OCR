// node pdftext.test.mjs — the page's own words into rows, lines and cells
import { assignWords, linesFromWords } from './pdftext.js';
import { wordsOfTextContent } from './pdfload.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const W=(text,x0,y0,x1,y1)=>({text, bb:{x0,y0,x1,y1}});
console.log('[1] words into cells');
{
  const rowsY=[{y0:100,y1:112},{y0:120,y1:132},{y0:140,y1:152}], colsX=[{x0:0,x1:200},{x0:210,x1:260},{x0:270,x1:330},{x0:340,x1:400}];
  const words=[ W('AREDS',40,101,70,111), W('Softgel',74,101,110,111), W('Capsule',114,101,150,111), W("28's",154,101,170,111), W('26G0517',215,101,255,111), W('1,086.21',280,101,320,111), W('2.00',350,101,370,111),
    W('Acufer',40,121,70,131), W('Capsule',74,121,110,131), W('26E0556',215,121,255,131), W('494.75',280,121,320,131), W('2.00',350,121,370,131),
    W('gutter',263,141,268,151),                     // in the gap between two columns: the nearer column, within half a width
    W('between',10,113,30,116),                      // between two rows, nearer the first: the first
    W('far',40,180,70,190) ];                        // a row height away from every row: dropped
  const cells=assignWords(words, rowsY, colsX);
  check(cells[0].join(' | ')==="between AREDS Softgel Capsule 28's | 26G0517 | 1,086.21 | 2.00", 'row 1: the name joined left to right, one word per number cell ('+cells[0].join(' | ')+')');
  check(cells[1][0]==='Acufer Capsule' && cells[1][3]==='2.00', 'row 2');
  check(cells[2][2]==='gutter' && cells[2][1]==='', 'a word in the gap between two columns goes to the nearer one ('+cells[2].join('|')+')');
  check(cells[0][0].startsWith('between') && !cells[1][0].includes('between'), 'a word between two rows goes to the nearer one');
  check(!cells.flat().join(' ').includes('far'), 'a word far from every row is dropped');
  const skewed=assignWords([W('x',100,101,110,111)], rowsY, [{x0:0,x1:50},{x0:60,x1:200}], (x,y)=>x-80);
  check(skewed[0][0]==='x', 'the de-skew map is applied to the x before the column is chosen');
}
console.log('[2] words into lines');
{
  const rows=[{index:0,y0:100,y1:112},{index:1,y0:120,y1:132}];
  const words=[ W('Capsule',74,101,110,111), W('AREDS',40,101,70,111), W('2.00',350,121,370,131), W('Acufer',40,121,70,131) ];
  const lines=linesFromWords(words, rows);
  check(lines[0].text==='AREDS Capsule' && lines[0].rowIndex===0 && lines[0].confidence===100 && lines[0].words.length===2, 'line 1 in reading order at full confidence');
  check(lines[1].text==='Acufer 2.00', 'line 2');
  check(linesFromWords([], rows)[0].confidence===0 && linesFromWords([], rows)[0].text==='', 'an empty row: no text, no confidence');
}
console.log('[3] pdf.js text items into words');
{
  // an item "AREDS Softgel Capsule 28's" at x 38.1, baseline 221.8 from the top, width 116.4, height 9.9 (transform d = 9.9), page 792 tall, scale 2
  const items=[{str:"AREDS Softgel Capsule 28's", transform:[9.9,0,0,9.9,38.1,792-221.8], width:116.4, height:9.9}, {str:'2.00', transform:[9.9,0,0,9.9,318.3,792-221.8], width:17.6, height:9.9}, {str:'  ', transform:[9.9,0,0,9.9,0,0], width:1, height:9.9}];
  const ws=wordsOfTextContent(items, 792, 2);
  check(ws.length===5 && ws.map(w=>w.text).join(' ')==="AREDS Softgel Capsule 28's 2.00", 'the item is cut at its spaces, a blank item skipped ('+ws.map(w=>w.text).join('|')+')');
  check(Math.abs(ws[0].bb.x0-76.2)<0.1 && ws[0].bb.x1<ws[1].bb.x0 && ws[3].bb.x1<=2*(38.1+116.4)+0.1, 'each word takes its share of the item width, in order, within the item');
  check(ws[0].bb.y0<2*221.8 && ws[0].bb.y1>2*221.8 && (ws[0].bb.y1-ws[0].bb.y0)>2*9.9*0.9, 'the box straddles the baseline and spans the font height');
}
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
