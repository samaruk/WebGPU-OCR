// sauvola.wgsl — Sauvola local adaptive thresholding
// T(x,y) = mean * (1 + k * (std / R - 1))
struct Params { width: f32, height: f32, window: f32, k: f32, R: f32, _p0: f32, _p1: f32, _p2: f32 }
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> p: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let r = i32(p.window / 2.0);
  var sum = 0.0; var sum2 = 0.0; var count = 0.0;
  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      let sp = vec2<i32>(clamp(pos.x+dx, 0, W-1), clamp(pos.y+dy, 0, H-1));
      let v  = dot(textureLoad(inputTex, sp, 0).rgb, vec3<f32>(0.2126,0.7152,0.0722));
      sum += v; sum2 += v*v; count += 1.0;
    }
  }
  let mean = sum / count;
let stdDev = sqrt(max(0.0, sum2/count - mean*mean));
let threshold = mean * (1.0 + p.k * (stdDev / p.R - 1.0));
let pixGray = dot(textureLoad(inputTex, pos, 0).rgb, vec3<f32>(0.2126,0.7152,0.0722));
let binary = select(1.0, 0.0, pixGray < threshold);
textureStore(outputTex, pos, vec4<f32>(binary, binary, binary, 1.0));
}
