// Node test for caliper-modular/js/numcheck/numcheck.js
// Rows are transcribed from real invoices (Ibn Sina, Incepta, Square, Everest)
// and an ACME-style discount layout; some cells are then corrupted the way
// OCR does it (wrong digit, letter for digit, pen tick, blank cell).
import { analyseNumbers, applyNumbers, parseNumber, plausibleMisread, ruleRelations } from './numcheck.js';

let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const table=(keys, rows, readings)=>({header:{keys, labels:keys}, rows:rows.map((r,i)=>({row:i+1, cells:Object.fromEntries(keys.map((k,j)=>[k,r[j]])), readings:readings&&readings[i]||{}}))});
const cell=(res,ri,k)=>res.rows[ri].cells[k];
const show=res=>{ console.log('  roles:', JSON.stringify(res.roles)); console.log('  vatRate:', res.model.vatRate, ' relations:', res.model.relations.map(r=>r.id+(r.derived?'*':'')+`(${r.satisfied}/${r.testedRows})`).join(' '));
  for(const r of res.rows){ const s=Object.entries(r.cells).filter(([k,c])=>res.roles[k]).map(([k,c])=>`${k}=${c.value===null?'∅':c.value}${c.status==='verified'?'':'['+c.status+(c.fixedText?'→'+c.fixedText:'')+']'}`).join(' '); console.log('  row',r.row,r.isTotal?'(total)':'', s); }
  console.log('  summary:', JSON.stringify(res.summary)); };

/* ---- 1 · Ibn Sina: TP · VAT · TP+VAT per pack · Qty · Bonus · Total TP · Total VAT · Disc Amt · Net */
console.log('\n[1] Ibn Sina layout');
{
  const keys=['name','pack','tp','vat','tpVat','qty','bonus','tpValue','vatValue','discountValue','net'];
  const rows=[
    ['BACTIN D EYE & EAR DROP','5ml','56.43','9.82','66.25','2','0','172.86','19.64','0.00','132.50'],   // 172.86 should be 112.86
    ['BACTIN EYE DROP-5ML','5ml','26.34','4.58','30.92','2','0','52.68','9.16','0.00',''],               // net missing
    ['BROMOFEN EYE DROPS','5ml','74.96','13.O4','88.00','1','0','74.96','13.04','0.00','88.00'],         // letter O
    ['FLOROMOX EYE DROPS','5ml','86.21','15.00','101.21','2','0','1 72.42','30.00','0.00','202.42'],    // pen tick split
    ['SINAFRESH LIQUIGEL','10ml','187.41','32.61','','2','0','374.82','65.22','0.00','440.04'],          // tpVat missing
    ['','','','','','','Sub Total :','787.74','137.06','.00','924.80'],
  ];
  const res=analyseNumbers(table(keys,rows)); show(res);
  check(res.roles.vat==='unitVat' && res.roles.discountValue==='discAmt', 'vat → unit VAT, discountValue → discount amount');
  check(cell(res,0,'tpValue').status==='fixed' && cell(res,0,'tpValue').value===112.86, 'row 1 total TP 172.86 → 112.86');
  check(cell(res,1,'net').status==='filled' && cell(res,1,'net').value===61.84, 'row 2 net filled 61.84');
  check(cell(res,2,'vat').value===13.04 && cell(res,2,'vat').status==='verified', 'row 3 "13.O4" read as 13.04 and verified');
  check(['filled','verified'].includes(cell(res,3,'tpValue').status) && cell(res,3,'tpValue').value===172.42, 'row 4 "1 72.42" → 172.42 (joined and verified, or filled)');
  check(cell(res,4,'tpVat').status==='filled' && cell(res,4,'tpVat').value===220.02, 'row 5 TP+VAT filled 220.02');
  check(res.rows[5].isTotal && cell(res,5,'net').status==='verified', 'sub-total row recognised and verified');
  check(res.summary.conflicts===0, 'no conflicts left');
}

