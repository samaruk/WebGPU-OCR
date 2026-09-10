/* ======================================================================
   UI WIRING
   Why: keeps every human-facing control in one place. Binds each slider
   to its live value label, each section's enable checkbox to its option
   block, and the Run / export buttons to their actions, so the analysis
   modules never touch the control tree.
   ====================================================================== */
import { $, stageCap, runBtn, savePng, saveJson } from '../dom/dom.js';
import { S } from '../state/state.js';
import { STAGES } from '../config/config.js';
import { runPipeline, readParams } from '../pipeline/pipeline.js';
import { columnsToJson } from '../columns/columns.js';
import { bordersToJson } from '../borderlayout/borderlayout.js';
import { removeWatermark } from '../watermark/watermark.js';
import { finalTableJson } from '../final/final.js';
import { resetResults, previewImage } from '../imageload/imageload.js';

/* stage caption under the viewport (-1 = raw preview before a run) */
export function setStageCap(index,note){
  if(index<0){ stageCap.innerHTML='<b>SOURCE</b> — '+(note||'raw image preview')+'. Run the pipeline.'; return; }
  const stage=STAGES[index];
  stageCap.innerHTML=`<b>${stage.name}</b> — ${stage.desc}`;
  $('hud').style.display='flex';
}

/* slider value labels: a slider `id` writes its formatted value into `idVal` */
const bind=(id,format)=>{ const input=$(id), label=$(id+'Val');
  const update=()=>label.textContent=format(input.value); input.addEventListener('input',update); update(); };
const px=v=>v+' px', two=v=>(+v).toFixed(2), one=v=>(+v).toFixed(1), raw=v=>String(v);
bind('sauvolaWindow',px); bind('sauvolaK',two); bind('sauvolaR',two); bind('minArea',px);
bind('rulesK',two); bind('rulesMinLength',two); bind('rulesGapH',px); bind('rulesGapV',px);
bind('rulesOpenH',px); bind('rulesOpenV',px); bind('rulesMaxThickness',px); bind('rulesMinCoverage',two);
bind('rulesSmoothing',raw); bind('rulesDotMaxSize',px); bind('rulesDotMinCount',raw); bind('rulesDotStride',one);
bind('rulesDashedMinLength',two);
bind('bordersLongRule',two); bind('bordersSectionRule',two);
bind('tlMinGlyphHeight',two); bind('tlMaxGlyphHeight',two); bind('tlMaxGlyphAspect',raw);
bind('tlChainGap',two); bind('tlMinOverlap',two); bind('tlMinGlyphs',raw);
bind('clMinPieces',raw); bind('clRowGap',raw); bind('clMergeGap',raw); bind('clGutterWidth',two); bind('clGutterCoverage',two);
bind('chJoinOverlap',two); bind('chSplitRatio',two); bind('chValleyDepth',two); bind('chMinWidth',two);
bind('rcTargetHeight',px); bind('wmContrast',two);

/* the Final table · JSON panel (section 07): refreshed whenever the
   final table is (after a run and again when the API answer lands) */
export function updateFinalJson(){
  document.dispatchEvent(new Event('finalchanged'));   // the editable-table panel rebuilds when shown
  const pre=$('finalJson'), btn=$('copyFinalJson');
  if(!S.final || !S.final.grid){ pre.textContent=S.final&&S.final.note?S.final.note:'no final table yet — run the pipeline'; btn.disabled=true; return; }
  pre.textContent=JSON.stringify(finalTableJson(S.final),null,1); btn.disabled=false;
}
$('copyFinalJson').onclick=()=>{ const t=$('finalJson').textContent; navigator.clipboard.writeText(t).then(()=>{ $('copyFinalJson').textContent='Copied'; setTimeout(()=>$('copyFinalJson').textContent='Copy JSON',1200); }); };

/* Remove watermark / Restore original: swaps the image the pipeline
   starts from (S.origCanvas) between the raw load and the cleaned copy,
   shows it in the viewport and drops every result of the previous run */
