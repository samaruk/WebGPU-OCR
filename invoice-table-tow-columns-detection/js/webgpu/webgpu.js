/* ======================================================================
   SECTION 1 · GPU BINARISATION  (Sauvola via WGSL compute shaders)
   Why: Sauvola adaptive thresholding costs O(window) per pixel — tens of
   millions of operations on a multi-megapixel scan, far too slow to re-run
   on the CPU every time a slider moves. Five compute shaders (grayscale,
   separable box sums, threshold, separable dilation) put it on the GPU.
   The whole tool is built around instant re-runs, so this is load-bearing.
   ====================================================================== */
import { S } from '../state/state.js';
import { gpuDot, gpuTxt, showError } from '../dom/dom.js';


/* =====================================================================
   1. WEBGPU  —  Sauvola via 4 compute shaders
   ===================================================================== */
export const WGSL_PARAMS = `
struct Params {
  w:u32, h:u32, r:u32, _p0:u32,
  k:f32, R:f32, invert:f32, _p1:f32,
};`;

// (a) RGBA -> normalized luminance
export const SH_GRAY = WGSL_PARAMS + `
@group(0) @binding(0) var<uniform> P:Params;
@group(0) @binding(1) var<storage,read> inPix:array<u32>;
@group(0) @binding(2) var<storage,read_write> gray:array<f32>;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) g:vec3<u32>){
  if(g.x>=P.w || g.y>=P.h){return;}
  let i = g.y*P.w + g.x;
  let px = inPix[i];
  let r = f32(px & 0xffu);
  let gg= f32((px>>8u)&0xffu);
  let b = f32((px>>16u)&0xffu);
  var lum = (0.299*r + 0.587*gg + 0.114*b)/255.0;
  if(P.invert>0.5){ lum = 1.0 - lum; }
  gray[i]=lum;
}`;

// (b) horizontal box sums of value and value^2 (separable pass 1)
export const SH_HBOX = WGSL_PARAMS + `
@group(0) @binding(0) var<uniform> P:Params;
@group(0) @binding(1) var<storage,read> gray:array<f32>;
@group(0) @binding(2) var<storage,read_write> sumH:array<f32>;
@group(0) @binding(3) var<storage,read_write> sqH:array<f32>;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) g:vec3<u32>){
  if(g.x>=P.w || g.y>=P.h){return;}
  let r=i32(P.r); let w=i32(P.w);
  let x0=max(0,i32(g.x)-r); let x1=min(w-1,i32(g.x)+r);
  var s=0.0; var sq=0.0;
  let base=g.y*P.w;
  for(var xi=x0; xi<=x1; xi=xi+1){
    let v=gray[base+u32(xi)];
    s=s+v; sq=sq+v*v;
  }
  let i=base+g.x;
  sumH[i]=s; sqH[i]=sq;
}`;

// (c) vertical box sums (separable pass 2) -> rectangle sums
export const SH_VBOX = WGSL_PARAMS + `
@group(0) @binding(0) var<uniform> P:Params;
@group(0) @binding(1) var<storage,read> sumH:array<f32>;
@group(0) @binding(2) var<storage,read> sqH:array<f32>;
@group(0) @binding(3) var<storage,read_write> sumV:array<f32>;
@group(0) @binding(4) var<storage,read_write> sqV:array<f32>;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) g:vec3<u32>){
  if(g.x>=P.w || g.y>=P.h){return;}
  let r=i32(P.r); let h=i32(P.h);
  let y0=max(0,i32(g.y)-r); let y1=min(h-1,i32(g.y)+r);
  var s=0.0; var sq=0.0;
  for(var yi=y0; yi<=y1; yi=yi+1){
    let idx=u32(yi)*P.w + g.x;
    s=s+sumH[idx]; sq=sq+sqH[idx];
  }
  let i=g.y*P.w+g.x;
  sumV[i]=s; sqV[i]=sq;
}`;

// (d) Sauvola threshold -> binary mask
export const SH_SAUV = WGSL_PARAMS + `
@group(0) @binding(0) var<uniform> P:Params;
@group(0) @binding(1) var<storage,read> gray:array<f32>;
@group(0) @binding(2) var<storage,read> sumV:array<f32>;
@group(0) @binding(3) var<storage,read> sqV:array<f32>;
@group(0) @binding(4) var<storage,read_write> outBin:array<u32>;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) g:vec3<u32>){
  if(g.x>=P.w || g.y>=P.h){return;}
  let r=i32(P.r);
  let x=i32(g.x); let y=i32(g.y);
  let w=i32(P.w); let h=i32(P.h);
  let cw=f32(min(w-1,x+r)-max(0,x-r)+1);
  let ch=f32(min(h-1,y+r)-max(0,y-r)+1);
  let cnt=cw*ch;
  let i=g.y*P.w+g.x;
  let mean   = sumV[i]/cnt;
  let meanSq = sqV[i]/cnt;
  let varc   = max(0.0, meanSq - mean*mean);
  let sd     = sqrt(varc);
  let T      = mean*(1.0 + P.k*(sd/P.R - 1.0));
  outBin[i] = select(0u, 1u, gray[i] < T);
}`;

