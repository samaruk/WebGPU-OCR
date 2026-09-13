/* ======================================================================
   PAGES  ·  an invoice of many pages, one page processed at a time
   Why: an invoice runs to forty pages. Every page is a full analysis — an
   image, the stage results, the gallery, the final table — and the whole
   app works on ONE shared state object S. So each page keeps its own copy
   of the page-bound fields of S (PAGE_KEYS) plus its gallery thumbnails and
   readout, and selecting a page swaps that copy into S and redraws. The
   pipeline still runs on S alone, which is why pages are processed one
   after another: while a page runs the viewport shows it, and a thumbnail
   clicked meanwhile is shown as soon as that run ends — the queue then
   pauses until Resume, so browsing is never interrupted by the next run.
     addFiles(files)   – queue images (each becomes a thumbnail at once)
     select(i)         – show page i (or run it, when it is still queued)
     current()         – the page shown
   The API answer and the product match arrive on their own time: when
   they land for a page that is no longer in S, the page is flagged and
   the continuation runs the moment it is shown again.
   ====================================================================== */
import { S } from '../state/state.js';
import { STAGES } from '../config/config.js';
import { $, fileInput, drop, viewport, runBtn, savePng, saveJson, vpEmpty, stageCap, meta, showError } from '../dom/dom.js';
import { loadImage, loadCanvas, scaledCanvas, resetResults } from '../imageload/imageload.js';
import { pageQuadOf, rectifyPerspective } from '../rectify/rectify.js';
import { correctLensDistortion } from '../lens/lens.js';
import { thumbWithQuad, defaultQuad, sameQuad } from '../rectify/quadedit.js';
import { isPdfFile, openPdf, renderPdfPage, pdfThumbnail } from '../pdf/pdfload.js';
import { runPipeline, continueAfterApi } from '../pipeline/pipeline.js';
import { showStage, refreshStages } from '../gallery/gallery.js';
import { resizeView, drawView, fitView } from '../viewport/viewport.js';
import { setStageCap, updateFinalJson } from '../ui/ui.js';
import { applyColumnNames, rebuildColumns } from '../edit/columnedit.js';
import { mergeRecord } from '../edit/colnames.js';
import { layoutOfColumns, applyLayout, needsLayout, hasOwnTitles } from '../headerrule/headerrule.js';
import { showSummary, hideSummary } from './summary.js';
import { pageNumberOf, orderPages, serialRangeOf } from './pagenumber.js';
import { apiRegions } from '../api/api.js';

/* the fields of S that belong to a page (the GPU, the pixel budget and the device pixel ratio do not) */
export const PAGE_KEYS=['img','srcW','srcH','W','H','scaledFrom','rawCanvas','rawImageData','origCanvas','origImageData','watermark',
  'lensCanvas','workCanvas','workImageData','cleanCanvas','cleanImageData','borders','textLines','columns','characters','recognition',
  'api','final','products','headerRuleMatch','params','pdfWords','pipelineDone','galleryPromise','stage','stageCv','thumbs','view','prepared'];
const READOUT=['statRules','statLines','statFullLines','statTable','statTilt','statChars','statRecognised','statApi'];
const blankState=()=>({img:null, srcW:0, srcH:0, W:0, H:0, scaledFrom:null, rawCanvas:null, rawImageData:null, origCanvas:null, origImageData:null, watermark:null,
  lensCanvas:null, workCanvas:null, workImageData:null, cleanCanvas:null, cleanImageData:null, borders:null, textLines:null, columns:null, characters:null, recognition:null,
  api:null, final:null, products:null, headerRuleMatch:null, params:null, pdfWords:null, pipelineDone:false, galleryPromise:null, stage:STAGES.length-1, stageCv:null, thumbs:[], view:{scale:1,tx:0,ty:0}, prepared:null, quadEdit:null});

export const pages=[];
let cur=-1, running=-1, wantView=null, paused=false, seq=0, summaryOn=false;

/* ---- the order of the pages -------------------------------------------------
   Uploaded pages stand in the order they came; once a page is read, the number it prints on itself ("Page No. 3 of
   10", from the local reading, the PDF's words or the API's regions) puts it in its place — within its own file for
   a PDF, among the loose images for photos. The page in S, the one running and the one waited for are tracked by
   identity across the reorder. */