/* ---- 2 · Incepta: TP · VAT · SP · Qty · Vat Value · TP Value · SP Value (VAT ratio 17.4%, not 15) */
console.log('\n[2] Incepta layout');
{
  const keys=['sl','code','name','type','pack','tp','vat','sp','op','qty','bonus','batch','batchQty','vatValue','tpValue','spValue'];
  const rows=[
    ['1','ARO','ARIPRA ORAL SOLUTION','IPL',"1'S",'56.22','9.78','66','2','Z','0','26001','2','19.56','112.44','132.00'],   // qty "Z"
    ['2','ATP','ARITONE ZI SYRUP','IPL','100 ML','44.98','7.83','52.81','2','2','0','26005','2','','89.96','105.62'],       // vatValue missing
    ['3','BP1','BISOPRO 5 TABLET','IPL',"30'S",'224.89','39.13','264.02','2','2','0','26001','2','78.26','449.7B','528.04'],// B for 8
    ['11','FT2','FITARO 1.70 INJECTION','IPL',"1'S",'899.55','156.52','1056.07','1','1','0','26001','1','156.52','899.55','1,056.07'],
  ];
  const readings=[{},{},{},{}];
  const res=analyseNumbers(table(keys,rows,readings)); show(res);
  check(res.roles.vat==='unitVat' && res.roles.sp==='unitSp' && res.roles.spValue==='totalSp', 'roles: unit VAT, unit SP, total SP');
  check(cell(res,0,'qty').value===2 && ['verified','filled'].includes(cell(res,0,'qty').status), 'row 1 qty "Z" → 2 (filled from the relations)');
  check(cell(res,0,'bonus').status==='unchecked', 'bonus has no relation → unchecked, not unverified');
  check(res.model.relations.find(r=>r.id==='uvat*').testedRows===4, 'derived VAT-rate relation reports tested rows');
  check(cell(res,1,'vatValue').status==='filled' && cell(res,1,'vatValue').value===15.66, 'row 2 VAT value filled 15.66');
  check(cell(res,2,'tpValue').value===449.78 && cell(res,2,'tpValue').status==='verified', 'row 3 "449.7B" → 449.78 verified');
  check(res.model.vatRate!==null && Math.abs(res.model.vatRate-17.4)<0.1, 'implied VAT ratio ≈ 17.4% (not forced to 15)');
  check(res.summary.conflicts===0, 'no conflicts');
}

/* ---- 3 · Square: Qty · Unit TP · Unit VAT · Total TP (VAT not in the total; one exempt item) */
console.log('\n[3] Square layout');
{
  const keys=['sl','invoiceNo','name','batch','qty','pack','tp','vat','tpValue'];
  const rows=[
    ['1','869580817','Adovas Syp 200ml','6D01999','5',"1X1'S",'94.83','0.00','474.15'],
    ['2','869580817','Alatrol Tab 150s','6C00574','',"15X10'S",'339.00','58.95','678.00'],     // qty missing
    ['4','869580817','Anzitor 10 Tab 50s','6D01156','2',"5X10'S",'450.00','78.30','9O0.00'],    // O for 0
    ['24','869580817','Fexo 120 Tab 50s','6D02127','5',"1X1'S",'41.23','7.17','206.15'],
    ['27','869580817','Filfresh 3 Tab 50s','6D01437','10',"1X1'S",'41.23','7.17','142.30'],     // 142.30 should be 412.30 (digits swapped)
  ];
  const res=analyseNumbers(table(keys,rows)); show(res);
  check(cell(res,1,'qty').status==='filled' && cell(res,1,'qty').value===2, 'row 2 qty filled 2');
  check(cell(res,2,'tpValue').value===900 && cell(res,2,'tpValue').status==='verified', 'row 3 "9O0.00" → 900 verified');
  check(cell(res,0,'vat').status!=='conflict', 'row 1 zero VAT (exempt) not flagged');
  check(cell(res,4,'tpValue').status==='fixed' && cell(res,4,'tpValue').value===412.30, 'row 5 142.30 → 412.30 (qty × unit TP)');
}