// (e) separable morphological dilation of the binary mask
//     run twice: axis 0 = horizontal, axis 1 = vertical
export const SH_DILATE = `
struct Dil { w:u32, h:u32, rad:u32, axis:u32 };
@group(0) @binding(0) var<uniform> P:Dil;
@group(0) @binding(1) var<storage,read> src:array<u32>;
@group(0) @binding(2) var<storage,read_write> dst:array<u32>;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) g:vec3<u32>){
  if(g.x>=P.w || g.y>=P.h){return;}
  let r=i32(P.rad);
  var on=0u;
  if(P.axis==0u){
    let x=i32(g.x);
    let x0=max(0,x-r); let x1=min(i32(P.w)-1,x+r);
    let base=g.y*P.w;
    for(var xi=x0; xi<=x1; xi=xi+1){
      if(src[base+u32(xi)]!=0u){ on=1u; break; }
    }
  } else {
    let y=i32(g.y);
    let y0=max(0,y-r); let y1=min(i32(P.h)-1,y+r);
    for(var yi=y0; yi<=y1; yi=yi+1){
      if(src[u32(yi)*P.w+g.x]!=0u){ on=1u; break; }
    }
  }
  dst[g.y*P.w+g.x]=on;
}`;

export let GPU={}; // pipelines

export async function initGPU(){
  if(!navigator.gpu){
    gpuDot.className='dot err'; gpuTxt.textContent='WebGPU unavailable';
    showError('This browser has no WebGPU. Use a recent Chrome / Edge (or Safari Technology Preview). The pipeline cannot run without it.');
    return false;
  }
  try{
    const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
    if(!adapter) throw new Error('no GPU adapter');
    const L=adapter.limits;
    S.device=await adapter.requestDevice({requiredLimits:{
      maxStorageBufferBindingSize:L.maxStorageBufferBindingSize,
      maxBufferSize:L.maxBufferSize
    }});
    S.device.lost.then(()=>{gpuDot.className='dot err';gpuTxt.textContent='GPU device lost';});
    // pixel budget: 128 MB RGBA cap, also bounded by storage-buffer binding limit
    S.maxPixels=Math.min(32_000_000, Math.floor(S.device.limits.maxStorageBufferBindingSize/4));
    const mod=src=>S.device.createShaderModule({code:src});
    const mk=(m,e)=>S.device.createComputePipeline({layout:'auto',compute:{module:m,entryPoint:e}});
    GPU.gray=mk(mod(SH_GRAY),'main');
    GPU.hbox=mk(mod(SH_HBOX),'main');
    GPU.vbox=mk(mod(SH_VBOX),'main');
    GPU.sauv=mk(mod(SH_SAUV),'main');
    GPU.dil =mk(mod(SH_DILATE),'main');
    gpuDot.className='dot ok';
    gpuTxt.textContent='WebGPU ready · '+(Math.floor(S.maxPixels/1e6))+' MP budget';
    return true;
  }catch(e){
    gpuDot.className='dot err'; gpuTxt.textContent='WebGPU init failed';
    showError('WebGPU initialization failed: '+e.message);
    return false;
  }
}

export function ensureGpuBuffers(N){
  if(S.gpuBufN===N && S.gpuBuf) return S.gpuBuf;
  if(S.gpuBuf) for(const k in S.gpuBuf) S.gpuBuf[k].destroy&&S.gpuBuf[k].destroy();
  const d=S.device, U=GPUBufferUsage;
  const stor=N*4;
  const b={
    uni  : d.createBuffer({size:32, usage:U.UNIFORM|U.COPY_DST}),
    dilU : d.createBuffer({size:16, usage:U.UNIFORM|U.COPY_DST}),
    inPix: d.createBuffer({size:stor,usage:U.STORAGE|U.COPY_DST}),
    gray : d.createBuffer({size:stor,usage:U.STORAGE}),
    sumH : d.createBuffer({size:stor,usage:U.STORAGE}),
    sqH  : d.createBuffer({size:stor,usage:U.STORAGE}),
    sumV : d.createBuffer({size:stor,usage:U.STORAGE}),
    sqV  : d.createBuffer({size:stor,usage:U.STORAGE}),
    outB : d.createBuffer({size:stor,usage:U.STORAGE|U.COPY_SRC}),
    dilA : d.createBuffer({size:stor,usage:U.STORAGE}),
    read : d.createBuffer({size:stor,usage:U.COPY_DST|U.MAP_READ})
  };
  S.gpuBuf=b; S.gpuBufN=N;
  return b;
}

