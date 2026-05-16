// bilateral.wgsl — joint bilateral filter
struct Params { width: f32, height: f32, sigma_space: f32, sigma_color: f32, _p: vec4<f32> }
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> p: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let center = textureLoad(inputTex, pos, 0).rgb;
  let r = i32(ceil(p.sigma_space * 2.5));
  var accColor = vec3<f32>(0.0); var wSum = 0.0;
  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      let sp = vec2<i32>(clamp(pos.x+dx, 0, W-1), clamp(pos.y+dy, 0, H-1));
      let s  = textureLoad(inputTex, sp, 0).rgb;
      let wSpace = exp(-f32(dx*dx + dy*dy) / (2.0 * p.sigma_space * p.sigma_space));
      let diff   = s - center;
      let wColor = exp(-dot(diff, diff) / (2.0 * p.sigma_color * p.sigma_color));
      let w = wSpace * wColor;
      accColor += s * w; wSum += w;
    }
  }
  textureStore(outputTex, pos, vec4<f32>(accColor / wSum, 1.0));
}
