/* ======================================================================
   IMAGE LOADING  (with GPU-budget downscaling)
   Why: decodes the dropped / chosen file and downscales it when it would
   exceed the GPU storage-buffer budget or the canvas dimension limit. An
   over-budget image would fail buffer allocation mid-pipeline, so the
   clamp here is what keeps the pipeline from crashing on large scans.
   ====================================================================== */
import { S } from '../state/state.js';
import { STAGES } from '../config/config.js';
import { $, meta, runBtn, vpEmpty, stageCap, savePng, saveJson, showError, drop, fileInput, viewport } from '../dom/dom.js';
import { resizeView, fitView } from '../viewport/viewport.js';
import { setStageCap } from '../ui/ui.js';

export function loadImage(file){
  if(!file||!file.type.startsWith('image/')) return Promise.reject(new Error('not an image'));
  return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{
    URL.revokeObjectURL(url);
    S.img=img; S.srcW=img.naturalWidth; S.srcH=img.naturalHeight;
    let W=S.srcW, H=S.srcH, scaled=null;
    const budget=S.maxPixels||32_000_000;          // RGBA buffer ≤ 128 MB
    if(W*H>budget){ const s=Math.sqrt(budget/(W*H)); W=Math.max(1,Math.round(W*s)); H=Math.max(1,Math.round(H*s)); scaled='pixel budget'; }
    const maxDim=16384;                            // 2D canvas limit
    if(W>maxDim||H>maxDim){ const s=Math.min(maxDim/W,maxDim/H); W=Math.round(W*s); H=Math.round(H*s); scaled='dimension limit'; }
    S.W=W; S.H=H; S.scaledFrom=scaled?{w:S.srcW,h:S.srcH,why:scaled}:null;

    // rasterise to working size
    const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.imageSmoothingQuality='high'; ctx.drawImage(img,0,0,W,H);
    S.origImageData=ctx.getImageData(0,0,W,H);
    S.origCanvas=canvas;
    S.rawCanvas=canvas; S.rawImageData=S.origImageData; S.watermark=null;
    $('removeWm').disabled=false; $('removeWm').textContent='Remove watermark';

    // meta panel
    const mb=(S.srcW*S.srcH*4/1048576).toFixed(1);
    let html=`<div><span class="k">source</span> <span class="v">${S.srcW}×${S.srcH}</span> · ${mb} MB RGBA</div>`;
    html+=S.scaledFrom
      ? `<div class="warn">↓ resized to ${W}×${H} — ${S.scaledFrom.why}</div>`
      : `<div><span class="k">working</span> <span class="v">${W}×${H}</span> · original size</div>`;
    meta.innerHTML=html; meta.style.display='block';

    resetResults();
    previewImage(S.origCanvas);
    resolve();
  };
  img.onerror=()=>{ URL.revokeObjectURL(url); showError('Could not decode that image file.'); reject(new Error('could not decode '+file.name)); };
  img.src=url;
  });
}

/* a rendered page (a PDF page from js/pdf/pdfload.js) loaded the way a decoded file is: the same pixel budget, the
   same working raster, the same preview */
/* the working raster of a decoded image, a bitmap or a rendered page: the pixel budget and the canvas limit applied —
   nothing in S touched, so a page can be prepared in the background while another is shown (js/pages/pages.js) */
export function scaledCanvas(source){
  const srcW=source.width, srcH=source.height;
  let W=srcW, H=srcH, scaled=null;
  const budget=S.maxPixels||32_000_000;
  if(W*H>budget){ const s=Math.sqrt(budget/(W*H)); W=Math.max(1,Math.round(W*s)); H=Math.max(1,Math.round(H*s)); scaled='pixel budget'; }
  const maxDim=16384;
  if(W>maxDim||H>maxDim){ const s=Math.min(maxDim/W,maxDim/H); W=Math.round(W*s); H=Math.round(H*s); scaled='dimension limit'; }
  const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext('2d',{willReadFrequently:true}); ctx.imageSmoothingQuality='high'; ctx.drawImage(source,0,0,W,H);
  return {canvas, W, H, srcW, srcH, scaledFrom:scaled?{w:srcW,h:srcH,why:scaled}:null};
}
export function loadCanvas(source, label){
  const r=scaledCanvas(source); const W=r.W, H=r.H;
  S.img=null; S.srcW=r.srcW; S.srcH=r.srcH; S.W=W; S.H=H; S.scaledFrom=r.scaledFrom;
  const canvas=r.canvas;
  S.origImageData=canvas.getContext('2d').getImageData(0,0,W,H); S.origCanvas=canvas; S.rawCanvas=canvas; S.rawImageData=S.origImageData; S.watermark=null;
  $('removeWm').disabled=false; $('removeWm').textContent='Remove watermark';
  meta.innerHTML=`<div><span class="k">${label||'page'}</span> <span class="v">${W}×${H}</span>${S.scaledFrom?' <span class="warn">↓ resized — '+S.scaledFrom.why+'</span>':''}</div>`; meta.style.display='block';
  resetResults(); previewImage(S.origCanvas);
  return {W,H};
}

/* every stage result and the gallery are dropped: the next run starts
   from S.origCanvas again (called on load and when the watermark is
   removed or restored) */
export function resetResults(){
  runBtn.disabled=!S.device;
  S.lensCanvas=null; S.workCanvas=null; S.workImageData=null; S.cleanCanvas=null; S.cleanImageData=null;
  S.borders=null; S.textLines=null; S.columns=null; S.characters=null; S.recognition=null; S.api=null; S.final=null;
  S.stageCv=null; S.thumbs=[]; S.stage=STAGES.length-1;
  for(const id of ['statRules','statLines','statFullLines','statTable','statTilt','statChars','statRecognised','statApi']) $(id).textContent='—';
  $('timing').innerHTML='';
  $('gallery').innerHTML='<div class="gal-msg">Run the pipeline to populate stage outputs.</div>';
  vpEmpty.style.display='none';
  stageCap.style.display='block';
  savePng.disabled=saveJson.disabled=true;
}

/* show a canvas in the viewport before any run */
export function previewImage(canvas,caption){
  const preview=document.createElement('canvas'); preview.width=canvas.width; preview.height=canvas.height;
  preview.getContext('2d').drawImage(canvas,0,0);
  S.stageCv=preview; resizeView(); fitView();
  setStageCap(-1,caption);
}

/* the file input, the drop zone and the viewport hand their files to the pages of the invoice (js/pages/pages.js) */
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('hot');}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('hot');}));
viewport.addEventListener('dragover',e=>e.preventDefault());