export async function gpuSauvola(imgData,p){
  const W=imgData.width,H=imgData.height,N=W*H;
  const d=S.device, b=ensureGpuBuffers(N);

  // uniforms
  const ub=new ArrayBuffer(32), dv=new DataView(ub);
  dv.setUint32(0,W,true); dv.setUint32(4,H,true);
  dv.setUint32(8,p.radius,true); dv.setUint32(12,0,true);
  dv.setFloat32(16,p.k,true); dv.setFloat32(20,p.R,true);
  dv.setFloat32(24,p.invert?1:0,true); dv.setFloat32(28,0,true);
  d.queue.writeBuffer(b.uni,0,ub);
  d.queue.writeBuffer(b.inPix,0,imgData.data);

  const bg=(pl,res)=>d.createBindGroup({layout:pl.getBindGroupLayout(0),
    entries:res.map((r,i)=>({binding:i,resource:{buffer:r}}))});
  const gx=Math.ceil(W/16), gy=Math.ceil(H/16);
  const enc=d.createCommandEncoder();
  const pass=(pl,res)=>{const c=enc.beginComputePass();c.setPipeline(pl);
    c.setBindGroup(0,bg(pl,res));c.dispatchWorkgroups(gx,gy);c.end();};
  pass(GPU.gray,[b.uni,b.inPix,b.gray]);
  pass(GPU.hbox,[b.uni,b.gray,b.sumH,b.sqH]);
  pass(GPU.vbox,[b.uni,b.sumH,b.sqH,b.sumV,b.sqV]);
  pass(GPU.sauv,[b.uni,b.gray,b.sumV,b.sqV,b.outB]);
  enc.copyBufferToBuffer(b.outB,0,b.read,0,N*4);
  d.queue.submit([enc.finish()]);

  await b.read.mapAsync(GPUMapMode.READ);
  const u32=new Uint32Array(b.read.getMappedRange());
  const bin=new Uint8Array(N);
  for(let i=0;i<N;i++) bin[i]=u32[i]?1:0;
  b.read.unmap();
  return bin;
}

/* separable morphological dilation of the Sauvola mask.
   b.outB still holds the binary from gpuSauvola; we dilate it on the GPU
   (horizontal pass -> dilA, vertical pass -> outB) and read it back. */
export async function gpuDilate(dilH,dilV){
  const W=S.W,H=S.H,N=W*H;
  const d=S.device, b=S.gpuBuf;
  const gx=Math.ceil(W/16), gy=Math.ceil(H/16);
  const grp=(src,dst)=>d.createBindGroup({
    layout:GPU.dil.getBindGroupLayout(0),
    entries:[{binding:0,resource:{buffer:b.dilU}},
             {binding:1,resource:{buffer:src}},
             {binding:2,resource:{buffer:dst}}]});
  const run=(src,dst,rad,axis)=>{
    const u=new ArrayBuffer(16), dv=new DataView(u);
    dv.setUint32(0,W,true); dv.setUint32(4,H,true);
    dv.setUint32(8,rad,true); dv.setUint32(12,axis,true);
    d.queue.writeBuffer(b.dilU,0,u);              // ordered before this submit
    const enc=d.createCommandEncoder();
    const c=enc.beginComputePass();
    c.setPipeline(GPU.dil); c.setBindGroup(0,grp(src,dst));
    c.dispatchWorkgroups(gx,gy); c.end();
    d.queue.submit([enc.finish()]);
  };
  run(b.outB,b.dilA, dilH, 0);                    // horizontal
  run(b.dilA,b.outB, dilV, 1);                    // vertical
  const enc=d.createCommandEncoder();
  enc.copyBufferToBuffer(b.outB,0,b.read,0,N*4);
  d.queue.submit([enc.finish()]);
  await b.read.mapAsync(GPUMapMode.READ);
  const u32=new Uint32Array(b.read.getMappedRange());
  const out=new Uint8Array(N);
  for(let i=0;i<N;i++) out[i]=u32[i]?1:0;
  b.read.unmap();
  return out;
}
