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
  const packCi=keys.indexOf('pack');
  const roles=(F.numbers&&F.numbers.roles)||{}; let tpKey=Object.keys(roles).find(k=>roles[k]==='unitTp'); if(!tpKey && keys.includes('tp')) tpKey='tp';
  const tpCi=tpKey?keys.indexOf(tpKey):-1;
  return F.grid.map((row,ri)=>{
    const nr=F.numbers&&F.numbers.rows?F.numbers.rows[ri]:null;
    const name=nameCi>=0?(row[nameCi].text||''):'';
    let tp=null; if(tpCi>=0){ const c=nr&&nr.cells?nr.cells[keys[tpCi]]:null; tp=c&&c.value!==null&&c.value!==undefined?c.value:(parseFloat(String(row[tpCi].text||'').replace(/,/g,''))||null); }
    return {row:ri, name, pack:packCi>=0?(row[packCi].text||''):'', tp, isTotal:!!(nr&&nr.isTotal)};
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
