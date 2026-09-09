/* ======================================================================
   PADDLEOCR API  ·  fire-and-forget request of the rectified image
   Why: the .NET service (api/InvoiceOcrApi) reads the page with PaddleOCR,
   a second, independent engine. Its answer is a cross-check for the local
   pipeline, not a step of it — so the request goes out the moment the
   rectified image exists and the pipeline carries on. The returned entry
   is stored in S.api; its promise settles into the same entry (status
   pending → done | error) so a renderer can draw it at any time, and the
   pipeline's continuation builds the final comparison when both are in.
   ====================================================================== */

/* canvas : the rectified working image (the API answers in its pixels)
   url    : full endpoint incl. ?depth=…
   Returns {status, url, started, ms, response, error, promise}          */
export function startApiAnalysis(canvas,url){
  const entry={status:'pending', url, started:performance.now(), ms:0, response:null, error:null, promise:null};
  entry.promise=new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.92))
    .then(blob=>{
      if(!blob) throw new Error('could not encode the image');
      const form=new FormData(); form.append('file',blob,'invoice.jpg');
      return fetch(url,{method:'POST', body:form});
    })
    .then(async r=>{
      if(!r.ok){
        let detail=''; try{ const j=await r.json(); detail=j.error||j.detail||JSON.stringify(j); }catch{ detail=await r.text().catch(()=>''); }
        throw new Error('HTTP '+r.status+(detail?' — '+String(detail).slice(0,300):''));
      }
      return r.json();
    })
      .then(json => {
          entry.status = 'done'; entry.response = json; entry.ms = performance.now() - entry.started;
          console.log(['entry, json', entry, json]);
          return entry;
      })
    .catch(e=>{ entry.status='error'; entry.error=e.message||String(e); entry.ms=performance.now()-entry.started; return entry; });
  return entry;
}

/* Every engine of the answer, with its CHARACTERS and its regions in image
   pixels. The service reports every engine's reading as symbols
   (engines[].characters: text, confidence, bbox, word, estimated — Tesseract's
   boxes are reported by the engine, PaddleOCR's and EasyOCR's are interpolated
   along the region and flagged estimated); the words / regions are rebuilt
   here by grouping the symbols on their word index, so the column placement
   in the final merge keeps working:
     paddle     — PaddleOCR, the API's primary engine (brief.lines, or the
                  table cells at depth deep); also the API's layout;
     tesseract5 — Tesseract 5 through tesseract.exe: one region per word;
     easyocr    — EasyOCR through its Python worker: one region per fragment.
   An engine that did not run keeps its status (unavailable, loading, error,
   disabled) and empty lists, so the final merge can say so. An older service
   build that still sends engines[].lines is read as before, its characters
   estimated here.                                                       */
export function apiEngineList(response){
  if(!response) return [];
  const list=[{name:'paddle', label:'PaddleOCR PP-OCRv5', status:'ok', ms:response.timing?response.timing.ocrMs:0, error:null, regions:apiRegions(response), characters:[]}];
  for(const e of response.engines||[]){
    const chars=(e.status==='ok'&&e.characters)?e.characters.map(c=>({text:c.text, confidence:c.confidence, bbox:c.bbox, word:c.word, estimated:!!c.estimated})):[];
    if(e.name==='paddle'){ list[0].label=e.label||list[0].label; list[0].ms=e.ms; list[0].characters=chars.length?chars:estimateCharacters(list[0].regions); continue; }
    const regions=(e.status==='ok'&&e.lines)?e.lines.map(l=>({text:l.text, confidence:l.confidence, bbox:l.bbox, polygon:l.polygon})):wordsOf(chars);
    list.push({name:e.name, label:e.label||e.name, status:e.status, ms:e.ms||0, error:e.error||null, regions, characters:chars.length?chars:estimateCharacters(regions)});
  }
  return list;
}

/* words / regions from symbols: the symbols of one word index, left to
   right. A space emits no symbol, so a gap wider than a third of a symbol
   between two neighbours (an interpolated space takes half a slot) puts the
   space back — an EasyOCR fragment holding several words keeps them apart. */
export function wordsOf(chars){
  const groups=new Map();
  for(const c of chars){ if(!c.bbox) continue; const k=c.word===undefined?0:c.word; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(c); }
  const words=[];
  for(const [k,g] of [...groups.entries()].sort((a,b)=>a[0]-b[0])){
    g.sort((a,b)=>a.bbox.x0-b.bbox.x0);
    const cw=g.reduce((s,c)=>s+(c.bbox.x1-c.bbox.x0+1),0)/g.length;
    let text=''; g.forEach((c,i)=>{ if(i && c.estimated && c.bbox.x0-g[i-1].bbox.x1-1>0.35*cw) text+=' '; text+=c.text; });   // reported boxes (Tesseract) are one word: no spaces
    const bbox={x0:Math.min(...g.map(c=>c.bbox.x0)), y0:Math.min(...g.map(c=>c.bbox.y0)), x1:Math.max(...g.map(c=>c.bbox.x1)), y1:Math.max(...g.map(c=>c.bbox.y1))};
    words.push({text, confidence:g.reduce((s,c)=>s+(c.confidence||0),0)/g.length, bbox, polygon:[[bbox.x0,bbox.y0],[bbox.x1,bbox.y0],[bbox.x1,bbox.y1],[bbox.x0,bbox.y1]], word:k});
  }
  return words;
}

/* symbols from regions when the service sent none: boxes interpolated along
   each region by character count (a space takes half a slot and no symbol) */
export function estimateCharacters(regions){
  const out=[];
  regions.forEach((r,wi)=>{ const b=r.bbox, text=r.text||''; if(!b||!text) return;
    let total=0; for(const ch of text) total+=/\s/.test(ch)?0.5:1; if(!total) return;
    const w=b.x1-b.x0+1; let cur=0;
    for(const ch of text){ const slot=/\s/.test(ch)?0.5:1;
      if(!/\s/.test(ch)){ const x0=b.x0+Math.floor(w*cur/total), x1=Math.max(x0,Math.min(b.x1,b.x0+Math.ceil(w*(cur+slot)/total)-1));
        out.push({text:ch, confidence:r.confidence||0, bbox:{x0,y0:b.y0,x1,y1:b.y1}, word:wi, estimated:true}); }
      cur+=slot; } });
  return out;
}

/* The API's text regions with boxes in image pixels, whatever the depth:
   brief carries every region; deep only carries table cells with boxes. */
export function apiRegions(response){
  if(!response) return [];
  if(response.brief && response.brief.lines) return response.brief.lines.map(l=>({text:l.text, confidence:l.confidence, bbox:l.bbox, polygon:l.polygon}));
  if(response.deep && response.deep.rows)
    return response.deep.rows.flatMap(r=>(r.cells||[]).filter(c=>c.bbox&&c.text).map(c=>({text:c.text, confidence:c.confidence, bbox:c.bbox, polygon:null})));
  return [];
}
