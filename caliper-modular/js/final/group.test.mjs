// node group.test.mjs — item group names inside the table
import { isGroupName, isStray, groupNameOf, groupRowsOf, numericColumnsOf, isNumberedCategory, categoryName, groupInsideTotal } from './group.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
console.log('[1] what reads like a group name');
for(const [t,v] of [['RPL',true],['RNL',true],['JBL',true],['NEVIAN',true],['Square Pharmaceuticals Ltd.',true],['ACME Laboratories',true],['Cosmetics & Toiletries',true],['Non-Pharma',true],
  ['Sub Total',false],['Total',false],['Grand Total',false],['Net Payable',false],['Round Down (-)',false],['Less Discount',false],['Amount In Words',false],['Page',false],
  ['(60s)',false],['500mg/400IU',false],['Tab',false],['Sach',false],['Forte',false],['Cap',false],['DS Tab',false],['Vial',false],['Tablet',false],
  ['',false],['-',false],['|',false],['A',false],['S',false],['12',false],['Group 1',false]])
  check(isGroupName(t)===v, JSON.stringify(t)+' → '+isGroupName(t));
console.log('[2] stray marks: what a pen stroke across the row reads as');
for(const [t,src,v] of [['L.','tesseract5',true],['A','tesseract5',true],['2','tesseract5',true],['0.35','local-only',true],['1.35','local-only',true],['o]','easyocr',true],['',null,true],['1',null,true],
  ['0','agreed',false],['1','api',false],['2','vote',false],['1.35','manual',false],["2X10'S",'tesseract5',false],['Cap','local',false],['248.14','local-only',false]])
  check(isStray(t,src)===v, JSON.stringify(t)+' ('+src+') → '+isStray(t,src));
