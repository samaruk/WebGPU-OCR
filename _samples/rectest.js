/* local recognition accuracy check: each crop style against the API's cells */
import { S } from '/caliper-modular/js/state/state.js';
import { segmentCharacters, assignCells } from '/caliper-modular/js/characters/characters.js';
import { recognizeText, refineCellsByColumn, buildCellTexts } from '/caliper-modular/js/recognition/recognition.js';
import { matchHeaderRule, applyHeaderRule } from '/caliper-modular/js/headerrule/headerrule.js';
import { buildFinal } from '/caliper-modular/js/final/final.js';

export async function runStyle(cropStyle,targetHeight=40,onProgress=null,psm=7,cellPass=false){
  const t0=performance.now();
  const p=(await import('/caliper-modular/js/pipeline/pipeline.js')).readParams();
  S.characters=segmentCharacters(S.textLines,S.columns,S.W,S.H,p.characters);
  S.recognition=await recognizeText(S.textLines,S.characters,S.columns,S.W,S.H,{language:'eng',targetHeight,cropStyle,psm},onProgress);
  let cellInfo=null;
  if(cellPass){ const m=matchHeaderRule(S.columns,S.recognition,S.api); if(m && applyHeaderRule(S.columns,m)){ S.characters.stats.inCells=assignCells(S.characters.characters,S.columns); S.recognition.cells=buildCellTexts(S.characters,S.columns,S.textLines.stats.reference||20); }
    await refineCellsByColumn(S.recognition,S.textLines,S.characters,S.columns,S.W,S.H,{language:'eng',targetHeight},onProgress); cellInfo=S.recognition.cellPass; }
  const F=buildFinal(); S.final=F;
  const lines=S.recognition.lines.filter(l=>l.rowIndex>=0 && l.text);
  const meanConf=lines.length?lines.reduce((s,l)=>s+l.confidence,0)/lines.length:0;
  const styles={}; for(const r of S.textLines.fullLines.rows) if(r.cropStyleUsed) styles[r.cropStyleUsed]=(styles[r.cropStyleUsed]||0)+1;
  return {cropStyle, psm, targetHeight, cellPass:cellInfo, hasLuma:!!S.textLines.luma, ms:Math.round(performance.now()-t0), available:S.recognition.available, error:S.recognition.error||null, lines:lines.length, meanConf:+meanConf.toFixed(1),
          both:F.stats?F.stats.both:0, agreed:F.stats?F.stats.agreed:0, agreement:F.stats?+(100*F.stats.agreement).toFixed(1):0, stylesUsed:styles,
          sample:F.grid?F.grid.slice(0,4).map(r=>r.map(g=>g.local).join(' | ')):[]};
}