function pageTexts(){
  const t=[];
  if(S.recognition && S.recognition.available) for(const l of S.recognition.lines||[]) if(l.text) t.push(l.text);
  if(S.api && S.api.status==='done'){ try{ for(const r of apiRegions(S.api.response)) if(r.text) t.push(r.text); }catch(e){} }
  return t;
}
function detectPageNumber(page){
  let changed=false;
  const r=pageNumberOf(pageTexts()); if(r){ changed=page.pageNo!==r.page; page.pageNo=r.page; page.pageOf=r.of; }
  // the serial numbers of the page's items: the order of the pages when the printed numbers are unclear or missing
  const sl=serialRangeOf(S.final); const was=page.serial?page.serial.first+'-'+page.serial.last:''; page.serial=sl; if((sl?sl.first+'-'+sl.last:'')!==was) changed=true;
  return changed;
}
function reorder(){
  const curP=cur>=0?pages[cur]:null, runP=running>=0?pages[running]:null, wantP=wantView!==null?pages[wantView]:null;
  const ordered=orderPages(pages, p=>p.pdf?p.file:'images');
  if(ordered.every((p,i)=>p===pages[i])) return false;
  pages.splice(0, pages.length, ...ordered);
  cur=curP?pages.indexOf(curP):-1; running=runP?pages.indexOf(runP):-1; wantView=wantP?pages.indexOf(wantP):null;
  return true;
}
document.addEventListener('apianswered',()=>{ if(cur>=0 && running<0 && detectPageNumber(pages[cur])) reorder(); render(); });

/* the summary of every page: the pages' stored states, the page in S live */
function textsOf(st){ const t=[]; if(!st) return t;
  if(st.recognition && st.recognition.available) for(const l of st.recognition.lines||[]) if(l.text) t.push(l.text);
  if(st.api && st.api.status==='done'){ try{ for(const r of apiRegions(st.api.response)) if(r.text) t.push(r.text); }catch(e){} }
  return t; }
function pageEntries(){ return pages.map((p,i)=>{ const st=i===cur?S:p.state; return {name:p.name, status:p.status, F:st&&st.final||null, P:st&&st.products||null, texts:textsOf(st)}; }); }
export function openSummary(){ summaryOn=true; if(cur>=0 && running<0) snapshotInto(pages[cur]); hideSourceBar(); showSummary(pageEntries()); render(); }
export function closeSummary(){ if(!summaryOn) return; summaryOn=false; hideSummary(); render(); }
/* a field typed on a page, or the profit range changed: the all-pages summary, when open, is built again */
for(const ev of ['finaledited','profitrange']) document.addEventListener(ev,()=>{ if(summaryOn){ if(cur>=0 && running<0) snapshotInto(pages[cur]); showSummary(pageEntries()); } });

/* the column names of the invoice: a name set on one page (the column-edit menu announces it) is kept here and laid
   over every other page — one already read, when it is next shown; one still queued, when its run ends */
export let columnNames=[]; let namesVersion=0;
document.addEventListener('columnnamed',e=>{ columnNames=mergeRecord(columnNames, e.detail); namesVersion++; if(cur>=0) pages[cur].namesVersion=namesVersion; render(); propagateToReadPages(); });
/* the invoice's LAYOUT: the columns of the first page that prints its column titles (only the first page of many
   invoices prints them — and it may be read AFTER pages that print none): a rule matched exactly, or the titles named
   most of the columns; an exact rule match met later replaces a merely named layout. Laid over every page without
   titles of its own — a page already read, at once (propagateToReadPages) or when it is next shown; a page still
   queued, when its run ends — then the shared column names on top */
export let invoiceLayout=null; let layoutVersion=0;
function keepLayout(page){
  if(!S.columns || !hasOwnTitles(S.columns)) return false;
  const exact=/^exact/.test(S.columns.headerRule.mode||'');
  if(invoiceLayout && (invoiceLayout.exact || !exact)) return false;   // the first titled page's layout stands; an exact rule match replaces a merely named one
  const L=layoutOfColumns(S.columns); if(!L) return false;
  L.fromPage=page.name; L.exact=exact; invoiceLayout=L; layoutVersion++; page.layoutVersion=layoutVersion; return true;
}

/* ---- the pages already read, brought up to date -------------------------------
   Pages are read in the order they come, and the page that prints the column titles may come AFTER pages that
   print none: when its layout is captured (or a column is named by hand), every page already read that still needs
   it is swapped into S in turn, given the layout and the names, rebuilt and put back — never while a run is on
   (the run owns S; the work waits for its end), and the page that was shown is shown again at the end. */
