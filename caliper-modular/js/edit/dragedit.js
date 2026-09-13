/* ======================================================================
   DRAG EDIT  ·  column boundaries and table edges dragged in the view
   Why: the column stage and the table layout are the invoice's skeleton,
   and when the detector gets an edge wrong the operator can see exactly
   where it should be. On 22CL (Columns) every boundary between columns
   — and the two outer edges — is a handle: dragged, the two columns on
   either side take the new boundary and everything from the cells on is
   built again (the cell pass on those columns, the final table, the
   number check, the products, the stages). On 24CL (Table Layout) the
   table's top and bottom edges are handles: dragged, the band takes the
   rows the edge now covers and the columns are found again from that
   band, then the header rule, the invoice's layout and names, the cells,
   the final table, the products and the stages.
   The viewport (viewport.js) draws S.dragEdit and hands it the pointer;
   this module sets S.dragEdit for the stage on view and does the work.
   ====================================================================== */
import { S } from '../state/state.js';
import { STAGES } from '../config/config.js';
import { drawView } from '../viewport/viewport.js';
import { setStageCap } from '../ui/ui.js';
import { moveBoundary, rebuildColumns, isBusy } from './columnedit.js';
import { reapplyColumns } from '../pipeline/pipeline.js';
import { relayCurrent } from '../pages/pages.js';
import { boundariesOf, boundaryAt, clampBoundary, bandEdgeFor } from './dragmath.js';

const ACCENT='rgba(166,255,63,.95)', DIM='rgba(166,255,63,.45)', HIT_PX=7;
let working=false;

/* ---- 22CL · the column boundaries ------------------------------------------- */
function columnsEdit(C){
  const B=C.band, tolY=Math.max(12, 0.5*(C.glyphHeight||12));
  const yp=p=>p.y-C.slope*p.x;
  const state={kind:'columns', live:null,
    hit(p){ if(working) return null; const y=yp(p); if(y<B.yTop-tolY*3 || y>B.yBottom+tolY*3) return null;
      const i=boundaryAt(C.columns, C.toDeskewedX(p.x,p.y), HIT_PX/Math.max(0.02,S.view.scale)); return i>=0 ? {i} : null; },
    cursor(){ return 'col-resize'; },
    begin(h){ state.live={i:h.i, x:boundariesOf(C.columns)[h.i]}; },
    move(h,p){ state.live={i:h.i, x:clampBoundary(C.columns, h.i, C.toDeskewedX(p.x,p.y))}; },
    async drop(h){ const l=state.live; state.live=null; if(!l) return; const was=boundariesOf(C.columns)[l.i]; if(Math.abs(l.x-was)<0.5) return;
      working=true; try{ await moveBoundary(l.i, l.x); } finally { working=false; } },
    draw(ctx,v,d){ const b=boundariesOf(C.columns);
      ctx.save(); ctx.setTransform(1,0,0,1,0,0);
      b.forEach((x,i)=>{ const on=state.live && state.live.i===i; const xx=on?state.live.x:x;
        const a=C.toImage(xx,B.yTop), z=C.toImage(xx,B.yBottom);
        ctx.beginPath(); ctx.moveTo((v.tx+a.x*v.scale)*d,(v.ty+a.y*v.scale)*d); ctx.lineTo((v.tx+z.x*v.scale)*d,(v.ty+z.y*v.scale)*d);
        ctx.lineWidth=(on?3:1.5)*d; ctx.strokeStyle=on?ACCENT:DIM; ctx.setLineDash(on?[]:[4*d,4*d]); ctx.stroke(); ctx.setLineDash([]);
        const hx=(v.tx+a.x*v.scale)*d, hy=(v.ty+a.y*v.scale)*d-10*d;   // the handle: a small tab above the table
        ctx.fillStyle=on?ACCENT:'rgba(10,14,15,.85)'; ctx.strokeStyle=ACCENT; ctx.lineWidth=1.5*d;
        ctx.beginPath(); ctx.rect(hx-5*d,hy-6*d,10*d,12*d); ctx.fill(); ctx.stroke(); });
      ctx.restore(); }
  };
  return state;
}

