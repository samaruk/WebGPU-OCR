/* ======================================================================
   STAGE GALLERY
   Why: a wrong final box is almost always explained by an earlier stage.
   Rendering every stage to a clickable, full-resolution thumbnail lets the
   operator inspect any intermediate result, which is what makes the
   parameter sliders tunable in practice.
   ====================================================================== */
import { $ } from '../dom/dom.js';
import { S } from '../state/state.js';
import { STAGES } from '../config/config.js';
import { getStageCanvas, renderStage, renderStageInto } from '../render/render.js';
import { nextFrame } from '../pipeline/pipeline.js';
import { drawView } from '../viewport/viewport.js';
import { setStageCap } from '../ui/ui.js';

/* =====================================================================
   STAGE GALLERY  —  every output rendered as a clickable thumbnail
   ===================================================================== */
export async function buildGallery(){
  const gal=$('gallery'); gal.innerHTML=''; S.thumbs=[];
  const W=S.W,H=S.H, cv=getStageCanvas(), ctx=cv.getContext('2d');
  let curGroup=null;
  for(let i=0;i<STAGES.length;i++){
    const st=STAGES[i];
    if(st.group!==curGroup){
      curGroup=st.group;
      const sep=document.createElement('div');
      sep.className='gsep'; sep.textContent=curGroup;
      gal.appendChild(sep);
    }
    const item=document.createElement('div');
    item.className='gitem'+(i===S.stage?' on':'');
    item.dataset.idx=i;
    // render the stage at full working resolution, store it as an <img>
    // whose source is a full-size PNG — copying / saving the thumbnail
    // then yields the complete W×H image, not the shrunk canvas bitmap.
    renderStageInto(st,ctx,W,H);
    const im=new Image();
    im.src=cv.toDataURL('image/png');
    im.alt=st.name; im.draggable=true; im.loading='lazy';
    const cap=document.createElement('div'); cap.className='cap';
    cap.innerHTML=`<b>${i+1}</b>${st.name}`;
    item.appendChild(im); item.appendChild(cap);
    item.onclick=()=>showStage(i);
    gal.appendChild(item);
    S.thumbs.push(im);
    if((i&3)===3) await nextFrame();        // yield so the encode loop doesn't jank
  }
}

/* Re-render the thumbnails of the stages whose kind is listed, and the
   view if one of them is on screen — used when the API answer arrives
   after the gallery was built. */
export async function refreshStages(kinds){
  if(!S.thumbs.length || !S.W) return;
  const cv=getStageCanvas(), ctx=cv.getContext('2d');
  // the stage on screen first, so the operator sees the change at once;
  // the thumbnails follow one per frame — a full-page render and a PNG
  // encode each, which back to back would freeze the page for seconds
  renderStage(S.stage); drawView(); setStageCap(S.stage);
  const gen=(refreshStages.gen=(refreshStages.gen||0)+1);
  for(let i=0;i<STAGES.length;i++){ const st=STAGES[i]; if(!kinds.includes(st.kind) || !S.thumbs[i]) continue;
    if(refreshStages.gen!==gen || !S.thumbs.length) return;    // a newer refresh or a new run took over
    renderStageInto(st,ctx,S.W,S.H); S.thumbs[i].src=cv.toDataURL('image/png');
    await nextFrame(); }
}

export function showStage(i){
  S.stage=i;
  document.querySelectorAll('.gitem').forEach(g=>
    g.classList.toggle('on',+g.dataset.idx===i));
  renderStage(i); drawView(); setStageCap(i);
  document.dispatchEvent(new CustomEvent('stagechange',{detail:i}));   // the editable-table panel shows itself on its stage
}