let propagating=false, propagateWanted=false;
export async function propagateToReadPages(){
  if(running>=0){ propagateWanted=true; return; }
  if(propagating){ propagateWanted=true; return; }
  propagating=true; propagateWanted=false;
  const shown=cur>=0?pages[cur]:null;
  try{
    for(const page of pages.slice()){
      if(page.status!=='done' || !page.state) continue;
      const needsL=!!(invoiceLayout && page.layoutVersion!==layoutVersion && page.state.columns && needsLayout(page.state.columns));
      const needsN=!!(columnNames.length && page.namesVersion!==namesVersion);
      if(!needsL && !needsN){ page.layoutVersion=layoutVersion; page.namesVersion=namesVersion; continue; }
      if(running>=0) break;                                   // a run started meanwhile: the rest waits for its end
      if(cur>=0 && pages[cur]!==page) snapshotInto(pages[cur]);
      cur=pages.indexOf(page); restoreFrom(page,{quiet:true}); render();
      await layLayoutOver(page); await layNamesOver(page);
      detectPageNumber(page);                                  // the serial column may only now be known
      snapshotInto(page);
    }
  } finally {
    propagating=false;
    if(shown && cur>=0 && pages[cur]!==shown){ snapshotInto(pages[cur]); cur=pages.indexOf(shown); restoreFrom(shown,{quiet:true}); }
    reorder(); render();
    if(propagateWanted && running<0) propagateToReadPages();
  }
}
/* the header words of every other page read so far (S.final.headerWords: what each page printed above its table) */
function sharedHeaderWords(page){
  const v=new Set();
  for(const p of pages){ if(p===page || !p.state || !p.state.final) continue; for(const w of p.state.final.headerWords||[]) v.add(w); }
  return [...v];
}
async function layLayoutOver(page){
  if(page.layoutVersion===layoutVersion) return;
  page.layoutVersion=layoutVersion;
  if(!invoiceLayout || !S.pipelineDone || !needsLayout(S.columns)) return;
  S.sharedHeaderWords=sharedHeaderWords(page);
  try{ if(applyLayout(S.columns, invoiceLayout, 'the layout of '+invoiceLayout.fromPage+' (no title row on this page)')) await rebuildColumns('columns from the layout of '+invoiceLayout.fromPage, S.columns.columns.map((c,i)=>i)); }
  catch(e){ console.warn('layout on page '+page.name+' failed', e); }
}
async function layNamesOver(page){
  if(page.namesVersion===namesVersion) return;
  page.namesVersion=namesVersion;
  if(!columnNames.length || !S.pipelineDone || !S.columns) return;
  try{ await applyColumnNames(columnNames); }catch(e){ console.warn('column names on page '+page.name+' failed', e); }
}
/* the page on view re-laid after its table's rows were set by hand (js/edit/dragedit.js): the invoice's layout over a
   page without titles of its own, the shared column names on top — each rebuilds the table when it changes anything */
export async function relayCurrent(){
  const page=cur>=0?pages[cur]:null; if(!page || running>=0 || !S.pipelineDone) return false;
  if(keepLayout(page)) propagateWanted=true;
  page.layoutVersion=-1; await layLayoutOver(page); page.namesVersion=-1; await layNamesOver(page);
  detectPageNumber(page); snapshotInto(page); reorder(); render();
  if(propagateWanted) await propagateToReadPages();
  return true;
}
export const current=()=>cur>=0?pages[cur]:null;
export const isRunning=()=>running>=0;

