/* ======================================================================
   PASS-A BLOB HEIGHT FILTER  ·  one blob = one letter, word or line
   Why: pass A's dilation is tuned to fuse characters into words, but stray
   ink, descenders and table rules still bridge stacked lines into one
   tall component, and rules / logos / box borders survive the min-area
   filter. Section 05 fixes that at the BLOB level, before any geometry is
   computed:
     1. a blob taller than splitF × median is projected onto Y and cut at
        every genuine ink valley, so a multi-line blob becomes one blob
        per line (each piece is re-labelled and re-split into connected
        components so contour tracing still sees one component per blob);
     2. every blob (original or piece) is then kept only if its height sits
        inside [minF, splitF] × median and it is not rule-shaped
        (bounding-box width / height above maxAspect). A blob still taller
        than one line after the split attempt is a multi-line merge that
        could not be cut, and is removed rather than kept.
   Only the kept blobs go on to contours → hull → calipers → OBB.
   ====================================================================== */
import { cca } from '../cca/cca.js';
import { smooth1d } from '../splitter/splitter.js';

/* status codes shared with the renderer */
export const HF_KEPT=0, HF_TALL=1, HF_SMALL=2, HF_RULE=3, HF_SPLIT=4, HF_PARENT=5;

/* recursive valley search on the smoothed row profile. Rows y0..y1 are
   inclusive indices into `sm`. The deepest interior row is a cut only when
   it is below 42 % of the lower of the two neighbouring peaks (the same
   gate the OBB-level splitter uses) and both sides keep at least minRows
   rows. The cut is widened into the whole near-empty run around it
   (rows below 20 % of that peak) — those are the bridge rows between two
   lines, and they are dropped from BOTH pieces so a descender that touched
   the next line does not inflate either box. Each side is then searched
   again, so an n-line merge yields n-1 valleys. `out` receives [a,b]
   inclusive row ranges. */
function findCuts(sm,y0,y1,minRows,mergeRows,out){
  if(y1-y0+1<=mergeRows) return;                 // short enough to be one line
  let bi=-1,bv=Infinity;
  for(let t=y0+minRows;t<=y1-minRows;t++) if(sm[t]<bv){bv=sm[t];bi=t;}
  if(bi<0) return;
  let lp=0,rp=0;
  for(let t=y0;t<bi;t++) if(sm[t]>lp)lp=sm[t];
  for(let t=bi+1;t<=y1;t++) if(sm[t]>rp)rp=sm[t];
  const peak=Math.min(lp,rp);
  if(!(peak>0) || bv>=0.42*peak) return;         // no genuine gap
  const lowv=Math.max(bv,0.20*peak);
  let a=bi,b=bi;
  while(a-1>y0+minRows-1 && sm[a-1]<=lowv) a--;
  while(b+1<y1-minRows+1 && sm[b+1]<=lowv) b++;
  findCuts(sm,y0,a-1,minRows,mergeRows,out);
  out.push([a,b]);
  findCuts(sm,b+1,y1,minRows,mergeRows,out);
}

/* cut one blob into row bands (the rows between the valley ranges),
   relabel each band's connected components as new blobs. Pixels inside a
   valley range keep the parent's label: no child owns them, so contour
   tracing never sees them, and the renderer shows them as a removed
   bridge. Returns the child blobs (possibly empty). */
function splitBlob(bl,labels,binary,W,H,cuts,alloc,minArea,conn8){
  const bb=bl.bb, lab=bl.label, rw=bb.x1-bb.x0+1;
  const bands=[]; let prev=bb.y0;
  for(const [a,b] of cuts){ bands.push([prev,a-1]); prev=b+1; }
  bands.push([prev,bb.y1]);
  const children=[];
  for(const [ya,yb] of bands){
    if(yb<ya) continue;
    const rh=yb-ya+1, crop=new Uint8Array(rw*rh);
    let any=false;
    for(let y=ya;y<=yb;y++){ const row=y*W, crow=(y-ya)*rw;
      for(let x=bb.x0;x<=bb.x1;x++) if(labels[row+x]===lab){ crop[crow+x-bb.x0]=1; any=true; } }
    if(!any) continue;
    const cc=cca(crop,rw,rh,conn8);
    const newLab=new Int32Array(cc.count).fill(-1);
    for(let l=0;l<cc.count;l++){
      if(cc.area[l]<minArea) continue;
      const nl=alloc();
      newLab[l]=nl;
      children.push({label:nl,area:cc.area[l],
        bb:{x0:cc.bx0[l]+bb.x0,y0:cc.by0[l]+ya,x1:cc.bx1[l]+bb.x0,y1:cc.by1[l]+ya},
        start:(cc.start[l]/rw|0)*W + ya*W + (cc.start[l]%rw) + bb.x0,
        fromSplit:true, parent:bl});
    }
    // write the new labels back into the full-image label map. Pixels of
    // sub-min-area fragments are cleared so they no longer carry a label
    // that maps to nothing.
    for(let y=ya;y<=yb;y++){ const row=y*W, crow=(y-ya)*rw;
      for(let x=bb.x0;x<=bb.x1;x++){
        const l=cc.labels[crow+x-bb.x0];
        if(l<0) continue;
        labels[row+x]=newLab[l];
      } }
  }
  return children;
}

