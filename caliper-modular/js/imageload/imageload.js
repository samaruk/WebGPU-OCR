/* ======================================================================
   IMAGE LOADING  (with GPU-budget downscaling)
   Why: decodes the dropped/chosen file and — critically — downscales it when
   it would exceed the GPU storage-buffer budget or canvas dimension limits.
   An over-budget image would fail buffer allocation mid-pipeline, so the
   clamp here is what keeps the pipeline from crashing on large scans.
   ====================================================================== */
import { S } from '../state/state.js';
import { STAGES } from '../config/config.js';
import { $, meta, runBtn, vpEmpty, stageCap, savePng, saveJson,
         showError, drop, fileIn, viewport } from '../dom/dom.js';
import { resizeView, fitView } from '../viewport/viewport.js';
import { setStageCap } from '../ui/ui.js';

/* =====================================================================
   IMAGE LOADING  (with 128 MB / GPU-limit downscale)
   ===================================================================== */
export function loadImage(file){
  if(!file||!file.type.startsWith('image/')) return;
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{
    URL.revokeObjectURL(url);
    S.img=img; S.srcW=img.naturalWidth; S.srcH=img.naturalHeight;
    let W=S.srcW,H=S.srcH, scaled=null;
    const budget=S.maxPixels||32_000_000;       // RGBA buffer ≤ 128 MB
    if(W*H>budget){
      const s=Math.sqrt(budget/(W*H));
      W=Math.max(1,Math.round(W*s)); H=Math.max(1,Math.round(H*s));
      scaled='pixel budget';
    }
    // also respect 2D canvas / practical limits
    const maxDim=16384;
    if(W>maxDim||H>maxDim){
      const s=Math.min(maxDim/W,maxDim/H);
      W=Math.round(W*s); H=Math.round(H*s); scaled='dimension limit';
    }
    S.W=W; S.H=H; S.scaledFrom=scaled?{w:S.srcW,h:S.srcH,why:scaled}:null;
    // rasterize to working size — this is the original (pre-deskew) image
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const cx=c.getContext('2d',{willReadFrequently:true});
    cx.imageSmoothingQuality='high'; cx.drawImage(img,0,0,W,H);
    S.origImageData=cx.getImageData(0,0,W,H);
    S.origCanvas=c;

    // meta panel
    const mb=(S.srcW*S.srcH*4/1048576).toFixed(1);
    let html=`<div><span class="k">source</span> <span class="v">${S.srcW}×${S.srcH}</span> · ${mb} MB RGBA</div>`;
    if(S.scaledFrom)
      html+=`<div class="warn">↓ resized to ${W}×${H} — ${S.scaledFrom.why}</div>`;
    else
      html+=`<div><span class="k">working</span> <span class="v">${W}×${H}</span> · original size</div>`;
    meta.innerHTML=html; meta.style.display='block';

    runBtn.disabled=!S.device;
    S.passes={A:null,B:null}; S.stageCv=null; S.thumbs=[];
    S.lensCanvas=null; S.workCanvas=null; S.workImageData=null;
    S.deskewCanvas=null; S.deskewImageData=null; S.angle=0;
    S.dewarpCanvas=null; S.dewarpImageData=null;
    S.stage=STAGES.length-1;
    $('skewOut').innerHTML='detected angle — run the pipeline';
    $('sAngle').textContent='—';
    $('gallery').innerHTML='<div class="gal-msg">Run the pipeline to populate stage outputs.</div>';
    vpEmpty.style.display='none';
    stageCap.style.display='block';
    savePng.disabled=saveJson.disabled=true;
    // preview the raw image in the viewport
    const pv=document.createElement('canvas'); pv.width=W;pv.height=H;
    pv.getContext('2d').drawImage(img,0,0,W,H);
    S.stageCv=pv; resizeView(); fitView();
    setStageCap(-1);
  };
  img.onerror=()=>showError('Could not decode that image file.');
  img.src=url;
}
drop.onclick=()=>fileIn.click();
fileIn.onchange=e=>loadImage(e.target.files[0]);
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('hot');}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('hot');}));
drop.addEventListener('drop',e=>loadImage(e.dataTransfer.files[0]));
viewport.addEventListener('dragover',e=>e.preventDefault());
viewport.addEventListener('drop',e=>{e.preventDefault();loadImage(e.dataTransfer.files[0]);});
