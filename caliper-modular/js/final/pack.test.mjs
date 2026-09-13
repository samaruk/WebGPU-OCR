// node pack.test.mjs — the pack size as a unit conversion
import { unitConversionOf, looksLikePack, packFromName, packColumnIndex, rowPackText, packShapeScore, repairPackCount, resolvePackCell, sConfusion, packWithS, repairPacksByColumn, packByMrp } from './pack.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
for(const [t,v] of [["4X10'S",40],["1X1'S",1],["4X1 0S",40],["5X10s",50],["10x10's",100],["30's",30],["30S",30],["30 PCS",30],["1x15gm",1],["100ml",1],["5 ML",1],["1X100ML",1],["VIAL",1],["TUBE",1],["",1],["2X100ML",2],["1O0's",100],["3 X 10'S",30]])
  check(unitConversionOf(t).value===v, JSON.stringify(t)+' → '+unitConversionOf(t).value+' ('+unitConversionOf(t).rule+')'+(unitConversionOf(t).value===v?'':' wanted '+v));
console.log('[1b] pieces × pieces per strip × strips, and a letter for a digit');
for(const [t,v] of [['1X1X1',1],['1X3X10',30],['1X5X10',50],['1X2X6',12],['1X7X4',28],['1x3x10s',30],["2X3X10'S",60],['IXIXIO',10],['IX3XIO',30],['1X1X1O',10]])
  check(unitConversionOf(t).value===v, JSON.stringify(t)+' → '+unitConversionOf(t).value+' ('+unitConversionOf(t).rule+')'+(unitConversionOf(t).value===v?'':' wanted '+v));
console.log('[1c] two parts without an S: strips × pieces per strip');
for(const [t,v] of [['6X2',12],['20X7',140],['10X5',50],['6 X 2',12],['6x2',12],['12X1',12],['1X20X7',140]])
  check(unitConversionOf(t).value===v && packShapeScore(t)===5 && looksLikePack(t), JSON.stringify(t)+' → '+unitConversionOf(t).value+' ('+unitConversionOf(t).rule+'), shape '+packShapeScore(t)+(unitConversionOf(t).value===v?'':' wanted '+v));
check(packWithS('6X2')===null && packWithS('10X5')===null && repairPacksByColumn(["5X10'S","3X10'S",'10X5','6X2']).length===0, '10X5 and 6X2 are never "repaired" into an S form, even in a column ending with S');
check(packShapeScore('1X1X1')===5 && packShapeScore('1X3X10')===5 && packShapeScore('IXIXIO')===5 && packShapeScore('pixxr')===0 && packShapeScore('rxxsio')===0 && packShapeScore('ioxxa')===0, 'the three-part form and its letter-for-digit reading score as a pack; pixxr, rxxsio, ioxxa do not');
check(looksLikePack('1X1X1') && looksLikePack('IXIXI') && !looksLikePack('pixxr'), '1X1X1 and IXIXI read like packs, pixxr does not');
{
  const c=(text,api,others,local)=>({text, api, others:(others||[]).map(([n,t])=>({name:n,text:t})), local});
  const r=resolvePackCell(c('pixxr','1X1X1',[['tesseract5','pixxr'],['easyocr','1X1X1']],'pixxr'),'Actilac Syrup 200ml');
  check(r && r.text==='1X1X1' && r.source==='paddle', '"pixxr" chosen, "1X1X1" by PaddleOCR → 1X1X1 ('+JSON.stringify(r)+')');
  const r2=resolvePackCell(c('IXIXIO','1X1X10',[],'IXIXIO'),'X');
  check(r2 && r2.text==='1X1X10' && r2.source==='paddle', 'IXIXIO chosen, 1X1X10 by PaddleOCR: the reading with the digits ('+JSON.stringify(r2)+')');
  const r3=resolvePackCell(c('IXIXI','IXIXI',[],'IXIXI'),'X');
  check(r3 && r3.text==='1X1X1' && r3.source==='repair', 'IXIXI by every engine: the digits put in ('+JSON.stringify(r3)+')');
  check(resolvePackCell(c('1X3X10','1X3X10',[],'IX3XIO'),'X')===null, 'a pack already in digits stands');
  check(packWithS('1X3X108')==="1X3X10'S" && sConfusion('1X3X108',"1X3X10'S"), 'the S read as an 8 in a three-part pack');
  check(packFromName("Napa Tab 1x3x10's")==="1x3x10's" && packFromName('Seclo Cap 1X2X1O')==='1X2X10', 'a three-part pack at the end of a name, its O a 0 again');
}
console.log('[2] the pack size at the end of a name');
for(const [n,v] of [['Adovas Syp 200ml','200ml'],["Napa Tab 10x10's","10x10's"],["Seclo Cap 30's","30's"],['Fexo 120 Tab 50s','50s'],['Cef-3 200 Cap',null],['SECLO 20MG Capsule',null],['Ansulin 30/70 100 Inj',null],['Halobet 0.05% Crm 20g','20g'],["MICROGEST 200MG CAPS 3XI0'S","3X10'S"],["NEUROBEST FC TAB 6XI0'S","6X10'S"],['Napa Tab 1OS','10S'],['Deltasone 10mg Tab',null]])
  check(packFromName(n)===v, JSON.stringify(n)+' → '+JSON.stringify(packFromName(n))+(packFromName(n)===v?'':' wanted '+JSON.stringify(v)));
