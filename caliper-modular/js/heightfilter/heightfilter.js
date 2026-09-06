/* ======================================================================
   COMPONENT HEIGHT FILTER  ·  one component = one glyph, word or line
   Why: connected components of a healed binary still contain stray
   structures — specks, halftone dots, rules, box borders, logos, and two
   text lines fused by a pen mark. This filter works purely on component
   geometry, before any line is built:
     1. a component taller than splitFrac × reference height is projected
        onto Y and cut at every genuine ink valley, so a multi-line merge
        becomes one component per line (each piece is re-labelled and
        re-split into connected components, the bridge rows are dropped);
     2. every component (original or piece) is then kept only if its
        height lies inside [minFrac, maxFrac] × reference and it is not
        rule-shaped (width / height above maxAspect).
   ====================================================================== */
import { cca } from '../cca/cca.js';
import { smooth1d, median } from '../morph/morph.js';

/* status codes, shared with the renderer */
export const HF_KEPT=0, HF_TALL=1, HF_SMALL=2, HF_RULE=3, HF_SPLIT=4, HF_PARENT=5;

/* Recursive valley search on the smoothed row profile of one component.
   rows y0..y1 are inclusive indices into `profile`; a cut is accepted when
   the deepest interior row is below 42 % of the lower neighbouring peak
   and both sides keep at least minRows rows. The cut is widened into the
   near-empty run around it (below 20 % of that peak) — the bridge rows
   between two lines — and `out` receives [first,last] row ranges.      */
function findValleys(profile,y0,y1,minRows,mergeRows,out){
  if(y1-y0+1<=mergeRows) return;                 // short enough to be one line
  let best=-1, bestValue=Infinity;
  for(let t=y0+minRows;t<=y1-minRows;t++) if(profile[t]<bestValue){ bestValue=profile[t]; best=t; }
  if(best<0) return;
  let leftPeak=0, rightPeak=0;
  for(let t=y0;t<best;t++) if(profile[t]>leftPeak) leftPeak=profile[t];
  for(let t=best+1;t<=y1;t++) if(profile[t]>rightPeak) rightPeak=profile[t];
  const peak=Math.min(leftPeak,rightPeak);
  if(!(peak>0) || bestValue>=0.42*peak) return;  // no genuine gap
  const low=Math.max(bestValue,0.20*peak);
  let a=best, b=best;
  while(a-1>y0+minRows-1 && profile[a-1]<=low) a--;
  while(b+1<y1-minRows+1 && profile[b+1]<=low) b++;
  findValleys(profile,y0,a-1,minRows,mergeRows,out);
  out.push([a,b]);
  findValleys(profile,b+1,y1,minRows,mergeRows,out);
}

/* Cut one component into the row bands between the valley ranges and
   relabel each band's connected components as new components. Pixels in
   a valley range keep the parent's label (no child owns them). Returns
   the child components.                                                  */
function splitComponent(comp,labels,W,valleys,allocLabel,minArea,connectivity8){
  const bb=comp.bb, label=comp.label, cropW=bb.x1-bb.x0+1;
  const bands=[]; let prev=bb.y0;
  for(const [a,b] of valleys){ bands.push([prev,a-1]); prev=b+1; }
  bands.push([prev,bb.y1]);
  const children=[];
  for(const [ya,yb] of bands){
    if(yb<ya) continue;
    const cropH=yb-ya+1, crop=new Uint8Array(cropW*cropH);
    let any=false;
    for(let y=ya;y<=yb;y++){ const row=y*W, cropRow=(y-ya)*cropW;
      for(let x=bb.x0;x<=bb.x1;x++) if(labels[row+x]===label){ crop[cropRow+x-bb.x0]=1; any=true; } }
    if(!any) continue;
    const cc=cca(crop,cropW,cropH,connectivity8);
    const newLabel=new Int32Array(cc.count).fill(-1);
    for(let l=0;l<cc.count;l++){
      if(cc.area[l]<minArea) continue;
      const nl=allocLabel();
      newLabel[l]=nl;
      children.push({label:nl,area:cc.area[l],
        bb:{x0:cc.bx0[l]+bb.x0,y0:cc.by0[l]+ya,x1:cc.bx1[l]+bb.x0,y1:cc.by1[l]+ya},
        start:((cc.start[l]/cropW)|0)*W + ya*W + (cc.start[l]%cropW) + bb.x0,
        fromSplit:true, parent:comp});
    }
    for(let y=ya;y<=yb;y++){ const row=y*W, cropRow=(y-ya)*cropW;
      for(let x=bb.x0;x<=bb.x1;x++){
        const l=cc.labels[cropRow+x-bb.x0];
        if(l>=0) labels[row+x]=newLabel[l];       // -1 for sub-min-area fragments
      } }
  }
  return children;
}