/* ---- 24CL · the table's top and bottom edges ---------------------------------- */
function bandEdit(C){
  const B=C.band, X0=C.profile?C.profile.X0:C.columns[0].gutterX0, X1=C.profile?C.profile.X1:C.columns[C.columns.length-1].gutterX1;
  const yp=p=>p.y-C.slope*p.x;
  const state={kind:'band', live:null,
    hit(p){ if(working) return null; const xd=C.toDeskewedX(p.x,p.y); if(xd<X0-40 || xd>X1+40) return null; const y=yp(p), tol=HIT_PX/Math.max(0.02,S.view.scale);
      if(Math.abs(y-B.yTop)<=tol) return {which:'top'}; if(Math.abs(y-B.yBottom)<=tol) return {which:'bottom'}; return null; },
    cursor(){ return 'row-resize'; },
    begin(h){ state.live={which:h.which, y:h.which==='top'?B.yTop:B.yBottom}; },
    move(h,p){ state.live={which:h.which, y:yp(p)}; },
    async drop(h){ const l=state.live; state.live=null; if(!l) return;
      const r=bandEdgeFor(C.rows, B.first, B.last, l.which, l.y);
      if(r.first===B.first && r.last===B.last) return;
      working=true;
      try{ await reapplyColumns({forceBand:{first:r.first, last:r.last}});
        const all=(S.columns&&S.columns.columns||[]).map((c,i)=>i);
        await rebuildColumns('table rows set by hand: '+(r.first+1)+'–'+(r.last+1)+' ('+(l.which==='top'?'top':'bottom')+' edge dragged)', all);
        await relayCurrent();
      } finally { working=false; sync(); } },
    draw(ctx,v,d){
      ctx.save(); ctx.setTransform(1,0,0,1,0,0);
      for(const which of ['top','bottom']){ const on=state.live && state.live.which===which; const y=on?state.live.y:(which==='top'?B.yTop:B.yBottom);
        const a=C.toImage(X0,y), z=C.toImage(X1,y);
        ctx.beginPath(); ctx.moveTo((v.tx+a.x*v.scale)*d,(v.ty+a.y*v.scale)*d); ctx.lineTo((v.tx+z.x*v.scale)*d,(v.ty+z.y*v.scale)*d);
        ctx.lineWidth=(on?3:2)*d; ctx.strokeStyle=on?ACCENT:DIM; ctx.setLineDash(on?[]:[6*d,4*d]); ctx.stroke(); ctx.setLineDash([]);
        const m=C.toImage((X0+X1)/2,y); const hx=(v.tx+m.x*v.scale)*d, hy=(v.ty+m.y*v.scale)*d;
        ctx.fillStyle=on?ACCENT:'rgba(10,14,15,.85)'; ctx.strokeStyle=ACCENT; ctx.lineWidth=1.5*d;
        ctx.beginPath(); ctx.rect(hx-14*d,hy-5*d,28*d,10*d); ctx.fill(); ctx.stroke(); }
      ctx.restore(); }
  };
  return state;
}

/* the stage on view decides what is draggable */
function sync(){
  const st=STAGES[S.stage], C=S.columns;
  let next=null;
  if(st && C && C.band && C.columns && C.columns.length && S.pipelineDone && !isBusy()){
    if(st.kind==='columns') next=columnsEdit(C);
    else if(st.kind==='table') next=bandEdit(C);
  }
  S.dragEdit=next; drawView();
  if(next && st){ const cap=document.getElementById('stageCap'); if(cap && !/drag/.test(cap.textContent)) cap.innerHTML+=' <span style="color:#6edcff">· drag '+(next.kind==='columns'?'a column boundary (the tabs above the table) to move it':'the table\'s top or bottom edge to change its rows')+'; everything from there on is computed again</span>'; }
}
document.addEventListener('stagechange',()=>sync());
document.addEventListener('finalchanged',()=>{ if(S.dragEdit) sync(); });
