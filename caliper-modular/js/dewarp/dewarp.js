/* ======================================================================
   CURL DEWARPING  ·  non-rigid baseline correction
   Why: perspective rectification is a homography — the exact model for a
   FLAT plane. A photographed sheet that is smoothly curled or bent is not
   a plane, so after rectification a curled region is still distorted: its
   text-line baselines bow, and no 8-parameter transform can lift them
   (8 numbers cannot describe a curved surface). This stage removes that
   residual the only way a non-planar warp can be — a dense displacement
   field.

   Method — text-line dewarping, no ML: on a flat page every text line is
   straight and horizontal. The word boxes are grouped into text rows;
   each adequately-sampled row's baseline is fitted as a quadratic (a
   smooth curl is a single bowl); a vertical displacement field is built
   that straightens every baseline at once; the image is resampled. It
   corrects the APPEARANCE — straight baselines, which is what row/table
   detection needs — not true 3D.

   Conservative + gated: it dewarps only when the baselines are genuinely
   bowed and enough text rows are found; a flat page passes straight
   through. Vertical-only — it straightens row curvature (the dominant
   effect); residual horizontal scale drift near the curl is left as-is.
   Self-contained: Canvas2D + plain JS, no imports.
   ====================================================================== */

/* Solve a 3x3 linear system by Gaussian elimination with partial pivot. */
function solve3(A,b){
  const M=[A[0].slice(),A[1].slice(),A[2].slice()], v=b.slice();
  for(let c=0;c<3;c++){
    let p=c;
    for(let r=c+1;r<3;r++) if(Math.abs(M[r][c])>Math.abs(M[p][c])) p=r;
    if(Math.abs(M[p][c])<1e-12) return null;
    [M[c],M[p]]=[M[p],M[c]]; [v[c],v[p]]=[v[p],v[c]];
    for(let r=c+1;r<3;r++){
      const f=M[r][c]/M[c][c];
      for(let k=c;k<3;k++) M[r][k]-=f*M[c][k];
      v[r]-=f*v[c];
    }
  }
  const x=[0,0,0];
  for(let r=2;r>=0;r--){
    let s=v[r]; for(let k=r+1;k<3;k++) s-=M[r][k]*x[k];
    x[r]=s/M[r][r];
  }
  return x;
}
/* Least-squares quadratic y = a(x-xm)^2 + b(x-xm) + c through the points.
   x is centred on its mean for numerical conditioning. */
function fitQuad(pts){
  let xm=0; for(const p of pts) xm+=p.x; xm/=pts.length;
  let S0=pts.length,S1=0,S2=0,S3=0,S4=0,Sy=0,Sxy=0,Sx2y=0;
  for(const p of pts){
    const x=p.x-xm, x2=x*x, y=p.y;
    S1+=x; S2+=x2; S3+=x2*x; S4+=x2*x2;
    Sy+=y; Sxy+=x*y; Sx2y+=x2*y;
  }
  const s=solve3([[S4,S3,S2],[S3,S2,S1],[S2,S1,S0]],[Sx2y,Sxy,Sy]);
  return s?{a:s[0],b:s[1],c:s[2],xm}:null;
}
/* Max deviation of the points from their least-squares straight line —
   the row's "bow", used to decide whether the page is curled at all. */
function lineBow(pts){
  let xm=0; for(const p of pts) xm+=p.x; xm/=pts.length;
  const n=pts.length; let Sx=0,Sy=0,Sxx=0,Sxy=0;
  for(const p of pts){ const x=p.x-xm; Sx+=x; Sy+=p.y; Sxx+=x*x; Sxy+=x*p.y; }
  const det=n*Sxx-Sx*Sx; if(Math.abs(det)<1e-9) return 0;
  const m=(n*Sxy-Sx*Sy)/det, k=(Sy-m*Sx)/n;
  let bow=0;
  for(const p of pts) bow=Math.max(bow,Math.abs(p.y-(m*(p.x-xm)+k)));
  return bow;
}

/* Straighten smoothly curved text-line baselines. `words` is a list of
   {cx,cy,h} word-box centres in the canvas' coordinates. Returns a new
   W x H canvas, or null when the page is flat enough to leave untouched. */
