/* ======================================================================
   MERGED-BOX SPLITTER
   Why: dilation strong enough to fuse characters into a word will sometimes
   also bridge two stacked lines into one tall blob. This module detects an
   over-tall OBB and recursively resolves it — valley cut first, then
   progressively weaker re-dilation — so one physical word yields one box.
   ====================================================================== */
import { S } from './state.js';
import { cca } from './cca.js';
import { convexHull } from './hull.js';
import { minAreaRect } from './calipers.js';

/* =====================================================================
   MERGED-BOX SPLITTER
   On a clean invoice most word boxes are correct, so the MEDIAN box
   height is a dependable line-height reference. A box far taller than
   that has bridged two text lines (pen ticks, fold marks, stray ink).
   We project the box's ink onto its height axis, locate the gap(s)
   between the lines, cut there, and rebuild a tight OBB for each piece.
   A box with no genuine gap is left untouched, so tall single words are
   never wrongly cut. Applied to the after-rotate pass.
   ===================================================================== */
export function obbToPart(o,accepted,area,aspect,fill){
  return {corners:o.corners,cx:o.cx,cy:o.cy,w:o.w,h:o.h,angle:o.angle,
          accepted,area,aspect,fill,split:false};
}
export function smooth1d(a,win){
  const n=a.length,hw=win>>1,out=new Float32Array(n);
  for(let i=0;i<n;i++){
    let s=0,c=0;
    for(let j=i-hw;j<=i+hw;j++) if(j>=0&&j<n){s+=a[j];c++;}
    out[i]=s/c;
  }
  return out;
}
/* height axis of an OBB = its more-vertical edge (after deskew the
   word height runs ~vertically); returns {len, ux,uy unit vector} */
export function obbHeightAxis(o){
  const c=o.corners;
  const e1={x:c[1].x-c[0].x,y:c[1].y-c[0].y};
  const e2={x:c[2].x-c[1].x,y:c[2].y-c[1].y};
  const l1=Math.hypot(e1.x,e1.y)||1e-6, l2=Math.hypot(e2.x,e2.y)||1e-6;
  return (Math.abs(e1.y)/l1) >= (Math.abs(e2.y)/l2)
    ? {len:l1,ux:e1.x/l1,uy:e1.y/l1}
    : {len:l2,ux:e2.x/l2,uy:e2.y/l2};
}
/* ---- merged-box resolver --------------------------------------------
   A box taller than splitRatio×(median word height) is treated as a
   line merge and resolved with an escalating strategy:
     1. valley split  — cut at the low-ink gap between the two lines;
     2. if a piece is still oversized, reduce Dilation H for that box
        only (once, then twice) and re-dilate + re-label its ink, so a
        dilation-bridged merge falls apart into separate components;
     3. if a piece is STILL oversized after both reductions, keep it
        but flag it rejected.
   Runs on accepted AND rejected boxes — a merge is often what made a
   box fail the filter to begin with.                                  */