console.log('[3] the group name a row holds');
{
  const N=(texts,sources)=>{ const g=groupNameOf(texts,sources); return g?g.name+' @'+g.cells.join(','):null; };
  check(N(['','RPL','','','',''])==='RPL @1', 'one text: RPL');
  check(N(['RNL','','','','','','','','L.','','',''],['local','empty','empty','empty','empty','empty','empty','empty','tesseract5','empty','empty','empty'])==='RNL @0', 'RNL in the first column, a stray "L." from the pen stroke');
  check(N(['JBL','','','','','','2','0.35','1.35','1','',''],['local',null,null,null,null,null,'tesseract5','local-only','local-only','tesseract5',null,null])==='JBL @0', 'JBL with four strays from the tick marks');
  check(N(['','NEVAN','','','','','','','','A','',''],[null,'vote',null,null,null,null,null,null,null,'tesseract5',null,null])==='NEVAN @1', 'NEVIAN read NEVAN, a stray A');
  check(N(['','Square Pharmaceuticals','Ltd.','','',''])==='Square Pharmaceuticals Ltd. @1,2', 'a long name over two neighbouring cells');
  check(N(['','Ubi-Q Cap','','','','','1','0','','','',''],[null,'agreed',null,null,null,null,'agreed','agreed',null,null,null,null])===null, 'a damaged item row: its 1 and 0 were agreed on, not strays');
  check(N(['','Ubi-Q Cap',"2X10'S",'','','','','','','','',''])===null && N(['','Acos FC Tab 500mg(6s)','','','',''])===null, 'a pack size beside the name, or a name with digits: not a group');
  check(N(['','','','','',''])===null && N(['','Tab','','','',''])===null && N(['','Sub Total','','','','17'])===null, 'nothing, a form word, a totals row: not a group');
}
console.log('[4] group rows in a table');
{
  const R=(...c)=>c;
  const rows=[ R('','RPL','','','','',''), R('1','Acos FC Tab 500mg(6s)',"2X3'S",'248.14','1037926','1','248.14'), R('2','ATOZ Senior FC Tab(45s)',"5X9'S",'438.53','1054826','1','438.53'),
               R('','(60s)','','','','',''), R('RNL','','','','L.','',''), R('9','Ubi-Q Cap 200mg(20s)','2X10S','1466.09','200832','1','466.00'),
               R('JBL','','','2','0.35','1.35','1'), R('10','Greenox Cap 4mg(20s)',"2X10'S",'329.84','614262','2','659.68'), R('','NEVAN','','','','A',''), R('11','BINOCLAR 500MG',"2X7'S",'703.15','7015126','2','1406.30'), R('','Sub Total','','','','17','7999.38') ];
  const src=rows.map(r=>r.map(t=>t?'tesseract5':'empty'));
  const g=groupRowsOf(rows, src);
  check(JSON.stringify(g)===JSON.stringify([{index:0,name:'RPL'},{index:4,name:'RNL'},{index:6,name:'JBL'},{index:8,name:'NEVAN'}]), 'RPL, RNL, JBL, NEVAN are group rows despite the strays; (60s) and Sub Total are not ('+JSON.stringify(g)+')');
  check(groupRowsOf([R('','JBL','','','','',''), R('','Sub Total','','','','17','7999.38')]).length===0, 'a group name with no item row after it is not a group');
  const tail=rows.slice(0,3).concat([R('','JBL','','','','','')]);
  check(groupRowsOf(tail).length===1 && groupRowsOf(tail)[0].index===0, 'a trailing group row with nothing under it is left alone');
  const wide=[ R('','Square Pharmaceuticals','Ltd.','','','',''), R('1','Seclo 20 Cap',"3X10'S",'100.00','B1','2','200.00'), R('2','Napa 500 Tab',"10X10'S",'80.00','B2','1','80.00') ];
  check(groupRowsOf(wide).length===1 && groupRowsOf(wide)[0].name==='Square Pharmaceuticals Ltd.', 'a long name spread over two neighbouring cells is one group name');
  const apart=[ R('','Square','','','','Ltd.',''), R('1','Seclo 20 Cap',"3X10'S",'100.00','B1','2','200.00'), R('2','Napa 500 Tab',"10X10'S",'80.00','B2','1','80.00') ];
  check(groupRowsOf(apart).length===1 && groupRowsOf(apart)[0].name==='Square · Ltd.', 'two texts in columns apart are the group and its keeper, joined with a dot');
  const keeper=[ R('','Rx Product','','','MD JAKARIA HABIB','',''), R('1','Actilac Syrup 200ml','1X1X1','027','172.41','2','404.82'), R('2','Aeron Flash Tablet 5mg','1X3X10','1904985','179.91','1','211.21') ];
  check(groupRowsOf(keeper, keeper.map(r=>r.map(t=>t?'vote':'empty'))).length===1 && groupRowsOf(keeper)[0].name==='Rx Product · MD JAKARIA HABIB', 'the Healthcare header: the group and its keeper apart on one row ('+JSON.stringify(groupRowsOf(keeper))+')');
  const frag=[ R('1','Coralcal-DX FC Tab',"5X10S",'637.18','1046226','2','1274.36'), R('','Tab','','','','',''), R('2','Napa 500 Tab',"10X10'S",'80.00','B2','1','80.00') ];
  check(groupRowsOf(frag).length===0, 'a form word alone (the tail of a wrapped name) is not a group');
  const damaged=[ R('','Ubi-Q Cap','','','','1','0'), R('1','Seclo 20 Cap',"3X10'S",'100.00','B1','2','200.00'), R('2','Napa 500 Tab',"10X10'S",'80.00','B2','1','80.00') ];
  check(groupRowsOf(damaged, damaged.map(r=>r.map(t=>t?'agreed':'empty'))).length===0, 'a damaged item row whose numbers were agreed on is not a group');
  check(groupRowsOf([R('RPL','x'), R('1','Seclo')]).length===0, 'a table of two columns has no group rows');
}
console.log('[5] a group row that carries a code: nothing numeric in the number columns');
{
  const R=(...c)=>c;
  const rows=[ R('Products of General-A:','Territory:','BABB4-Jahi','dul Islam[PE13935]','','','',''), R('Clamox 625mg Tab','6X2','TOF299','296.88','51.6','1','348.48','339.57'), R('Finix 20mg Tab','20X7','TOH026','735','127.4','1','862.40','840.35'),
               R('','','','Sub Total:','','','5831.23','5682.21'), R('Products of General-B:','Territory:','BABB5-Parvej','Hasan[PE25972]','','','',''), R('Algecal D Tab','10X3','TOF395','247.5','42.9','1','290.40','282.97'),
               R('Received the goods in good condition','','','','','','',''), R('','','','','Page :4/1-[DD02581]','','','') ];
  const g=groupRowsOf(rows, rows.map(r=>r.map(t=>t?'vote':'empty')));
  check(JSON.stringify(g)===JSON.stringify([{index:0,name:'Products of General-A: Territory: BABB4-Jahi dul Islam[PE13935]'},{index:4,name:'Products of General-B: Territory: BABB5-Parvej Hasan[PE25972]'}]), 'the two territory rows are group rows, the sub-total and the trailing rows are not ('+JSON.stringify(g)+')');
  const frag=[ R('Coralcal-DX FC Tab','5X10S','1046226','637.18','221.74','2','1274.36','1496.10'), R('500mg/400IU (50s)','','','','','','',''), R('Tablet 500mg','','','','','','',''), R('Napa 500 Tab','10X10','B2','80.00','13.92','1','93.92','91.52') ];
  check(groupRowsOf(frag, frag.map(r=>r.map(t=>t?'vote':'empty'))).length===0, 'the wrapped tail of an item name, with or without digits, is not a group');
  const damaged=[ R('Ubi-Q Cap 200mg','','','','','1','',''), R('Napa 500 Tab','10X10','B2','80.00','13.92','1','93.92','91.52'), R('Ace 500 Tab','10X10','B3','60.00','10.44','2','140.88','137.28') ];
  check(groupRowsOf(damaged, damaged.map(r=>r.map(t=>t?'agreed':'empty'))).length===0, 'a damaged item row with a quantity in a number column is not a group');
  check(JSON.stringify(numericColumnsOf(rows))==='[4,5,6,7]', 'the number columns of the table — the T.P column here holds group text and a Sub Total label in half its cells, so it does not count ('+JSON.stringify(numericColumnsOf(rows))+')');
}
console.log('[6] numbered categories: an ACME page with NORMAL ITEM, 05 INJECTION, 06 LIQUID');
for(const [t,v] of [['05 INJECTION',true],['06 LIQUID',true],['01. TABLET',true],['02 CAPSULE',true],['12 EYE DROPS',true],['NORMAL ITEM',true],
  ['100ml',false],['500mg',false],['30 PCS',false],['10 Tabs',false],['14 Tab',false],['1x1',false],['05 Sub Total',false],['1017 FLUTICON NASAL SPRAY',false],['10',false]])
  check(isNumberedCategory(t)===v || (v && isGroupName(t)), JSON.stringify(t)+' → '+isNumberedCategory(t));
{
  const R=(...c)=>c;
  const rows=[ R('NORMAL ITEM','','','','','','','','','',''), R('1018 FLUTICON NASAL SPRAY',"1x1's",'D0182001','1','187.98','32.71','187.98','32.71','3','5.64','215.05'), R('1033 SUMA NASAL SPRAY',"1X1's",'D0331005','1','464.77','80.87','464.77','80.87','3','13.94','531.70'),
    R('05 INJECTION','','','','','','','','','',''), R('1017 TRIZON-IV 1G','1x1','V0171064','5','142.86','24.86','714.30','124.30','54.4','388.60','450.00'), R('1069 PPI 40 IV INJ.(LYOPHILIZED)','1X1','V0692001','3','67.47','11.74','202.41','35.22','3','102.63','135.00'),
    R('06 LIQUID','','','','','','','','','',''), R('1003 ELECTRO-K 100ML','100ml','L0032001','1','14.99','2.61','14.99','2.61','3','0.45','17.15'), R('1032 NYSTAT SUSPENSION 30ML','30ML','L0322002','2','35.11','6.11','70.22','12.22','3','2.10','80.34') ];
  const g=groupRowsOf(rows, rows.map(r=>r.map(t=>t?'vote':'empty')));
  check(JSON.stringify(g)===JSON.stringify([{index:0,name:'NORMAL ITEM'},{index:3,name:'05 INJECTION'},{index:6,name:'06 LIQUID'}]), 'the three category rows are group rows; the items with their product codes are not ('+JSON.stringify(g)+')');
  const tail=[ R('1022 V-PLEX SYRUP','100ml','L0221024','1','26.72','4.65','26.72','4.65','3','0.80','30.57'), R('10 Tabs','','','','','','','','','',''), R('1023 V-PLEX SYRUP 200ML','200ml','L0231049','1','46.62','8.11','46.62','8.11','3','1.40','53.33') ];
  check(groupRowsOf(tail, tail.map(r=>r.map(t=>t?'vote':'empty'))).length===0, 'a wrapped pack tail "10 Tabs" is not a category');
  // the number read with look-alikes: "0S INJECTION" (the 5 an S), "O6 LIQUID" (the 0 an O), a stray ":" beside it
  for(const [t,v,n] of [['0S INJECTION',true,'05 INJECTION'],['O6 LIQUID',true,'06 LIQUID'],['OS INJECTION',true,'05 INJECTION'],['S5 TABLET',true,'55 TABLET'],['IS INJECTION',false,null],['BS LIQUID',false,null]])
    check(isNumberedCategory(t)===v && (!v || categoryName(t)===n), JSON.stringify(t)+' → '+isNumberedCategory(t)+(v?' as '+categoryName(t):''));
  const misread=[ R('NORMAL ITEM','','','','','','','','','',''), R('1033 SUMA NASAL SPRAY',"1X1's",'D0331005','1','464.77','80.87','464.77','80.87','3','13.94','531.70'),
    R('0S INJECTION','','','','','','','','',':',''), R('1017 TRIZON-IV 1G','1x1','V0171064','5','142.86','24.86','714.30','124.30','54.4','388.60','450.00'),
    R('06 LIQUID','','','','','','','','','',''), R('1003 ELECTRO-K 100ML','100ml','L0032001','1','14.99','2.61','14.99','2.61','3','0.45','17.15') ];
  const src=misread.map(r=>r.map(t=>t===':'?'tesseract5':t?'vote':'empty'));
  const g2=groupRowsOf(misread, src);
  check(JSON.stringify(g2)===JSON.stringify([{index:0,name:'NORMAL ITEM'},{index:2,name:'05 INJECTION'},{index:4,name:'06 LIQUID'}]), 'the three ACME categories as the engines read them, the S written back as a 5 ('+JSON.stringify(g2)+')');
}
console.log('[9] a group name read into the SubTotal row above it');
{ const t=['MSD','Product','','','','','SubTotal','156','yd','43,090.25','7,497.71','50,587.96'];
  const g=groupInsideTotal(t); check(g && g.name==='MSD Product' && g.cells.join()==='0,1', '"MSD Product" in the leading cells of the SubTotal row is the next group header ('+JSON.stringify(g)+')');
  check(!groupInsideTotal(['','','','','','','SubTotal :','3','','1,780.92','','1,780.92']), 'a SubTotal row with nothing before the word holds no group');
  check(!groupInsideTotal(['1','18000001','Actilac Syrup 200ml','1X1X1','027','172.41','30.00','2','','344.82','60.00','404.82']), 'an item row is not');
  check(!groupInsideTotal(['93','','','','','','SubTotal','3','','1,780.92','','1,780.92']), 'a stray serial number before the word is no group'); }
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
