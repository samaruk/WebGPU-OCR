// polygonApprox.wgsl — axis-aligned bounding box polygon (4 corners)
struct BBox { min_x:u32,min_y:u32,max_x:u32,max_y:u32,area:u32,_p0:u32,_p1:u32,_p2:u32 };
struct Uni { n:u32, _p0:u32, _p1:u32, _p2:u32 };
@group(0) @binding(0) var<uniform>         u    :Uni;
@group(0) @binding(1) var<storage,read>    bb   :array<BBox>;
@group(0) @binding(2) var<storage,read>    keep :array<u32>;
@group(0) @binding(3) var<storage,read_write> poly:array<vec2<f32>>;
@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid:vec3<u32>) {
  if(gid.x>=u.n||keep[gid.x]==0u){return;}
  let b=bb[gid.x]; let base=gid.x*4u;
  poly[base+0u]=vec2<f32>(f32(b.min_x),f32(b.min_y));
  poly[base+1u]=vec2<f32>(f32(b.max_x),f32(b.min_y));
  poly[base+2u]=vec2<f32>(f32(b.max_x),f32(b.max_y));
  poly[base+3u]=vec2<f32>(f32(b.min_x),f32(b.max_y));
}
