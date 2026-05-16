// Pack individual crop tensors into a contiguous NCHW batch
// Pads to maxWidth with zeros
struct Uniforms { N:u32, C:u32, H:u32, maxW:u32, }
@group(0) @binding(0) var<storage, read>       crops : array<f32>;   // variable-width crops
@group(0) @binding(1) var<storage, read_write> batch : array<f32>;   // [N,C,H,maxW]
@group(0) @binding(2) var<storage, read>       widths: array<u32>;   // actual width per crop
@group(0) @binding(3) var<uniform>             uni   : Uniforms;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let x=gid.x; let y=gid.y; let n=gid.z;
  if(n>=uni.N||y>=uni.H||x>=uni.maxW){return;}
  let batchIdx=n*uni.C*uni.H*uni.maxW + y*uni.maxW + x;
  let cW=widths[n];
  if(x>=cW){batch[batchIdx]=0.0;return;}
  // Source offset: sum of all previous crop sizes
  var srcBase=0u;
  for(var i=0u;i<n;i++){srcBase+=uni.H*widths[i];}
  batch[batchIdx]=crops[srcBase+y*cW+x];
}