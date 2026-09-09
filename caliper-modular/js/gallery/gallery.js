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
export function refreshStages(kinds){
  if(!S.thumbs.length || !S.W) return;
  const cv=getStageCanvas(), ctx=cv.getContext('2d');
  STAGES.forEach((st,i)=>{ if(!kinds.includes(st.kind) || !S.thumbs[i]) return;
    renderStageInto(st,ctx,S.W,S.H); S.thumbs[i].src=cv.toDataURL('image/png'); });
  renderStage(S.stage); drawView(); setStageCap(S.stage);
}

export function showStage(i){
  S.stage=i;
  document.querySelectorAll('.gitem').forEach(g=>
    g.classList.toggle('on',+g.dataset.idx===i));
  renderStage(i); drawView(); setStageCap(i);
}
