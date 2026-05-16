/**
 * stages/13_graphMerge_phase1/adjacencyGraph.js
 * Phase 1 Graph Merge — loose thresholds to eliminate noise fragments.
 */
import { adaptiveHeuristics } from "../../adaptive/adaptiveHeuristics.js";

export async function runGraphMergePhase1(gpuCtx, ccaResult, sws, params, registry) {
  const { labelTex, componentCount } = ccaResult;
  if (componentCount < 2) return ccaResult;
  const W = labelTex.width, H = labelTex.height;
  const msw = sws.get(8);
  const imgData = await gpuCtx.downloadToImageData(labelTex);
  const labels  = new Uint32Array(W * H);
  for (let i = 0; i < W * H; i++) labels[i] = imgData.data[i * 4];
  const boxes    = buildBoundingBoxes(labels, W, H, componentCount);
  const mergeMap = new Uint32Array(componentCount + 1);
  for (let i = 0; i <= componentCount; i++) mergeMap[i] = i;
  for (let a = 1; a <= componentCount; a++) {
    for (let b = a + 1; b <= componentCount; b++) {
      if (!boxes[a] || !boxes[b]) continue;
      const gap = boxGap(boxes[a], boxes[b]);
      const normGap = adaptiveHeuristics.normalizedDistance(gap, msw);
      if (normGap < params.mergeLooseGapFactor) {
        const angle = boxAngle(boxes[a], boxes[b]);
        if (angle < params.mergeAngleLooseDeg) union(mergeMap, a, b);
      }
    }
  }
  const remapped = remapLabels(labels, mergeMap);
  const newTex   = await uploadLabels(gpuCtx, remapped, W, H, registry);
  const newCount = new Set(remapped.filter(v => v > 0)).size;
  return { labelTex: newTex, componentCount: newCount, mergeMap };
}

function boxGap(a, b) {
  const dx = Math.max(0, Math.max(a.x1,b.x1) - Math.min(a.x2,b.x2));
  const dy = Math.max(0, Math.max(a.y1,b.y1) - Math.min(a.y2,b.y2));
  return Math.sqrt(dx*dx + dy*dy);
}
function boxAngle(a, b) {
  return Math.abs(Math.atan2((a.y1+a.y2)/2-(b.y1+b.y2)/2, (a.x1+a.x2)/2-(b.x1+b.x2)/2)*180/Math.PI);
}
function find(map, x) { while(map[x]!==x){map[x]=map[map[x]]; x=map[x];} return x; }
function union(map, a, b) { const ra=find(map,a),rb=find(map,b); if(ra!==rb)map[ra]=rb; }
function buildBoundingBoxes(labels, W, H, count) {
  const boxes = [];
  for (let i=0; i<labels.length; i++) {
    const id=labels[i]; if(!id) continue;
    const x=i%W, y=Math.floor(i/W);
    if(!boxes[id]) boxes[id]={x1:x,y1:y,x2:x,y2:y};
    else { boxes[id].x1=Math.min(boxes[id].x1,x); boxes[id].y1=Math.min(boxes[id].y1,y);
           boxes[id].x2=Math.max(boxes[id].x2,x); boxes[id].y2=Math.max(boxes[id].y2,y); }
  }
  return boxes;
}
function remapLabels(labels, map) { return labels.map(id => id>0 ? find(map,id) : 0); }
async function uploadLabels(gpuCtx, labels, W, H, registry) {
  const rgba = new Uint8ClampedArray(W*H*4);
  for (let i=0; i<labels.length; i++) {
    rgba[i*4]=labels[i]&0xFF; rgba[i*4+1]=(labels[i]>>8)&0xFF;
    rgba[i*4+2]=(labels[i]>>16)&0xFF; rgba[i*4+3]=255;
  }
  return gpuCtx.uploadImageData(new ImageData(rgba, W, H));
}
