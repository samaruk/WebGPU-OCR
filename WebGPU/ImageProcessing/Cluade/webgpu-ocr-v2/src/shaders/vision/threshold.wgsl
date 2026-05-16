// Adaptive threshold using local mean + offset
struct Uniforms { width:u32, height:u32, blockR:u32, offset:f32, }
@group(0) @binding(0) var<storage, read>       input  : array<f32>;
@group(0) @binding(1) var<storage, read_write> output : array<f32>;
@group(0) @binding(2) var<uniform>             uni    : Uniforms;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  let x=gid.x; let y=gid.y; let W=uni.width; let H=uni.height;
  if(x>=W||y>=H){return;}
  let R=i32(uni.blockR);
  var sum=0.0; var cnt=0.0;
  for(var dy=-R;dy<=R;dy++){for(var dx=-R;dx<=R;dx++){
    let nx=clamp(i32(x)+dx,0,i32(W)-1); let ny=clamp(i32(y)+dy,0,i32(H)-1);
    sum+=input[u32(ny)*W+u32(nx)]; cnt+=1.0;
  }}
  let mean=sum/cnt;
  output[y*W+x]=select(0.0,1.0,input[y*W+x]>mean-uni.offset);
}