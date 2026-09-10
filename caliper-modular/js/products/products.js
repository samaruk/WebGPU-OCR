/* ======================================================================
   PRODUCTS  ·  match the final table's items against the pharmacy's list
   Why: an invoice line names a product the pharmacy already stocks, under
   its own spelling. Matching every line to the product list (42 000
   items, js/products/products-data.js) gives each row its MRP
   (UnitSalePrice) and a check of the invoice's TP against the purchase
   price on file. The matching runs in a module worker (js/products/
   worker.js) that loads the list and builds the index once, so the page
   never waits; without workers the matcher runs here. Like the OCR API,
   the request is an entry in S.products (status pending → done | error)
   that the stage and the JSON read whenever they are drawn.
     startProductMatch(F) → {status, ms, rows, results, error, promise}
       rows     – what was asked per table row: {name, pack, tp, row}
       results  – per row the match: {status, score, product, price, candidates}
   ====================================================================== */
import { S } from '../state/state.js';
import { unitConversionOf, rowPackText, packColumnIndex } from '../final/pack.js';

/* the row's unit conversion: the invoice's own column of that meaning, else the operator's entry, else the pack size rule */
export function rowConversion(F, ri){
  const keys=F.keys||[]; const meta=F.rowMeta&&F.rowMeta[ri];
  if(meta && meta.unitConversion!==undefined && meta.unitConversion!==null && isFinite(meta.unitConversion)) return {value:+meta.unitConversion, source:'typed'};
  const ci=keys.indexOf('unitconversion'); if(ci>=0){ const v=parseFloat(String((F.grid[ri][ci]&&F.grid[ri][ci].text)||'').replace(/,/g,'')); if(isFinite(v) && v>0) return {value:v, source:'column'}; }
  const pk=rowPackText(keys, F.grid, ri); const r=unitConversionOf(pk.text);
  return {value:r.value, source:(pk.source==='name'?'pack from the name: ':'pack: ')+r.rule+(pk.text?' ('+pk.text+')':'')};
}

let worker=null, ready=null, seq=0; const pending=new Map();
function getWorker(){
  if(worker) return ready;
  try{
    worker=new Worker(new URL('./worker.js', import.meta.url), {type:'module'});
  }catch(e){ worker=null; return Promise.reject(e); }
  ready=new Promise((resolve,reject)=>{
    worker.onmessage=e=>{ const d=e.data||{};
      if(d.ready){ resolve(d); return; }
      const p=pending.get(d.id); if(!p) return; pending.delete(d.id);
      if(d.error) p.reject(new Error(d.error)); else p.resolve(d); };
    worker.onerror=e=>{ const err=new Error('product worker failed: '+(e.message||'unknown')); reject(err); for(const p of pending.values()) p.reject(err); pending.clear(); worker=null; ready=null; };
  });
  return ready;
}
function ask(rows,opts){
  return getWorker().then(()=>new Promise((resolve,reject)=>{ const id=++seq; pending.set(id,{resolve,reject}); worker.postMessage({id, rows, opts}); }));
}
function askSearch(text,limit){
  return getWorker().then(()=>new Promise((resolve,reject)=>{ const id=++seq; pending.set(id,{resolve,reject}); worker.postMessage({id, search:{text, limit}}); }));
}
/* the product list ranked for a text (the popup behind a Product cell): [{score, product, by}] */
export async function searchProducts(text, limit=200){
  try{ if(typeof Worker==='undefined') throw new Error('no Worker'); return (await askSearch(text,limit)).results; }
  catch(e){ const [{PRODUCTS, PRODUCT_COLUMNS},M]=await Promise.all([import('./products-data.js'), import('./matcher.js')]); if(!mainIndex) mainIndex=M.buildIndex(PRODUCTS, PRODUCT_COLUMNS); return M.searchProducts(mainIndex, text, limit); }
}
/* a product chosen by hand for a row: the match entry the stage and the JSON read */
export async function manualMatch(ri, product){
  const P=S.products; if(!P || !P.results) return null;
  const { priceOf }=await import('./matcher.js');
  const row=P.rows.find(r=>r.row===ri) || {};
  const entry={status:'match', score:1, product, price:priceOf(product, row.tp, row.conv), candidates:[], manual:true};
  P.results[ri]=entry; return entry;
}
/* no worker (file://, an old browser): the matcher on this thread, the index built on first use */
let mainIndex=null;
async function askHere(rows,opts){
  const [{PRODUCTS, PRODUCT_COLUMNS},{buildIndex, matchRows}]=await Promise.all([import('./products-data.js'), import('./matcher.js')]);
  if(!mainIndex) mainIndex=buildIndex(PRODUCTS, PRODUCT_COLUMNS);
  const t=performance.now(); return {results:matchRows(mainIndex, rows, opts), ms:Math.round(performance.now()-t)};
}

