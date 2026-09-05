/* ======================================================================
   PASS-A LINE BLOBS  ·  whole text-line components from clean word blobs
   Why: section 05 guarantees every pass-A blob is a single letter, word
   or line and nothing else. Fusing THOSE blobs horizontally therefore
   yields clean whole-line blobs: rules, logos, borders and multi-line
   merges were already removed, so a strong horizontal dilation cannot
   drag them into a line, and stacked lines stay separate because the
   vertical growth is kept tiny. Each resulting component is one text
   line, with the word blobs that fell inside it attached.
   ====================================================================== */
import { S } from '../state/state.js';
import { gpuUploadBinary, gpuDilate } from '../webgpu/webgpu.js';
import { cca } from '../cca/cca.js';
import { dilateCPU } from '../splitter/splitter.js';

/* pass : a runPass result whose .blobs are the KEPT pass-A blobs and
          whose .labels / .lab2blob describe them
   p    : {lineDilH, lineDilV, conn8}
   Returns {mask, dilated, labels, count, lines:[{label,bb,area,words}]}  */
export async function buildLineBlobs(pass,p){
  const W=S.W, H=S.H, N=W*H;
  // 1 · mask of the kept blobs only (labels that map to a kept blob)
  const mask=new Uint8Array(N);
  const l2b=pass.lab2blob, labels=pass.labels;
  for(let i=0;i<N;i++){ const l=labels[i]; if(l>=0 && l2b[l]>=0) mask[i]=1; }
  // 2 · asymmetric dilation, GPU when available, CPU otherwise
  let dilated;
  if(S.device && S.gpuBuf){
    await gpuUploadBinary(mask);
    dilated=await gpuDilate(p.lineDilH,p.lineDilV);
  } else {
    dilated=dilateCPU(mask,W,H,p.lineDilH,p.lineDilV);
  }
  // 3 · connected components of the fused mask = text lines
  const cc=cca(dilated,W,H,p.conn8);
  const lines=[];
  const lineOf=new Int32Array(cc.count).fill(-1);
  for(let l=0;l<cc.count;l++){
    lineOf[l]=lines.length;
    lines.push({label:l,area:cc.area[l],
      bb:{x0:cc.bx0[l],y0:cc.by0[l],x1:cc.bx1[l],y1:cc.by1[l]},words:[]});
  }
  // 4 · attach each kept word blob to the line under its centre
  for(const bl of pass.blobs){
    const cx=(bl.bb.x0+bl.bb.x1)>>1, cy=(bl.bb.y0+bl.bb.y1)>>1;
    const l=cc.labels[cy*W+cx];
    const li=l>=0?lineOf[l]:-1;
    if(li>=0) lines[li].words.push(bl);
  }
  // lines without a word (cannot happen unless dilation is 0 and a blob
  // centre falls outside its own pixels) are dropped; sort top→bottom
  const kept=lines.filter(ln=>ln.words.length>0);
  kept.sort((a,b)=>a.bb.y0-b.bb.y0 || a.bb.x0-b.bb.x0);
  // tight ink bbox of each line = union of its word boxes
  for(const ln of kept){
    let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0;
    for(const w of ln.words){ if(w.bb.x0<x0)x0=w.bb.x0; if(w.bb.y0<y0)y0=w.bb.y0;
      if(w.bb.x1>x1)x1=w.bb.x1; if(w.bb.y1>y1)y1=w.bb.y1; }
    ln.ink={x0,y0,x1,y1};
  }
  return {mask,dilated,labels:cc.labels,count:cc.count,lines:kept};
}

/* ======================================================================
   FULL LINES  ·  join line blobs left → right across the whole page
   Why: the 05b components stop at every column gutter, so one physical
   text row of a table arrives as several line blobs. Reading order and
   row detection want the entire row. The pieces are joined when they
   overlap vertically, but a join is refused whenever the combined height
   would exceed one line — that is exactly the case of two stacked or
   staggered lines in neighbouring columns, and a "line" must never
   contain more than one line. A join is also refused when the two pieces
   overlap HORIZONTALLY: reading left to right there is exactly one piece
   at any x position, so two pieces sharing an x range are two different
   lines by definition, however small their vertical offset.
     lineResult : output of buildLineBlobs
     hMax       : max single-line height in px (height filter's hMax);
                  when absent it is derived as 1.6 × median line height
     minOverlap : required vertical overlap as a fraction of the shorter
                  piece's height (0..1)
   Returns {hMax, rows:[{bb, ink, lines:[...], words}]} sorted top → bottom,
   each row's lines sorted left → right.                                */
export function buildFullLines(lineResult,hMax,minOverlap){
  const src=lineResult.lines.slice();
  if(!src.length) return {hMax:hMax||0, rows:[]};
  const hOf=b=>b.y1-b.y0+1;
  if(!(hMax>0)){
    const hs=src.map(l=>hOf(l.ink)).sort((a,b)=>a-b);
    hMax=1.6*hs[hs.length>>1];
  }
  // process pieces top→bottom; each joins the first row it is compatible
  // with, otherwise starts a new row.  Compatibility is judged on the
  // tight INK boxes (the dilated boxes are padded by lineDilV).
  src.sort((a,b)=>a.ink.y0-b.ink.y0 || a.ink.x0-b.ink.x0);
  const wOf=b=>b.x1-b.x0+1;
  // horizontal overlap tolerance: a couple of pixels of dilation slop only
  const xTol=(a,b)=>Math.max(2,0.05*Math.min(wOf(a),wOf(b)));
  const rows=[];
  for(const ln of src){
    const b=ln.ink; let home=null;
    for(const r of rows){
      const ov=Math.min(r.ink.y1,b.y1)-Math.max(r.ink.y0,b.y0)+1;
      const need=minOverlap*Math.min(hOf(r.ink),hOf(b));
      if(ov<need) continue;
      const uy0=Math.min(r.ink.y0,b.y0), uy1=Math.max(r.ink.y1,b.y1);
      if(uy1-uy0+1>hMax) continue;                  // would become two lines
      // one piece per x position: refuse if it sits over any existing piece
      let stacked=false;
      for(const m of r.lines){ const a=m.ink;
        const xo=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0)+1;
        if(xo>xTol(a,b)){ stacked=true; break; } }
      if(stacked) continue;
      home=r; break;
    }
    if(home){
      home.lines.push(ln);
      home.ink={x0:Math.min(home.ink.x0,b.x0),y0:Math.min(home.ink.y0,b.y0),
                x1:Math.max(home.ink.x1,b.x1),y1:Math.max(home.ink.y1,b.y1)};
      home.bb ={x0:Math.min(home.bb.x0,ln.bb.x0),y0:Math.min(home.bb.y0,ln.bb.y0),
                x1:Math.max(home.bb.x1,ln.bb.x1),y1:Math.max(home.bb.y1,ln.bb.y1)};
    } else {
      rows.push({lines:[ln], ink:{...b}, bb:{...ln.bb}});
    }
  }
  for(const r of rows){
    r.lines.sort((a,b)=>a.ink.x0-b.ink.x0);
    r.words=r.lines.reduce((n,l)=>n+l.words.length,0);
  }
  rows.sort((a,b)=>a.ink.y0-b.ink.y0 || a.ink.x0-b.ink.x0);
  return {hMax, rows};
}