/* Main entry — mutates `labels` in place when components are split.
     components : [{label, area, bb, start}] after the min-area filter
     labels     : Int32Array label map (W*H) from cca
     ink        : Uint8Array raw binary (W*H) — valleys are measured on ink
     opts       : { minFrac, splitFrac, maxFrac?, maxAspect, minArea,
                    connectivity8, labelCount, referenceHeight? }
                  maxFrac defaults to splitFrac (one line at most);
                  referenceHeight overrides the median component height.
   Returns { kept, labelToKept, labelToAll, all, labelCount, summary }.   */
export function filterComponentsByHeight(components,labels,ink,W,H,opts){
  const all=components.slice();
  let reference=opts.referenceHeight>0?opts.referenceHeight:0;
  if(!reference) reference=median(components.map(c=>c.bb.y1-c.bb.y0+1));
  const minHeight=reference*opts.minFrac, splitHeight=reference*opts.splitFrac;
  const maxHeight=opts.maxFrac>0 ? reference*opts.maxFrac : splitHeight;
  const minRows=Math.max(2,Math.round(minHeight)), mergeRows=Math.max(3,Math.round(splitHeight));
  const smoothWindow=Math.max(3,(Math.round(reference*0.13)|1));

  let labelCount=opts.labelCount;
  const allocLabel=()=>labelCount++;
  const items=[];                                  // {bb,label,status} for the renderer
  const kept=[];
  let small=0, tall=0, rule=0, splitParents=0, splitChildren=0;

  const classify=(comp,isChild)=>{
    const h=comp.bb.y1-comp.bb.y0+1, w=comp.bb.x1-comp.bb.x0+1;
    let status;
    if(h<minHeight){ status=HF_SMALL; small++; }
    else if(h>maxHeight){ status=HF_TALL; tall++; }
    else if(opts.maxAspect>0 && w/h>opts.maxAspect){ status=HF_RULE; rule++; }
    else { status=isChild?HF_SPLIT:HF_KEPT; kept.push(comp); if(isChild) splitChildren++; }
    comp.heightStatus=status;
    items.push({bb:comp.bb,label:comp.label,status});
  };

  for(const comp of components.slice()){
    const h=comp.bb.y1-comp.bb.y0+1;
    if(reference>0 && h>splitHeight && h>=2*minRows+1){
      const y0=comp.bb.y0, profile=new Float32Array(h);
      for(let y=y0;y<=comp.bb.y1;y++){ const row=y*W; let n=0;
        for(let x=comp.bb.x0;x<=comp.bb.x1;x++){ const i=row+x; if(labels[i]===comp.label && ink[i]) n++; }
        profile[y-y0]=n; }
      const smooth=smooth1d(profile,smoothWindow);
      const valleys=[]; findValleys(smooth,0,h-1,minRows,mergeRows,valleys);
      if(valleys.length){
        const children=splitComponent(comp,labels,W,valleys.map(([a,b])=>[a+y0,b+y0]),allocLabel,opts.minArea,opts.connectivity8);
        comp.children=children;                    // labelToAll needs the new labels either way
        if(children.length>1){
          splitParents++;
          comp.heightStatus=HF_PARENT;
          items.push({bb:comp.bb,label:comp.label,status:HF_PARENT});
          for(const child of children) classify(child,true);
          continue;
        }
        if(children.length===1){ const child=children[0]; child.fromSplit=false; child.parent=null; classify(child,false); continue; }
      }
    }
    classify(comp,false);
  }

  const labelToKept=new Int32Array(labelCount).fill(-1);
  kept.forEach((c,i)=>labelToKept[c.label]=i);
  const labelToAll=new Int32Array(labelCount).fill(-1);
  all.forEach((c,i)=>{ labelToAll[c.label]=i; if(c.children) for(const child of c.children) labelToAll[child.label]=i; });
  const labelStatus=new Uint8Array(labelCount).fill(HF_KEPT);
  for(const it of items) labelStatus[it.label]=it.status;

  return {kept, labelToKept, labelToAll, all, labelCount,
    summary:{reference, minHeight, maxHeight, splitHeight,
      total:all.length, kept:kept.length, small, tall, rule, splitParents, splitChildren, items, labelStatus}};
}
