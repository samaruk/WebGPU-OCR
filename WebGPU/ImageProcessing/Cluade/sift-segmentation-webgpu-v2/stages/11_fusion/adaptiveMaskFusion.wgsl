// adaptiveMaskFusion.wgsl — fuse density map + stroke consistency
struct Uni { pixel_count:u32, alpha:f32, _p0:u32, _p1:u32 };
@group(0) @binding(0) var<uniform>            u      :Uni;
@group(0) @binding(1) var<storage,read>       density:array<f32>;
@group(0) @binding(2) var<storage,read>       consist:array<f32>;
@group(0) @binding(3) var<storage,read_write> mask   :array<f32>;
@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.pixel_count){return;}
  mask[gid.x]=u.alpha*clamp(density[gid.x],0.0,1.0)+(1.0-u.alpha)*clamp(consist[gid.x],0.0,1.0);
}
