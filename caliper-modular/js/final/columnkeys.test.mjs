// node columnkeys.test.mjs — the column-name recheck, quantity insisted on
import { resolveColumnKeys, keyFromTitle, isQtyToken, qtyByNumbers, titleAgreement } from './columnkeys.js';

let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };

console.log('[1] quantity spellings');
for(const w of ['qty','Qty.','QNT','Qnty','Quantity','quan','Inv. Qty','Qtv','qte']) check(keyFromTitle(w)?.key==='qty', `"${w}" → qty`);
check(!isQtyToken('quality'), '"quality" is not quantity');   // two letters off
check(keyFromTitle('Total TP')?.key==='tpValue', '"Total TP" → tpValue from the rules vocabulary');
check(keyFromTitle('Net Amount')?.key==='net', '"Net Amount" → net');
check(keyFromTitle('Batch')?.key==='batch', '"Batch" → batch');

console.log('[1b] the ACME case: "Trade" and "VAT" twice, under "Per pack" and under "Value"; the rule did not match exactly');
{
  const titleCands=[['Category & Product Name'],[],[],[],['Pack Size.'],['Batch No.'],['Qty'],['Per pack','Trade'],['VAT'],['Trade','Value'],['VAT'],['%','Discount'],['Value'],['Net Value']];
  const keys=titleCands.map(()=>null), labels=titleCands.map(()=>'');
  const r=resolveColumnKeys({keys, labels, titleCands, columnValues:[]});
  check(r.keys[7]==='unittp' && r.keys[8]==='unitvat' && r.keys[9]==='totaltp' && r.keys[10]==='totalvat', 'Per pack Trade/VAT → unittp, unitvat; Value Trade/VAT → totaltp, totalvat ('+r.keys.slice(7,11)+')');
  check(r.keys[11]==='discountpct' && r.keys[12]==='totaldiscount' && r.keys[13]==='net' && r.keys[6]==='qty' && r.keys[0]==='name', 'the rest of the ACME columns are named in order');
  check(!r.keys.includes('tpVat'), 'no column is taken for TP+VAT');
}

console.log('[1c] a header cell read by the API and by the local pass: which agrees with the vocabulary better');
{
  const a=titleAgreement('Category & Produdt Name'), l=titleAgreement('Category & Product Name');
  check(a.n===3 && l.n===3 && l.exact===3 && a.exact===2, 'Produdt is one exact token short of Product ('+JSON.stringify(a)+' vs '+JSON.stringify(l)+')');
  check(titleAgreement('Per pack Trade').n>=1 && titleAgreement('xyzzy').n===0, 'a title with a known label scores, gibberish does not');
}

console.log('[2] the Ibn Sina case: Qty column unnamed, its title only in the API title row');
{
  const keys=[null,null,null,null,null,null,null,null,null,null,null];
  const labels=['Product Name','Pack Size','TP','VAT','TP+VAT PerPack','','Bon us','Total TP','Total VAT','Disc Amt','Net Amount'];
  const titleCands=labels.map(l=>l?[l]:[]); titleCands[5]=['|','Qty'];           // the local read a bar; the API title row says Qty
  const r=resolveColumnKeys({keys, labels, titleCands, columnValues:[]});
  check(r.keys[5]==='qty' && r.labels[5]==='Qty', 'column 6 → qty, labelled Qty');
  check(r.keys[7]==='tpValue' && r.keys[8]==='vatValue' && r.keys[10]==='net' && r.keys[2]==='tp', 'other columns named from the vocabulary');
  check(r.keys[6]==='bonus', '"Bon us" → bonus');
  check(labels[5]==='' , 'input untouched');
}

console.log('[3] no title says quantity: the column of small whole numbers');
{
  const keys=['sl','code','name',null,'tp',null,null,'tpValue'];
  const labels=['SL','Code','Product Name','','TP','','','Total TP'];
  const columnValues=[
    ['1','2','3','4','5'],                 // serial (keyed anyway)
    ['26001','26005','26001','26004','26002'],
    ['A','B','C','D','E'],
    ['26001','26005','26001','26004','26002'],   // batch-like codes, 5 digits
    ['56.22','44.98','224.89','52.47','202.4'],
    ['2','2','3','1','2'],                  // the quantity
    ['0','0','0','0','1'],                  // bonus: mostly zeros
    ['112.44','89.96','674.67','52.47','404.8'],
  ];
  const r=resolveColumnKeys({keys, labels, titleCands:labels.map(l=>l?[l]:[]), columnValues});
  check(r.keys[5]==='qty' && r.labels[5]==='Qty', 'column 6 → qty by its numbers');
  check(r.keys[3]!=='qty' && r.keys[6]!=='qty', 'the code column and the bonus column are not quantity');
  check(r.renamed.some(x=>x.key==='qty' && x.by==='its numbers'), 'reported as named by its numbers');
}

console.log('[4] a serial column is never quantity by numbers');
check(qtyByNumbers([null,null], [['1','2','3','4','5','6'],['3','1','2','2','5','1']])===1, 'counting-up column skipped, the other taken');

console.log('[5] a rule key stands; a wrongly keyed quantity title is set right');
{
  const r=resolveColumnKeys({keys:['name','invoiceNo','tp'], labels:['Product','Inv. Qty','TP'], titleCands:[['Product'],['Inv. Qty'],['TP']], columnValues:[]});
  check(r.keys[0]==='name' && r.keys[2]==='tp', 'existing keys kept');
  check(r.keys[1]==='qty' && r.labels[1]==='Inv. Qty', '"Inv. Qty" keyed invoiceNo becomes qty, label kept');
}

console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED');
process.exit(failures?1:0);
