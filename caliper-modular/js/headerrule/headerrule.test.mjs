// node headerrule.test.mjs — the closest rule laid over the profile columns in order
import { ruleInOrder, tokensOf, alignRule, matchHeaderRule, findTitleRowOnPage, layoutOfColumns, columnsFromLayout, needsLayout, hasOwnTitles } from './headerrule.js';
import { HEADER_RULES } from '../config/headerrules.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const W=s=>tokensOf(s).map(t=>({t, text:t}));
const acme=HEADER_RULES.find(r=>r.id==='acme');

console.log('[1] the ACME page read by the OCR: the name column split in four, "Trade Per pa" / "ck VAT", "Value Trade" / "VAT"');
{
  const cols=[W('Category & Produdt Name'),[],[],[],W('Pack Size.'),W('Batch No.'),W('Qty'),W('Trade Per pa'),W('ck VAT'),W('Value Trade'),W('VAT'),W('%'),W('Discount Value'),W('Net Value')];
  const r=ruleInOrder(acme,cols).map(o=>o&&o.key);
  console.log('   ', JSON.stringify(r));
  check(r[7]==='unittp' && r[8]==='unitvat' && r[9]==='totaltp' && r[10]==='totalvat', 'Trade, VAT, Trade, VAT → unittp, unitvat, totaltp, totalvat in order');
  check(r[11]==='discountpct' && r[12]==='totaldiscount' && r[13]==='net' && r[6]==='qty' && r[0]==='name' && r[4]==='pack' && r[5]==='batch', 'the other columns in order');
}
console.log('[1b] among every rule, ACME explains the most of these columns');
{
  const cols=[W('Category & Produdt Name'),[],[],[],W('Pack Size.'),W('Batch No.'),W('Qty'),W('Trade Per pack'),W('VAT'),W('Value Trade'),W('VAT'),W('%'),W('Discount Value'),W('Net Value')];
  const counts=HEADER_RULES.map(r=>({id:r.id, n:ruleInOrder(r,cols).filter(Boolean).length})).sort((a,b)=>b.n-a.n);
  console.log('   ', counts.slice(0,4).map(c=>c.id+':'+c.n).join(' '));
  check(counts[0].id==='acme' && counts[0].n>counts[1].n, 'acme first, ahead of every other rule');
}
console.log('[1c] a % read as 0/0');
check(tokensOf('0/0').join()==='pct' && tokensOf('%').join()==='pct' && tokensOf('Disc %').join()==='disc,pct', '"0/0" and "%" both tokenise to pct');
console.log('[1d] the Opsonin title row: Product Name · Pack · Batch · T.P · VAT · Qnty · TP+VAT · Net Val');
{
  const ops=HEADER_RULES.find(r=>r.id==='opsonin');
  const cols=[W('Product Name'),W('Pack'),W('Batch'),W('T.P'),W('VAT'),W('Qnty'),W('TP+VAT'),W('Net Val')];
  const r=ruleInOrder(ops,cols).map(o=>o&&o.key);
  console.log('   ', JSON.stringify(r));
  check(JSON.stringify(r)===JSON.stringify(['name','pack','batch','tp','unitvat','qty','tpVat','net']), 'every column keyed in order');
  const counts=HEADER_RULES.map(x=>({id:x.id, n:ruleInOrder(x,cols).filter(Boolean).length})).sort((a,b)=>b.n-a.n);
  console.log('   ', counts.slice(0,4).map(c=>c.id+':'+c.n).join(' '));
  check(counts[0].id==='opsonin' && counts[0].n===8 && counts[0].n>counts[1].n, 'opsonin explains all eight, ahead of every other rule');
  check(ops.columns.find(c=>c.key==='tpVat').relation==='{qty}*({tp}+{unitvat})', 'TP+VAT is the line gross: Qnty × (T.P + VAT)');
  // the exact match: the title words as the page prints them, left to right, with the customer block's words above them in the pool
  const wordsOf=(rows)=>rows.flatMap(([row,texts])=>texts.map(([text,x])=>tokensOf(text).map(t=>({t, x, y:row*20, row, text, src:'local'})))).flat().sort((a,b)=>a.x-b.x);
  const words=wordsOf([[5,[['Customer',40],['Name',110],['and',160],['Address:',200]]],[8,[['Product',40],['Name',110],['Pack',280],['Batch',370],['T.P',450],['VAT',520],['Qnty',580],['TP+VAT',660],['Net',760],['Val',800]]]]);
  const m=alignRule(ops, words);
  console.log('   ', m.cols.map(c=>c.found?'+':'-').join(''), 'rows', JSON.stringify([...new Set(m.cols.filter(c=>c.found).flatMap(c=>c.rows))]));
  check(m.found===8 && m.total===8, 'every one of the eight titles is found ('+m.found+' of '+m.total+')');
  { const rowCount=new Map(); for(const c of m.cols) if(c.found) for(const r of new Set(c.rows)) rowCount.set(r,(rowCount.get(r)||0)+1);
    const strong=[...rowCount].filter(([,n])=>n>=2).map(([r])=>r);
    check(strong.length===1 && strong[0]===8 && (rowCount.get(5)||0)<=1, 'the title row holds the titles; the customer block above gives at most one stray token and is not a title row ('+JSON.stringify([...rowCount])+')'); }
  check(tokensOf('T.P').join()==='tp' && tokensOf('T. P').join()==='tp' && tokensOf('Exp. Date').join()==='exp,date' && tokensOf('S. No').join()==='s,no', '"T.P" and "T. P" are one token tp; "Exp. Date" and "S. No" are untouched');
}
console.log('[1e] the title row found page-wide: a band whose top is twenty rows above the title, its own words garbage');
{
  // the page: 30 text rows 20 px apart; the band starts at row 0 (a customer block the profile swallowed), the title sits at row 20
  const rows=[...Array(30)].map((_,i)=>({index:i, kind:i<19?'header':'table', row:{dy:{y0:i*20,y1:i*20+16}, ink:{y0:i*20,y1:i*20+16}}}));
  const W=(rowIndex, ...ws)=>({rowIndex, words:ws.map(([text,x0,x1])=>({text, bb:{x0,y0:rowIndex*20,x1,y1:rowIndex*20+16}}))});
  const lines=[ W(1,['Customer',40,100],['Name',110,150],['and',160,190],['Address:',200,260]), W(2,['zamram',30,80],['Noor',90,120],['City',130,160],['Savar',170,220]),
    W(5,['L',30,40],['5',44,50],['AP',55,70],['h',75,80],['rAdag',90,130]), W(20,['Product',40,95],['Name',100,140],['Pack',280,310],['Batch',360,400],['T.P',445,470],['VAT',515,540],['anty',575,605],['TP+VAT',650,700],['Net',760,785],['Val',790,815]),
    W(22,['Salazine',30,90],['500mg',95,130],['Tab',135,160],['10X5',280,310],['TOG121',360,410],['196',450,470],['34',520,535],['2',585,590],['460.00',660,700],['448.24',770,810]) ];
  const C={rows, band:{rows:rows.slice(0)}, slope:0, toDeskewedX:(x,y)=>x, columns:[], gutters:[]};
  const rec={available:true, lines};
  const pg=findTitleRowOnPage(C,rec,null);
  check(pg && pg.rule.id==='opsonin' && pg.found===8 && pg.total===8 && pg.rowIndex===20 && pg.span===1, 'the page-wide search finds the Opsonin title on row 20 ('+(pg?pg.rule.id+' '+pg.found+'/'+pg.total+' row '+pg.rowIndex:'nothing')+')');
  const m=matchHeaderRule(C,rec,null);
  check(m && m.pageWide && m.rule.id==='opsonin' && m.found===8, 'matchHeaderRule falls back to it when the words around the band top match no rule ('+(m?(m.rule?m.rule.id:'none')+' '+m.found+'/'+m.total+(m.pageWide?' page-wide':''):'null')+')');
  check(m.cols.every(c=>c.found && c.rows.every(r=>r===20)), 'every title comes from row 20');
  // the same page with the band starting right at the title: the window search matches on its own, the page search is not needed
  const C2={...C, band:{rows:rows.slice(19)}};
  const m2=matchHeaderRule(C2,rec,null);
  check(m2 && !m2.pageWide && m2.rule.id==='opsonin' && m2.found===8, 'with the band at the title the window search matches by itself');
}
console.log('[1f] the layout of the first page laid over a page without a title row');
{
  const page1={profile:{X0:100, X1:1100}, headerRule:{id:'opsonin', name:'Opsonin', mode:'exact match: rule columns on the gutters'},
    columns:[{key:'name',label:'Product Name',gutterX0:100,gutterX1:400},{key:'pack',label:'Pack',gutterX0:410,gutterX1:500},{key:'qty',label:'Qnty',gutterX0:510,gutterX1:600},{key:'net',label:'Net Val',gutterX0:610,gutterX1:1100}]};
  const L=layoutOfColumns(page1);
  check(L.ruleId==='opsonin' && L.columns.length===4 && Math.abs(L.columns[0].x1f-0.3)<1e-9 && Math.abs(L.columns[3].x0f-0.51)<1e-9, 'the layout: four keyed columns, boundaries as shares of the width ('+L.columns.map(c=>c.key+' '+c.x0f.toFixed(2)+'-'+c.x1f.toFixed(2)).join(', ')+')');
  // page 2: the table is 200..2200 (twice as wide); its own gutters sit near the first two boundaries (0.30 → 800, 0.40 → 1000)
  // and the only other one, at 1900, is too far from the third (0.50 → 1200) to be it
  const gutters=[{x0:790,x1:812},{x0:1000,x1:1010},{x0:1900,x1:1910}];
  const cols=columnsFromLayout(L, 200, 2200, gutters, 20);
  check(cols.length===4 && cols.map(c=>c.key).join()==='name,pack,qty,net', 'four columns with the rule\'s keys');
  check(cols[0].gutterX1===789 && cols[1].gutterX0===813 && cols[0].fromGutter, 'the first boundary snapped to the gutter at 790..812');
  check(cols[1].gutterX1===999 && cols[2].gutterX0===1011 && cols[1].fromGutter, 'the second boundary snapped to the gutter at 1000..1010');
  check(Math.abs(cols[2].gutterX1-1200)<=2 && Math.abs(cols[3].gutterX0-1200)<=2 && cols[2].gutterX1<cols[3].gutterX0 && !cols[2].fromGutter, 'the third boundary at its place (0.50 → 1200) — the gutter at 1900 is too far ('+cols[2].gutterX1+'/'+cols[3].gutterX0+')');
  check(cols[3].gutterX1===2200 && cols[0].gutterX0===200, 'the outer edges are the page\'s');
  check(needsLayout({band:{rows:[1,2,3]}, columns:[{}], headerRule:{mode:'vocabulary'}}) && !needsLayout({band:{rows:[1,2,3]}, columns:[{}], headerRule:{mode:'exact match: rule columns on the gutters'}}) && !needsLayout({band:{rows:[1,2,3]}, columns:[{}], edits:['column 2 → qty']}), 'a page needs the layout when no rule matched exactly and the operator has not edited its columns');
  const named=(n,hits)=>({band:{rows:[1,2,3]}, columns:[{},{},{},{},{},{}], headerRule:{mode:'profile columns, named from the header vocabulary', titleRows:[0,1], found:n, total:6, titleHits:hits===undefined?n:hits}});
  check(!hasOwnTitles(named(10,2)) && needsLayout(named(10,2)), 'ten columns named from the closest rule in order but no row of words naming more than two: no titles of its own — the page takes the layout (Healthcare page 2)');
  check(hasOwnTitles(named(5)) && !needsLayout(named(5)), 'a page whose title row named five of six columns prints its own titles: its layout is the invoice’s, it needs none');
  check(!hasOwnTitles(named(2)) && needsLayout(named(2)), 'two names from stray words (Date, No) are not titles: the page takes the layout');
  check(!hasOwnTitles({band:{rows:[1,2,3]}, columns:[{},{}], headerRule:{mode:'the layout of p1.jpg (no title row on this page)', titleRows:[], found:0, total:8}}), 'a page laid out from another page does not print its own titles');
}
console.log('[2] fewer than three columns explained: nothing is named by the rule');
{
  const r=ruleInOrder(acme,[W('Foo'),W('Bar'),W('Trade')]);
  check(r.every(o=>!o), 'a lone Trade is not enough');
}
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