export function dewarpCurl(canvas, words, also=[]){
  // `also`: further W×H canvases to resample with the SAME field (the
  // rules-erased raster and the original must stay in register). They
  // come back on the returned canvas as out.also[].
  const W=canvas.width, H=canvas.height;
  if(W<64||H<64 || !words || words.length<20) return null;

  // typical text height
  const hs=words.map(w=>w.h).filter(h=>h>0).sort((a,b)=>a-b);
  if(hs.length<20) return null;
  const medH=hs[hs.length>>1] || 10;

  // group word centres into text rows by vertical gap
  const ws=words.slice().sort((a,b)=>a.cy-b.cy);
  const rows=[]; let cur=[ws[0]];
  for(let i=1;i<ws.length;i++){
    if(ws[i].cy-ws[i-1].cy > 0.7*medH){ rows.push(cur); cur=[]; }
    cur.push(ws[i]);
  }
  rows.push(cur);

  // fit each adequately-sampled row's baseline as a quadratic
  const fitted=[];                          // {a,b,c,xm,t,x0,x1}
  let maxBow=0;
  for(const r of rows){
    if(r.length<5) continue;                // too few words for a stable fit
    let x0=1/0,x1=-1/0;
    for(const w of r){ if(w.cx<x0)x0=w.cx; if(w.cx>x1)x1=w.cx; }
    if(x1-x0 < 0.25*W) continue;            // row must span enough of the page
    const pts=r.map(w=>({x:w.cx,y:w.cy}));
    const q=fitQuad(pts); if(!q) continue;
    maxBow=Math.max(maxBow, lineBow(pts));
    let t=0; for(const p of pts) t+=p.y; t/=pts.length;
    fitted.push({a:q.a,b:q.b,c:q.c,xm:q.xm, t, x0,x1});
  }

  // gate: enough rows, and the baselines genuinely bowed
  if(fitted.length<4) return null;
  if(maxBow < 0.5*medH) return null;        // already straight — pass through
  fitted.sort((p,q)=>p.t-q.t);
  const R=fitted.length, clampD=3*medH;

  // resample with the straightening displacement field. For output pixel
  // (x,y), the displacement D is interpolated between text rows; the
  // source pixel is (x, y+D). Vertical-only — columns stay in place.
  const sd=canvas.getContext('2d').getImageData(0,0,W,H).data;
  const out=document.createElement('canvas'); out.width=W; out.height=H;
  const octx=out.getContext('2d',{willReadFrequently:true});
  const oImg=octx.createImageData(W,H), od=oImg.data;
  for(let i=0;i<od.length;i+=4){ od[i]=od[i+1]=od[i+2]=255; od[i+3]=255; }
  const extra=also.map(c=>{ const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const cx=cv.getContext('2d',{willReadFrequently:true}); const img=cx.createImageData(W,H);
    const d=img.data; for(let i=0;i<d.length;i+=4){ d[i]=d[i+1]=d[i+2]=255; d[i+3]=255; }
    return {cv,cx,img,d, sd:c.getContext('2d').getImageData(0,0,W,H).data}; });
  const D=new Float64Array(R);
  for(let x=0;x<W;x++){
    // each row's displacement at this column = baseline_y - straight_target
    for(let r=0;r<R;r++){
      const f=fitted[r];
      const xe = x<f.x0?f.x0 : (x>f.x1?f.x1:x);   // hold baseline flat past the words
      const xc = xe-f.xm;
      let d = (f.a*xc*xc + f.b*xc + f.c) - f.t;
      if(d>clampD)d=clampD; else if(d<-clampD)d=-clampD;
      D[r]=d;
    }
    let ri=0, prevSrc=-1;
    for(let y=0;y<H;y++){
      while(ri<R-1 && fitted[ri+1].t<=y) ri++;
      let disp;
      if(y<=fitted[0].t) disp=D[0];                    // above the first row
      else if(y>=fitted[R-1].t) disp=D[R-1];           // below the last row
      else {
        const t0=fitted[ri].t, t1=fitted[ri+1].t;
        disp=D[ri]+(D[ri+1]-D[ri])*((y-t0)/((t1-t0)||1));
      }
      let sy=y+disp;
      if(sy<prevSrc) sy=prevSrc;                       // forbid the map folding
      prevSrc=sy;
      if(sy<0||sy>=H-1) continue;
      const y0=sy|0, fy=sy-y0;
      const o=(y*W+x)*4, i0=(y0*W+x)*4, i1=((y0+1)*W+x)*4;
      for(let k=0;k<3;k++) od[o+k]=(sd[i0+k]+(sd[i1+k]-sd[i0+k])*fy)|0;
      for(const e of extra) for(let k=0;k<3;k++) e.d[o+k]=(e.sd[i0+k]+(e.sd[i1+k]-e.sd[i0+k])*fy)|0;
    }
  }
  octx.putImageData(oImg,0,0);
  out.also=extra.map(e=>{ e.cx.putImageData(e.img,0,0); return e.cv; });
  return out;
}
