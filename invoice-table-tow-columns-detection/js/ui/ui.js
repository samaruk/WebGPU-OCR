/* ======================================================================
   UI WIRING
   Why: keeps every human-facing control in one place. Binds each slider /
   checkbox to its live value label and enable/disable behaviour, and the
   Run and export buttons to their actions, so the image-processing modules
   never touch the DOM control tree.
   ====================================================================== */
import { $, stageCap, legendEl, runBtn, savePng, saveJson } from '../dom/dom.js';
import { S } from '../state/state.js';
import { STAGES } from '../config/config.js';
import { fmtDeg, runPipeline, readParams } from '../pipeline/pipeline.js';

/* =====================================================================
   UI WIRING
   ===================================================================== */
export function setStageCap(i){
  if(i<0){ stageCap.innerHTML='<b>SOURCE</b> — raw image preview. Run the pipeline.';
    legendEl.classList.remove('show'); return; }
  const st=STAGES[i];
  let cap=`<b>${st.name}</b> — ${st.desc}`;
  if(st.kind==='deskewed' && S.deskewCanvas){
    cap += Math.abs(S.angle)>1e-3
      ? `  ·  found skew <b>${fmtDeg(S.angle)}</b>, rotated back <b>${fmtDeg(-S.angle)}</b>.`
      : `  ·  no skew correction applied.`;
  }
  stageCap.innerHTML=cap;
  legendEl.classList.toggle('show', st.kind==='obb');
  $('hud').style.display='flex';
}

/* slider value labels */
export const bind=(id,el,fmt)=>{const o=$(id);const u=()=>$(el).textContent=fmt(o.value);o.addEventListener('input',u);u();};
bind('win','vWin',v=>v+' px');
bind('k','vK',v=>(+v).toFixed(2));
bind('rr','vR',v=>(+v).toFixed(2));
bind('skewMax','vSkew',v=>v+'°');
bind('dilHa','vDilHa',v=>v+' px');
bind('dilVa','vDilVa',v=>v+' px');
bind('dilHb','vDilHb',v=>v+' px');
bind('dilVb','vDilVb',v=>v+' px');
bind('minA','vMin',v=>v+' px');
bind('asp','vAsp',v=>v);
bind('fill','vFill',v=>(+v).toFixed(2));
bind('len','vLen',v=>(+v).toFixed(2));
bind('amax','vArea',v=>(+v).toFixed(2));
bind('splitRatio','vSplit',v=>(+v).toFixed(2)+'×');
bind('tableSens','vTab',v=>v);
bind('rowDilH','vRowDil',v=>v+' px');
bind('colDilV','vColDil',v=>v+' px');
$('detectTable').addEventListener('change',e=>{$('tableOpts').style.opacity=e.target.checked?1:.4;
  $('tableSens').disabled=!e.target.checked;});
$('rlsa').addEventListener('change',e=>{$('rlsaOpts').style.opacity=e.target.checked?1:.4;
  $('rowDilH').disabled=!e.target.checked; $('colDilV').disabled=!e.target.checked;});
$('splitMerged').addEventListener('change',e=>{$('splitOpts').style.opacity=e.target.checked?1:.4;
  $('splitOpts').style.pointerEvents=e.target.checked?'auto':'none';});
$('conn').querySelectorAll('button').forEach(b=>b.onclick=()=>{
  $('conn').querySelectorAll('button').forEach(x=>x.classList.remove('on'));b.classList.add('on');});
$('rmNon').addEventListener('change',e=>{$('nonOpts').style.opacity=e.target.checked?1:.4;
  $('nonOpts').style.pointerEvents=e.target.checked?'auto':'none';});
$('deskew').addEventListener('change',e=>{$('deskewOpts').style.opacity=e.target.checked?1:.4;
  $('deskewOpts').style.pointerEvents=e.target.checked?'auto':'none';});

runBtn.onclick=runPipeline;

/* exports */
savePng.onclick=()=>{
  if(!S.stageCv)return;
  S.stageCv.toBlob(b=>{
    const a=document.createElement('a');
    a.href=URL.createObjectURL(b);
    a.download='caliper_'+STAGES[S.stage].id+'.png'; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  });
};
saveJson.onclick=()=>{
  if(!S.passes.B || !S.passes.B.blobs.length) return;
  const boxesOf=pass=>{
    const out=[];
    for(const b of pass.blobs) for(const pt of b.parts){
      if(!pt.accepted) continue;
      out.push({area:pt.area, fill:+pt.fill.toFixed(3), aspect:+pt.aspect.toFixed(2),
        split:!!pt.split,
        obb:{cx:+pt.cx.toFixed(2),cy:+pt.cy.toFixed(2),
          w:+pt.w.toFixed(2),h:+pt.h.toFixed(2),
          angleDeg:+(pt.angle*180/Math.PI).toFixed(2),
          // corners ordered ~TL, TR, BR, BL (clockwise, screen space)
          corners:pt.corners.map(c=>[+c.x.toFixed(2),+c.y.toFixed(2)])}});
    }
    return out;
  };
  const A=S.passes.A, B=S.passes.B;
  const ib=b=>b?{x0:Math.round(b.x0),y0:Math.round(b.y0),
                 x1:Math.round(b.x1),y1:Math.round(b.y1)}:null;
  const tableJson=pass=>{
    const L=pass&&pass.layout;
    if(!L||!L.table) return {detected:false};
    return {
      detected:true, space:'deskewed image',
      region:ib(L.table),
      rowCount:L.rows.length, columnCount:L.cols.length,
      columnHeaderRow:L.colHeader,
      rows:L.rows.map(r=>ib(r)),
      columns:L.cols.map(c=>ib(c)),
      header:ib(L.header), footer:ib(L.footer)
    };
  };
  const out={
    image:{width:S.W,height:S.H,source:{width:S.srcW,height:S.srcH},
           resized:!!S.scaledFrom, skewAngleDeg:+S.angle.toFixed(3)},
    params:readParams(),
    beforeRotate:{ space:'original image',  count:boxesOf(A).length, boxes:boxesOf(A) },
    afterRotate: { space:'deskewed image',  count:boxesOf(B).length, boxes:boxesOf(B) },
    table: tableJson(B)
  };
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));
  a.download='caliper_obb.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};
