// node pack.test.mjs — the pack size as a unit conversion
import { unitConversionOf, looksLikePack, packFromName, packColumnIndex, rowPackText, packShapeScore, repairPackCount, resolvePackCell } from './pack.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
for(const [t,v] of [["4X10'S",40],["1X1'S",1],["4X1 0S",40],["5X10s",50],["10x10's",100],["30's",30],["30S",30],["30 PCS",30],["1x15gm",1],["100ml",1],["5 ML",1],["1X100ML",1],["VIAL",1],["TUBE",1],["",1],["2X100ML",2],["1O0's",100],["3 X 10'S",30]])
  check(unitConversionOf(t).value===v, JSON.stringify(t)+' → '+unitConversionOf(t).value+' ('+unitConversionOf(t).rule+')'+(unitConversionOf(t).value===v?'':' wanted '+v));
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
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
