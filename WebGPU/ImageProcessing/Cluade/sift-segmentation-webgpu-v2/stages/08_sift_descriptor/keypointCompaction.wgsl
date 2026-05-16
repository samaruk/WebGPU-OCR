// keypointCompaction.wgsl — stream-compact final keypoints
struct KP { x:f32,y:f32,sigma:f32,angle:f32,octave:u32,layer:u32,resp:f32,_pad:f32 };
struct Uni { src_count:u32, octave:u32, layer:u32, max_out:u32 };
@group(0) @binding(0) var<uniform>            u     :Uni;
@group(0) @binding(1) var<storage,read>       kp_in :array<vec4<f32>>;
@group(0) @binding(2) var<storage,read_write> ctr   :atomic<u32>;
@group(0) @binding(3) var<storage,read_write> kp_out:array<KP>;
@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.src_count){return;}
  let v=kp_in[gid.x];
  let slot=atomicAdd(&ctr,1u);
  if(slot>=u.max_out){atomicSub(&ctr,1u);return;}
  kp_out[slot]=KP(v.x,v.y,v.z,v.w,u.octave,u.layer,0.0,0.0);
}
