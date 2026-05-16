// math.js — CPU-side math utilities
export function gaussianKernel1D(sigma, radius) {
  const len=radius*2+1;
  const k=new Float32Array(len);
  let sum=0;
  for(let i=0;i<len;i++){
    const x=i-radius;
    k[i]=Math.exp(-x*x/(2*sigma*sigma));
    sum+=k[i];
  }
  return k.map(v=>v/sum);
}

export function hsvToRgb(h, s, v) {
  const i=Math.floor(h*6), f=h*6-i;
  const p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s);
  switch(i%6){
    case 0: return [v,t,p];
    case 1: return [q,v,p];
    case 2: return [p,v,t];
    case 3: return [p,q,v];
    case 4: return [t,p,v];
    default: return [v,p,q];
  }
}

export const ceilDiv = (n,d) => Math.ceil(n/d);
