// shaders/localmax.wgsl
// Convert JFA result to Euclidean distance map, find local maxima = circle centers

struct Params {
  width: u32,
  height: u32,
  window_r: u32,
  min_radius: f32,
  max_radius: f32,
  score_thresh: f32,
  max_circles: u32,
  _pad: u32,
}

@group(0) @binding(0) var seed_tex: texture_2d<u32>;
// Distance field stored as r32float
@group(0) @binding(1) var dist_out: texture_storage_2d<r32float, write>;
@group(0) @binding(2) var<uniform> p: Params;

const SENTINEL: u32 = 0xFFFFu;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = p.width; let H = p.height;
  if (gid.x >= W || gid.y >= H) { return; }

  let seed = textureLoad(seed_tex, vec2<i32>(gid.xy), 0).xy;
  var d: f32 = 0.0;
  if (seed.x != SENTINEL) {
    let dx = f32(i32(gid.x) - i32(seed.x));
    let dy = f32(i32(gid.y) - i32(seed.y));
    d = sqrt(dx * dx + dy * dy);
  }
  textureStore(dist_out, vec2<i32>(gid.xy), vec4<f32>(d, 0.0, 0.0, 1.0));
}
