// node summarydata.test.mjs — the Healthcare invoice across five pages: groups, sub-totals, the invoice's totals
import { summaryData, invoiceTotals } from './summarydata.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const keys=['sl','name','qty','net'];
const g=t=>({text:t, source:'agreed'});
// a page: rows as [kind, sl, name, qty, net]; the number check's rows follow the kinds
const page=(name, rows, texts=[])=>({name, status:'done', texts, F:{keys, header:{labels:['Sl No','Product Name','Invoice Qty','Total Value']}, grid:rows.map(r=>[g(r[1]),g(r[2]),g(r[3]),g(r[4])]),
  rows:rows.map(r=>r[0]==='group'?{kind:'group',groupName:r[2]}:{}),
  numbers:{roles:{qty:'qty', net:'net'}, rows:rows.map(r=>({isTotal:r[0]==='total', isGroup:r[0]==='group', cells:{qty:{value:r[3]!==''?+r[3]:null}, net:{value:r[4]!==''?+String(r[4]).replace(/,/g,''):null}}}))}},
  P:{results:rows.map(r=>r[0]==='item'?{status:'match', product:{name:r[2].toUpperCase()}}:{status:r[0]})}});
const p1=page('p1',[['group','','Rx Product · MD JAKARIA HABIB','',''],['item','1','Actilac Syrup 200ml','2','404.82'],['item','2','Aeron Flash Tablet 5mg','1','211.21']]);
const p2=page('p2',[['item','31','Furotil PFS 70ml','1','176.02'],['item','32','Furotil Tablet 250mg','1','396.03']]);
const p3=page('p3',[['item','63','Rozith PFS 35ml','1','123.21']]);
const p4=page('p4',[['total','','SubTotal :','6','1311.29'],['group','','MSD Product','',''],['item','93','Andriol TestoCaps 40mg','3','1,780.92'],['total','','SubTotal :','3','1780.92'],['group','','Credence Product · MAHFUZUR RAHMAN JAYED','',''],['item','94','Acecard Tablet 2.5mg','1','132.01']]);
const p5=page('p5',[['item','116','Silinor M Tablet','1','464.67'],['total','','SubTotal :','2','596.68'],['group','','Visionary Product · MD AFZAL HOSSAIN','',''],['item','122','Gemicin Tablet 320mg','2','800.86'],['total','','SubTotal :','2','800.86']],
  ['Grand Total : 4,489.75','Less Discount : 1,186.56','Total Payable : 3,303.19','Amount In Words : Three Thousand']);
