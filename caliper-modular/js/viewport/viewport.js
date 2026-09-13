/* ======================================================================
   VIEWPORT  ·  pan / zoom blitter
   Why: a scanned page is far larger than the screen; the operator must be
   able to inspect individual word boxes at pixel scale. This blitter stays
   independent of *which* stage is shown — it only pans/zooms the current
   offscreen canvas.
   ====================================================================== */
import { S } from '../state/state.js';
import { $, viewport, viewCv } from '../dom/dom.js';
import { drawQuad, nearestCorner, moveCorner, quadIsConvex, HANDLE_PX } from '../rectify/quadedit.js';

/* =====================================================================
   VIEWPORT  —  pan / zoom blitter
   ===================================================================== */
export function resizeView(){
  const r=viewport.getBoundingClientRect();
  viewCv.width=r.width*S.dpr; viewCv.height=r.height*S.dpr;
  drawView();
}
export function fitView(){
  const r=viewport.getBoundingClientRect();
  const s=Math.min(r.width/S.W, r.height/S.H)*0.94;
  S.view.scale=s;
  S.view.tx=(r.width-S.W*s)/2;
  S.view.ty=(r.height-S.H*s)/2;
  drawView();
}
export function drawView(){
  const ctx=viewCv.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,viewCv.width,viewCv.height);
  if(!S.stageCv) return;
  const v=S.view, d=S.dpr;
  ctx.setTransform(v.scale*d,0,0,v.scale*d,v.tx*d,v.ty*d);
  ctx.imageSmoothingEnabled = v.scale<2;
  ctx.drawImage(S.stageCv,0,0);
  // frame
  ctx.setTransform(d,0,0,d,0,0);
  ctx.strokeStyle='rgba(166,255,63,.35)'; ctx.lineWidth=1;
  ctx.strokeRect(v.tx,v.ty,S.W*v.scale,S.H*v.scale);
  // the page's corners, up for correction before the run (quadedit.js)
  if(S.quadEdit && S.quadEdit.quad) drawQuad(ctx, S.quadEdit.quad, v, d, {W:S.W, H:S.H, active:S.quadEdit.active, convex:quadIsConvex(S.quadEdit.quad)});
  // the handles of the stage on view: column boundaries, the table's edges (js/edit/dragedit.js)
  if(S.dragEdit && S.dragEdit.draw){ try{ S.dragEdit.draw(ctx, v, d); }catch(e){ console.warn('drag overlay', e); } }
  $('zVal').textContent=Math.round(v.scale*100)+'%';
}
export function zoomAt(cx,cy,factor){
  const v=S.view;
  const nx=Math.min(40,Math.max(0.02,v.scale*factor));
  v.tx=cx-(cx-v.tx)*(nx/v.scale);
  v.ty=cy-(cy-v.ty)*(nx/v.scale);
  v.scale=nx; drawView();
}

/* viewport interaction */
export let dragging=false,lx=0,ly=0;
/* a corner handle under the pointer takes the drag: the corner follows the pointer in image coordinates, the view
   does not pan; on release the owner of the quad hears of the change */
let cornerDrag=null, editDrag=null;   // editDrag: the handle of S.dragEdit being dragged
const imagePoint=e=>{ const r=viewport.getBoundingClientRect(); return {x:(e.clientX-r.left-S.view.tx)/S.view.scale, y:(e.clientY-r.top-S.view.ty)/S.view.scale}; };
const cornerAt=e=>{ if(!S.quadEdit || !S.quadEdit.quad) return null; const p=imagePoint(e); return nearestCorner(S.quadEdit.quad, p.x, p.y, (HANDLE_PX+5)/S.view.scale); };
const editHandleAt=e=>{ if(!S.dragEdit || !S.dragEdit.hit) return null; try{ return S.dragEdit.hit(imagePoint(e)); }catch(err){ return null; } };
viewCv.addEventListener('mousedown',e=>{
  if(e.button!==0) return;
  const k=cornerAt(e); if(k){ cornerDrag=k; S.quadEdit.active=k; viewCv.style.cursor='grabbing'; drawView(); e.preventDefault(); return; }
  const h=editHandleAt(e); if(h){ editDrag=h; if(S.dragEdit.begin) S.dragEdit.begin(h); viewCv.style.cursor=S.dragEdit.cursor?S.dragEdit.cursor(h):'move'; drawView(); e.preventDefault(); return; }
  dragging=true;lx=e.clientX;ly=e.clientY;viewCv.classList.add('drag');});
addEventListener('mousemove',e=>{
  if(cornerDrag){ const p=imagePoint(e); S.quadEdit.quad=moveCorner(S.quadEdit.quad, cornerDrag, p.x, p.y, S.W, S.H); drawView(); return; }
  if(editDrag){ if(S.dragEdit && S.dragEdit.move) S.dragEdit.move(editDrag, imagePoint(e)); drawView(); return; }
  if(!dragging){ if(e.target===viewCv){ if(S.quadEdit) viewCv.style.cursor=cornerAt(e)?'grab':''; else if(S.dragEdit){ const h=editHandleAt(e); viewCv.style.cursor=h?(S.dragEdit.cursor?S.dragEdit.cursor(h):'move'):''; } } return; }
  S.view.tx+=e.clientX-lx;S.view.ty+=e.clientY-ly;lx=e.clientX;ly=e.clientY;drawView();});
addEventListener('mouseup',()=>{
  if(cornerDrag){ cornerDrag=null; const q=S.quadEdit; if(q){ q.active=null; if(q.onChange) q.onChange(q.quad); } viewCv.style.cursor=''; drawView(); return; }
  if(editDrag){ const h=editDrag; editDrag=null; viewCv.style.cursor=''; const D=S.dragEdit; drawView(); if(D && D.drop){ Promise.resolve(D.drop(h)).catch(err=>console.warn('drag edit failed', err)); } return; }
  dragging=false;viewCv.classList.remove('drag');});
viewCv.addEventListener('wheel',e=>{e.preventDefault();
  const r=viewport.getBoundingClientRect();
  zoomAt(e.clientX-r.left,e.clientY-r.top, e.deltaY<0?1.16:1/1.16);
},{passive:false});
$('zIn').onclick =()=>{const r=viewport.getBoundingClientRect();zoomAt(r.width/2,r.height/2,1.3);};
$('zOut').onclick=()=>{const r=viewport.getBoundingClientRect();zoomAt(r.width/2,r.height/2,1/1.3);};
$('zFit').onclick=fitView;
addEventListener('resize',resizeView);
