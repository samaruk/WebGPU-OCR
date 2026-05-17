/* ======================================================================
   SECTION 2 · CONNECTED-COMPONENT ANALYSIS  (CPU union-find)
   Why: after thresholding the mask is only on/off pixels. CCA is the step
   that turns it into discrete blobs — the candidate words. Union-find labels
   every component in a near-linear single pass; every later geometric stage
   runs per-component, so this is the bridge from pixels to objects.
   ====================================================================== */
/* =====================================================================
   2. CONNECTED-COMPONENT ANALYSIS  (CPU union-find)
   ===================================================================== */
export function cca(bin,W,H,conn8){
  const N=W*H;
  const par=new Int32Array(N);
  for(let i=0;i<N;i++) par[i]=bin[i]?i:-1;
  const find=x=>{let r=x;while(par[r]!==r)r=par[r];while(par[x]!==r){const n=par[x];par[x]=r;x=n;}return r;};
  const uni=(a,b)=>{const ra=find(a),rb=find(b);if(ra!==rb)par[ra]=rb;};
  for(let y=0;y<H;y++){
    const row=y*W;
    for(let x=0;x<W;x++){
      const i=row+x;
      if(!bin[i]) continue;
      if(x>0 && bin[i-1]) uni(i,i-1);
      if(y>0){
        if(bin[i-W]) uni(i,i-W);
        if(conn8){
          if(x>0   && bin[i-W-1]) uni(i,i-W-1);
          if(x<W-1 && bin[i-W+1]) uni(i,i-W+1);
        }
      }
    }
  }
  // compact labels + per-label area & bbox + start pixel
  const labels=new Int32Array(N).fill(-1);
  const map=new Map();
  const area=[], bx0=[],by0=[],bx1=[],by1=[],start=[];
  let count=0;
  for(let y=0;y<H;y++){
    const row=y*W;
    for(let x=0;x<W;x++){
      const i=row+x;
      if(!bin[i]) continue;
      const r=find(i);
      let l=map.get(r);
      if(l===undefined){
        l=count++; map.set(r,l);
        area[l]=0; bx0[l]=x;by0[l]=y;bx1[l]=x;by1[l]=y; start[l]=i;
      }
      labels[i]=l; area[l]++;
      if(x<bx0[l])bx0[l]=x; if(x>bx1[l])bx1[l]=x;
      if(y<by0[l])by0[l]=y; if(y>by1[l])by1[l]=y;
    }
  }
  return {labels,count,area,bx0,by0,bx1,by1,start};
}