$('removeWm').onclick=()=>{
  if(!S.rawImageData) return;
  const button=$('removeWm');
  if(S.watermark){
    S.origCanvas=S.rawCanvas; S.origImageData=S.rawImageData; S.watermark=null;
    button.textContent='Remove watermark';
    resetResults(); previewImage(S.origCanvas,'original restored');
    return;
  }
  button.disabled=true; button.textContent='removing…';
  setTimeout(()=>{                                   // let the label paint before the CPU work
    try{
      const r=removeWatermark(S.rawImageData,{contrast:+$('wmContrast').value});
      S.origCanvas=r.canvas; S.origImageData=r.imageData; S.watermark=r.stats;
      resetResults();
      previewImage(S.origCanvas,'watermark removed in '+Math.round(r.stats.ms)+' ms — '+r.stats.watermarkPixels.toLocaleString()+' px returned to paper (contrast ≤ '+r.stats.contrast.toFixed(2)+')');
      button.textContent='Restore original';
    }catch(e){ button.textContent='Remove watermark'; throw e; }
    finally{ button.disabled=false; }
  },20);
};

/* enable checkboxes dim their option block */
const gate=(checkboxId,blockId)=>$(checkboxId).addEventListener('change',e=>{
  $(blockId).style.opacity=e.target.checked?1:.4; $(blockId).style.pointerEvents=e.target.checked?'auto':'none'; });
gate('bordersEnable','bordersOptions'); gate('tlEnable','tlOptions'); gate('clEnable','clOptions');
gate('chEnable','chOptions'); gate('rcEnable','rcOptions'); gate('apiEnable','apiOptions');

/* connectivity segmented button */
$('connectivity').querySelectorAll('button').forEach(b=>b.onclick=()=>{
  $('connectivity').querySelectorAll('button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); });

runBtn.onclick=runPipeline;

/* exports */
savePng.onclick=()=>{
  if(!S.stageCv) return;
  S.stageCv.toBlob(blob=>{
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='caliper_'+STAGES[S.stage].id+'.png'; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  });
};
saveJson.onclick=()=>{
  if(!S.textLines && !S.borders) return;
  const box=b=>b?{x0:Math.round(b.x0),y0:Math.round(b.y0),x1:Math.round(b.x1),y1:Math.round(b.y1)}:null;
  const params=readParams();
  const TL=S.textLines;
  const out={
    image:{width:S.W,height:S.H,source:{width:S.srcW,height:S.srcH},resized:!!S.scaledFrom,
           rectified:params.rectify, space:params.rectify?'rectified image':'original image',
           watermarkRemoved:S.watermark?{contrast:S.watermark.contrast,window:S.watermark.window,pixels:S.watermark.watermarkPixels}:null},
    params,
    borders:bordersToJson(S.borders),
    textLines: TL ? {
      pageTiltDeg:+(Math.atan(TL.stats.slope)*180/Math.PI).toFixed(3),
      lines:TL.chains.filter(c=>c.accepted).map(c=>({bbox:box(c.bb), glyphs:c.members.length})),
      fullLines:TL.fullLines.rows.map(r=>({bbox:box(r.bb), pieces:r.lines.length, glyphs:r.words,
        polygon:r.poly.map(q=>[Math.round(q.x),Math.round(q.y)]),
        centerline:r.centerline.map(q=>[Math.round(q.x),+q.y.toFixed(1)])}))
    } : null,
    columns:columnsToJson(S.columns),
    characters: S.characters ? S.characters.characters.map(ch=>({line:ch.line, index:ch.index, bbox:box(ch.bb), kind:ch.kind,
      cell:ch.cell||null, text:ch.text||null, confidence:ch.confidence!==undefined?+ch.confidence.toFixed(1):null})) : null,
    recognition: (S.recognition&&S.recognition.available) ? {
      language:S.recognition.language, recognised:S.recognition.recognised,
      lines:S.recognition.lines.map(l=>({row:l.rowIndex+1, text:l.text, confidence:+l.confidence.toFixed(1)})),
      tableCells:S.recognition.cells
    } : null,
    api: S.api ? {status:S.api.status, url:S.api.url, roundTripMs:Math.round(S.api.ms), error:S.api.error, response:S.api.response} : null,
    finalTable: S.final ? finalTableJson(S.final) : null,
    final: S.final ? {source:S.final.source, note:S.final.note, header:S.final.header?{labels:S.final.header.labels, rule:S.final.header.rule}:null, localTable:S.final.localTable, apiTable:S.final.apiTable, stats:S.final.stats, fields:S.final.fields,
      rows:S.final.rows ? S.final.rows.map(r=>r.source) : null,
      cells:S.final.grid ? S.final.grid.map(row=>row.map(g=>({text:g.text, source:g.source, local:g.local, api:g.api,
        localConfidence:+g.localConf.toFixed(1), apiConfidence:+g.apiConf.toFixed(1), bbox:box(g.bb)}))) : null} : null
  };
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));
  a.download='caliper_layout.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};
