// node headerrows.test.mjs — the invoice header taken for items on a page without column titles (Healthcare page 3)
import { leadingHeaderRows, headerVocabulary, wordsOf } from './headerrows.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const R=(...c)=>{ while(c.length<12) c.push(''); return c; };
// sl code name pack batch tp vat qty bonus tpValue vatValue net — numeric: sl code tp vat qty bonus tpValue vatValue net
const numeric=[true,true,false,false,false,true,true,true,true,true,true,true];
const page1Header=['Healthcare Pharmaceuticals Ltd','Nasir Trade Centre (Level-9 & 14)','89 Bir Uttam C.R. Datta Sarak,Dhaka- 1205.','Tel: +880-2-9632175, +880-2-9632176','Dhaka Sales Depot','3/3 A, East Rampura,','Dhaka-1219','Bangladesh','Telephone : +8802-9337663','Customer Code :0010078908','LAZZ PHARMA,','Dhaka','Dhaka-1100','Date :05.03.2020','Invoice No. :9140668401','Area :60000635DMCH-Chankharpul','[M10313]','MIO :60000849-MD JAKARIA HABIB','Mobile No. :01977158297','Delivered By :80000358-MD JONYJUL ISLAM','Delivered Date :05.03.2020'];
const vocab=headerVocabulary(page1Header);
const rows=[ R('elepho',':+8802-933','','1','','','','[M','[M10313]','','',''),
  R('','','','1','00','','','MIO','O',':60000849-MD','JAKARIA','HABIB'),
  R('','','','','Bangladesh','','','','','','',''),
  R('','','','1','','','','M','Mobile …',':01977158297','',''),
  R('','','','1','','','','De','Deliver…',':80000358-MD','JONYJUL','ISLAM'),
  R('','','','1','','','',')','Delivered Date',':05.03.2020','',''),
  R('63','18000234','Rozith PFS 35ml','1X1X1','1905069','104.95','18.26','A','A','104.95','18.26','123.21'),
  R('64','18000236','Rozith PFS 50ml','1X1X1','1905800','138.68','24.13','A1','7','138.68','24.13','162.81') ];
console.log('[1] the header block ahead of the items');
const n=leadingHeaderRows(rows, numeric, vocab, {itemFill:10});
check(n===6, 'six header rows dropped, item 63 is the first row ('+n+')');
check(leadingHeaderRows(rows, numeric, new Set(), {itemFill:10})>=5, 'without the other pages\' words the misfit test alone catches the block ('+leadingHeaderRows(rows, numeric, new Set(), {itemFill:10})+')');
check(leadingHeaderRows([R('','','','1','','','','MIO','O',':60000849-MD','JAKARIA','HABIB'), rows[6]], numeric, new Set(), {itemFill:10})===1, 'a row with words but not one number where the columns hold numbers is header, even with no shared vocabulary and few misfits');
console.log('[2] rows that must stay');
check(leadingHeaderRows(rows.slice(6), numeric, vocab, {itemFill:10})===0, 'an item row with pen ticks read as A in the qty column is not a header row');
const group=[ R('','Rx Product','','','MD JAKARIA HABIB','','','','','','',''), rows[6] ];
check(leadingHeaderRows(group, numeric, vocab, {itemFill:10, isGroup:t=>/^Rx Product$/.test(t[1])})===0, 'a group header (its keeper\'s name is in the page-1 header too) ends the walk');
check(leadingHeaderRows([R('','','','','','','SubTotal :','38','','11,049.52','1,922.55','12,972.07'), rows[6]], numeric, vocab, {itemFill:10, isTotal:t=>/total/i.test(t.join(' '))})===0, 'a sub-total at the top of the page stays');
const wrapped=[ R('116','18000254','Silinor M Tablet','1X3X8','1904502','395.80','68.87','1','','395.80','68.87','464.67'), R('','','50/1000mg','','','','','','','','','') ];
check(leadingHeaderRows(wrapped, numeric, vocab, {itemFill:10})===0, 'an item at the top with its wrapped line stays');
check(wordsOf('MIO :60000849-MD JAKARIA HABIB').join(',')==='MIO,60000849,JAKARIA,HABIB' && wordsOf('Tab 10mg').length===1, 'the words that identify a line: letters of three or more, digits of four or more');
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
