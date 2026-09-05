/* ======================================================================
   TEXT-LINE CLEAN  ·  whole-line detection and noise removal, pre pass A
   Why: everything downstream (word OBBs, skew, dewarp, rows, columns)
   works better when its input contains text and nothing else. This stage
   runs on the rectified image before pass A and produces a CLEAN binary:
   ink that belongs to a detected text line, with rules, borders, logos,
   halftone, dust and multi-line merges removed. Pass A then consumes that
   binary instead of thresholding the image itself.

   Method (chosen for robustness on skewed, photographed pages):
     1. Sauvola binary (GPU) + 1 px heal dilation so broken strokes and
        i-dots stay attached to their glyph.
     2. CCA on the healed mask → character-level components.
     3. Reference glyph height = ink-weighted median of component heights,
        ignoring solid components (fill > 0.9: dots, rules, blobs). A
        plain median would collapse to the dot size on a page with a
        halftone photo, and every real glyph would then look "too tall".
     4. Component filter (shared with section 05): tall components are cut
        at ink valleys, then each is kept only if its height sits in the
        band around the reference and it is not rule-shaped. Kills specks,
        rules, box borders, logos, most halftone.
     5. Line chaining: two components are linked when they are horizontally
        close (gap ≤ gapF × their height), overlap vertically by at least
        overlapF of the shorter one, and have comparable heights. Union-
        find over those links gives one chain per text-line segment. A
        chain never spans two lines because stacked lines do not overlap
        vertically — and, unlike a horizontal dilation, chaining does not
        care that a skewed line drifts across the page.
     6. Chain validation: lone components must look like a glyph (fill,
        aspect, height); multi-component chains must have consistent
        member heights, must not be small relative to the reference, and
        must not be rows of small identical solid dots (halftone / leader
        dots).
     7. The reference is re-estimated from the accepted lines' glyphs and,
        if it moved noticeably, steps 4–6 run once more with it.
     8. Full lines: accepted chains are joined left → right with the same
        rules as section 05c (vertical overlap, no x overlap, never taller
        than one line).
     9. Clean binary = raw ink of the members of accepted chains.
   ====================================================================== */
import { S } from '../state/state.js';
import { gpuSauvola, gpuDilate } from '../webgpu/webgpu.js';
import { cca } from '../cca/cca.js';
import { dilateCPU } from '../splitter/splitter.js';
import { filterBlobsByHeight } from '../heightfilter/heightfilter.js';
import { buildFullLines } from '../lines/lines.js';

const median=a=>{ if(!a.length) return 0; const s=a.slice().sort((x,y)=>x-y); return s[s.length>>1]; };
/* weighted median of values v with weights w */
function wmedian(v,w){
  if(!v.length) return 0;
  const ix=v.map((_,i)=>i).sort((a,b)=>v[a]-v[b]);
  let tot=0; for(const x of w) tot+=x;
  let acc=0;
  for(const i of ix){ acc+=w[i]; if(acc>=tot/2) return v[i]; }
  return v[ix[ix.length-1]];
}
const hOf=b=>b.bb.y1-b.bb.y0+1, wOf=b=>b.bb.x1-b.bb.x0+1, fillOf=b=>b.area/(wOf(b)*hOf(b));

/* reference glyph height from raw components (step 3) */
function referenceHeight(blobs){
  const textish=blobs.filter(b=>fillOf(b)<=0.9);
  const src=textish.length>=20?textish:blobs;
  return wmedian(src.map(hOf), src.map(b=>b.area));
}

/* steps 4–6 for one reference height. `labels` is copied first because
   the height filter rewrites it when it splits a component. */
