// qualityScorer.wgsl
// GPU-side Laplacian and noise energy computation for large images.
struct Params { width: u32, height: u32 }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var inputTex: texture_2d<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x; let y = gid.y;
  if (x < 1u || y < 1u || x >= params.width - 1u || y >= params.height - 1u) { return; }
  let c  = dot(textureLoad(inputTex, vec2<i32>(i32(x),   i32(y)),   0).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let n  = dot(textureLoad(inputTex, vec2<i32>(i32(x),   i32(y)-1), 0).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let s  = dot(textureLoad(inputTex, vec2<i32>(i32(x),   i32(y)+1), 0).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let w  = dot(textureLoad(inputTex, vec2<i32>(i32(x)-1, i32(y)),   0).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let e  = dot(textureLoad(inputTex, vec2<i32>(i32(x)+1, i32(y)),   0).rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let lap = 4.0*c - n - s - w - e;
  output[y * params.width + x] = lap * lap;
}
