// shaders/postprocess/polygonApprox.wgsl — Write bounding-box corner polygon per kept label

struct BBox { min_x:u32, min_y:u32, max_x:u32, max_y:u32, area:u32, _p0:u32, _p1:u32, _p2:u32 };
struct Uniforms { num_labels:u32, _pad0:u32, _pad1:u32, _pad2:u32 };
@group(0) @binding(0) var<uniform>            u      : Uniforms;
@group(0) @binding(1) var<storage,read>       bboxes : array<BBox>;
@group(0) @binding(2) var<storage,read>       keep   : array<u32>;
@group(0) @binding(3) var<storage,read_write> polys  : array<vec2<f32>>; // [num_labels * 4]

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.num_labels) { return; }
  if (keep[gid.x] == 0u) { return; }
  let bb   = bboxes[gid.x];
  let base = gid.x * 4u;
  polys[base+0u] = vec2<f32>(f32(bb.min_x), f32(bb.min_y));
  polys[base+1u] = vec2<f32>(f32(bb.max_x), f32(bb.min_y));
  polys[base+2u] = vec2<f32>(f32(bb.max_x), f32(bb.max_y));
  polys[base+3u] = vec2<f32>(f32(bb.min_x), f32(bb.max_y));
}
