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
   Returns {hMax, slope, rows:[{bb, ink, dy, poly, centerline, lines:[...],
   words}]} sorted top → bottom, each row's lines sorted left → right.
   `slope` is the estimated page tilt (dy/dx) used for the join; `dy` is
   the row's de-skewed vertical extent; `poly` is the closed outline that
   follows the pieces and `centerline` the left → right reading path.  */
export function buildFullLines(lineResult,hMax,minOverlap){
  const src=lineResult.lines.slice();
  if(!src.length) return {hMax:hMax||0, slope:0, rows:[]};
  const hOf=b=>b.y1-b.y0+1;

  /* --- page slope ---------------------------------------------------
     On a photographed or skewed page a text row drifts vertically as it
     crosses the page, so row N on the left can sit level with row N-1
     on the right. Joining by raw vertical overlap would then chain
     pieces of neighbouring rows into one "line". The slope is estimated
     from the pieces themselves: a least-squares line through the member
     centres of every wide piece with ≥ 4 members, combined as a
     member-weighted median. Every vertical comparison below is done in
     the de-skewed frame y' = y − slope·x.                              */
  const slopes=[], wts=[];
  for(const ln of src){
    const ws=ln.words||[]; if(ws.length<4) continue;
    if(ln.ink.x1-ln.ink.x0+1 < 3*hOf(ln.ink)) continue;
    let sx=0,sy=0,sxx=0,sxy=0,n=0;
    for(const m of ws){ const cx=(m.bb.x0+m.bb.x1)/2, cy=(m.bb.y0+m.bb.y1)/2;
      sx+=cx; sy+=cy; sxx+=cx*cx; sxy+=cx*cy; n++; }
    const d=n*sxx-sx*sx; if(d<=0) continue;
    slopes.push((n*sxy-sx*sy)/d); wts.push(n);
  }
  let slope=0;
  if(slopes.length){
    const ix=slopes.map((_,i)=>i).sort((a,b)=>slopes[a]-slopes[b]);
    let tot=0; for(const w of wts) tot+=w; let acc=0;
    for(const i of ix){ acc+=wts[i]; if(acc>=tot/2){ slope=slopes[i]; break; } }
  }
  // de-skewed vertical extent of a piece = union of its members' extents,
  // each shifted by the slope at that member's own x
  const dsk=ln=>{
    const ws=ln.words&&ln.words.length?ln.words:null;
    if(!ws){ const cx=(ln.ink.x0+ln.ink.x1)/2; return {y0:ln.ink.y0-slope*cx, y1:ln.ink.y1-slope*cx}; }
    let y0=1/0,y1=-1/0;
    for(const m of ws){ const cx=(m.bb.x0+m.bb.x1)/2;
      const a=m.bb.y0-slope*cx, b=m.bb.y1-slope*cx; if(a<y0)y0=a; if(b>y1)y1=b; }
    return {y0,y1};
  };
  for(const ln of src) ln.dy=dsk(ln);
  if(!(hMax>0)){
    const hs=src.map(l=>hOf(l.dy)).sort((a,b)=>a-b);
    hMax=1.6*hs[hs.length>>1];
  }
  // process pieces top→bottom (de-skewed); each joins the first row it is
  // compatible with, otherwise starts a new row.
  src.sort((a,b)=>a.dy.y0-b.dy.y0 || a.ink.x0-b.ink.x0);
  const wOf=b=>b.x1-b.x0+1;
  // horizontal overlap tolerance: a couple of pixels of dilation slop only
  const xTol=(a,b)=>Math.max(2,0.05*Math.min(wOf(a),wOf(b)));
  /* --- joining --------------------------------------------------------
     A piece is judged against its NEAREST piece in a candidate row (the
     closest in x), not against the row as a whole: the vertical-overlap
     and one-line-height tests are local. This keeps one odd piece (a
     tall fragment, a glyph with a pen mark) from poisoning a whole row,
     and lets a gently curled row, whose far ends sit at different
     heights, still join piece by piece. The one-piece-per-x rule is
     checked against every piece of the row.                            */
  const rows=[];
  for(const ln of src){
    const b=ln.ink, d=ln.dy; let home=null, bestScore=-1;
    for(const r of rows){
      let stacked=false, near=null, nearDist=1/0;
      for(const m of r.lines){ const a=m.ink;
        const xo=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0)+1;
        if(xo>xTol(a,b)){ stacked=true; break; }      // sits over an existing piece
        const dist=a.x1<b.x0 ? b.x0-a.x1 : a.x0-b.x1;
        if(dist<nearDist){ nearDist=dist; near=m; } }
      if(stacked || !near) continue;
      const nd=near.dy;
      const ov=Math.min(nd.y1,d.y1)-Math.max(nd.y0,d.y0)+1;
      const mh=Math.min(hOf(nd),hOf(d));
      if(ov<minOverlap*mh) continue;
      if(Math.max(nd.y1,d.y1)-Math.min(nd.y0,d.y0)+1>hMax) continue;   // would become two lines
      const score=ov/mh;
      if(score>bestScore){ bestScore=score; home=r; }
    }
    if(home){
      home.lines.push(ln);
      home.ink={x0:Math.min(home.ink.x0,b.x0),y0:Math.min(home.ink.y0,b.y0),
                x1:Math.max(home.ink.x1,b.x1),y1:Math.max(home.ink.y1,b.y1)};
      home.bb ={x0:Math.min(home.bb.x0,ln.bb.x0),y0:Math.min(home.bb.y0,ln.bb.y0),
                x1:Math.max(home.bb.x1,ln.bb.x1),y1:Math.max(home.bb.y1,ln.bb.y1)};
      home.dy ={y0:Math.min(home.dy.y0,d.y0), y1:Math.max(home.dy.y1,d.y1)};
    } else {
      rows.push({lines:[ln], ink:{...b}, bb:{...ln.bb}, dy:{...d}});
    }
  }
  for(const r of rows){
    r.lines.sort((a,b)=>a.ink.x0-b.ink.x0);
    r.words=r.lines.reduce((n,l)=>n+l.words.length,0);
    /* --- polygon outline ------------------------------------------
       A full line is NOT its bounding rectangle: on a tilted page that
       rectangle is tall and overlaps the neighbouring rows. Instead the
       outline follows the pieces — top edge along the top of each piece
       box left → right, bottom edge back along the bottoms right → left,
       with the gaps between pieces bridged by straight segments. The
       centreline joins the piece centres and is the row's reading path. */
    const top=[], bot=[], ctr=[];
    for(const ln of r.lines){ const b=ln.ink;
      top.push({x:b.x0,y:b.y0},{x:b.x1+1,y:b.y0});
      bot.push({x:b.x0,y:b.y1+1},{x:b.x1+1,y:b.y1+1});
      const cy=(b.y0+b.y1+1)/2; ctr.push({x:b.x0,y:cy},{x:b.x1+1,y:cy}); }
    r.poly=top.concat(bot.reverse());
    r.centerline=ctr;
  }
  rows.sort((a,b)=>a.dy.y0-b.dy.y0 || a.ink.x0-b.ink.x0);
  return {hMax, slope, slopeN:slopes.length, rows};
}