/* ---- the state swap ------------------------------------------------------ */
function snapshotInto(page){
  page.state={}; for(const k of PAGE_KEYS) page.state[k]=S[k];
  page.gallery=[...$('gallery').childNodes];
  page.readout=Object.fromEntries(READOUT.map(id=>[id,$(id).textContent])); page.timing=$('timing').innerHTML; page.metaHtml=meta.innerHTML;
  page.wmLabel=$('removeWm').textContent;
}
function restoreFrom(page, opts={}){
  Object.assign(S, page.state||blankState()); S.quadEdit=null; hideSourceBar();
  const gal=$('gallery'); gal.replaceChildren(...(page.gallery||[]));
  if(!gal.childNodes.length) gal.innerHTML='<div class="gal-msg">Run the pipeline to populate stage outputs.</div>';
  for(const id of READOUT) $(id).textContent=page.readout?page.readout[id]:'—';
  $('timing').innerHTML=page.timing||''; meta.innerHTML=page.metaHtml||''; meta.style.display=page.metaHtml?'block':'none';
  $('removeWm').disabled=!S.rawImageData; $('removeWm').textContent=page.wmLabel||'Remove watermark';
  runBtn.disabled=!S.device || !S.origImageData || running>=0;
  savePng.disabled=saveJson.disabled=!S.pipelineDone;
  vpEmpty.style.display=S.stageCv?'none':'flex'; stageCap.style.display=S.stageCv?'block':'none'; $('hud').style.display=S.stageCv?'flex':'none';
  resizeView();
  if(!S.view || !(S.view.scale>0)) fitView();          // a view never fitted (the page loaded while the viewport had no size)
  if(S.pipelineDone && S.thumbs.length) showStage(S.stage);
  else { drawView(); setStageCap(-1, page.status==='error'?'the run failed — '+(page.error||''):page.status==='running'?'processing':'not processed yet'); hideStagePanels(); }
  updateFinalJson();
  // what arrived while the page was away: the API answer (the final table waits for it), the product match (its stage)
  if(S.api && S.api.status!=='pending' && S.final && S.final.waitingApi && S.params) continueAfterApi(S.params, S.api);
  else if(S.products && S.products.status==='done' && !S.products.drawn){ S.products.drawn=true; refreshStages(['final-compare','final-table','products-match']); }
  if(!opts.quiet) (async()=>{ await layLayoutOver(page); await layNamesOver(page); })();   // the layout and the names set on other pages since this one was last shown
}

/* the panels that show themselves on their stage (the editable table) hide when no stage is on view: the stage-change
   event is sent with no stage selected, then the page's own stage index is put back */
function hideStagePanels(){ const keep=S.stage; S.stage=-1; document.dispatchEvent(new CustomEvent('stagechange',{detail:-1})); S.stage=keep; }

/* the API answer landed for a page that is not in S: flagged, the continuation runs when the page is shown */
export function pageOfApi(entry){ return pages.find(p=>p.state && p.state.api===entry) || null; }

/* ---- the queue ------------------------------------------------------------ */
async function runPage(i){
  const page=pages[i]; running=i; wantView=null;
  if(cur>=0 && cur!==i) snapshotInto(pages[cur]);
  cur=i; Object.assign(S, blankState()); resetResults(); meta.innerHTML=''; meta.style.display='none'; hideStagePanels(); hideSourceBar();
  page.status='loading'; page.error=null; render();
  try{
    if(page.prep){                                       // the page prepared when it was added: its raster, its text layer, its lens correction and its corners as the operator left them
      loadCanvas(page.prep.canvas, page.name); S.pdfWords=page.prep.hasText?page.prep.words:null; page.hasText=page.prep.hasText;
      S.prepared={lens:page.prep.lens, lensDone:true, quad:page.quad, edited:!!page.quadEdited, found:page.prep.quadFound, rectified:page.prep.rectified||null};
      page.prep=null; }
    else if(page.pdf){                                   // a PDF page: rendered now, its text layer kept for the reading
      const {canvas, words, hasText}=await renderPdfPage(page.pdf.doc, page.pdf.n, 1800);
      loadCanvas(canvas, page.name); S.pdfWords=hasText?words:null; page.hasText=hasText; }
    else await loadImage(page.file);
    S.sharedHeaderWords=sharedHeaderWords(page);           // the words the other pages printed above their table: the invoice header, wherever it lands here
    if(!S.device){ page.status='error'; page.error='WebGPU unavailable — the pipeline cannot run in this browser'; }
    else {
      page.status='running'; render();
      await runPipeline();
      page.status=S.pipelineDone?'done':'error'; if(!S.pipelineDone) page.error='the run failed (see the banner)';
      if(S.pipelineDone){ if(keepLayout(page)) propagateWanted=true; page.layoutVersion=-1; await layLayoutOver(page); page.namesVersion=-1; await layNamesOver(page); detectPageNumber(page); } }   // the invoice's layout and column names, from earlier pages; the page's own number
  }catch(e){ page.status='error'; page.error=e.message||String(e); showError('Page '+(i+1)+': '+page.error); }
  if(!S.view || !(S.view.scale>0)){ resizeView(); fitView(); }   // the page was loaded while the viewport had no size: fit it now
  snapshotInto(page); running=-1; reorder(); render();   // the page's printed number puts it in its place
  if(propagateWanted) await propagateToReadPages();      // the layout captured on this page (or names set during the run) go to the pages read before it
  if(summaryOn) showSummary(pageEntries());              // the summary open while the page ran: it fills in
  if(wantView!==null && wantView!==i){ const w=wantView; wantView=null; paused=pages.some(p=>p.status==='queued'); select(w); render(); return; }
  pump();
}
function pump(){
  if(running>=0 || paused) return;
  const i=pages.findIndex(p=>p.status==='queued'); if(i<0) return;
  runPage(i);
}
export function resume(){ paused=false; render(); pump(); }