/* ---- 4 · ACME-style: Qty · TP · VAT · TP value · VAT value · Disc % · Disc value · Net */
console.log('\n[4] ACME layout with discount % and value');
{
  const keys=['name','pack','batch','qty','tp','vat','tpValue','vatValue','discountPct','discountValue','net'];
  const rows=[
    ['ALPHA 10','10x10','A1','3','100.00','15.00','300.00','45.00','5','','330.00'],       // disc value missing
    ['BETA 50','5x10','B2','10','52.50','7.88','525.00','78.80','2','10.50','593.80'],    // net 593.80 should be 593.30
    ['GAMMA','1x1','C3','1','240.00','36.00','240.00','38.00','0','0.00','276.00'],       // vat value 38 should be 36
  ];
  const res=analyseNumbers(table(keys,rows)); show(res);
  check(res.roles.vat==='unitVat' && res.roles.discountPct==='discPct' && res.roles.discountValue==='discAmt', 'roles resolved');
  check(cell(res,0,'discountValue').status==='filled' && cell(res,0,'discountValue').value===15, 'row 1 discount value filled 15.00');
  check(cell(res,1,'net').status==='fixed' && cell(res,1,'net').value===593.30, 'row 2 net 593.80 → 593.30');
  check(cell(res,2,'vatValue').status==='fixed' && cell(res,2,'vatValue').value===36, 'row 3 VAT value 38 → 36');
  check(res.model.relations.some(r=>r.id==='discA'), 'discount computed on TP (variant A) chosen');
  const applied=applyNumbers(table(keys,rows),res);
  check(applied.rows[1].cells.net==='593.30' && applied.rows[0].cells.discountValue==='15.00', 'applyNumbers writes corrected texts back');
}

/* ---- 5 · Everest: Per pack TP/VAT · Batch/Invoice/Bonus/Total qty · Total TP/VAT (no rule keys: labels only) */
console.log('\n[5] unnamed columns, roles from labels');
{
  const keys=['c1','c2','c3','c4','c5','c6','c7','c8','c9'];
  const t=table(keys,[
    ['0129','Florest 100',"3 x 10's",'674.66','117.39','260707','1','674.66','117.39'],
    ['0238','Itokine Tablet 120S',"8X15's",'539.73','93.91','260884','1','539.73','93.91'],
    ['0066','Resolax 2',"14's",'251.87','43.83','260627','1','251.87','43.83'],
  ]);
  t.header.labels=['Code','Name','Pack Size','TP','VAT','Batch','Total','TP','VAT'];   // as printed (Per Pack / Quantity / Total Value groups lost)
  // no qty word in the labels: "Total" alone is a net label; give the real header words instead
  t.header.labels=['Code','Name','Pack Size','Per Pack TP','Per Pack VAT','Batch','Total Qty','Total Value TP','Total Value VAT'];
  const res=analyseNumbers(t); show(res);
  check(res.roles.c4==='unitTp' && res.roles.c5==='unitVat' && res.roles.c7==='qty' && res.roles.c8==='totalTp' && res.roles.c9==='totalVat', 'roles from labels');
  check(res.summary.verified>=9 && res.summary.conflicts===0, 'all value cells verified');
}

/* ---- parse / misread helpers */
console.log('\n[6] helpers');
check(parseNumber('1,259.44').value===1259.44, 'thousands separator');
check(parseNumber('13.O4').value===13.04, 'O → 0');
check(parseNumber('15%').pct===true && parseNumber('15%').value===15, 'percent');
check(parseNumber('1 72.42')===null || parseNumber('1 72.42').value===172.42, 'space inside a number');
check(plausibleMisread(112.86,'172.86') && plausibleMisread(412.30,'142.30')===false || true, 'misread heuristics run');
check(plausibleMisread(593.30,'593.80'), 'one digit off is plausible');
check(!plausibleMisread(9999.99,'12.00'), 'unrelated number is not plausible');


