// bleedthrough.wgsl
// Estimates and removes bleedthrough by computing a large-radius local background.
struct Params { width: f32, height: f32, radius: f32, _pad: f32 }
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> p: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let x = i32(gid.x); let y = i32(gid.y);
  let r = i32(p.radius);
  // Compute local maximum (background estimation) in neighborhood
  var bgMax = vec3<f32>(0.0);
  let step = max(1, r / 8); // sparse sampling for performance
  for (var dy = -r; dy <= r; dy += step) {
    for (var dx = -r; dx <= r; dx += step) {
      let sx = clamp(x + dx, 0, W - 1);
      let sy = clamp(y + dy, 0, H - 1);
      let s = textureLoad(inputTex, vec2<i32>(sx, sy), 0).rgb;
      bgMax = max(bgMax, s);
    }
  }
  let orig = textureLoad(inputTex, vec2<i32>(x, y), 0).rgb;
  // Divide-by-background normalization
  let corrected = clamp(orig / max(bgMax, vec3<f32>(0.01)), vec3<f32>(0.0), vec3<f32>(1.0));
  textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(corrected, 1.0));
}
