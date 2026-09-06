/* ======================================================================
   TEXT-LINE CLEAN  ·  whole-line detection and noise removal
   Why: everything downstream works better when its input contains text
   and nothing else. This stage runs on the rules-erased image and produces
   a CLEAN binary: ink that belongs to a detected text line, with logos,
   halftone, dust, pen marks and multi-line merges removed.

   Method (chosen for robustness on skewed, photographed pages):
     1. Sauvola binary (GPU) + 1 px heal dilation so broken strokes and
        i-dots stay attached to their glyph.
     2. CCA on the healed mask → character-level components.
     3. Reference glyph height = ink-weighted median of component heights,
        ignoring solid components (fill > 0.9: dots, rules, blobs). A plain
        median would collapse to the dot size on a page with a halftone
        photo, and every real glyph would then look "too tall".
     4. Component filter (heightfilter.js): tall components are cut at
        ink valleys, then each is kept only if its height sits in the band
        around the reference and it is not rule-shaped.
     5. Chaining: two components are linked when they are horizontally
        close (gap ≤ chainGap × their height), overlap vertically by at
        least minOverlap of the shorter one, and have comparable heights.
        Before the links are merged, BRIDGES are found: a component whose
        neighbours lie on two different lines (they overlap it but not each
        other) is a pen tick / stroke / smear reaching across lines. A tall
        bridge is dropped as pen noise; a short one keeps only its links to
        the line it overlaps most. Union-find over the remaining links
        gives one chain per text-line segment. Unlike a horizontal
        dilation, chaining does not care that a skewed line drifts.
     6. Two-line safety net: a Theil–Sen line through each chain's member
        centres; a chain with members both well above and well below it
        is split, a few members far off it are dropped as off-line marks.
     7. Validation: lone components must look like a glyph or a touching
        bold word (fill, height ≤ 1.3 × reference; wide-and-short only is
        a dash) and sit inside the page (paper-edge fragments hug the
        border); multi-component chains must have
        consistent member heights, must not be small relative to the
        reference, and must not be rows of small identical solid dots.
     8. The reference is re-estimated from the accepted lines' glyphs and,
        if it moved noticeably, steps 4–7 run once more with it.
     9. Full lines (lines.js): accepted chains joined left → right in a
        de-skewed frame. A full line that is one lone glyph joined to
        nothing is rejected as a stray mark.
    10. Punctuation recovery: a small component lying inside an accepted
        line's box (dropped as too short: periods, decimal points) or a
        lone rejected chain next to a line (dash-like, too small or solid:
        hyphens, minus signs, colon dots) is re-attached to that line. A
        dash never links into its line by itself — its height differs from
        the digits by more than 3:1 — so adjacency is the only way back.
    11. Off-page rejection: a chain whose local paper is far darker than
        the page's is on the desk around the paper (photo texture) and is
        rejected.
    12. Clean binary = raw ink of the members of accepted chains.
   ====================================================================== */
import { S } from '../state/state.js';
import { gpuSauvola, gpuDilate, gpuUploadBinary } from '../webgpu/webgpu.js';
import { cca } from '../cca/cca.js';
import { dilateCPU, median, weightedMedian } from '../morph/morph.js';
import { filterComponentsByHeight } from '../heightfilter/heightfilter.js';
import { buildFullLines } from '../lines/lines.js';

const heightOf=c=>c.bb.y1-c.bb.y0+1, widthOf=c=>c.bb.x1-c.bb.x0+1;
const fillOf=c=>c.area/(widthOf(c)*heightOf(c));
const centreX=c=>(c.bb.x0+c.bb.x1)/2, centreY=c=>(c.bb.y0+c.bb.y1)/2;

/* step 3: reference glyph height from the raw components */
function referenceHeight(components){
  const textLike=components.filter(c=>fillOf(c)<=0.9);
  const source=textLike.length>=20?textLike:components;
  return weightedMedian(source.map(heightOf), source.map(c=>c.area));
}

/* Steps 4–7 for one reference height. `labels0` is copied first because
   the height filter rewrites it when it splits a component.
     components : [{label,area,bb,start}] after the min-area filter
     ink        : raw binary the valleys are measured on
     params     : {components:{minArea,connectivity8}, textLines:{...}}   */