/* main entry — mutates `labels` in place when blobs are split.
     blobs  : array from runPass (label, area, bb, start), after min-area
     labels : Int32Array label map from cca (W*H)
     binary : Uint8Array Sauvola binary (W*H) — valleys are measured on ink
     opts   : {lo, split, hi?, maxAspect, minArea, conn8, count, median?}
              median = reference height override; hi = reject limit (x median)
              when it should differ from the cut threshold `split`
   Returns {blobs, lab2blob, lab2blobAll, blobsAll, count, heightFilter}. */
export function filterBlobsByHeight(blobs,labels,binary,W,H,opts){
  const blobsAll=blobs.slice();
  // reference height: caller-supplied (opts.median) or the plain median
  // of the blob heights
  let median=opts.median>0?opts.median:0;
  if(!median){ const hs=blobs.map(b=>b.bb.y1-b.bb.y0+1).sort((a,b)=>a-b); median=hs.length?hs[hs.length>>1]:0; }
  // split  = height above which a valley cut is attempted
  // hi     = optional reject limit (defaults to split: one line at most)
  const hMin=median*opts.lo, hSplit=median*opts.split;
  const hMax=opts.hi>0 ? median*opts.hi : hSplit;
  const minRows=Math.max(2,Math.round(hMin)), mergeRows=Math.max(3,Math.round(hSplit));
  const smWin=Math.max(3,(Math.round(median*0.13)|1));

  let count=opts.count;
  const alloc=()=>count++;
  const items=[];                                  // {bb,status} for the stage renderer
  const kept=[];
  let nSmall=0,nTall=0,nRule=0,nSplitParents=0,nSplitChildren=0;

  const classify=(bl,isChild)=>{
    const h=bl.bb.y1-bl.bb.y0+1, w=bl.bb.x1-bl.bb.x0+1;
    let st;
    if(h<hMin){ st=HF_SMALL; nSmall++; }
    else if(h>hMax){ st=HF_TALL; nTall++; }
    else if(opts.maxAspect>0 && w/h>opts.maxAspect){ st=HF_RULE; nRule++; }
    else { st=isChild?HF_SPLIT:HF_KEPT; kept.push(bl); if(isChild) nSplitChildren++; }
    bl.heightStatus=st;
    items.push({bb:bl.bb,label:bl.label,status:st});
  };

  const work=blobs.slice();
  for(const bl of work){
    const h=bl.bb.y1-bl.bb.y0+1;
    if(median>0 && h>hSplit && h>=2*minRows+1){
      // row profile of the blob's own INK (labels ∧ binary), smoothed
      const y0=bl.bb.y0, n=h, prof=new Float32Array(n);
      for(let y=y0;y<=bl.bb.y1;y++){ const row=y*W; let c=0;
        for(let x=bl.bb.x0;x<=bl.bb.x1;x++){ const i=row+x; if(labels[i]===bl.label && binary[i]) c++; }
        prof[y-y0]=c; }
      const sm=smooth1d(prof,smWin);
      const cuts=[]; findCuts(sm,0,n-1,minRows,mergeRows,cuts);
      if(cuts.length){
        const children=splitBlob(bl,labels,binary,W,H,cuts.map(([a,b])=>[a+y0,b+y0]),alloc,opts.minArea,opts.conn8);
        bl.children=children;              // lab2blobAll needs the new labels either way
        if(children.length>1){
          nSplitParents++;
          bl.heightStatus=HF_PARENT;
          items.push({bb:bl.bb,label:bl.label,status:HF_PARENT});
          for(const ch of children) classify(ch,true);
          continue;
        }
        // a cut that produced ≤1 component is not a real split; the label
        // map was rewritten, so adopt the single child in place of the parent
        if(children.length===1){ const ch=children[0]; ch.fromSplit=false; ch.parent=null; classify(ch,false); continue; }
      }
    }
    classify(bl,false);
  }

  // label → blob index maps. lab2blob covers the KEPT blobs (feeds the
  // geometry stages); lab2blobAll maps every label — including labels
  // written by the splitter — to its index in blobsAll (pre-filter list),
  // so the Blob Pixels stage still shows the unsplit parents.
  const lab2blob=new Int32Array(count).fill(-1);
  kept.forEach((bl,i)=>lab2blob[bl.label]=i);
  const lab2blobAll=new Int32Array(count).fill(-1);
  blobsAll.forEach((bl,i)=>{ lab2blobAll[bl.label]=i;
    if(bl.children) for(const ch of bl.children) lab2blobAll[ch.label]=i; });
  const labelStatus=new Uint8Array(count).fill(HF_KEPT);
  for(const it of items) labelStatus[it.label]=it.status;

  return {blobs:kept, lab2blob, lab2blobAll, blobsAll, count,
    heightFilter:{median,hMin,hMax,hSplit,lo:opts.lo,split:opts.split,
      total:blobsAll.length,kept:kept.length,small:nSmall,tall:nTall,rule:nRule,
      splitParents:nSplitParents,splitChildren:nSplitChildren,items,labelStatus}};
}
