export function nchwToNhwc(data, C, H, W) {
  const out=new Float32Array(H*W*C);
  for(let c=0;c<C;c++) for(let y=0;y<H;y++) for(let x=0;x<W;x++)
    out[(y*W+x)*C+c] = data[c*H*W+y*W+x];
  return out;
}

export function nhwcToNchw(data, C, H, W) {
  const out=new Float32Array(C*H*W);
  for(let c=0;c<C;c++) for(let y=0;y<H;y++) for(let x=0;x<W;x++)
    out[c*H*W+y*W+x] = data[(y*W+x)*C+c];
  return out;
}

export function softmax1D(arr) {
  const maxV=Math.max(...arr);
  const exp=arr.map(v=>Math.exp(v-maxV));
  const s=exp.reduce((a,b)=>a+b,0);
  return exp.map(v=>v/(s+1e-10));
}