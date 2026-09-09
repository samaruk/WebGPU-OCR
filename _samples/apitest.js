/* Browser-side check of the API stage and the FINAL stages without WebGPU:
   the CPU harness supplies the local results, the real API the answer. */
import { S } from '/caliper-modular/js/state/state.js';
import { STAGES } from '/caliper-modular/js/config/config.js';
import { renderStageInto } from '/caliper-modular/js/render/render.js';
import { segmentCharacters } from '/caliper-modular/js/characters/characters.js';
import { startApiAnalysis } from '/caliper-modular/js/api/api.js';
import { buildFinal } from '/caliper-modular/js/final/final.js';
import { runCPU } from '/_samples/harness.js?v=9';

export async function prepare(file,opts={}){
  const R=await runCPU(file,opts);
  S.W=R.W; S.H=R.H; S.origCanvas=R.canvas; S.workCanvas=R.canvas; S.lensCanvas=R.canvas;
  S.borders=R.borders; S.textLines=R.TL; S.columns=R.C;
  S.characters=segmentCharacters(R.TL,R.C,R.W,R.H,R.p.characters);
  S.recognition=null; S.api=null; S.final=null;
  return R;
}
export function callApi(url){ S.api=startApiAnalysis(S.workCanvas,url); return S.api; }
export function finalise(){ S.final=buildFinal(); return S.final; }
export function renderKind(kind){
  const st=STAGES.find(s=>s.kind===kind); const cv=document.createElement('canvas'); cv.width=S.W; cv.height=S.H;
  renderStageInto(st,cv.getContext('2d'),S.W,S.H); return cv;
}
export function show(kind,scale=0.5){
  const cv=renderKind(kind); const out=document.createElement('canvas'); out.width=Math.round(cv.width*scale); out.height=Math.round(cv.height*scale);
  out.getContext('2d').drawImage(cv,0,0,out.width,out.height);
  let host=document.getElementById('__apitest'); if(!host){ host=document.createElement('div'); host.id='__apitest'; host.style.cssText='position:fixed;inset:0;z-index:99999;background:#111;overflow:auto'; document.body.appendChild(host); }
  host.innerHTML=''; host.appendChild(out); return out;
}
