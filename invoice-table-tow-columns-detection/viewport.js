/* ======================================================================
   VIEWPORT  ·  pan / zoom blitter
   Why: a scanned page is far larger than the screen; the operator must be
   able to inspect individual word boxes at pixel scale. This blitter stays
   independent of *which* stage is shown — it only pans/zooms the current
   offscreen canvas.
   ====================================================================== */
import { S } from './state.js';
import { $, viewport, viewCv } from './dom.js';

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
viewCv.addEventListener('mousedown',e=>{dragging=true;lx=e.clientX;ly=e.clientY;viewCv.classList.add('drag');});
addEventListener('mousemove',e=>{if(!dragging)return;S.view.tx+=e.clientX-lx;S.view.ty+=e.clientY-ly;lx=e.clientX;ly=e.clientY;drawView();});
addEventListener('mouseup',()=>{dragging=false;viewCv.classList.remove('drag');});
viewCv.addEventListener('wheel',e=>{e.preventDefault();
  const r=viewport.getBoundingClientRect();
  zoomAt(e.clientX-r.left,e.clientY-r.top, e.deltaY<0?1.16:1/1.16);
},{passive:false});
$('zIn').onclick =()=>{const r=viewport.getBoundingClientRect();zoomAt(r.width/2,r.height/2,1.3);};
$('zOut').onclick=()=>{const r=viewport.getBoundingClientRect();zoomAt(r.width/2,r.height/2,1/1.3);};
$('zFit').onclick=fitView;
addEventListener('resize',resizeView);