function chainAndValidate(components,labels0,ink,W,H,params,reference,labelCount){
  const tl=params.textLines, comp=params.components;
  const labels=labels0.slice();
  // cut attempt above 1.6 × reference (taller than one line), reject only
  // above maxGlyphHeight — a pen mark fused to glyphs on two lines gets a
  // chance to fall apart at the line gap before it is judged
  const filtered=filterComponentsByHeight(components.map(c=>({...c})),labels,ink,W,H,{
    minFrac:tl.minGlyphHeight, splitFrac:Math.min(1.6,tl.maxGlyphHeight), maxFrac:tl.maxGlyphHeight,
    maxAspect:tl.maxGlyphAspect, minArea:comp.minArea, connectivity8:comp.connectivity8,
    labelCount, referenceHeight:reference});
  // page-edge fragments: a glyph never touches the image border on a
  // rectified page, so a border-hugging component that is taller than a
  // glyph or a thin vertical stroke is paper edge / shadow, not text —
  // and must not get the chance to chain into a nearby line
  const border=1.5*reference, glyphs=[], edgeFragments=[];
  for(const g of filtered.kept){
    const h=heightOf(g), w=widthOf(g);
    const touches=g.bb.x0<border || g.bb.x1>W-1-border || g.bb.y0<border || g.bb.y1>H-1-border;
    if(touches && (h>1.2*reference || w/h<0.25)){ g.edgeFragment=true; edgeFragments.push(g); } else glyphs.push(g);
  }
  const n=glyphs.length;

  /* --- 5a · candidate links between horizontal neighbours ---------- */
  const adjacency=Array.from({length:n},()=>[]);
  const order=Array.from({length:n},(_,i)=>i).sort((a,b)=>glyphs[a].bb.x0-glyphs[b].bb.x0);
  const reach=tl.chainGap*filtered.summary.maxHeight;      // no kept component is taller
  for(let oi=0;oi<n;oi++){
    const i=order[oi], A=glyphs[i].bb, hA=heightOf(glyphs[i]);
    for(let oj=oi+1;oj<n;oj++){
      const j=order[oj], B=glyphs[j].bb;
      if(B.x0-A.x1-1>reach) break;                         // sorted by x0: nothing further can be near
      const hB=heightOf(glyphs[j]);
      if(B.x0-A.x1-1>tl.chainGap*Math.max(hA,hB)) continue;
      const overlap=Math.min(A.y1,B.y1)-Math.max(A.y0,B.y0)+1;
      if(overlap<tl.minOverlap*Math.min(hA,hB)) continue;
      if(Math.max(hA,hB)>3*Math.min(hA,hB)) continue;      // wildly different sizes
      adjacency[i].push(j); adjacency[j].push(i);
    }
  }
  /* --- 5b · bridges: a component whose neighbours lie on two lines --- */
  const overlapFrac=(a,b)=>{ const A=glyphs[a].bb,B=glyphs[b].bb;
    return (Math.min(A.y1,B.y1)-Math.max(A.y0,B.y0)+1)/Math.min(heightOf(glyphs[a]),heightOf(glyphs[b])); };
  const cutLinks=new Set(); const linkKey=(a,b)=>a<b?a*n+b:b*n+a;
  const isBridgeNoise=new Uint8Array(n);
  for(let i=0;i<n;i++){
    const nb=adjacency[i]; if(nb.length<2) continue;
    const sorted=nb.slice().sort((a,b)=>centreY(glyphs[a])-centreY(glyphs[b]));
    const lineGroups=[[sorted[0]]];
    for(let k=1;k<sorted.length;k++){ const g=lineGroups[lineGroups.length-1];
      if(overlapFrac(g[g.length-1],sorted[k])>=0.2) g.push(sorted[k]); else lineGroups.push([sorted[k]]); }
    if(lineGroups.length<2) continue;                      // all neighbours on one line
    const neighbourHeight=median(nb.map(j=>heightOf(glyphs[j])));
    if(heightOf(glyphs[i])>1.6*neighbourHeight){           // tall bridge: pen noise
      isBridgeNoise[i]=1; for(const j of nb) cutLinks.add(linkKey(i,j)); continue; }
    let best=null,bestSum=-1;
    for(const g of lineGroups){ let s=0; for(const j of g) s+=overlapFrac(i,j); if(s>bestSum){bestSum=s;best=g;} }
    for(const g of lineGroups) if(g!==best) for(const j of g) cutLinks.add(linkKey(i,j));
  }
  /* --- 5c · union-find over the surviving links --------------------- */
  const parent=new Int32Array(n); for(let i=0;i<n;i++) parent[i]=i;
  const find=i=>{ while(parent[i]!==i){ parent[i]=parent[parent[i]]; i=parent[i]; } return i; };
  const unite=(a,b)=>{ a=find(a); b=find(b); if(a!==b) parent[a]=b; };
  for(let i=0;i<n;i++) for(const j of adjacency[i])
    if(j>i && !isBridgeNoise[i] && !isBridgeNoise[j] && !cutLinks.has(linkKey(i,j))) unite(i,j);
  const groups=new Map(); const noise=edgeFragments.slice();
  for(let i=0;i<n;i++){
    if(isBridgeNoise[i]){ noise.push(glyphs[i]); continue; }
    const root=find(i); if(!groups.has(root)) groups.set(root,[]); groups.get(root).push(glyphs[i]); }

  /* --- 6 · two-line safety net (Theil–Sen line through the centres) -- */
  const splitTwoLine=(members)=>{
    if(members.length<4) return [members];
    const hm=median(members.map(heightOf));
    const N=members.length, xs=members.map(centreX), ys=members.map(centreY);
    const slopes=[]; const step=N>60?Math.ceil(N*N/4000):1; let k=0;
    for(let i=0;i<N;i++) for(let j=i+1;j<N;j++){ if((k++)%step) continue;
      const dx=xs[j]-xs[i]; if(Math.abs(dx)<1) continue; slopes.push((ys[j]-ys[i])/dx); }
    const b=slopes.length?median(slopes):0;
    const a=median(members.map((m,i)=>ys[i]-b*xs[i]));
    const residual=members.map((m,i)=>ys[i]-(a+b*xs[i]));
    const above=residual.filter(r=>r<-0.3*hm).length, below=residual.filter(r=>r>0.3*hm).length;
    if(Math.max(...residual)-Math.min(...residual)>1.2*hm && above>=2 && below>=2){
      const g1=[],g2=[]; members.forEach((m,i)=>(residual[i]<0?g1:g2).push(m));
      return [...splitTwoLine(g1), ...splitTwoLine(g2)];
    }
    // hangers: a few members well off the line (pen strokes reaching into
    // the line, a smear) — too few to be a second line, so they are marks
    const off=[]; members.forEach((m,i)=>{ if(Math.abs(residual[i])>0.6*hm) off.push(i); });
    if(off.length && off.length*2<members.length){
      for(const i of off){ members[i].offLine=true; noise.push(members[i]); }
      return [members.filter((_,i)=>!off.includes(i))];
    }
    return [members];
  };
  const chainMembers=[]; for(const g of groups.values()) chainMembers.push(...splitTwoLine(g));

  /* --- 7 · validation ------------------------------------------------ */
  const chains=[];
  const edge=1.5*reference;
  const cv=a=>{ const m=a.reduce((s,x)=>s+x,0)/a.length; if(!m) return 0;
    return Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/a.length)/m; };
  for(const members of chainMembers){
    members.sort((a,b)=>a.bb.x0-b.bb.x0);
    let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0, area=0;
    for(const m of members){ if(m.bb.x0<x0)x0=m.bb.x0; if(m.bb.y0<y0)y0=m.bb.y0;
      if(m.bb.x1>x1)x1=m.bb.x1; if(m.bb.y1>y1)y1=m.bb.y1; area+=m.area; }
    const heights=members.map(heightOf), widths=members.map(widthOf), hm=median(heights);
    const mad=median(heights.map(h=>Math.abs(h-hm)));
    const fillMed=median(members.map(fillOf));
    let ok=true, reason='';
    if(members.length<tl.minGlyphs){ ok=false; reason='too few glyphs'; }
    else if(members.length===1){
      const m=members[0], h=heightOf(m), w=widthOf(m), fill=fillOf(m);
      // a dash is wide AND short; a bold word whose glyphs all touch is
      // one wide component of full glyph height and is a line of its own
      // (the character stage cuts it into its glyphs)
      if(h<0.6*reference){ ok=false; reason='lone, too small'; }
      else if(h>1.3*reference){ ok=false; reason='lone, too tall'; }
      else if(w/h>3 && h<0.5*reference){ ok=false; reason='lone, dash-like'; }
      else if(fill<0.12||fill>0.98){ ok=false; reason='lone, fill '+fill.toFixed(2); }
      else if(m.bb.x0<edge || m.bb.x1>W-1-edge || m.bb.y0<edge || m.bb.y1>H-1-edge){ ok=false; reason='lone, page edge'; }
    }
    else if(hm<0.6*reference){ ok=false; reason='too small ('+Math.round(hm)+'px)'; }
    else if(mad>0.75*hm){ ok=false; reason='uneven heights'; }
    else if(members.length>=8 && hm<0.8*reference && fillMed>=0.85 && cv(heights)<0.08 && cv(widths)<0.08){ ok=false; reason='dot grid'; }
    chains.push({members, bb:{x0,y0,x1,y1}, ink:{x0,y0,x1,y1}, words:members, area, heightMed:hm, accepted:ok, reason});
  }
  for(const m of noise) chains.push({members:[m], bb:{...m.bb}, ink:{...m.bb}, words:[m], area:m.area,
    heightMed:heightOf(m), accepted:false, reason:m.offLine?'off-line mark':m.edgeFragment?'page-edge fragment':'bridge (pen mark)'});
  chains.sort((a,b)=>a.bb.y0-b.bb.y0 || a.bb.x0-b.bb.x0);
  const accepted=chains.filter(c=>c.accepted);
  const acceptedHeights=[]; for(const c of accepted) for(const m of c.members) acceptedHeights.push(heightOf(m));
  return {filtered, labels, glyphs, chains, accepted, refinedReference:acceptedHeights.length?median(acceptedHeights):reference};
}