export async function addFiles(list){
  const files=[...(list||[])].filter(f=>f && (isPdfFile(f) || (f.type && f.type.startsWith('image/'))));
  if(!files.length) return;
  for(const file of files){
    if(isPdfFile(file)){                                  // every page of the PDF is a page of the invoice
      let pdf; try{ pdf=await openPdf(file); }catch(e){ showError('Could not open '+file.name+': '+(e.message||e)); continue; }
      const added=[];
      for(let n=1;n<=pdf.numPages;n++){ const page={id:++seq, name:file.name+' · '+n+'/'+pdf.numPages, file, pdf:{doc:pdf.doc, n}, status:'new', error:null, state:null, gallery:null, thumb:null}; pages.push(page); added.push(page); }
      render(); prepare();
      (async()=>{ for(const page of added){ if(page.thumb) continue; try{ const t=await pdfThumbnail(pdf.doc, page.pdf.n, 200); if(!page.thumb) page.thumb=t; render(); }catch(e){} } })();
      continue; }
    const page={id:++seq, name:file.name, file, status:'new', error:null, state:null, gallery:null, thumb:null};
    pages.push(page); render();
    thumbnail(file).then(url=>{ if(!page.thumb) page.thumb=url; render(); }).catch(()=>{});
  }
  prepare();
  if(pages.length && cur<0) select(pages.findIndex(p=>p.status!=='error'));   // the first page on view, its corners ready to be fitted
}

/* ---- the preparation --------------------------------------------------------
   A page added is not run: it is decoded to its working raster, lens-corrected, and its corners are found and drawn
   over it (quadedit.js) — the operator fits them where the detector was fooled (a shadow, a second sheet, a hand),
   page by page from the strip, and RUN PIPELINE then processes every ready page from the corners as they stand. Pages
   are prepared one at a time in the background, whatever page is on view. */
let preparing=false;
const breath=()=>new Promise(r=>setTimeout(r,0));
async function decodeImage(file){
  try{ return await createImageBitmap(file); }
  catch(e){ return new Promise((res,rej)=>{ const url=URL.createObjectURL(file); const im=new Image(); im.onload=()=>{ URL.revokeObjectURL(url); res(im); }; im.onerror=()=>{ URL.revokeObjectURL(url); rej(new Error('could not decode '+file.name)); }; im.src=url; }); }
}
async function preparePage(page){
  let source, words=null, hasText=false;
  if(page.pdf){ const r=await renderPdfPage(page.pdf.doc, page.pdf.n, 1800); source=r.canvas; words=r.words; hasText=r.hasText; }
  else source=await decodeImage(page.file);
  const sc=scaledCanvas(source); if(source.close) source.close();
  await breath();
  let lens=null; try{ lens=correctLensDistortion(sc.canvas); }catch(e){ lens=null; }
  await breath();
  const view=lens||sc.canvas;
  let quad=null; try{ quad=pageQuadOf(view); }catch(e){ quad=null; }
  page.prep={canvas:sc.canvas, lens, W:sc.W, H:sc.H, words, hasText, quadFound:!!quad};
  page.quad=quad||defaultQuad(sc.W,sc.H); page.detectedQuad=page.quad; page.quadEdited=false;
  page.thumb=thumbWithQuad(view, page.quad, 200);
  page.status='ready';
}
async function prepare(){
  if(preparing) return; preparing=true;
  try{
    for(;;){
      const page=pages.find(p=>p.status==='new'); if(!page) break;
      try{ await preparePage(page); }
      catch(e){ page.status='error'; page.error='could not read the page: '+(e.message||e); }
      render();
      if(cur>=0 && pages[cur]===page && running<0) showPrepared(page);   // the page on view while it was prepared: its corners appear
      await breath();
    }
  } finally { preparing=false; }
}
/* the prepared page on view: beautified, the page warped flat; else its lens-corrected raster with the corners drawn
   for correction */
