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
        overlapF of the shorter one, and have comparable heights. Before
        the links are merged, BRIDGES are found: a component whose
        neighbours lie on two different lines (they overlap it but not each
        other) is a pen tick / stroke / smear reaching across lines. A tall
        bridge is dropped as pen noise; a short one keeps only its links to
        the line it overlaps most. Union-find over the remaining links then
        gives one chain per text-line segment that can never span two
        lines — and, unlike a horizontal dilation, chaining does not care
        that a skewed line drifts across the page.
     6. Chain validation: lone components must look like a glyph (fill,
        aspect, height ≤ 1.3 × reference) and sit inside the page (paper-
        edge fragments hug the border); multi-component chains must have
        no two-line structure (a line fit through the member centres
        leaves no members both well above and well below it) and consistent
        member heights, must not be small relative to the reference, and
        must not be rows of small identical solid dots (halftone / leader
        dots).
     7. The reference is re-estimated from the accepted lines' glyphs and,
        if it moved noticeably, steps 4–6 run once more with it.
     8. Full lines: accepted chains are joined left → right with the same
        rules as section 05c (vertical overlap, no x overlap, never taller
        than one line), in a de-skewed frame: the page slope is estimated
        from the lines themselves, so on a tilted page row N on the left
        is never joined to row N-1 on the right. A full line that is a
        single lone glyph joined to nothing is rejected as a stray mark.
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
  // cut attempt above 1.6 x ref (a component taller than one line), reject
  // only above tlMaxH - so a pen mark fused to glyphs on two lines gets a
  // chance to fall apart at the line gap before it is judged
  const f=filterBlobsByHeight(blobs.map(b=>({...b})),labels,raw,W,H,{
    lo:p.tlMinH, split:Math.min(1.6,p.tlMaxH), hi:p.tlMaxH, maxAspect:p.tlMaxAsp,
    minArea:p.minArea, conn8:p.conn8, count, median:ref});
  const comps=f.blobs;

  // chaining - 1 : candidate links between horizontal neighbours
  const n=comps.length;
  const adj=Array.from({length:n},()=>[]);
  const order=Array.from({length:n},(_,i)=>i).sort((a,b)=>comps[a].bb.x0-comps[b].bb.x0);
  const reach=p.tlGap*f.heightFilter.hMax;      // no kept component is taller than hMax
  for(let oi=0;oi<n;oi++){
    const i=order[oi], A=comps[i].bb, hA=hOf(comps[i]);
    for(let oj=oi+1;oj<n;oj++){
      const j=order[oj], B=comps[j].bb;
      if(B.x0-A.x1-1>reach) break;             // sorted by x0: nothing further can be near
      const hB=hOf(comps[j]);
      if(B.x0-A.x1-1>p.tlGap*Math.max(hA,hB)) continue;
      const ov=Math.min(A.y1,B.y1)-Math.max(A.y0,B.y0)+1;
      if(ov<p.tlOverlap*Math.min(hA,hB)) continue;
      if(Math.max(hA,hB)>3*Math.min(hA,hB)) continue;   // wildly different sizes
      adj[i].push(j); adj[j].push(i);
    }
  }
  // 2 : bridge detection.  A pen tick, stroke or smear that reaches two
  //     lines overlaps glyphs on BOTH, while those glyphs do not overlap
  //     each other.  Such a component must never carry a link across
  //     lines: if it is tall it is pen noise and is dropped entirely,
  //     otherwise it keeps only the links to the line it overlaps most.
  const ovf=(a,b)=>{ const A=comps[a].bb,B=comps[b].bb;
    return (Math.min(A.y1,B.y1)-Math.max(A.y0,B.y0)+1)/Math.min(hOf(comps[a]),hOf(comps[b])); };
  const cyOf=a=>(comps[a].bb.y0+comps[a].bb.y1)/2;
  const cut=new Set(); const key=(a,b)=>a<b?a*n+b:b*n+a;
  const bridgeNoise=new Uint8Array(n);
  for(let i=0;i<n;i++){
    const nb=adj[i]; if(nb.length<2) continue;
    const sorted=nb.slice().sort((a,b)=>cyOf(a)-cyOf(b));
    const lines=[[sorted[0]]];
    for(let k=1;k<sorted.length;k++){ const g=lines[lines.length-1];
      if(ovf(g[g.length-1],sorted[k])>=0.2) g.push(sorted[k]); else lines.push([sorted[k]]); }
    if(lines.length<2) continue;                 // all neighbours on one line
    const nbH=median(nb.map(j=>hOf(comps[j])));
    if(hOf(comps[i])>1.6*nbH){                   // tall bridge: pen noise
      bridgeNoise[i]=1; for(const j of nb) cut.add(key(i,j)); continue; }
    let best=null,bv=-1;
    for(const g of lines){ let s=0; for(const j of g) s+=ovf(i,j); if(s>bv){bv=s;best=g;} }
    for(const g of lines) if(g!==best) for(const j of g) cut.add(key(i,j));
  }
  // 3 : union-find over the surviving links
  const par=new Int32Array(n); for(let i=0;i<n;i++) par[i]=i;
  const find=i=>{ while(par[i]!==i){ par[i]=par[par[i]]; i=par[i]; } return i; };
  const uni=(a,b)=>{ a=find(a); b=find(b); if(a!==b) par[a]=b; };
  for(let i=0;i<n;i++) for(const j of adj[i])
    if(j>i && !bridgeNoise[i] && !bridgeNoise[j] && !cut.has(key(i,j))) uni(i,j);
  const groups=new Map(); const noise=[];
  for(let i=0;i<n;i++){
    if(bridgeNoise[i]){ noise.push(comps[i]); continue; }
    const r=find(i); if(!groups.has(r)) groups.set(r,[]); groups.get(r).push(comps[i]); }
  // 4 : two-line safety net.  Whatever slipped past the bridge rule (two
  //     marks bridging each other, a smear along a descender) shows up
  //     as a chain whose members sit in two bands above and below a
  //     straight-line fit through their centres. Such a chain is split
  //     by the sign of the residual; each half is checked once more.
  const splitTwoLine=(members)=>{
    if(members.length<4) return [members];
    const hm=median(members.map(hOf));
    // Theil–Sen line through the member centres: median of the pairwise
    // slopes, median intercept. Least squares would let two strokes at
    // the end of a short chain tilt the line towards themselves and hide
    // their own residuals; the median fit cannot be pulled by a few.
    const cx=m=>(m.bb.x0+m.bb.x1)/2, cy=m=>(m.bb.y0+m.bb.y1)/2;
    const N=members.length, xs=members.map(cx), ys=members.map(cy);
    const slopes=[]; const step=N>60?Math.ceil(N*N/4000):1; let k=0;
    for(let i=0;i<N;i++) for(let j=i+1;j<N;j++){ if((k++)%step) continue;
      const dx=xs[j]-xs[i]; if(Math.abs(dx)<1) continue; slopes.push((ys[j]-ys[i])/dx); }
    const b=slopes.length?median(slopes):0;
    const a=median(members.map((m,i)=>ys[i]-b*xs[i]));
    const res=members.map((m,i)=>ys[i]-(a+b*xs[i]));
    const up=res.filter(r=>r<-0.3*hm).length, dn=res.filter(r=>r>0.3*hm).length;
    if(Math.max(...res)-Math.min(...res)>1.2*hm && up>=2 && dn>=2){
      const g1=[],g2=[]; members.forEach((m,i)=>(res[i]<0?g1:g2).push(m));
      return [...splitTwoLine(g1), ...splitTwoLine(g2)];
    }
    // hangers: a few members well off the line (pen strokes reaching down
    // from / up into the line, a smear) — too few to be a second line, so
    // they are marks, not glyphs; drop them so they cannot make the line
    // tall enough to fall out of its row
    const off=[]; members.forEach((m,i)=>{ if(Math.abs(res[i])>0.6*hm) off.push(i); });
    if(off.length && off.length*2<members.length){
      const keep=members.filter((_,i)=>!off.includes(i));
      for(const i of off){ const m=members[i]; m.offLine=true; noise.push(m); }
      return [keep];
    }
    return [members];
  };
  const groupList=[]; for(const g of groups.values()) groupList.push(...splitTwoLine(g));

  // validation
  const chains=[];
  const edge=1.5*ref;
  for(const members of groupList){
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
      // a lone component is only a glyph if it has glyph proportions and
      // sits inside the page: paper-edge shadows and torn margins show up
      // as tall thin fragments hugging the image border
      const m=members[0], h=hOf(m), w=wOf(m), fill=fillOf(m);
      if(h<0.6*ref){ ok=false; why='lone, too small'; }
      else if(h>1.3*ref){ ok=false; why='lone, too tall'; }
      else if(w/h>3){ ok=false; why='lone, dash-like'; }
      else if(fill<0.12||fill>0.98){ ok=false; why='lone, fill '+fill.toFixed(2); }
      else if(m.bb.x0<edge || m.bb.x1>W-1-edge || m.bb.y0<edge || m.bb.y1>H-1-edge){ ok=false; why='lone, page edge'; }
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
  for(const m of noise) chains.push({members:[m], bb:{...m.bb}, ink:{...m.bb}, words:[m], area:m.area,
      hMed:hOf(m), accepted:false, reason:m.offLine?'off-line mark':'bridge (pen mark)'});
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
  const {f,labels,comps,chains}=r;
  let accepted=r.accepted;

  // full lines (left → right, one piece per x position, single line).
  // The join estimates the page slope from the lines themselves and
  // compares pieces in the de-skewed frame; the max line height is
  // derived from de-skewed piece heights (0 → derive).
  let rows=buildFullLines({lines:accepted}, 0, 0.5);
  // a full line that is one lone glyph joined to nothing is not text on
  // this page (signature fragment, pen tick, stray mark): reject the chain
  // and rebuild, so it also leaves the clean binary
  let dropped=0;
  for(const rw of rows.rows){
    if(rw.lines.length===1 && rw.words===1){ rw.lines[0].accepted=false; rw.lines[0].reason='isolated glyph'; dropped++; }
  }
  if(dropped){
    accepted=chains.filter(c=>c.accepted);
    rows=buildFullLines({lines:accepted}, 0, 0.5);
  }

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
           fullLines:rows.rows.length, slope:rows.slope, hMed:ref, ref0, refined}
  };
}

/* GPU entry used by the pipeline.  opts.erase (Uint8Array W*H) marks the
   pixels of detected rules (section 02a); they are cleared from the
   binary before the heal, so a rule fused to a glyph never joins a line. */
export async function detectTextLines(imgData,p,opts={}){
  const W=S.W, H=S.H;
  const raw=await gpuSauvola(imgData,p);
  if(opts.erase){ const e=opts.erase; for(let i=0;i<raw.length;i++) if(e[i]) raw[i]=0; }
  let healed;
  if(S.device && S.gpuBuf) healed=await gpuDilate(1,1);      // b.outB still holds the Sauvola mask
  else healed=dilateCPU(raw,W,H,1,1);
  return analyseTextLines(raw,healed,W,H,p);
}
