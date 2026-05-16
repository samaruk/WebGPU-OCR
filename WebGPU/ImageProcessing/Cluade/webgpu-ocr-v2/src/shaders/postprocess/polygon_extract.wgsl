// Mark contour pixels of connected regions
struct Uniforms { width:u32, height:u32, thresh:f32, _p:u32, }
@group(0) @binding(0) var<storage, read>       binMap  : array<f32>;
@group(0) @binding(1) var<storage, read_write> contour : array<f32>;
@group(0) @binding(2) var<uniform>             uni     : Uniforms;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let x=gid.x; let y=gid.y; let W=uni.width; let H=uni.height;
  if(x>=W||y>=H){return;}
  let idx=y*W+x;
  if(binMap[idx]<uni.thresh){contour[idx]=0.0;return;}
  var border=false;
  if(x==0u||y==0u||x==W-1u||y==H-1u){border=true;}
  else{
    border=(binMap[idx-1u]<uni.thresh)||(binMap[idx+1u]<uni.thresh)||
           (binMap[idx-W]  <uni.thresh)||(binMap[idx+W]  <uni.thresh);
  }
  contour[idx]=select(0.0,1.0,border);
}