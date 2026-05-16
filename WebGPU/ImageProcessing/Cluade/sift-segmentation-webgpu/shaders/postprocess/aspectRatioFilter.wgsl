// shaders/postprocess/aspectRatioFilter.wgsl — Kill labels with bad aspect ratio or small area

struct BBox { min_x:u32, min_y:u32, max_x:u32, max_y:u32, area:u32, _p0:u32, _p1:u32, _p2:u32 };
struct Uniforms {
  num_labels  : u32,
  min_area    : u32,
  aspect_min  : f32,
  aspect_max  : f32,
};
@group(0) @binding(0) var<uniform>            u      : Uniforms;
@group(0) @binding(1) var<storage,read>       bboxes : array<BBox>;
@group(0) @binding(2) var<storage,read_write> keep   : array<u32>; // [num_labels] 0/1

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.num_labels) { return; }
  let bb  = bboxes[gid.x];
  if (bb.area < u.min_area) { keep[gid.x] = 0u; return; }
  let w   = f32(bb.max_x - bb.min_x + 1u);
  let h   = f32(bb.max_y - bb.min_y + 1u);
  let ar  = max(w, h) / (min(w, h) + 1.0);
  keep[gid.x] = select(0u, 1u, ar >= u.aspect_min && ar <= u.aspect_max);
}
