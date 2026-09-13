// node tabletop.test.mjs — the rows above the column titles that belong to the table (Healthcare pages 4 and 5)
import { tableTop, rowKind, firstTitleBlock } from './tabletop.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const R=(...c)=>{ while(c.length<12) c.push(''); return c; };
const T1=R('Sl.No','Product','Product Name','Pack Size','Batch','TP(TK)','VAT(TK)','Invoice','Bonus','TP(TK)','VAT(TK)','Total');
const T2=R('','Code','','','Number','PACK','/PACK','Qty.','Qty.','Value','Value','Value');
console.log('[1] page 5: six items of the group begun on page 4, their SubTotal, then Visionary with its titles');
const p5=[ R('','Dhaka Sales Depot','','','','Customer Code :0010078908','','','Date','','',':05.03.2020'), R('','Bangladesh','','','','','','','Delivered Date','','',':05.03.2020'),
  R('116','18000254','Silinor M Tablet','1X3X8','1904502','395.80','68.87','1','','395.80','68.87','464.67'), R('','','50/1000mg','','','','','','','','',''),
  R('117','18000255','Silinor M Tablet 50/500 mg','1X3X7','2000304','314.84','54.78','1','','314.84','54.78','369.62'),
  R('121','18000307','Xelpid Tablet 40mg','1X1X10','1904332','179.91','31.30','2','','359.82','62.60','422.42'),
  R('','','','','','','SubTotal :','38','','11,049.52','1,922.55','12,972.07'),
  R('','Visionary Product','','','MD AFZAL HOSSAIN','','','','','','',''), T1, T2,
  R('122','18000117','Gemicin Tablet 320mg','1X1X7','1901163','341.08','59.35','2','','682.16','118.70','800.86'),
  R('125','18000281','Temovate Ointment 10gm','1X1X1','1904898','50.97','8.87','1','','50.97','8.87','59.84'),
  R('','','','','','','SubTotal :','9','','1,793.87','312.12','2,105.99') ];
const a=tableTop(p5,[8,9]);
console.log('    kinds:', JSON.stringify(a.kinds), 'keepFrom', a.keepFrom, 'above', a.above);
check(a.keepFrom===2 && a.above===6 && a.titleEnd===9, 'the table starts at item 116, six rows above the titles; the two page-header rows stay out');
check(a.kinds[7]==='group' && a.kinds[6]==='total' && a.kinds[2]==='item' && a.kinds[3]==='', 'group header, SubTotal, item, and the wrapped "50/1000mg" line between items');
console.log('[2] page 4: the Rx SubTotal at the top, MSD with its titles and one item, its SubTotal, Credence with its titles');
const p4=[ R('','Dhaka Sales Depot','','','','Customer Code :0010078908','','','Date','','',':05.03.2020'),
  R('','','','','','','SubTotal :','156','','43,090.25','7,497.71','50,587.96'),
  R('','MSD Product','','','','','','','','','',''), T1, T2,
  R('93','20000002','Andriol TestoCaps 40mg','','HPLR0114','593.64','','3','','1,780.92','','1,780.92'), R('','','','','99','','','','','','',''),
  R('','','','','','','SubTotal :','3','','1,780.92','','1,780.92'),
  R('','Credence Product','','','MAHFUZUR RAHMAN JAYED','','','','','','',''), T1, T2,
  R('94','18000002','Acecard Tablet 2.5mg','1X3X10','1904369','112.44','19.57','1','','112.44','19.57','132.01') ];
const b=tableTop(p4,[3,4,9,10]);
console.log('    kinds:', JSON.stringify(b.kinds), 'keepFrom', b.keepFrom);
check(b.keepFrom===1 && b.titleEnd===4, 'the table starts at the Rx SubTotal on row 1 and the first title block ends on row 4 (Credence\'s titles are not the top)');
check(firstTitleBlock([3,4,9,10]).start===3 && firstTitleBlock([0,5,6]).start===5, 'the first title block; a lone row far above loses to a two-row block');
console.log('[2b] Square page 5: the customer block above the titles, two items and the summary tables below');
const sq=[ R('Customer',': 259268 - Lazz Pharma - Z016','','','','Printing Date','',': 06.02.2020','',''), R('Address',': 71/5 Hossaini Dalan, Bakshi Bazar ,','','','','Invoice Date','',': 06.02.2020','',''),
  R('Invoice No',': 3162002381','Route',': Nilkhate','','Delivery Date','',': 06.02.2020 / E','',''),
  R('Sl.No','Product Name','SBU Inv.','Batch','Pack','Qty','Unit','Unit','Total',''), R('','','','','Size','','(T.P)','VAT','(T.P)',''),
  R('124','Zif Cl Cap','3162002535','0A02769',"6X10'S",'1','180.00','31.32','180.00',''), R('125','Zox Tab','3162002535','9K04479',"5X6'S",'1','226.50','39.42','226.50',''),
  R('Adjustment Amount','','0.00','Total Trade Price','','','','58,373.15','',''), R('Previous Outstanding Amount','','718,262.80','Total VAT','','','','9,483.72','',''),
  R('1163430055','3162002381','1026','DMCH-1(N)','00009313','','','1,413.16','',''), R('3161412690','29.01.2020','1021','DMCH-1(A)','','','','7,753.00','','') ];
const q=tableTop(sq,[3,4]); console.log('    kinds:', JSON.stringify(q.kinds), 'keepFrom', q.keepFrom);
check(q.keepFrom===3 && q.above===0, 'Customer, Address and Invoice No above the titles are the invoice header, not items — even with the summary tables below pulling the fill down');
console.log('[3] a page whose titles are at the top keeps nothing above');
const p1=[ R('','Rx Product','','','MD JAKARIA HABIB','','','','','','',''), T1, T2, R('1','18000001','Actilac Syrup 200ml','1X1X1','027','172.41','30.00','2','','344.82','60.00','404.82') ];
const c=tableTop(p1,[1,2]); check(c.keepFrom===0 && c.above===1 && c.kinds[0]==='group', 'the group header above the titles is kept, nothing else is there');
const c2=tableTop([ R('','Dhaka Sales Depot','','','','Customer Code :0010078908'), T1, T2, p1[3] ],[1,2]); check(c2.keepFrom===1 && c2.above===0, 'a customer line above the titles is not a table row');
check(rowKind(R('','','','','','','Grand Total','','','','','67,446.94'),10)==='total' && rowKind(R('','Amount In Words :Sixty Six Thousand'),10)==='', 'a total needs a number; words alone are nothing');
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