/* the rows to match from the final table: the item name (key name, else
   the widest text column), the pack size, the unit TP (the number check's
   unit TP role, else key tp), skipping sub-total rows */
export function rowsToMatch(F){
  if(!F || !F.grid) return [];
  const keys=F.keys||(S.columns&&S.columns.columns||[]).map((c,i)=>c.key||('c'+(i+1)));
  let nameCi=keys.indexOf('name');
  if(nameCi<0){ let best=-1, bw=-1; keys.forEach((k,ci)=>{ const w=F.grid.reduce((s,r)=>s+((r[ci]&&r[ci].text)||'').replace(/[\d.,]/g,'').length,0); if(w>bw){ bw=w; best=ci; } }); nameCi=best; }
  const packCi=packColumnIndex(keys, F.grid);
  const roles=(F.numbers&&F.numbers.roles)||{}; let tpKey=Object.keys(roles).find(k=>roles[k]==='unitTp'); if(!tpKey && keys.includes('tp')) tpKey='tp';
  const tpCi=tpKey?keys.indexOf(tpKey):-1;
  return F.grid.map((row,ri)=>{
    const nr=F.numbers&&F.numbers.rows?F.numbers.rows[ri]:null;
    const name=nameCi>=0?(row[nameCi].text||''):'';
    let tp=null; if(tpCi>=0){ const c=nr&&nr.cells?nr.cells[keys[tpCi]]:null; tp=c&&c.value!==null&&c.value!==undefined?c.value:(parseFloat(String(row[tpCi].text||'').replace(/,/g,''))||null); }
    return {row:ri, name, pack:rowPackText(keys, F.grid, ri).text, tp, conv:rowConversion(F,ri).value, isTotal:!!(nr&&nr.isTotal)};
  });
}

/* the invoice's manufacturer / supplier, from the API's header rows or the page's own header text */
function manufacturerHint(){
  const A=S.api&&S.api.status==='done'?S.api.response:null;
  if(A&&A.deep&&A.deep.rows) return A.deep.rows.filter(r=>r.kind==='header').map(r=>r.text).join(' ').slice(0,400);
  if(S.recognition&&S.recognition.available&&S.recognition.lines) return S.recognition.lines.slice(0,8).map(l=>l.text).join(' ').slice(0,400);
  return '';
}

export function startProductMatch(F){
  const rows=rowsToMatch(F);
  const entry={status:'pending', started:performance.now(), ms:0, rows, results:null, error:null, promise:null, engine:'worker'};
  const opts={manufacturer:manufacturerHint()};
  const toMatch=rows.filter(r=>!r.isTotal && r.name);
  entry.promise=(typeof Worker==='undefined'?Promise.reject(new Error('no Worker')):ask(toMatch,opts))
    .catch(e=>{ entry.engine='main thread ('+(e.message||e)+')'; return askHere(toMatch,opts); })
    .then(d=>{ const byRow=new Map(toMatch.map((r,i)=>[r.row,d.results[i]]));
      entry.results=rows.map(r=>byRow.get(r.row)||{status:r.isTotal?'total':'none', score:0, product:null, candidates:[]});
      entry.matchMs=d.ms; entry.status='done'; entry.ms=performance.now()-entry.started; return entry; })
    .catch(e=>{ entry.status='error'; entry.error=e.message||String(e); entry.ms=performance.now()-entry.started; return entry; });
  return entry;
}
