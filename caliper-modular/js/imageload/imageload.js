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
  if(!file||!file.type.startsWith('image/')) return;
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
  };
  img.onerror=()=>showError('Could not decode that image file.');
  img.src=url;
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

drop.onclick=()=>fileInput.click();
fileInput.onchange=e=>loadImage(e.target.files[0]);
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('hot');}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('hot');}));
drop.addEventListener('drop',e=>loadImage(e.dataTransfer.files[0]));
viewport.addEventListener('dragover',e=>e.preventDefault());
viewport.addEventListener('drop',e=>{e.preventDefault();loadImage(e.dataTransfer.files[0]);});