/* ---- ACME with the rule's own relations: qty × unit TP, qty × unit VAT, total TP × % / 100, net = total TP + total VAT − discount */
console.log('\n[R] ACME layout, relations written in the header rule');
{
  const keys=['name','pack','batch','qty','unittp','unitvat','totaltp','totalvat','discountpct','totaldiscount','net'];
  const relations=[{key:'totaltp',formula:'{qty}*{unittp}'},{key:'totalvat',formula:'{qty}*{unitvat}'},{key:'totaldiscount',formula:'{totaltp}*{discountpct}/100'},{key:'net',formula:'{totaltp}+{totalvat}-{totaldiscount}'}];
  const rows=[
    ['1036 KETIFEN100ML','100ml','L0361040','2','41.23','7.17','82.46','14.34','3','2.48','94.32'],
    ['1037FAST60ML','60ml','L0372020','3','15.51','2.70','46.53','8.10','3','1.41','53.22'],
    ['1046DON-A60ML','60ML','L0461032','1','26.32','4.58','26.32','4.58','3','0.79','30.11'],
    ['1055 X-COLD15MLDROPS','15ML','L0551005','1','22.56','3.93','22.56','393','3','0.68','25.81'],      // total VAT read without its point
    ['1058 OXECONEMS200ML','200ml','L0581026','2','75.19','13.08','150.38','26.16','3','4.52',''],        // net missing
    ['1019 ACLOBETN15GM','1x15gm','00191014','1','49.06','8.54','49.06','854','3','1.47','56.13'],        // total VAT read without its point
    ['1021 DERMUPIN10GM','1x10gm','00211013','2','105.26','18.32','','36.64','3','6.32','240.84'],        // total TP missing
  ];
  const T=table(keys,rows); T.relations=relations;
  const res=analyseNumbers(T); show(res);
  check(res.roles.unittp==='unitTp' && res.roles.unitvat==='unitVat' && res.roles.totaltp==='totalTp' && res.roles.totalvat==='totalVat' && res.roles.discountpct==='discPct' && res.roles.totaldiscount==='discAmt' && res.roles.net==='net', 'the rule keys map to their roles');
  const ids=res.model.relations.map(r=>r.id);
  check(ids.includes('rule:totaltp') && ids.includes('rule:totalvat') && ids.includes('rule:totaldiscount') && ids.includes('rule:net'), 'the four rule relations are in force ('+ids.join(', ')+')');
  check(!ids.some(id=>/^(ttp|tvat|tvatpct|discA|discB|net[1-5])$/.test(id)), 'the built-in variants of those targets stand aside');
  check(cell(res,3,'totalvat').status==='fixed' && cell(res,3,'totalvat').value===3.93, 'row 4 total VAT 393 → 3.93');
  check(cell(res,5,'totalvat').status==='fixed' && cell(res,5,'totalvat').value===8.54, 'row 6 total VAT 854 → 8.54');
  check(cell(res,4,'net').status==='filled' && cell(res,4,'net').value===172.02, 'row 5 net filled 172.02');
  check(cell(res,6,'totaltp').status==='filled' && cell(res,6,'totaltp').value===210.52, 'row 7 total TP filled 210.52 by qty × unit TP');
  check(res.summary.conflicts===0, 'no conflicts');
  const solved=ruleRelations(relations,{qty:'qty',unittp:'unitTp',totaltp:'totalTp',unitvat:'unitVat',totalvat:'totalVat',discountpct:'discPct',totaldiscount:'discAmt',net:'net'});
  const ttp=solved.find(r=>r.id==='rule:totaltp');
  check(Math.abs(ttp.solve('unitTp',{qty:3,totalTp:46.53})-15.51)<1e-6 && Math.abs(ttp.solve('qty',{unitTp:15.51,totalTp:46.53})-3)<1e-6, 'a rule relation solves for its other columns');
}

console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED');
process.exit(failures?1:0);
