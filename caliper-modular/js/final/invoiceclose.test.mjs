// node invoiceclose.test.mjs — the invoice's summary closes it (Square page 5, Healthcare page 5)
import { isSummaryLine, invoiceCloseAt } from './invoiceclose.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const R=(...c)=>{ while(c.length<10) c.push(''); return c; };
console.log('[1] the lines that name an invoice-level total');
for(const t of ['Total Trade Price 58,373.15','Total VAT','Less Discount Amount 1,825.66-','Net Invoice Amount 66,031.21','Adjustment Amount : 0.00','Previous Outstanding Amount : 718,262.80','Grand Total : 67,446.94','Total Payable : 66,260.38','Total Invoice Amount : Taka Sixty Six Thousand','Amount In Words :Sixty Six'])
  check(isSummaryLine(t), JSON.stringify(t)+' closes the invoice');
for(const t of ['SubTotal : 156 43,090.25','Sub Total','Total Value','VAT(TK) Value','Unit VAT','Cefotil 750 IM/IV Inj','TP+VAT','Total (T.P)'])
  check(!isSummaryLine(t), JSON.stringify(t)+' does not');
console.log('[2] Square page 5: two items, the summary, the tables below');
const p5=[ R('124','Zif Cl Cap','3162002535','0A02769',"6X10'S",'1','180.00','31.32','180.00'),
  R('125','Zox Tab','3162002535','9K04479',"5X6'S",'1','226.50','39.42','226.50'),
  R('','Adjustment Amount','','0.00','Total Trade Price','','','','58,373.15'),
  R('','Previous Outstanding Amount','','718,262.80','Total VAT','','','','9,483.72'),
  R('','Total Outstanding Amount','','784,294.01','Less Discount Amount','','','','1,825.66-'),
  R('','Total Invoice Amount','Taka Sixty Six Thousand','','Net Invoice Amount','','','','66,031.21'),
  R('1163430055','3162002381','1026','DMCH-1(N)','00009313','','','','1,413.16'),
  R('3161412690','29.01.2020','1021','DMCH-1(A)','','','','','7,753.00') ];
check(invoiceCloseAt(p5)===2, 'the invoice closes at "Total Trade Price": the two items stay, the summary and the tables under it go ('+invoiceCloseAt(p5)+')');
console.log('[3] rows that do not close');
const mid=[ R('31','Ceftron 1g IV Inj','3162002535','0A00289',"1X1'S",'1','187.41','32.61','187.41'), R('','','','','','SubTotal :','38','','11,049.52'), R('','Visionary Product','','','MD AFZAL HOSSAIN','','','',''), R('122','Gemicin Tablet 320mg','18000117','1X1X7','1901163','341.08','59.35','2','800.86') ];
check(invoiceCloseAt(mid)===-1, 'a group SubTotal inside the table is not the close');
check(invoiceCloseAt([R('','Grand Total','','','67,446.94'), R('1','Actilac','2','404.82')])===-1, 'a summary line before any item (a stray match in the page header) does not close');
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
