/* ======================================================================
   SKEW DETECTION & CORRECTION
   Why: scanned invoices are rarely level. Left uncorrected, every OBB
   inherits the tilt and the table grid shears. detectSkew scores candidate
   angles by how sharply the text collapses into rows (envelope-removed
   projection profile); buildDeskew rotates the raster upright so the
   after-rotate pass and table analysis run in a level coordinate frame.
   ====================================================================== */
import { S } from './state.js';

/* =====================================================================
   SKEW DETECTION + CORRECTION
   Detection works on a downscaled Sobel edge map (uniform regions —
   page, vignette, the solid corners left by a prior rotation — give
   zero gradient, so they cannot bias the result). The edges are then
   strongly dilated horizontally so each text line collapses into one
   solid bar. For every candidate angle the bars are binned into rotated
   rows; the score is the energy of the profile AFTER its slow envelope
   is removed, which isolates the line/gap texture from the page's gross
   aspect ratio (the latter otherwise pins the answer to a search edge).
   The best angle is the one whose rows are sharpest.
   ===================================================================== */
export function detectSkew(img,maxDeg){
  // ---- 1. downscale (skew angle is scale-invariant; keep line gaps) ----
  const long=Math.max(img.naturalWidth,img.naturalHeight);
  const sc=Math.min(1,1000/long);
  const sw=Math.max(32,Math.round(img.naturalWidth*sc));
  const sh=Math.max(32,Math.round(img.naturalHeight*sc));
  const c=document.createElement('canvas'); c.width=sw; c.height=sh;
  const cx=c.getContext('2d',{willReadFrequently:true});
  cx.fillStyle='#fff'; cx.fillRect(0,0,sw,sh);   // composite (transparent PNGs)
  cx.drawImage(img,0,0,sw,sh);
  const px=cx.getImageData(0,0,sw,sh).data, Np=sw*sh;

  // ---- 2. grayscale ----
  const g=new Float32Array(Np);
  for(let i=0,j=0;i<Np;i++,j+=4)
    g[i]=0.299*px[j]+0.587*px[j+1]+0.114*px[j+2];

  // ---- 3. Sobel edge map (mean-relative threshold) ----
  const mag=new Float32Array(Np); let gsum=0;
  for(let y=1;y<sh-1;y++){
    for(let x=1;x<sw-1;x++){
      const i=y*sw+x;
      const gx=(g[i-sw+1]+2*g[i+1]+g[i+sw+1])-(g[i-sw-1]+2*g[i-1]+g[i+sw-1]);
      const gy=(g[i+sw-1]+2*g[i+sw]+g[i+sw+1])-(g[i-sw-1]+2*g[i-sw]+g[i-sw+1]);
      const m=Math.abs(gx)+Math.abs(gy);
      mag[i]=m; gsum+=m;
    }
  }
  const eThr=(gsum/Np)*1.2;
  const edge=new Uint8Array(Np);
  for(let i=0;i<Np;i++) edge[i]=mag[i]>eThr?1:0;

  // ---- 4. strong horizontal dilation -> one solid bar per text line ----
  const r=Math.max(2,Math.round(sw/22));
  const bar=new Uint8Array(Np);
  for(let y=0;y<sh;y++){
    const row=y*sw; let cnt=0;
    for(let x=0;x<=Math.min(sw-1,r);x++) cnt+=edge[row+x];
    for(let x=0;x<sw;x++){
      bar[row+x]=cnt>0?1:0;
      const add=x+r+1, rem=x-r;
      if(add<sw) cnt+=edge[row+add];
      if(rem>=0) cnt-=edge[row+rem];
    }
  }

  // ---- 5. centred foreground point list (subsample if very dense) ----
  let fx=[],fy=[]; const cxh=sw/2,cyh=sh/2;
  for(let y=0;y<sh;y++){const row=y*sw;
    for(let x=0;x<sw;x++) if(bar[row+x]){ fx.push(x-cxh); fy.push(y-cyh); }
  }
  if(fx.length<80) return 0;
  if(fx.length>240000){
    const ssx=[],ssy=[];
    for(let i=0;i<fx.length;i+=2){ ssx.push(fx[i]); ssy.push(fy[i]); }
    fx=ssx; fy=ssy;
  }

  // ---- 6. projection-profile search with envelope-removed scoring ----
  const profLen=Math.ceil(Math.hypot(sw,sh))+4, mid=profLen>>1;
  const prof=new Float32Array(profLen), pre=new Float32Array(profLen+1);
  const envWin=Math.max(9,(Math.round(profLen/14)|1));   // odd, ~ several line pitches
  const hw=envWin>>1;
  const score=deg=>{
    prof.fill(0);
    const rad=deg*Math.PI/180, s=Math.sin(rad), co=Math.cos(rad);
    for(let i=0;i<fx.length;i++){
      const ry=(fx[i]*s + fy[i]*co + mid)|0;
      if(ry>=0 && ry<profLen) prof[ry]++;
    }
    pre[0]=0;
    for(let r2=0;r2<profLen;r2++) pre[r2+1]=pre[r2]+prof[r2];
    let e=0;                                     // sum of squared high-pass residuals
    for(let r2=0;r2<profLen;r2++){
      const lo=r2-hw<0?0:r2-hw, hi=r2+hw>=profLen?profLen-1:r2+hw;
      const env=(pre[hi+1]-pre[lo])/(hi-lo+1);
      const d=prof[r2]-env;
      e+=d*d;
    }
    return e;
  };
  let best=0,bestS=-1;
  const lim=maxDeg+2;                             // small margin past the slider limit
  for(let a=-lim;a<=lim+1e-6;a+=0.5){             // coarse 0.5° sweep
    const e=score(a); if(e>bestS){bestS=e;best=a;}
  }
  for(let a=best-0.6;a<=best+0.6+1e-6;a+=0.1){    // 0.1° refinement around peak
    const e=score(a); if(e>bestS){bestS=e;best=a;}
  }
  return best;
}

/* draw the source rotated to level the text, into S.deskewCanvas.
   detectSkew returns the angle that, passed straight to ctx.rotate,
   re-levels the page (verified against synthetic skews), so the
   correction IS that angle. The readout names the rotate-back with the
   opposite sign — the same physical turn expressed in the page-tilt
   convention the user thinks in.
   Exposed corners are filled solid white — uniform regions yield no
   Sauvola foreground, so they don't pollute CCA. */
export function buildDeskew(angleDeg){
  const W=S.W,H=S.H;
  if(!S.deskewCanvas || S.deskewCanvas.width!==W || S.deskewCanvas.height!==H){
    S.deskewCanvas=document.createElement('canvas');
    S.deskewCanvas.width=W; S.deskewCanvas.height=H;
  }
  const ctx=S.deskewCanvas.getContext('2d',{willReadFrequently:true});
  ctx.setTransform(1,0,0,1,0,0);
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
  const correction = angleDeg;                   // detectSkew returns the ctx.rotate angle that re-levels the text
  if(Math.abs(correction)>1e-3){
    ctx.save();
    ctx.translate(W/2,H/2);
    ctx.rotate(correction*Math.PI/180);
    ctx.translate(-W/2,-H/2);
    ctx.drawImage(S.img,0,0,W,H);
    ctx.restore();
  }else{
    ctx.drawImage(S.img,0,0,W,H);
  }
  S.deskewImageData=ctx.getImageData(0,0,W,H);
}


/* one full Sauvola → dilate → CCA → contour → hull → calipers → OBB pass.
   `dil` = {h,v} dilation radii; returns all per-pass intermediates. */
