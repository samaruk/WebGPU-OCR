// confidenceScore.wgsl — geometric mean confidence → binary mask
struct Uni { pixel_count:u32, thresh:f32, _p0:u32, _p1:u32 };
@group(0) @binding(0) var<uniform>            u     :Uni;
@group(0) @binding(1) var<storage,read>       mask  :array<f32>;
@group(0) @binding(2) var<storage,read>       density:array<f32>;
@group(0) @binding(3) var<storage,read_write> conf  :array<f32>;
@group(0) @binding(4) var<storage,read_write> binary:array<u32>;
@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.pixel_count){return;}
  let c=sqrt(mask[gid.x]*clamp(density[gid.x],0.0,1.0));
  conf[gid.x]=c;
  binary[gid.x]=select(0u,1u,c>=u.thresh);
}