export function blobInk(bl,pass){
  const W=S.W, labels=pass.labels, binary=pass.binary, bb=bl.bb, lab=bl.label;
  const out=[];
  for(let y=bb.y0;y<=bb.y1;y++){const row=y*W;
    for(let x=bb.x0;x<=bb.x1;x++){
      const i=row+x;
      if(labels[i]===lab && binary[i]) out.push({x,y});
    }
  }
  return out;
}
export function obbOf(pts){
  if(pts.length<3) return null;
  const hull=convexHull(pts);
  if(hull.length<3) return null;
  return minAreaRect(hull);
}
export function buildPart(r,pts,ctx){
  const lng=Math.max(r.w,r.h), sht=Math.max(Math.min(r.w,r.h),1e-6);
  const aspect=lng/sht, fill=pts.length/Math.max(r.w*r.h,1e-6);
  let ok=true;
  if(ctx.p.rmNon){
    if(aspect>ctx.p.maxAspect) ok=false;
    else if(lng/ctx.minSide>ctx.p.maxLen) ok=false;
    else if((r.w*r.h)/ctx.imgArea>ctx.p.maxArea) ok=false;
    else if(fill<ctx.p.minFill) ok=false;
  }
  return {corners:r.corners,cx:r.cx,cy:r.cy,w:r.w,h:r.h,angle:r.angle,
          accepted:ok,area:pts.length,aspect,fill,split:true};
}
export const partH=pt=>obbHeightAxis(pt).len;
/* CPU separable rectangular dilation on a small crop */
export function dilateCPU(src,w,h,dh,dv){
  let cur=src;
  if(dh>0){
    const o=new Uint8Array(w*h);
    for(let y=0;y<h;y++){const row=y*w;
      for(let x=0;x<w;x++){
        let on=0;
        for(let k=-dh;k<=dh;k++){const xx=x+k;
          if(xx>=0&&xx<w&&cur[row+xx]){on=1;break;}}
        o[row+x]=on;
      }
    }
    cur=o;
  }
  if(dv>0){
    const o=new Uint8Array(w*h);
    for(let x=0;x<w;x++){
      for(let y=0;y<h;y++){
        let on=0;
        for(let k=-dv;k<=dv;k++){const yy=y+k;
          if(yy>=0&&yy<h&&cur[yy*w+x]){on=1;break;}}
        o[y*w+x]=on;
      }
    }
    cur=o;
  }
  return cur;
}
/* re-dilate an ink-point set at (dh,dv) and break it into components */
export function inkComponents(ink,dh,dv,conn8){
  if(ink.length<4) return [];
  let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0;
  for(const p of ink){
    if(p.x<x0)x0=p.x; if(p.x>x1)x1=p.x;
    if(p.y<y0)y0=p.y; if(p.y>y1)y1=p.y;
  }
  const pad=dh+dv+2;
  x0-=pad; y0-=pad; x1+=pad; y1+=pad;
  const rw=x1-x0+1, rh=y1-y0+1;
  if(rw<1||rh<1||rw*rh>4e6) return [];
  const base=new Uint8Array(rw*rh);
  for(const p of ink) base[(p.y-y0)*rw+(p.x-x0)]=1;
  const dil=dilateCPU(base,rw,rh,dh,dv);
  const cc=cca(dil,rw,rh,conn8);
  const comps=Array.from({length:cc.count},()=>({dil:[],ink:[]}));
  for(let ly=0;ly<rh;ly++){const row=ly*rw;
    for(let lx=0;lx<rw;lx++){
      const li=row+lx, l=cc.labels[li];
      if(l<0) continue;
      comps[l].dil.push({x:lx+x0,y:ly+y0});
      if(base[li]) comps[l].ink.push({x:lx+x0,y:ly+y0});
    }
  }
  return comps.filter(c=>c.ink.length>=4 && c.dil.length>=10);
}
/* valley split of one component's point lists */
export function valleySplitPts(dilPts,inkPts,ob,ctx){
  const ax=obbHeightAxis(ob), hLen=ax.len, half=hLen/2;
  const ux=ax.ux, uy=ax.uy, cx=ob.cx, cy=ob.cy;
  const L=Math.max(16,Math.ceil(hLen));
  const toBin=(x,y)=>{
    const t=(((x-cx)*ux+(y-cy)*uy)+half)/hLen*L|0;
    return t<0?0:t>=L?L-1:t;
  };
  const prof=new Float32Array(L);
  for(const p of inkPts) prof[toBin(p.x,p.y)]++;
  const sm=smooth1d(prof,Math.max(3,(Math.round(ctx.Hmed*0.13)|1)));
  const nLines=Math.min(6,Math.max(2,Math.round(hLen/ctx.Hmed)));
  const cand=[];
  for(let k=1;k<nLines;k++){
    const ctr=k/nLines*L, winR=L/(nLines*2.3);
    const lo=Math.max(1,Math.round(ctr-winR)), hi=Math.min(L-2,Math.round(ctr+winR));
    let bi=lo,bv=Infinity;
    for(let t=lo;t<=hi;t++) if(sm[t]<bv){bv=sm[t];bi=t;}
    cand.push(bi);
  }
  const cuts=[]; let prev=0;
  for(let ci=0;ci<cand.length;ci++){
    const cut=cand[ci], next=ci+1<cand.length?cand[ci+1]:L-1;
    let lp=0,rp=0;
    for(let t=prev;t<cut;t++) if(sm[t]>lp)lp=sm[t];
    for(let t=cut;t<next;t++) if(sm[t]>rp)rp=sm[t];
    const peak=Math.min(lp,rp);
    if(peak>0 && sm[cut]<0.42*peak){ cuts.push(cut); prev=cut; }
  }
  if(!cuts.length) return null;                  // no genuine gap
  const segs=Array.from({length:cuts.length+1},()=>[]);
  for(const p of dilPts){
    const b=toBin(p.x,p.y);
    let s=0; while(s<cuts.length && b>=cuts[s]) s++;
    segs[s].push(p);
  }
  const parts=[];
  for(const pts of segs){
    if(pts.length<10) continue;
    const r=obbOf(pts);
    if(r) parts.push(buildPart(r,pts,ctx));
  }
  return parts.length>1?parts:null;
}
/* escalating resolver — split, else reduce Dilation H, else reject */
export function resolveTall(ink,dh,dv,reductionsLeft,ctx){
  const comps=inkComponents(ink,dh,dv,ctx.conn8);
  const out=[];
  for(const cm of comps){
    const ob=obbOf(cm.dil);
    if(!ob) continue;
    if(obbHeightAxis(ob).len<=ctx.threshold){      // this piece already fits
      out.push(buildPart(ob,cm.dil,ctx)); continue;
    }
    const sp=valleySplitPts(cm.dil,cm.ink,ob,ctx); // 1 · valley split
    if(sp && sp.every(pt=>partH(pt)<=ctx.threshold)){ out.push(...sp); continue; }
    if(reductionsLeft>0 && dh>0){                  // 2 · reduce Dilation H, retry
      out.push(...resolveTall(cm.ink,dh-1,dv,reductionsLeft-1,ctx));
    }else{                                         // 3 · exhausted → reject tall piece
      const pieces=(sp&&sp.length)?sp:[buildPart(ob,cm.dil,ctx)];
      for(const pc of pieces){ if(partH(pc)>ctx.threshold) pc.accepted=false; out.push(pc); }
    }
  }
  return out;
}
export function splitMergedBoxes(pass,p){
  const acc=pass.blobs.filter(b=>b.accepted);
  if(acc.length<6) return;                         // too few boxes for a stable median
  const heights=acc.map(b=>obbHeightAxis(b.obb).len).sort((a,b)=>a-b);
  const Hmed=heights[heights.length>>1];
  if(Hmed<=0) return;
  const ctx={Hmed, threshold:p.splitRatio*Hmed, p,
             minSide:Math.min(S.W,S.H), imgArea:S.W*S.H, conn8:p.conn8};
  for(const bl of pass.blobs){                     // every box — accepted OR rejected
    if(obbHeightAxis(bl.obb).len < ctx.threshold) continue;   // not oversized
    const ink=blobInk(bl,pass);
    if(ink.length<8) continue;
    const parts=resolveTall(ink, p.dilB.h, p.dilB.v, 2, ctx);
    if(parts.length) bl.parts=parts;
  }
}
