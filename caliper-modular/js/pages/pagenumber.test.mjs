// node pagenumber.test.mjs — the number a page prints on itself, and the order of the pages
import { pageNumberOf, orderPages, serialRangeOf } from './pagenumber.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
console.log('[1] the page number in the page\'s text');
for(const [t,v] of [['Page No. 3 of 10','3/10'],['Page 1 of 15','1/15'],['Page No.1 of 15','1/15'],['Page1 of 15','1/15'],['Page 4/13','4/13'],['Page :4/1-[DD02581]','4/-'],['Page No: 7','7/-'],['Pg. 2','2/-'],['Page 12','12/-'],
  ['3 of 10 pages','3/10'],['Pagel of 15',null],['Package 500 MG',null],['Pack 10X5',null],['1/15',null],['Order No. 320092',null],['Page No. 3 of |0','3/10']]){
  const r=pageNumberOf([t]); const got=r?r.page+'/'+(r.of??'-'):null;
  check(got===v, JSON.stringify(t)+' → '+got+(got===v?'':' wanted '+v)); }
check(pageNumberOf(['Corporate Office','INVOICE','Page No. 3 of 10','Customer Signature']).page===3, 'the first line naming a page wins among many');
check(pageNumberOf([])===null && pageNumberOf(null)===null, 'nothing: null');
console.log('[2] the order of the pages');
{
  const mk=(name,file,pageNo)=>({name, file, pageNo});
  const A='a.jpg', B='b.jpg', C='c.jpg', D='d.jpg';
  const pages=[mk('a',A,3), mk('b',B,1), mk('c',C,null), mk('d',D,2)];
  const groupOf=p=>p.pdf?p.file:'images';
  check(orderPages(pages,groupOf).map(p=>p.name).join('')==='bdac', 'images by their page number, the one without a number after them (bdac)');
  const pdf1=[mk('p1',{},1),mk('p2',{},2)].map((p,i)=>({...p, pdf:{n:i+1}, file:'x.pdf'})); const pdf2=[mk('q1',{},1),mk('q2',{},2)].map((p,i)=>({...p, pdf:{n:i+1}, file:'y.pdf'}));
  const mixed=[pdf1[1],pdf1[0],pdf2[0],pdf2[1]];
  check(orderPages(mixed,groupOf).map(p=>p.name).join('')==='p1p2q1q2', 'each PDF keeps to itself and is ordered by its numbers');
  check(orderPages([mk('x',A,null),mk('y',B,null)],groupOf).map(p=>p.name).join('')==='xy', 'no numbers known: the upload order stands');
}
console.log('[3] the serial numbers the items carry');
{ const F=(cells,kinds)=>({keys:['sl','name','qty'], grid:cells.map(c=>[{text:c[0]},{text:c[1]},{text:c[2]}]), rows:cells.map((c,i)=>kinds&&kinds[i]==='group'?{kind:'group'}:{}), numbers:{rows:cells.map((c,i)=>({isTotal:kinds&&kinds[i]==='total'}))}});
  const p2=F([['31','Furotil PFS','1'],['32','Furotil Tab','1'],['33','Rozith','1'],['','SubTotal','3'],['','MSD Product',''],['34','Andriol','3']],[null,null,null,'total','group',null]);
  const r=serialRangeOf(p2); check(r && r.first===31 && r.last===34 && r.n===4, 'items 31…34, the total and the group left out ('+JSON.stringify(r)+')');
  check(serialRangeOf(F([['1','Cefixim','1'],['2','Napa','1'],['1018','Fluticon','1'],['3','Seclo','1']])).last===3, 'a four-digit product code among small serials is not a serial');
  check(serialRangeOf(F([['l','Actilac','2'],['2','Aeron','1'],['3O','Rozith','1']])).last===30, 'look-alikes read as digits: l → 1, 3O → 30');
  check(serialRangeOf(F([['94','Acecard','1'],['18000002','Acecard 5','1'],['95','Alexa','1']])).last===95, 'a product code in the serial cell is not a serial');
  check(serialRangeOf(F([['1','Actilac','2']]))===null && serialRangeOf({keys:['name'],grid:[]})===null, 'one figure, or no serial column: nothing'); }
console.log('[4] the order by serial when the page numbers are unclear');
{ const mk=(name,pageNo,first)=>({name, file:name+'.jpg', pageNo, serial:first!=null?{first,last:first+30,n:30}:null});
  const groupOf=p=>p.pdf?p.file:'images';
  check(orderPages([mk('c',null,63),mk('a',1,1),mk('b',null,31)],groupOf).map(p=>p.name).join('')==='abc', 'two pages print no number: all three fall in by their first serial (abc)');
  check(orderPages([mk('b',2,31),mk('a',1,1),mk('c',3,63)],groupOf).map(p=>p.name).join('')==='abc', 'every page numbered: the numbers rule');
  check(orderPages([mk('b',null,31),mk('x',5,null),mk('a',null,1),mk('n',null,null)],groupOf).map(p=>p.name).join('')==='abxn', 'serials first, a page with only a number after them, a page with neither last');
  check(orderPages([mk('b',1,31),mk('a',1,1)],groupOf).map(p=>p.name).join('')==='ab', 'two pages both read as page 1 (a misread): the serials decide'); }
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
