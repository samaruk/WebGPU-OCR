// GPU parallel connected components (label propagation)
// Run multiple passes until convergence
struct Uniforms { width:u32, height:u32, thresh:f32, _p:u32, }
@group(0) @binding(0) var<storage, read>       binMap : array<f32>;
@group(0) @binding(1) var<storage, read_write> labels : array<u32>;
@group(0) @binding(2) var<uniform>             uni    : Uniforms;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let x=gid.x; let y=gid.y; let W=uni.width; let H=uni.height;
  if(x>=W||y>=H){return;}
  let idx=y*W+x;
  if(binMap[idx]<uni.thresh){labels[idx]=0u;return;}
  // Initialize with pixel index on first pass, propagate min-label
  var minL=labels[idx];
  if(minL==0u){minL=idx+1u;}
  if(x>0u   ){let l=labels[idx-1u];if(l>0u){minL=select(minL,min(minL,l),minL==0u||l<minL);}}
  if(y>0u   ){let l=labels[idx-W]; if(l>0u){minL=select(minL,min(minL,l),minL==0u||l<minL);}}
  if(x<W-1u ){let l=labels[idx+1u];if(l>0u){minL=select(minL,min(minL,l),minL==0u||l<minL);}}
  if(y<H-1u ){let l=labels[idx+W]; if(l>0u){minL=select(minL,min(minL,l),minL==0u||l<minL);}}
  labels[idx]=minL;
}