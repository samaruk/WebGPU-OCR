/* ======================================================================
   SMALL CPU HELPERS  ·  morphology and smoothing shared by several stages
   ====================================================================== */

/* Separable rectangular dilation of a 0/1 mask (radius dh horizontally,
   dv vertically). Returns a new Uint8Array; the input is not modified. */
export function dilateCPU(src,w,h,dh,dv){
  let cur=src;
  if(dh>0){
    const out=new Uint8Array(w*h);
    for(let y=0;y<h;y++){ const row=y*w;
      for(let x=0;x<w;x++){
        let on=0;
        for(let k=-dh;k<=dh;k++){ const xx=x+k; if(xx>=0&&xx<w&&cur[row+xx]){ on=1; break; } }
        out[row+x]=on;
      } }
    cur=out;
  }
  if(dv>0){
    const out=new Uint8Array(w*h);
    for(let x=0;x<w;x++){
      for(let y=0;y<h;y++){
        let on=0;
        for(let k=-dv;k<=dv;k++){ const yy=y+k; if(yy>=0&&yy<h&&cur[yy*w+x]){ on=1; break; } }
        out[y*w+x]=on;
      } }
    cur=out;
  }
  return cur;
}

/* Box-filter smoothing of a 1-D profile with an odd window. */
export function smooth1d(values,window){
  const n=values.length, half=window>>1, out=new Float32Array(n);
  for(let i=0;i<n;i++){
    let sum=0,count=0;
    for(let j=i-half;j<=i+half;j++) if(j>=0&&j<n){ sum+=values[j]; count++; }
    out[i]=sum/count;
  }
  return out;
}

/* Median of a numeric array (0 for an empty array). */
export function median(values){
  if(!values.length) return 0;
  const sorted=values.slice().sort((a,b)=>a-b);
  return sorted[sorted.length>>1];
}

/* Weighted median: the value at which the cumulative weight reaches half. */
export function weightedMedian(values,weights){
  if(!values.length) return 0;
  const order=values.map((_,i)=>i).sort((a,b)=>values[a]-values[b]);
  let total=0; for(const w of weights) total+=w;
  let acc=0;
  for(const i of order){ acc+=weights[i]; if(acc>=total/2) return values[i]; }
  return values[order[order.length-1]];
}