function pass(blobs,labels0,raw,W,H,p,ref,count){
  const labels=labels0.slice();
  const f=filterBlobsByHeight(blobs.map(b=>({...b})),labels,raw,W,H,{
    lo:p.tlMinH, split:p.tlMaxH, maxAspect:p.tlMaxAsp, minArea:p.minArea,
    conn8:p.conn8, count, median:ref});
  const comps=f.blobs;

  // chaining (union-find over horizontal neighbours)
  const n=comps.length, par=new Int32Array(n); for(let i=0;i<n;i++) par[i]=i;
  const find=i=>{ while(par[i]!==i){ par[i]=par[par[i]]; i=par[i]; } return i; };
  const uni=(a,b)=>{ a=find(a); b=find(b); if(a!==b) par[a]=b; };
  const order=Array.from({length:n},(_,i)=>i).sort((a,b)=>comps[a].bb.x0-comps[b].bb.x0);
  const reach=p.tlGap*f.heightFilter.hMax;      // no kept component is taller than hMax
  for(let oi=0;oi<n;oi++){
    const i=order[oi], A=comps[i].bb, hA=hOf(comps[i]);
    for(let oj=oi+1;oj<n;oj++){
      const j=order[oj], B=comps[j].bb;
      if(B.x0-A.x1-1>reach) break;             // sorted by x0 → nothing further can be near
      const hB=hOf(comps[j]);
      if(B.x0-A.x1-1>p.tlGap*Math.max(hA,hB)) continue;
      const ov=Math.min(A.y1,B.y1)-Math.max(A.y0,B.y0)+1;
      if(ov<p.tlOverlap*Math.min(hA,hB)) continue;
      if(Math.max(hA,hB)>3*Math.min(hA,hB)) continue;   // wildly different sizes
      uni(i,j);
    }
  }
  const groups=new Map();
  for(let i=0;i<n;i++){ const r=find(i); if(!groups.has(r)) groups.set(r,[]); groups.get(r).push(comps[i]); }

  // validation
  const chains=[];
  for(const members of groups.values()){
    members.sort((a,b)=>a.bb.x0-b.bb.x0);
    let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0, area=0;
    for(const m of members){ if(m.bb.x0<x0)x0=m.bb.x0; if(m.bb.y0<y0)y0=m.bb.y0;
      if(m.bb.x1>x1)x1=m.bb.x1; if(m.bb.y1>y1)y1=m.bb.y1; area+=m.area; }
    const hs=members.map(hOf), ws=members.map(wOf), hm=median(hs);
    const mad=median(hs.map(h=>Math.abs(h-hm)));
    const fills=members.map(fillOf), fm=median(fills);
    const cv=a=>{ const m=a.reduce((s,x)=>s+x,0)/a.length; if(!m) return 0;
      return Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/a.length)/m; };
    let ok=true, why='';
    if(members.length<p.tlMinChars){ ok=false; why='too few glyphs'; }
    else if(members.length===1){
      const m=members[0], h=hOf(m), w=wOf(m), fill=fillOf(m);
      if(h<0.6*ref){ ok=false; why='lone, too small'; }
      else if(w/h>3){ ok=false; why='lone, dash-like'; }
      else if(fill<0.12||fill>0.98){ ok=false; why='lone, fill '+fill.toFixed(2); }
    }
    else if(hm<0.6*ref){ ok=false; why='too small ('+Math.round(hm)+'px)'; }
    else if(mad>0.75*hm){ ok=false; why='uneven heights'; }
    // rows of identical solid dots (halftone, leader dots) — only when
    // they are also smaller than a glyph, so bold low-resolution text
    // with a high fill is never mistaken for dots
    else if(members.length>=8 && hm<0.8*ref && fm>=0.85 && cv(hs)<0.08 && cv(ws)<0.08){ ok=false; why='dot grid'; }
    chains.push({members, bb:{x0,y0,x1,y1}, ink:{x0,y0,x1,y1}, words:members, area,
      hMed:hm, accepted:ok, reason:why});
  }
  chains.sort((a,b)=>a.bb.y0-b.bb.y0 || a.bb.x0-b.bb.x0);
  const accepted=chains.filter(c=>c.accepted);
  // refined reference: median height of accepted glyphs
  const gl=[]; for(const c of accepted) for(const m of c.members) gl.push(hOf(m));
  const refOut=gl.length?median(gl):ref;
  return {f, labels, comps, chains, accepted, refOut};
}

/* CPU core — testable without a GPU.
     raw     : Sauvola binary (W*H, 0/1)
     healed  : raw dilated by 1 px in both axes (labels are built on this)
     p       : {minArea, conn8, tlMinH, tlMaxH, tlMaxAsp, tlGap, tlOverlap,
                tlMinChars}                                                 */
export function analyseTextLines(raw,healed,W,H,p){
  const N=W*H;
  const cc=cca(healed,W,H,p.conn8);
  const blobs=[];
  for(let l=0;l<cc.count;l++){
    if(cc.area[l]>=p.minArea) blobs.push({label:l,area:cc.area[l],
      bb:{x0:cc.bx0[l],y0:cc.by0[l],x1:cc.bx1[l],y1:cc.by1[l]},start:cc.start[l]});
  }
  const ref0=referenceHeight(blobs);
  let r=pass(blobs,cc.labels,raw,W,H,p,ref0,cc.count);
  let ref=ref0, refined=false;
  if(r.refOut>0 && Math.abs(r.refOut-ref0)>0.15*ref0){
    r=pass(blobs,cc.labels,raw,W,H,p,r.refOut,cc.count); ref=r.refOut; refined=true;
  }
  const {f,labels,comps,chains,accepted}=r;

  // full lines (left → right, one piece per x position, single line)
  const hLine=1.6*median(accepted.map(c=>c.bb.y1-c.bb.y0+1));
  const rows=buildFullLines({lines:accepted}, hLine, 0.5);

  // clean binary
  const clean=new Uint8Array(N);
  const keepLab=new Uint8Array(f.count);
  for(const c of accepted) for(const m of c.members) keepLab[m.label]=1;
  for(let i=0;i<N;i++){ const l=labels[i]; if(l>=0 && keepLab[l] && raw[i]) clean[i]=1; }

  return {
    binaryRaw:raw, healed, binary:clean,
    labels, ncomp:cc.count,
    blobs:comps, blobsAll:f.blobsAll, lab2blob:f.lab2blob, lab2blobAll:f.lab2blobAll,
    heightFilter:f.heightFilter,
    chains, lines:{lines:accepted}, rows,
    stats:{components:blobs.length, kept:comps.length, chains:chains.length,
           accepted:accepted.length, rejected:chains.length-accepted.length,
           fullLines:rows.rows.length, hMed:ref, ref0, refined}
  };
}

/* GPU entry used by the pipeline */
export async function detectTextLines(imgData,p){
  const W=S.W, H=S.H;
  const raw=await gpuSauvola(imgData,p);
  let healed;
  if(S.device && S.gpuBuf) healed=await gpuDilate(1,1);      // b.outB still holds the Sauvola mask
  else healed=dilateCPU(raw,W,H,1,1);
  return analyseTextLines(raw,healed,W,H,p);
}