function showPrepared(page){
  Object.assign(S, blankState()); resetResults(); meta.innerHTML=''; meta.style.display='none'; hideStagePanels();
  const view=page.prep.lens||page.prep.canvas; S.W=page.prep.W; S.H=page.prep.H;
  if(page.prep.rectified){ S.stageCv=page.prep.rectified; S.quadEdit=null; }
  else { S.stageCv=view;
    S.quadEdit={quad:page.quad, active:null, page, onChange:q=>{ page.quad=q; page.quadEdited=!sameQuad(q, page.detectedQuad); page.thumb=thumbWithQuad(view, q, 200); render(); }}; }
  $('removeWm').disabled=true; savePng.disabled=saveJson.disabled=true;
  vpEmpty.style.display='none'; stageCap.style.display='none'; $('hud').style.display='flex';
  resizeView(); fitView();
  renderSourceBar();
  updateFinalJson();
}
/* the source stage's own buttons: ⌖ Detect corners, ✦ Beautify (this page), ↶ Reset — shown over a page not yet run */
const sourceBar=$('sourceBar');
function renderSourceBar(){
  if(!sourceBar) return;
  const page=cur>=0?pages[cur]:null; const on=!!(page && page.status==='ready' && page.prep && running<0 && !summaryOn);
  sourceBar.style.display=on?'flex':'none'; if(!on) return;
  const rect=!!page.prep.rectified;
  $('srcDetect').disabled=rect; $('srcBeautify').disabled=rect; $('srcReset').disabled=!rect && !page.quadEdited;
  $('srcNote').textContent=rect ? 'beautified from its corners'+(page.prep.warpNote?' ('+page.prep.warpNote+')':'')
    : (page.prep.quadFound?'corners found by the detector':'no page found — the frame is offered')+(page.quadEdited?', moved by hand':'')+' · drag a handle to fit the page';
}
function hideSourceBar(){ if(sourceBar) sourceBar.style.display='none'; }
/* ⌖ Detect corners: the detector runs again on the page on view (after a Reset, or to undo a hand-moved corner) */
function detectCorners(){
  const page=cur>=0?pages[cur]:null; if(!page || page.status!=='ready' || !page.prep || page.prep.rectified) return;
  const view=page.prep.lens||page.prep.canvas; let quad=null; try{ quad=pageQuadOf(view); }catch(e){ quad=null; }
  page.prep.quadFound=!!quad; page.quad=quad||defaultQuad(page.prep.W,page.prep.H); page.detectedQuad=page.quad; page.quadEdited=false;
  page.thumb=thumbWithQuad(view, page.quad, 200);
  showPrepared(page); render();
}
/* ↶ Reset: this page as loaded — the beautified image dropped, the corners back where the detector put them */
function resetPage(){
  const page=cur>=0?pages[cur]:null; if(!page || page.status!=='ready' || !page.prep) return;
  page.prep.rectified=null; page.prep.warpNote=null; page.beautified=false;
  page.quad=page.detectedQuad||page.quad; page.quadEdited=false;
  page.thumb=thumbWithQuad(page.prep.lens||page.prep.canvas, page.quad, 200);
  showPrepared(page); render();
}
/* ✦ Beautify: every ready page not yet beautified is warped flat from its corners as they stand (the lens correction
   is already in) — the page on view first; a page whose corners cannot be warped (crossed, collapsed) is kept as
   loaded and says so. ↶ Original drops the beautified image of the page on view and brings its corners back. */
const breathe=()=>new Promise(r=>setTimeout(r,0));
function beautifyPage(page){
  const src=page.prep.lens||page.prep.canvas; let warped=null;
  try{ warped=rectifyPerspective(src, {quad:page.quad, force:true}); }catch(e){ warped=null; }
  if(warped){ page.prep.rectified=warped; page.prep.warpNote=page.quadEdited?'corners set by hand':'corners found by the detector'; page.thumb=thumbWithQuad(warped, null, 200); }
  else { page.prep.warpNote='the corners could not be warped — the page stays as loaded'; }
  page.beautified=!!warped;
  if(cur>=0 && pages[cur]===page && running<0) showPrepared(page);
  return !!warped;
}
/* the source stage's ✦ Beautify: the page on view alone */
function beautifyCurrent(){
  const page=cur>=0?pages[cur]:null; if(!page || page.status!=='ready' || !page.prep || page.prep.rectified) return;
  beautifyPage(page); render();
}
/* the ribbon's ✦ Beautify: every ready page not yet beautified, the page on view first */
async function beautify(){
  const todo=pages.filter(p=>p.status==='ready' && p.prep && !p.prep.rectified);
  if(!todo.length) return;
  if(cur>=0 && todo.includes(pages[cur])) todo.unshift(...todo.splice(todo.indexOf(pages[cur]),1));
  const b=$('beautify'); b.disabled=true; const label=b.textContent; let k=0;
  try{
    for(const page of todo){
      b.textContent='✦ Beautifying '+(++k)+'/'+todo.length; await breathe();
      beautifyPage(page);
      render(); await breathe();
    }
  } finally { b.textContent=label; render(); }
}
/* RUN PIPELINE: every ready page is queued and processed in turn from its corners — the page on view first; with no
   page waiting, the page shown is run again with the controls as they are */