const D=summaryData([p1,p2,p3,p4,p5]);
console.log('[1] the groups across the pages');
const gr=D.groups.map(x=>x.name+' items '+x.items+' pages '+x.pages.join(',')+(x.check?' net '+(x.check.net.ok?'ok':'differs')+' qty '+(x.check.qty.ok?'ok':'differs'):' open'));
console.log('   ', gr.join('\n    '));
check(D.groups.length===4, 'four groups: Rx, MSD, Credence, Visionary ('+D.groups.length+')');
check(D.groups[0].name.startsWith('Rx Product') && D.groups[0].items===5 && D.groups[0].pages.join()==='1,2,3', 'Rx Product holds the items of pages 1, 2 and 3 (5 items)');
check(D.groups[0].check && D.groups[0].check.net.ok && D.groups[0].check.qty.ok, 'the Rx sub-total on page 4 adds up over the three pages before it (1311.29, qty 6)');
check(D.groups[1].name==='MSD Product' && D.groups[1].items===1 && D.groups[1].check.net.ok, 'MSD Product: one item, its sub-total agrees');
check(D.groups[2].name.startsWith('Credence') && D.groups[2].items===2 && D.groups[2].pages.join()==='4,5' && D.groups[2].check.net.ok, 'Credence runs from page 4 into page 5; its sub-total on page 5 agrees (596.68)');
check(D.groups[3].name.startsWith('Visionary') && D.groups[3].check.net.ok, 'Visionary opens and closes on page 5');
check(D.pages[1].rows[0].group.startsWith('Rx Product') && D.pages[4].rows[0].group.startsWith('Credence'), 'the first rows of pages 2 and 5 belong to the group open at the end of the page before');
console.log('[2] the invoice\'s totals');
check(D.invoice.grandTotal===4489.75 && D.invoice.discount===1186.56 && D.invoice.payable===3303.19 && D.invoice.page===5, 'Grand Total, Less Discount and Total Payable read from page 5 ('+JSON.stringify(D.invoice)+')');
check(D.invoice.grandOk===true && D.invoice.itemsSum===4489.75, 'the Grand Total equals the sum of every item\'s Total Value');
check(D.invoice.payableOk===true, 'Total Payable = Grand Total − Less Discount');
const bad=summaryData([p1,p2,p3,p4,page('p5b',p5.F.grid.map((r,i)=>[p5.F.numbers.rows[i].isTotal?'total':p5.F.rows[i].kind==='group'?'group':'item', r[0].text, r[1].text, r[2].text, r[3].text]), ['Grand Total : 5,000.00','Less Discount : 1,186.56','Total Payable : 3,813.44'])]);
check(bad.invoice.grandOk===false && bad.invoice.payableOk===true, 'a Grand Total that does not match the items is reported ('+bad.invoice.grandTotal+' vs '+bad.invoice.itemsSum+')');
check(invoiceTotals([{texts:['Grand Total: 67,446.94','Less Discount: 1,186.56','Total Payable: 66,260.38']}]).payable===66260.38, 'the Healthcare figures');
check(invoiceTotals([{texts:['Sub Total : 1,293.06']}]).grandTotal===null, 'a sub-total is not the grand total');
console.log('[2b] the MRP sum and the profit per page and for the invoice');
{ const keys3=['sl','name','pack','tp','qty','net']; const g3=t=>({text:t,source:'agreed'});
  const pg3=(name,rows,meta)=>({name,status:'done',texts:[],F:{keys:keys3, header:{labels:['Sl','Name','Pack','TP','Qty','Total']}, grid:rows.map(r=>r.slice(0,6).map(g3)), rows:rows.map(()=>({})), rowMeta:meta||{},
    numbers:{roles:{tp:'unitTp', qty:'qty', net:'net'}, rows:rows.map(r=>({isTotal:false, cells:{tp:{value:+r[3]}, qty:{value:+r[4]}, net:{value:+r[5]}}}))}}, P:{results:rows.map(r=>({status:'match', product:{name:r[1].toUpperCase(), mrp:r[6]}}))}});
  const M=summaryData([pg3('p1',[['1','Ace 250 Supp',"4X5'S",'75.40','1','75.40',5],['2','Ace Syp 60ml',"1X1'S",'15.52','8','124.16',18]]), pg3('p2',[['3','Napa',"10X10'S",'80.00','2','160.00',1]],{0:{mrp:120}})]);
  check(M.pages[0].mrp.rows===2 && Math.abs(M.pages[0].mrp.value-(1*100+8*18))<1e-9 && Math.abs(M.pages[0].mrp.cost-(75.40+8*15.52))<1e-9, 'page 1: MRP sum 100 + 144 (5 × 20 units, 18 × 1) against its TP value ('+JSON.stringify(M.pages[0].mrp)+')');
  check(M.pages[1].mrp.value===240 && M.pages[1].rows[0].mrp===240, 'page 2: the pack MRP typed by hand (120) × qty 2');
  check(Math.abs(M.grand.mrp.value-484)<1e-9 && M.grand.mrp.rows===3 && M.grand.mrp.profit!==null && Math.abs(M.grand.mrp.profit-((484-(75.40+124.16+160))/(75.40+124.16+160)*100))<1e-9, 'the invoice: the MRP sum over every page and its profit on TP'); }
console.log('[3] the Square summary: Total Trade Price · Total VAT · Less Discount Amount · Net Invoice Amount');
{ const sq=invoiceTotals([{texts:['Adjustment Amount : 0.00','Total Trade Price 58,373.15','Previous Outstanding Amount : 718,262.80','Total VAT 9,483.72','Less Discount Amount 1,825.66-','Net Invoice Amount 66,031.21','Total Invoice Amount : Taka Sixty Six Thousand']}]);
  check(sq.tradeTotal===58373.15 && sq.vatTotal===9483.72 && sq.discount===1825.66 && sq.payable===66031.21 && sq.grandTotal===null, 'the four lines read ('+JSON.stringify(sq)+')');
  const keys2=['sl','name','totalTp','totalVat','net']; const g2=t=>({text:t,source:'agreed'});
  const pg=(name,rows,texts=[])=>({name,status:'done',texts,F:{keys:keys2, header:{labels:['Sl No','Product Name','Total (T.P)','Unit VAT','Total']}, grid:rows.map(r=>[g2(r[0]),g2(r[1]),g2(r[2]),g2(r[3]),g2(r[4])]), rows:rows.map(()=>({})), invoiceClosed:texts.length?{line:'Total Trade Price'}:null,
    numbers:{roles:{totalTp:'totalTp', totalVat:'totalVat', net:'net'}, rows:rows.map(r=>({isTotal:false, cells:{totalTp:{value:+r[2]}, totalVat:{value:+r[3]}, net:{value:+r[4]}}}))}}, P:{results:rows.map(()=>({status:'match',product:{name:'X'}}))}});
  const D2=summaryData([pg('p1',[['1','Ace 250 Supp','75.40','13.11','75.40'],['2','Ace P-Drop','15.52','2.70','15.52']]), pg('p5',[['124','Zif Cl Cap','180.00','31.32','180.00'],['125','Zox Tab','226.50','39.42','226.50']], ['Total Trade Price 497.42','Total VAT 86.55','Less Discount Amount 10.00-','Net Invoice Amount 573.97'])]);
  check(D2.invoice.tradeOk===true && D2.invoice.vatOk===true && D2.invoice.payableOk===true && D2.invoice.closedOnPage===2, 'Total Trade Price and Total VAT equal the items\' sums, Net Invoice Amount = trade + VAT − discount, the invoice closes on page 2 ('+JSON.stringify(D2.invoice)+')'); }
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
