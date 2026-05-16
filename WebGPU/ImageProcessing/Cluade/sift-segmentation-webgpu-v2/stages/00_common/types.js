// types.js — CPU-side struct layout helpers
export const KEYPOINT_STRIDE = 8; // 8 x f32 = 32 bytes
export const BBOX_STRIDE     = 8; // 8 x u32 = 32 bytes

export function makeImageUni(W, H) {
  const d = new ArrayBuffer(16);
  const u = new Uint32Array(d);
  const f = new Float32Array(d);
  u[0]=W; u[1]=H; f[2]=1/W; f[3]=1/H;
  return d;
}

export function makePyramidUni(srcW,srcH,dstW,dstH,sigma,radius) {
  const d=new ArrayBuffer(32);
  const u=new Uint32Array(d); const f=new Float32Array(d);
  u[0]=srcW;u[1]=srcH;u[2]=dstW;u[3]=dstH;f[4]=sigma;u[5]=radius;
  return d;
}

export function makeU32Uni(...vals) {
  const d=new ArrayBuffer(Math.max(vals.length,4)*4);
  const u=new Uint32Array(d); vals.forEach((v,i)=>u[i]=v);
  return d;
}

export function makeF32Uni(...vals) {
  const d=new ArrayBuffer(Math.max(vals.length,4)*4);
  const f=new Float32Array(d); vals.forEach((v,i)=>f[i]=v);
  return d;
}

export function makeMixedUni(fields) {
  // fields: [{type:'u32'|'f32', value}]
  const padded=Math.max(fields.length,4);
  const d=new ArrayBuffer(padded*4);
  const u=new Uint32Array(d); const f=new Float32Array(d);
  fields.forEach(({type,value},i)=>{
    if(type==='u32') u[i]=value|0;
    else f[i]=value;
  });
  return d;
}
