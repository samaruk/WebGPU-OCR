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

/* Every engine of the answer, with its regions in image pixels:
     paddle     — PaddleOCR, the API's primary engine (brief.lines, or the
                  table cells at depth deep); also the API's layout;
     tesseract5 — Tesseract 5 through tesseract.exe: one region per word;
     easyocr    — EasyOCR through its Python worker: one region per fragment.
   An engine that did not run keeps its status (unavailable, loading, error,
   disabled) and an empty region list, so the final merge can say so.   */
export function apiEngineList(response){
  if(!response) return [];
  const list=[{name:'paddle', label:'PaddleOCR PP-OCRv5', status:'ok', ms:response.timing?response.timing.ocrMs:0, error:null, regions:apiRegions(response)}];
  for(const e of response.engines||[]){
    if(e.name==='paddle'){ list[0].label=e.label||list[0].label; list[0].ms=e.ms; continue; }
    list.push({name:e.name, label:e.label||e.name, status:e.status, ms:e.ms||0, error:e.error||null,
               regions:(e.status==='ok'&&e.lines)?e.lines.map(l=>({text:l.text, confidence:l.confidence, bbox:l.bbox, polygon:l.polygon})):[]});
  }
  return list;
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
