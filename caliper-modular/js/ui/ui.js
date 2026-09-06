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
import { columnsToJson } from '../columns/columns.js';
import { bordersToJson } from '../borderlayout/borderlayout.js';

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
bind('kBorder','vKB',v=>(+v).toFixed(2));
// Border-detection (solid rules)
bind('bMinLenF',   'vBMinLenF',   v=>(+v).toFixed(2));
bind('bMaxGapH',   'vBMaxGapH',   v=>v+' px');
bind('bMaxGapV',   'vBMaxGapV',   v=>v+' px');
bind('bOpenH',     'vBOpenH',     v=>v+' px');
bind('bOpenV',     'vBOpenV',     v=>v+' px');
bind('bMaxThick',  'vBMaxThick',  v=>v+' px');
bind('bMinCov',    'vBMinCov',    v=>(+v).toFixed(2));
bind('bSmoothR',   'vBSmoothR',   v=>String(v));
// Border-detection (dashed rules)
bind('bDotMaxSize','vBDotMaxSize',v=>v+' px');
bind('bDotMinDots','vBDotMinDots',v=>String(v));
bind('bDotStrideR','vBDotStrideR',v=>(+v).toFixed(1));
bind('bDashMinLenF','vBDashMinLenF',v=>(+v).toFixed(2));
bind('rr','vR',v=>(+v).toFixed(2));
bind('brMinLen','vBrMinLen',v=>(+v).toFixed(2));
bind('brSectionLen','vBrSectionLen',v=>(+v).toFixed(2));
bind('tlMinH','vTlMinH',v=>(+v).toFixed(2));
bind('tlMaxH','vTlMaxH',v=>(+v).toFixed(2));
bind('tlMaxAsp','vTlMaxAsp',v=>v);
bind('tlGap','vTlGap',v=>(+v).toFixed(2));
bind('tlOverlap','vTlOverlap',v=>(+v).toFixed(2));
bind('tlMinChars','vTlMinChars',v=>v);
bind('clMinPieces','vClMinPieces',v=>v);
bind('clRowGap','vClRowGap',v=>v);
bind('clMergeGap','vClMergeGap',v=>v);
bind('clGutterW','vClGutterW',v=>(+v).toFixed(2));
bind('clGutterCov','vClGutterCov',v=>(+v).toFixed(2));
bind('skewMax','vSkew',v=>v+'°');
bind('dilHa','vDilHa',v=>v+' px');
bind('dilVa','vDilVa',v=>v+' px');
bind('minA','vMin',v=>v+' px');
bind('hSplitF','vHSplit',v=>(+v).toFixed(2));
bind('hMinF','vHMin',v=>(+v).toFixed(2));
bind('lineDilH','vLineDilH',v=>v+' px');
bind('lineDilV','vLineDilV',v=>v+' px');
bind('fullOverlap','vFullOverlap',v=>(+v).toFixed(2));
bind('asp','vAsp',v=>v);
bind('fill','vFill',v=>(+v).toFixed(2));
bind('len','vLen',v=>(+v).toFixed(2));
bind('amax','vArea',v=>(+v).toFixed(2));
bind('splitRatio','vSplit',v=>(+v).toFixed(2)+'×');
bind('densityThresh','vDens',v=>(+v).toFixed(2));
bind('tableSens','vTab',v=>v);
bind('rowDilH','vRowDilH',v=>v+' px');
bind('rowDilV','vRowDilV',v=>v+' px');
bind('rowEroH','vRowEroH',v=>v+' px');
bind('rowEroV','vRowEroV',v=>v+' px');
bind('colDilH','vColDilH',v=>v+' px');
bind('colDilV','vColDilV',v=>v+' px');
bind('colEroH','vColEroH',v=>v+' px');
bind('colEroV','vColEroV',v=>v+' px');
$('detectTable').addEventListener('change',e=>{$('tableOpts').style.opacity=e.target.checked?1:.4;
  $('tableSens').disabled=!e.target.checked;});
$('splitMerged').addEventListener('change',e=>{$('splitOpts').style.opacity=e.target.checked?1:.4;
  $('splitOpts').style.pointerEvents=e.target.checked?'auto':'none';});
$('densityFilter').addEventListener('change',e=>{$('densityOpts').style.opacity=e.target.checked?1:.4;
  $('densityOpts').style.pointerEvents=e.target.checked?'auto':'none';});
$('conn').querySelectorAll('button').forEach(b=>b.onclick=()=>{
  $('conn').querySelectorAll('button').forEach(x=>x.classList.remove('on'));b.classList.add('on');});
$('heightFilter').addEventListener('change',e=>{$('heightOpts').style.opacity=e.target.checked?1:.4;
  $('heightOpts').style.pointerEvents=e.target.checked?'auto':'none';});
$('lineBlobs').addEventListener('change',e=>{$('lineOpts').style.opacity=e.target.checked?1:.4;
  $('lineOpts').style.pointerEvents=e.target.checked?'auto':'none';});
$('fullLines').addEventListener('change',e=>{$('fullOpts').style.opacity=e.target.checked?1:.4;
  $('fullOpts').style.pointerEvents=e.target.checked?'auto':'none';});
$('tlEnable').addEventListener('change',e=>{$('tlOpts').style.opacity=e.target.checked?1:.4;
  $('tlOpts').style.pointerEvents=e.target.checked?'auto':'none';});
$('clEnable').addEventListener('change',e=>{$('clOpts').style.opacity=e.target.checked?1:.4;
  $('clOpts').style.pointerEvents=e.target.checked?'auto':'none';});
$('brEnable').addEventListener('change',e=>{$('brOpts').style.opacity=e.target.checked?1:.4;
  $('brOpts').style.pointerEvents=e.target.checked?'auto':'none';});
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
  const prm=readParams();
  const spaceA = prm.rectify ? 'rectified image' : 'original image';
  const out={
    image:{width:S.W,height:S.H,source:{width:S.srcW,height:S.srcH},
           resized:!!S.scaledFrom, rectified:prm.rectify, skewAngleDeg:+S.angle.toFixed(3)},
    params:prm,
    borders: bordersToJson(S.borders),
    textLines: S.textLines ? {
      space:spaceA,
      lines:S.textLines.chains.filter(c=>c.accepted).map(c=>({bbox:ib(c.bb), glyphs:c.members.length})),
      fullLines:S.textLines.rows.rows.map(r=>({bbox:ib(r.bb), pieces:r.lines.length, glyphs:r.words,
        polygon:r.poly.map(q=>[Math.round(q.x),Math.round(q.y)]),
        centerline:r.centerline.map(q=>[Math.round(q.x),+q.y.toFixed(1)])}))
    } : null,
    columns: Object.assign(columnsToJson(S.columns), S.columns&&S.columns.band ? {space:spaceA} : {}),
    beforeRotate:{ space:spaceA, count:boxesOf(A).length, boxes:boxesOf(A),
      lines:(A.lines?A.lines.lines:[]).map(ln=>({bbox:ib(ln.bb), ink:ib(ln.ink), words:ln.words.length})),
      fullLines:(A.rows?A.rows.rows:[]).map(r=>({bbox:ib(r.bb), ink:ib(r.ink), pieces:r.lines.length, words:r.words,
        polygon:(r.poly||[]).map(q=>[Math.round(q.x),Math.round(q.y)]),
        centerline:(r.centerline||[]).map(q=>[Math.round(q.x),+q.y.toFixed(1)])})) },
    afterRotate: { space:'deskewed image',  count:boxesOf(B).length, boxes:boxesOf(B) },
    table: tableJson(B)
  };
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));
  a.download='caliper_obb.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};
