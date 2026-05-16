// Morphological OPEN = erosion then dilation
struct Uniforms { width:u32, height:u32, radius:u32, _p:u32, }
@group(0) @binding(0) var<storage, read>       input : array<f32>;
@group(0) @binding(1) var<storage, read_write> erode : array<f32>;
@group(0) @binding(2) var<storage, read_write> dilat : array<f32>;
@group(0) @binding(3) var<uniform>             uni   : Uniforms;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let x=gid.x; let y=gid.y; let W=uni.width; let H=uni.height; let R=i32(uni.radius);
  if(x>=W||y>=H){return;}
  // Erosion pass
  var eMin=1.0;
  for(var dy=-R;dy<=R;dy++){for(var dx=-R;dx<=R;dx++){
    let nx=clamp(i32(x)+dx,0,i32(W)-1); let ny=clamp(i32(y)+dy,0,i32(H)-1);
    eMin=min(eMin,input[u32(ny)*W+u32(nx)]);
  }}
  erode[y*W+x]=eMin;
  storageBarrier();
  // Dilation pass on eroded
  var dMax=0.0;
  for(var dy=-R;dy<=R;dy++){for(var dx=-R;dx<=R;dx++){
    let nx=clamp(i32(x)+dx,0,i32(W)-1); let ny=clamp(i32(y)+dy,0,i32(H)-1);
    dMax=max(dMax,erode[u32(ny)*W+u32(nx)]);
  }}
  dilat[y*W+x]=dMax;
}