/* CPU core — testable without a GPU.
     rawBinary    : Sauvola binary (W*H, 0/1)
     healedBinary : rawBinary dilated by 1 px (labels are built on this)
     params       : {components:{minArea,connectivity8},
                     textLines:{minGlyphHeight,maxGlyphHeight,maxGlyphAspect,
                                chainGap,minOverlap,minGlyphs}}             */
export function analyseTextLines(rawBinary,healedBinary,W,H,params,luma=null){
  const N=W*H;
  const cc=cca(healedBinary,W,H,params.components.connectivity8);
  const components=[];
  for(let l=0;l<cc.count;l++){
    if(cc.area[l]>=params.components.minArea) components.push({label:l,area:cc.area[l],
      bb:{x0:cc.bx0[l],y0:cc.by0[l],x1:cc.bx1[l],y1:cc.by1[l]},start:cc.start[l]});
  }
  const reference0=referenceHeight(components);
  let result=chainAndValidate(components,cc.labels,rawBinary,W,H,params,reference0,cc.count);
  let reference=reference0, refined=false;
  if(result.refinedReference>0 && Math.abs(result.refinedReference-reference0)>0.15*reference0){
    result=chainAndValidate(components,cc.labels,rawBinary,W,H,params,result.refinedReference,cc.count);
    reference=result.refinedReference; refined=true;
  }
  const {filtered,labels,glyphs,chains}=result;
  let accepted=result.accepted;

  /* off-page rejection: on a photo the desk around the paper is dark and
     its texture yields text-like chains. The paper under a real line is
     bright; a chain whose local background is far darker than the page's
     is off the paper (or inside a dark stamp / photo) and is rejected. */
  let offPage=0;
  if(luma){
    const backgroundOf=chain=>{
      const lh=chain.heightMed||reference, pad=Math.round(0.5*lh);
      const x0=Math.max(0,chain.bb.x0-pad), x1=Math.min(W-1,chain.bb.x1+pad), y0=Math.max(0,chain.bb.y0-pad), y1=Math.min(H-1,chain.bb.y1+pad);
      const step=Math.max(1,Math.floor(Math.sqrt((x1-x0+1)*(y1-y0+1)/600)));
      const values=[];
      for(let y=y0;y<=y1;y+=step) for(let x=x0;x<=x1;x+=step){ const i=y*W+x; if(!rawBinary[i]) values.push(luma[i]); }
      return values.length?median(values):255;
    };
    for(const c of accepted) c.background=backgroundOf(c);
    const page=weightedMedian(accepted.map(c=>c.background), accepted.map(c=>c.members.length));
    for(const c of accepted){ if(c.background<0.55*page){ c.accepted=false; c.reason='off-page (dark background)'; offPage++; } }
    if(offPage) accepted=chains.filter(c=>c.accepted);
  }

  // full lines; a full line that is one lone glyph joined to nothing is a
  // stray mark: reject the chain and rebuild so it also leaves the binary
  let fullLines=buildFullLines(accepted,0,0.5);
  let dropped=0;
  for(const row of fullLines.rows){
    if(row.lines.length===1 && row.words===1){ row.lines[0].accepted=false; row.lines[0].reason='isolated glyph'; dropped++; }
  }
  if(dropped){ accepted=chains.filter(c=>c.accepted); fullLines=buildFullLines(accepted,0,0.5); }

  /* punctuation recovery: periods, commas, apostrophes and decimal points
     are too short for the component filter, but a small component that
     lies INSIDE an accepted line's box (and is not dust-sized) is part of
     that line — an invoice without its decimal points is useless */
  let punctuation=0;
  /* attach one small component to the nearest accepted line whose vertical
     band contains it and that lies within `reach` × line height of it */
  const attach=(comp,reach)=>{
    const h=comp.bb.y1-comp.bb.y0+1, w=comp.bb.x1-comp.bb.x0+1;
    if(h<0.06*reference || w>1.5*reference) return false;
    let best=null, bestGap=1/0;
    for(const chain of accepted){
      const lh=chain.heightMed;
      if(h>0.6*lh) continue;                                   // punctuation is small; page-edge fragments are glyph-sized
      const cy=(comp.bb.y0+comp.bb.y1)/2;
      if(cy<chain.bb.y0-0.2*lh || cy>chain.bb.y1+0.2*lh) continue;
      const gap=Math.max(0, chain.bb.x0-comp.bb.x1-1, comp.bb.x0-chain.bb.x1-1);
      if(gap>reach*lh || gap>=bestGap) continue;
      bestGap=gap; best=chain;
    }
    if(!best) return false;
    comp.punctuation=true; best.members.push(comp); best.members.sort((a,b)=>a.bb.x0-b.bb.x0);
    best.words=best.members; punctuation++;
    return true;
  };
  // (a) components the height filter dropped as too short: periods,
  //     commas, decimal points — inside a line's box
  const smallStatus=filtered.summary.labelStatus;
  for(const comp of components){ if(smallStatus[comp.label]===2 /* HF_SMALL */) attach(comp,0.5); }
  // (b) lone chains rejected as dash-like / too small / solid: hyphens,
  //     minus signs, colon dots, apostrophes — a dash never links into
  //     its line (its height differs from the digits by more than 3:1),
  //     so it can only be recovered by adjacency
  for(const chain of chains){
    if(chain.accepted || chain.members.length!==1) continue;
    if(!/^lone, (dash-like|too small|fill)/.test(chain.reason) && chain.reason!=='too few glyphs') continue;
    if(attach(chain.members[0],1.0)) chain.reason+=' → attached to line';
  }

  const cleanBinary=new Uint8Array(N);
  const keepLabel=new Uint8Array(filtered.labelCount);
  for(const c of accepted) for(const m of c.members) keepLabel[m.label]=1;
  for(let i=0;i<N;i++){ const l=labels[i]; if(l>=0 && keepLabel[l] && rawBinary[i]) cleanBinary[i]=1; }

  return {
    rawBinary, healedBinary, cleanBinary,
    labels, componentCount:cc.count,
    glyphs, componentsAll:filtered.all, labelToGlyph:filtered.labelToKept, labelToComponent:filtered.labelToAll,
    heightFilter:filtered.summary,
    chains, accepted, fullLines,
    stats:{components:components.length, glyphs:glyphs.length, chains:chains.length,
           accepted:accepted.length, rejected:chains.length-accepted.length,
           fullLines:fullLines.rows.length, slope:fullLines.slope, reference, reference0, refined, punctuation, offPage}
  };
}

/* GPU entry used by the pipeline.  eraseMask (Uint8Array W*H, optional)
   marks the pixels of detected rules; they are cleared from the binary
   before the heal so no rule remnant can join a line.                  */
export async function detectTextLines(imageData,params,eraseMask=null){
  const W=S.W, H=S.H;
  const raw=await gpuSauvola(imageData,params.sauvola);
  const px=imageData.data, luma=new Uint8Array(W*H);
  for(let i=0,j=0;i<W*H;i++,j+=4) luma[i]=(0.299*px[j]+0.587*px[j+1]+0.114*px[j+2])|0;
  let erased=false;
  if(eraseMask){ for(let i=0;i<raw.length;i++) if(eraseMask[i]){ raw[i]=0; erased=true; } }
  let healed;
  if(S.device && S.gpuBuf){
    if(erased) await gpuUploadBinary(raw);                  // the GPU buffer must hold the erased mask, not the raw Sauvola one
    healed=await gpuDilate(1,1);
  } else healed=dilateCPU(raw,W,H,1,1);
  const result=analyseTextLines(raw,healed,W,H,params,luma);
  result.luma=luma;                                          // the recognition stage crops from it
  return result;
}
