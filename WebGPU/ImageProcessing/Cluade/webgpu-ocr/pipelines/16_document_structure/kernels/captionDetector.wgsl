
struct Params { N: u32, maxH: f32 }
@group(0) @binding(0) var<storage, read>       bboxes    : array<f32>;
@group(0) @binding(1) var<storage, read_write> isCaption : array<u32>;
@group(0) @binding(2) var<uniform>             params    : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let n = gid.x; if (n >= params.N) { return; }
  let h = bboxes[n*4u+3u] - bboxes[n*4u+1u];
  let w = bboxes[n*4u+2u] - bboxes[n*4u];
  isCaption[n] = select(0u, 1u, h < params.maxH && w > 0.4);
}
