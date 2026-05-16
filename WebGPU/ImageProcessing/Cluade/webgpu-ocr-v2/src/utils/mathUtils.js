export const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
export const lerp  = (a,b,t)   => a + (b-a)*t;
export const dot   = (a,b)     => a.reduce((s,v,i)=>s+v*b[i],0);
export const norm  = a         => Math.sqrt(dot(a,a));