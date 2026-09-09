/* ======================================================================
   COLUMN EDIT  ·  right-click a column: Set name / Split column
   Why: a column can still come out wrong after the rules and the vocabulary
   have had their say — a title misread, two printed columns run together.
   The operator right-clicks the column in the view and either names it
   from the catalogue of column types (config/columntypes.js) or splits it
   at the widest gap the glyphs leave. Either way the cells are rebuilt, the
   numeric columns are read again cell by cell, the final table is rebuilt
   with the number check running under the new name's rule, the products
   are matched again and every stage redraws.
   The view shows one full-resolution stage image of the page, so a click's
   image coordinates are the same on every stage; the column under it is
   the one whose gutter bounds hold the de-skewed x.
   ====================================================================== */
import { S } from '../state/state.js';
import { viewCv, viewport } from '../dom/dom.js';
import { COLUMN_TYPES } from '../config/columntypes.js';
import { STAGES } from '../config/config.js';
import { finishColumns } from '../columns/columns.js';
import { assignCells } from '../characters/characters.js';
import { buildCellTexts, refineCellsByColumn } from '../recognition/recognition.js';
import { buildFinal } from '../final/final.js';
import { updateFinalJson } from '../ui/ui.js';
import { readParams, startProducts } from '../pipeline/pipeline.js';
import { refreshStages } from '../gallery/gallery.js';
import { findSplitGap } from './split.js';

/* ---- the menu ---------------------------------------------------------- */
const menu=document.createElement('div');
menu.id='colMenu';
menu.style.cssText='position:fixed;z-index:1000;display:none;min-width:220px;background:#101416;color:#e6f0eb;border:1px solid rgba(166,255,63,.45);border-radius:4px;box-shadow:0 6px 24px rgba(0,0,0,.6);font:12px "JetBrains Mono",monospace;padding:4px 0;';
document.body.appendChild(menu);
const item=(text,onClick,muted)=>{ const d=document.createElement('div'); d.textContent=text; d.style.cssText='padding:6px 12px;cursor:pointer;white-space:nowrap;'+(muted?'color:#8fa39a;cursor:default;':'');
  if(!muted){ d.onmouseenter=()=>d.style.background='rgba(166,255,63,.12)'; d.onmouseleave=()=>d.style.background=''; d.onclick=onClick; } return d; };
const note=text=>{ const d=document.createElement('div'); d.textContent=text; d.style.cssText='padding:4px 12px 6px;color:#8fa39a;border-bottom:1px solid rgba(166,255,63,.2);margin-bottom:2px;white-space:nowrap;max-width:420px;overflow:hidden;text-overflow:ellipsis;'; return d; };
function showMenu(x,y){ menu.style.display='block'; menu.style.left='0px'; menu.style.top='0px';
  const r=menu.getBoundingClientRect(); menu.style.left=Math.min(x,innerWidth-r.width-8)+'px'; menu.style.top=Math.min(y,innerHeight-r.height-8)+'px'; }
function hideMenu(){ menu.style.display='none'; menu.innerHTML=''; }
addEventListener('mousedown',e=>{ if(menu.style.display!=='none' && !menu.contains(e.target)) hideMenu(); });
addEventListener('keydown',e=>{ if(e.key==='Escape') hideMenu(); });

/* ---- the column under the pointer ---------------------------------------- */
function columnAt(clientX,clientY){
  const C=S.columns; if(!C || !C.columns || !C.columns.length || !S.W) return -1;
  const r=viewport.getBoundingClientRect(), v=S.view;
  const ix=(clientX-r.left-v.tx)/v.scale, iy=(clientY-r.top-v.ty)/v.scale;
  if(ix<0||iy<0||ix>S.W||iy>S.H) return -1;
  const xd=C.toDeskewedX(ix,iy);
  let ci=C.columns.findIndex(c=>xd>=c.gutterX0-1 && xd<=c.gutterX1+2);
  if(ci<0){ let bd=1/0; C.columns.forEach((c,i)=>{ const d=xd<c.gutterX0?c.gutterX0-xd:xd-c.gutterX1; if(d<bd){ bd=d; ci=i; } }); if(bd>40) return -1; }
  return ci;
}

/* ---- after an edit: cells, cell pass, final table, products, stages ------ */
let busy=false;
async function rebuild(what){
  const C=S.columns; if(!C) return;
  C.edits=(C.edits||[]).concat([what]);
  if(C.headerRule) C.headerRule.mode=(C.headerRule.mode||'').replace(/ · edited.*$/,'')+' · edited: '+C.edits.join('; ');
  busy=true;
  try{
    const p=readParams();
    if(S.characters){ S.characters.stats.inCells=assignCells(S.characters.characters,C);
      if(S.recognition && S.recognition.available && S.textLines) S.recognition.cells=buildCellTexts(S.characters,C,S.textLines.stats.reference||20); }
    if(p.recognition.enabled && p.recognition.cellPass && S.recognition && S.recognition.available && S.characters && S.textLines){
      try{ await refineCellsByColumn(S.recognition,S.textLines,S.characters,C,S.W,S.H,p.recognition,()=>{}); }catch(e){ console.warn('cell pass after the edit failed', e); } }
    if(S.pipelineDone && !(S.api && S.api.status==='pending')){ S.final=buildFinal(); updateFinalJson(); startProducts(); }
    refreshStages(STAGES.map(st=>st.kind));
  } finally { busy=false; }
}