console.log('[3] what reads like a pack size');
for(const [t,v] of [["4X10'S",true],['30S',true],['100ml',true],['VIAL',true],['30',true],['',false],['|',false],['-',false],['S',false],['1',true]])
  check(looksLikePack(t)===v, JSON.stringify(t)+' → '+looksLikePack(t));
console.log('[4] the pack column may be the Unit column; a blank one falls back to the name');
{
  const keys=['code','name','unit','batch','tp','qty','tpValue','vatValue','net'];
  const g=t=>({text:t});
  const grid=[["641","MICROGEST 100MG CAPS 3X10'S","","K11210251","337.20","1","337.20","58.68","395.88"].map(g),["993","MIDZO 7.5MG TAB 3X10S","30S","1382101","180.45","1","180.45","30.68","211.13"].map(g),["885","NEUROBEST FC TAB 6XI0'S","60S","14621D7","360.00","1","360.00","62.64","422.64"].map(g)];
  check(packColumnIndex(keys,grid)===2, 'the Unit column holds the pack sizes (30S, 60S)');
  check(rowPackText(keys,grid,0).text==="3X10'S" && rowPackText(keys,grid,0).source==='name', "row 1: unit blank → 3X10'S from the name");
  check(rowPackText(keys,grid,1).text==='30S' && unitConversionOf(rowPackText(keys,grid,1).text).value===30, 'row 2: 30S from the Unit column → 30');
  check(unitConversionOf(rowPackText(keys,grid,0).text).value===30 && unitConversionOf("6XI0'S").value===60, "3X10'S → 30, 6XI0'S (an I for the 1) → 60");
  check(packColumnIndex(['name','unit','qty'],[[g('A'),g('VIAL'),g('1')],[g('B'),g('TUBE'),g('2')]])===-1, 'a Unit column of words is not the pack column');
}
console.log('[5] a pack cell the engines read differently is settled by shape, then the name, then a repair');
{
  const c=(text,api,others,local)=>({text, api, others:(others||[]).map(([n,t])=>({name:n,text:t})), local});
  const r1=resolvePackCell(c('308','30S',[['tesseract5','308'],['easyocr','308']],'308'),'PHENOCEPT TABS');
  check(r1 && r1.text==='30S' && r1.source==='paddle', '"308" by three engines, "30S" by PaddleOCR → 30S ('+JSON.stringify(r1)+')');
  const r2=resolvePackCell(c('308','308',[],'308'),"PANGESICTAB 5X6'S");
  check(r2 && r2.text==="5X6'S" && r2.source==='name', 'every engine 308, the name ends with 5X6\'S → the name');
  const r3=resolvePackCell(c('308','308',[],'308'),'PHENOCEPT TABS');
  check(r3 && r3.text==='30S' && r3.source==='repair', 'every engine 308, no pack in the name → repaired to 30S');
  check(resolvePackCell(c('30S','30S',[],'308'),'X')===null, 'a cell already 30S stands');
  check(resolvePackCell(c('VIAL','VIAL',[],'VIAL'),'X')===null, 'a word stands');
  check(repairPackCount('308')==='30S' && repairPackCount('105')==='10S' && repairPackCount('128')===null && repairPackCount('1005')==='100S', 'the count repair: 308, 105, 1005 yes, 128 no');
  check(packShapeScore("5X6'S")===5 && packShapeScore('30S')===4 && packShapeScore('308')===1 && packShapeScore('|')===0, 'the shape scores');
  check(packFromName("OVULETTAB 50MG(1X10'S)")==="1X10'S", 'a pack in parentheses at the end of the name');
}
console.log('[6] the S read as an 8 or a 5');
{
  check(sConfusion('5X98',"5X9'S") && sConfusion('5X98','5x9s') && sConfusion('308','30S') && sConfusion('305',"30'S"), 'the same digits, the S as an 8 or a 5');
  check(!sConfusion('5X98',"5X10'S") && !sConfusion("5X9'S",'5X98') && !sConfusion('5X9','5X9S') && !sConfusion('10X10','10X10S'), 'different digits, or nothing to confuse');
  check(packWithS('5X98')==="5X9'S" && packWithS('5 X 98','S')==='5X9S' && packWithS('10X108')==="10X10'S" && packWithS('308')==="30'S" && packWithS('128')==="12'S" && packWithS('1005')==="100'S", 'the trailing 8 / 5 as an S');
  check(packWithS('10X15')===null && packWithS('2X25')===null && packWithS('5X95')==="5X9'S" && packWithS('15')===null && packWithS('5X8')===null && packWithS("5X9'S")===null && packWithS('100ml')===null, 'packs of 15 and 25, a lone 15, 5X8 and a pack with its S already are left alone');
  const c=(text,api,others,local)=>({text, api, others:(others||[]).map(([n,t])=>({name:n,text:t})), local});
  const r1=resolvePackCell(c('5X98',"5X9'S",[['tesseract5','5X98'],['easyocr','SX9s']],'5X98'),'X');
  check(r1 && r1.text==="5X9'S" && r1.source==='paddle', '"5X98" by the vote, "5X9\'S" by PaddleOCR → 5X9\'S from PaddleOCR ('+JSON.stringify(r1)+')');
  const r2=resolvePackCell(c('5X98','5X98',[['tesseract5','5X98'],['easyocr','5x9s']],'5X98'),'X');
  check(r2 && r2.text==='5x9s' && r2.source==='easyocr', 'only EasyOCR read the S → its reading');
  check(resolvePackCell(c('10X10',"10X10'S",[],'10X10'),'X')===null, 'a pack without an S that no engine read with one stands');
  const col=repairPacksByColumn(["5X10'S","3X10'S",'5X98',"1X30'S",'100ml','',"10X10'S",'308']);
  check(JSON.stringify(col)===JSON.stringify([{index:2,text:"5X9'S"},{index:7,text:"30'S"}]), 'a column ending with \'S: 5X98 → 5X9\'S, 308 → 30\'S ('+JSON.stringify(col)+')');
  check(JSON.stringify(repairPacksByColumn(['30S','60S','128']))===JSON.stringify([{index:2,text:'12S'}]), 'the column\'s own style: 30S, 60S → 12S');
  check(repairPacksByColumn(["5X10'S",'308','128','5X98']).length===0, 'one S against three digits: left alone');
  check(repairPacksByColumn(['10X10','5X10','308']).length===0 && repairPacksByColumn(["10X10'S",'10X15']).length===0, 'no S in the column, or nothing to repair');
}
console.log('[7] the pack size against the MRP');
{
  const readings=[{name:'paddle',text:"5X9'S"},{name:'tesseract5',text:'5X98'},{name:'easyocr',text:'SX9s'},{name:'local',text:'5X98'}];
  const m1=packByMrp({packText:'5X98', readings, nameText:'ROLAC 10MG TAB', mrp:8, tp:300});
  check(m1 && m1.text==="5X9'S" && m1.by==='the S read as a digit' && m1.profitWas>1000 && m1.profitNow>=-25 && m1.profitNow<=120, '5X98 at MRP 8 / TP 300 (+1207 %) → 5X9\'S (+20 %) ('+JSON.stringify(m1)+')');
  const m2=packByMrp({packText:'5X98', readings:[{name:'paddle',text:'5X9S'}], nameText:'', mrp:8, tp:300});
  check(m2 && m2.text==="5X9'S", 'the S repair comes before the engine reading');
  const m3=packByMrp({packText:'490', readings:[{name:'paddle',text:'5X9S'}], nameText:'', mrp:8, tp:300});
  check(m3 && m3.text==='5X9S' && m3.by==='paddle', 'no S to repair: the engine reading that makes the MRP ordinary');
  const m4=packByMrp({packText:'308', readings:[], nameText:"NAPA TAB 3X10'S", mrp:1.2, tp:30});
  check(m4 && m4.text==="30'S", '308 at MRP 1.2 / TP 30: the S repair (30\'S → +20 %) wins over the name');
  check(packByMrp({packText:"5X9'S", readings, nameText:'', mrp:8, tp:300})===null, 'an ordinary profit stands');
  check(packByMrp({packText:'1X30s', readings:[], nameText:'', mrp:150, tp:113.1})===null, 'absurd, but no other reading makes it ordinary: left alone (the pot the list counts as one)');
  check(packByMrp({packText:'5X98', readings, nameText:'', mrp:null, tp:300})===null && packByMrp({packText:'5X98', readings, nameText:'', mrp:8, tp:0})===null, 'no MRP or no TP: nothing to check');
}
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
