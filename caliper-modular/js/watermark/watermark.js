/* ======================================================================
   WATERMARK REMOVAL  ·  keep the ink, return the rest to paper
   Why: many invoices carry a large printed watermark — a company logo,
   a "PAID" stamp in light grey — behind the item table. It is big and
   low-contrast; the ink is small and high-contrast. Sauvola sees both,
   and the watermark's edges then break into false glyphs and rules.
   The removal works on that contrast difference alone:
     1. the PAPER TONE at every pixel is the local maximum of the
        luminance over a window wider than a text line (taken at 1/8
        scale, max-filtered, box-blurred twice, upsampled bilinearly).
        Inside a watermark no true paper is visible within the window,
        so the paper tone there IS the watermark's grey;
     2. every pixel's CONTRAST against that tone (1 − luma / paper) says
        what it is: at or below the watermark contrast → returned to the
        paper tone (its own colour scaled up to the paper luminance, so
        the photo's cream stays cream); at or above 1.8 × that → ink,
        kept as it is; between → blended.
   Text printed over the watermark keeps its contrast against the
   watermark grey and survives; pen strokes, stamps and rules are dark
   enough to survive too. The desk around the page is its own local
   maximum and passes through unchanged.
   ====================================================================== */

/* src      : ImageData of the loaded image
   contrast : contrast (0–1) at or below which a pixel is watermark, e.g. 0.15
   window   : paper-tone window in px (default 48: wider than a text line)
   Returns {imageData, canvas, stats:{ms, watermarkPixels, paperMedian}}  */
export function removeWatermark(src,{contrast=0.15, window=48}={}){
  const t0=performance.now();
  const W=src.width, H=src.height, N=W*H, d=src.data;
  const luma=new Float32Array(N);
  for(let i=0,j=0;i<N;i++,j+=4) luma[i]=0.299*d[j]+0.587*d[j+1]+0.114*d[j+2];

  /* --- 1 · paper tone at 1/8 scale ------------------------------------ */
  const ds=8, w=Math.ceil(W/ds), h=Math.ceil(H/ds);
  let small=new Float32Array(w*h);
  for(let y=0;y<H;y++){ const row=y*W, k0=(y>>3)*w;
    for(let x=0;x<W;x++){ const v=luma[row+x], k=k0+(x>>3); if(v>small[k]) small[k]=v; } }
  const r=Math.max(1,Math.round(window/ds/2));
  const maxPass=(inp,horizontal)=>{ const out=new Float32Array(w*h);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let m=0;
      if(horizontal){ for(let k=Math.max(0,x-r);k<=Math.min(w-1,x+r);k++){ const v=inp[y*w+k]; if(v>m) m=v; } }
      else { for(let k=Math.max(0,y-r);k<=Math.min(h-1,y+r);k++){ const v=inp[k*w+x]; if(v>m) m=v; } }
      out[y*w+x]=m; }
    return out; };
  small=maxPass(maxPass(small,true),false);
  const blurPass=(inp,horizontal)=>{ const out=new Float32Array(w*h);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){ let s=0,n=0;
      if(horizontal){ for(let k=Math.max(0,x-r);k<=Math.min(w-1,x+r);k++){ s+=inp[y*w+k]; n++; } }
      else { for(let k=Math.max(0,y-r);k<=Math.min(h-1,y+r);k++){ s+=inp[k*w+x]; n++; } }
      out[y*w+x]=s/n; }
    return out; };
  for(let pass=0;pass<2;pass++) small=blurPass(blurPass(small,true),false);

  /* --- 2 · contrast against the paper tone → keep, blend or return ---- */
  const low=Math.max(0.02,contrast), high=Math.min(0.95,low*1.8);
  const out=new ImageData(W,H), o=out.data;
  let watermarkPixels=0;
  const paperSamples=[];
  for(let y=0;y<H;y++){
    const fy=Math.max(0,Math.min(h-1,(y+0.5)/ds-0.5)), y0=Math.floor(fy), y1=Math.min(h-1,y0+1), ty=fy-y0;
    for(let x=0;x<W;x++){
      const fx=Math.max(0,Math.min(w-1,(x+0.5)/ds-0.5)), x0=Math.floor(fx), x1=Math.min(w-1,x0+1), tx=fx-x0;
      const paper=(small[y0*w+x0]*(1-tx)+small[y0*w+x1]*tx)*(1-ty)+(small[y1*w+x0]*(1-tx)+small[y1*w+x1]*tx)*ty;
      const i=y*W+x, j=i*4, l=luma[i];
      const c=paper>1?1-l/paper:0;
      let wgt; if(c<=low) wgt=0; else if(c>=high) wgt=1; else { const t=(c-low)/(high-low); wgt=t*t*(3-2*t); }
      if(wgt>=1){ o[j]=d[j]; o[j+1]=d[j+1]; o[j+2]=d[j+2]; o[j+3]=255; continue; }
      const f=l>1?paper/l:1;                                   // this pixel lifted to the paper luminance, hue kept
      for(let ch=0;ch<3;ch++){ const p=Math.min(255,d[j+ch]*f); o[j+ch]=p+wgt*(d[j+ch]-p); }
      o[j+3]=255;
      if(c>0.04) watermarkPixels++;
      if(((x|y)&255)===0) paperSamples.push(paper);
    }
  }
  const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H;
  canvas.getContext('2d',{willReadFrequently:true}).putImageData(out,0,0);
  paperSamples.sort((a,b)=>a-b);
  return {imageData:out, canvas, stats:{ms:performance.now()-t0, watermarkPixels, paperMedian:paperSamples.length?paperSamples[paperSamples.length>>1]:0, contrast:low, window}};
}