/* ---- Set name ------------------------------------------------------------- */
function setName(ci){
  const C=S.columns, c=C.columns[ci];
  menu.innerHTML='';
  menu.appendChild(note('column '+(ci+1)+' · now: '+(c.key||'unnamed')+(c.label?' ('+c.label+')':'')));
  const sel=document.createElement('select');
  sel.style.cssText='margin:6px 12px 8px;width:calc(100% - 24px);background:#0a0e0f;color:#e6f0eb;border:1px solid rgba(166,255,63,.35);border-radius:3px;font:12px "JetBrains Mono",monospace;padding:4px;';
  const opt=(v,t)=>{ const o=document.createElement('option'); o.value=v; o.textContent=t; return o; };
  sel.appendChild(opt('','— unnamed —'));
  for(const t of COLUMN_TYPES) sel.appendChild(opt(t.key, t.label+'  ['+t.key+']'+(t.relation?'  = '+t.relation.replace(/[{}]/g,''):'')));
  sel.value=COLUMN_TYPES.some(t=>t.key===c.key)?c.key:'';
  sel.onchange=async()=>{ const key=sel.value||null, t=COLUMN_TYPES.find(x=>x.key===key);
    // the same key on another column is released: one meaning, one column
    C.columns.forEach((o,i)=>{ if(i!==ci && key && o.key===key){ o.key=null; o.label=null; o.manual=true; } });
    c.key=key; c.label=t?t.label:null; c.group=null; c.manual=true;
    hideMenu(); await rebuild('column '+(ci+1)+' → '+(key||'unnamed')); };
  menu.appendChild(sel);
  menu.appendChild(item('Cancel',hideMenu));
  sel.focus();
}

/* ---- Split column ---------------------------------------------------------- */
async function splitColumn(ci){
  const C=S.columns, c=C.columns[ci];
  const spans=[]; for(const r of C.band.rows) for(const g of r.glyphs){ const m=(g.x0+g.x1)/2; if(m>=c.gutterX0 && m<=c.gutterX1+1) spans.push([g.x0,g.x1]); }
  const gap=findSplitGap(spans,c.gutterX0,c.gutterX1,{minGap:Math.max(3,0.3*(C.glyphHeight||10)), edgeFrac:0.12});
  if(!gap){ menu.innerHTML=''; menu.appendChild(note('column '+(ci+1)+': no gap to split at — its glyphs leave no clear space inside it')); menu.appendChild(item('Close',hideMenu)); return; }
  const left={x0:c.gutterX0, x1:gap.x0-1, gutterX0:c.gutterX0, gutterX1:gap.x0-1, glyphs:0, key:null, label:null, group:null, found:false, title:'', manual:true};
  const right={x0:gap.x1+1, x1:c.gutterX1, gutterX0:gap.x1+1, gutterX1:c.gutterX1, glyphs:0, key:null, label:null, group:null, found:false, title:'', manual:true};
  // a numeric key on the parent is more often the right-hand part's (the left is the new-found neighbour) — the operator names them anyway
  const cols=C.columns.slice(0,ci).concat([left,right],C.columns.slice(ci+1));
  finishColumns(C,cols);
  C.gutters=(C.gutters||[]).concat([{x0:gap.x0, x1:gap.x1, width:gap.width, relative:false, manual:true}]).sort((p,q)=>p.x0-q.x0);
  hideMenu(); await rebuild('column '+(ci+1)+' split at x='+Math.round((gap.x0+gap.x1)/2));
}

/* ---- the right-click ------------------------------------------------------- */
viewCv.addEventListener('contextmenu',e=>{
  const ci=columnAt(e.clientX,e.clientY);
  if(ci<0) return;                                   // outside the table: the browser's own menu
  e.preventDefault();
  if(busy) return;
  const c=S.columns.columns[ci];
  menu.innerHTML='';
  menu.appendChild(note('column '+(ci+1)+' of '+S.columns.columns.length+' · '+(c.key||'unnamed')+(c.label?' · '+c.label:'')));
  menu.appendChild(item('Set name…',()=>setName(ci)));
  menu.appendChild(item('Split column',()=>splitColumn(ci)));
  menu.appendChild(item('Cancel',hideMenu));
  showMenu(e.clientX,e.clientY);
});
