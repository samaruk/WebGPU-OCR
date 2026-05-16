// Final resegment visualisation.
// cleanTex: morphologically-opened binary (noise removed).
// confTex:  confidence map (.r channel: 1=good, 0=bad/touching).
//
// Output:
//   background          → black
//   good foreground     → white
//   low-confidence px   → orange (potential touching characters)

@group(0) @binding(0) var confTex  : texture_2d<f32>;
@group(0) @binding(1) var cleanTex : texture_2d<f32>;
@group(0) @binding(2) var outputTex : texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> u : vec4<u32>;

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(u.x); let H = i32(u.y);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }

  let fg   = textureLoad(cleanTex, vec2<i32>(gid.xy), 0).r;
  let conf = textureLoad(confTex,  vec2<i32>(gid.xy), 0);

  var col : vec4<f32>;
  if (fg < 0.5) {
    col = vec4<f32>(0.0, 0.0, 0.0, 1.0);          // background – black
  } else if (conf.r > 0.5 && conf.g < 0.5) {
    col = vec4<f32>(1.0, 0.5, 0.1, 1.0);          // low-confidence – orange
  } else {
    col = vec4<f32>(1.0, 1.0, 1.0, 1.0);          // clean text – white
  }
  textureStore(outputTex, vec2<i32>(gid.xy), col);
}