function runReady(){
  const ready=pages.filter(p=>p.status==='ready');
  if(!ready.length){ rerunCurrent(); return; }
  for(const p of ready) p.status='queued';
  paused=false; S.quadEdit=null; render();
  if(running<0 && cur>=0 && pages[cur].status==='queued'){ runPage(cur); return; }
  pump();
}
$('beautify').onclick=beautify;
$('srcDetect').onclick=detectCorners;
$('srcBeautify').onclick=beautifyCurrent;
$('srcReset').onclick=resetPage;
async function thumbnail(file){
  try{ const bmp=await createImageBitmap(file,{resizeWidth:200, resizeQuality:'medium'}); const c=document.createElement('canvas'); c.width=bmp.width; c.height=bmp.height; c.getContext('2d').drawImage(bmp,0,0); bmp.close(); return c.toDataURL('image/jpeg',0.8); }
  catch(e){ return new Promise((res,rej)=>{ const url=URL.createObjectURL(file); const im=new Image(); im.onload=()=>{ const s=Math.min(1,200/im.naturalWidth); const c=document.createElement('canvas'); c.width=Math.round(im.naturalWidth*s); c.height=Math.round(im.naturalHeight*s); c.getContext('2d').drawImage(im,0,0,c.width,c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg',0.8)); }; im.onerror=rej; im.src=url; }); }
}

/* ---- selecting a page ----------------------------------------------------- */
export function select(i){
  if(i<0 || i>=pages.length) return;
  if(summaryOn){ summaryOn=false; hideSummary(); }
  const page=pages[i];
  if(running>=0){                                        // a run is on: the view is its page's until it ends
    if(i===running){ wantView=null; render(); return; }
    wantView=i; render(); return;
  }
  if(page.status==='queued'){ paused=false; runPage(i); return; }
  if(page.status==='ready'){ if(cur>=0 && cur!==i) snapshotInto(pages[cur]); cur=i; showPrepared(page); render(); return; }
  if(page.status==='new'){                               // still being prepared: an empty view until its corners are found
    if(cur>=0 && cur!==i) snapshotInto(pages[cur]); cur=i;
    Object.assign(S, blankState()); resetResults(); meta.innerHTML=''; meta.style.display='none'; hideStagePanels();
    hideSourceBar(); vpEmpty.style.display='none'; stageCap.style.display='block'; $('hud').style.display='none'; drawView(); setStageCap(-1,'preparing the page — its corners are being found'); render(); return; }
  if(i===cur){ render(); return; }
  if(cur>=0) snapshotInto(pages[cur]);
  cur=i; restoreFrom(page); render();
}

/* re-run the page shown with the controls as they are now */
async function rerunCurrent(){
  if(cur<0 || running>=0 || !S.origImageData) return;
  const page=pages[cur]; running=cur; page.status='running'; render();
  try{ await runPipeline(); page.status=S.pipelineDone?'done':'error'; }
  catch(e){ page.status='error'; page.error=e.message||String(e); }
  snapshotInto(page); running=-1; render(); pump();
}

/* ---- the strip ------------------------------------------------------------ */
const panel=$('pagesPanel');
function render(){
  if(!panel) return;
  const queued=pages.filter(p=>p.status==='queued').length;
  let h='<div class="pages-head"><span>pages · '+pages.length+(invoiceLayout?' · layout: '+(invoiceLayout.ruleName||invoiceLayout.ruleId||'page '+invoiceLayout.fromPage):'')+(columnNames.length?' · '+columnNames.length+' column name'+(columnNames.length>1?'s':'')+' shared':'')+'</span>'+(paused&&queued?'<button class="ghost" id="pagesResume" title="continue processing the queued pages">▶ resume '+queued+'</button>':'')+'</div>';
  pages.forEach((p,i)=>{
    const st=p.status, on=i===cur, want=wantView===i;
    const badge=st==='done'?'✓':st==='error'?'✗':st==='running'||st==='loading'?'…':st==='new'?'reading':st==='ready'?(p.beautified?'✦ beautified':p.quadEdited?'corners set':'ready'):'queued';
    const printed=(p.pageNo!=null?' <span class="printed" title="the number the page prints on itself">p.'+p.pageNo+(p.pageOf?'/'+p.pageOf:'')+'</span>':'')
      +(p.serial?' <span class="printed" title="the serial numbers of the page\'s items">#'+p.serial.first+'–'+p.serial.last+'</span>':'');
    h+='<div class="page'+(on?' on':'')+(want?' want':'')+'" data-i="'+i+'" title="'+p.name.replace(/"/g,'&quot;')+' — '+st+(p.error?': '+p.error:'')+(p.pageNo!=null?' · prints page '+p.pageNo+(p.pageOf?' of '+p.pageOf:''):'')+(want?' · shown when the current run ends':'')+'">'
      +(p.thumb?'<img src="'+p.thumb+'" alt="">':'<div class="ph"></div>')+'<div class="pno">'+(i+1)+printed+'</div><div class="st '+st+'">'+badge+'</div><div class="nm">'+p.name.replace(/[<>&]/g,'')+'</div></div>';
  });
  if(!pages.length) h+='<div class="pages-empty">Add the pages of the invoice: drop images or PDFs here or on the page, or use ＋ Add pages. Each page\'s corners are found and shown — fit them where needed, then RUN PIPELINE processes every page in turn.</div>';
  // the summary card: pinned at the foot of the strip, every page added goes above it
  const done=pages.filter(p=>p.status==='done').length;
  h+='<div class="page summary'+(summaryOn?' on':'')+'" id="pageSummary" title="every page\'s items in one table, with the sums per page and for the invoice"><div class="sum-ico">Σ</div><div class="nm">All pages · summary'+(pages.length?' <span class="cnt">'+done+'/'+pages.length+'</span>':'')+'</div></div>';
  panel.innerHTML=h;
  panel.querySelectorAll('.page[data-i]').forEach(el=>{ el.onclick=()=>select(+el.dataset.i); });
  const sc=$('pageSummary'); if(sc) sc.onclick=openSummary;
  const rs=$('pagesResume'); if(rs) rs.onclick=resume;
  $('addPages').disabled=false;
  const ready=pages.filter(p=>p.status==='ready').length;
  runBtn.textContent=ready?'RUN PIPELINE · '+ready+' page'+(ready>1?'s':''):'RUN PIPELINE';
  runBtn.title=ready?'process the '+ready+' ready page'+(ready>1?'s':'')+' from their corners as they stand':'run the page shown again with the controls as they are';
  runBtn.disabled=running>=0 || !S.device || !(ready || S.origImageData);
  const toBeautify=pages.filter(p=>p.status==='ready' && p.prep && !p.prep.rectified).length;
  const bb=$('beautify'); if(bb){ bb.disabled=!toBeautify; bb.title=toBeautify?'warp the '+toBeautify+' ready page'+(toBeautify>1?'s':'')+' flat from their corners; RUN PIPELINE then works on the beautified image':'every ready page is beautified — a page not beautified is processed as it was loaded'; }
  renderSourceBar();
}

/* ---- wiring --------------------------------------------------------------- */
fileInput.multiple=true;
fileInput.onchange=e=>{ addFiles(e.target.files); e.target.value=''; };
drop.onclick=()=>fileInput.click();
drop.addEventListener('drop',e=>{ e.preventDefault(); addFiles(e.dataTransfer.files); });
viewport.addEventListener('drop',e=>{ e.preventDefault(); addFiles(e.dataTransfer.files); });
if(panel){ ['dragenter','dragover'].forEach(ev=>panel.addEventListener(ev,e=>{ e.preventDefault(); panel.classList.add('hot'); })); ['dragleave','drop'].forEach(ev=>panel.addEventListener(ev,e=>{ e.preventDefault(); panel.classList.remove('hot'); })); panel.addEventListener('drop',e=>addFiles(e.dataTransfer.files)); }
$('addPages').onclick=()=>fileInput.click();
runBtn.onclick=runReady;
render();
