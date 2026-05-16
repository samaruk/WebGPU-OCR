// retinex.wgsl — Multi-Scale Retinex approximated via sampled Gaussian differences
struct Params { width: f32, height: f32, sigma0: f32, sigma1: f32, sigma2: f32, _p0: f32, _p1: f32, _p2: f32 }
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> p: Params;

fn gaussianBlur1(pos: vec2<i32>, sigma: f32, W: i32, H: i32) -> vec3<f32> {
  let r = i32(ceil(sigma * 2.0));
  var acc = vec3<f32>(0.0); var wSum = 0.0;
  let step = max(1, r / 6);
  for (var dy = -r; dy <= r; dy += step) {
    for (var dx = -r; dx <= r; dx += step) {
      let w = exp(-f32(dx*dx + dy*dy) / (2.0 * sigma * sigma));
      let sx = clamp(pos.x + dx, 0, W-1);
      let sy = clamp(pos.y + dy, 0, H-1);
      acc += textureLoad(inputTex, vec2<i32>(sx, sy), 0).rgb * w;
      wSum += w;
    }
  }
  return acc / wSum;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let orig = log(textureLoad(inputTex, pos, 0).rgb + vec3<f32>(0.001));
  let b0   = log(gaussianBlur1(pos, p.sigma0, W, H) + vec3<f32>(0.001));
  let b1   = log(gaussianBlur1(pos, p.sigma1, W, H) + vec3<f32>(0.001));
  let b2   = log(gaussianBlur1(pos, p.sigma2, W, H) + vec3<f32>(0.001));
  let msr  = (orig - b0 + orig - b1 + orig - b2) / 3.0;
  // Normalize to [0, 1]
  let norm = clamp((msr + 3.0) / 6.0, vec3<f32>(0.0), vec3<f32>(1.0));
  textureStore(outputTex, pos, vec4<f32>(norm, 1.0));
}
