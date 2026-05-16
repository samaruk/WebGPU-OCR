// ─────────────────────────────────────────────────────────────
//  shaders/preprocess/denoise.wgsl
//  Full bilateral filter for scan noise removal
//  sigmaSpace controls spatial kernel, sigmaColor controls range
// ─────────────────────────────────────────────────────────────

struct Uniforms {
  width       : u32,
  height      : u32,
  sigmaSpace  : f32,   // spatial std dev  (try 3.0)
  sigmaColor  : f32,   // color  std dev  (try 0.1)
}

@group(0) @binding(0) var<storage, read>       input  : array<f32>;  // [H, W]
@group(0) @binding(1) var<storage, read_write> output : array<f32>;  // [H, W]
@group(0) @binding(2) var<uniform>             uni    : Uniforms;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let x = gid.x; let y = gid.y;
  let W = uni.width; let H = uni.height;
  if (x >= W || y >= H) { return; }

  let sigS2 = 2.0 * uni.sigmaSpace * uni.sigmaSpace;
  let sigC2 = 2.0 * uni.sigmaColor * uni.sigmaColor;
  let R     = i32(ceil(2.5 * uni.sigmaSpace));   // adaptive radius
  let center = input[y * W + x];

  var wSum   = 0.0;
  var valSum = 0.0;

  for (var dy = -R; dy <= R; dy++) {
    for (var dx = -R; dx <= R; dx++) {
      let nx = i32(x) + dx;
      let ny = i32(y) + dy;
      if (nx < 0 || ny < 0 || u32(nx) >= W || u32(ny) >= H) { continue; }

      let neighbor  = input[u32(ny) * W + u32(nx)];
      let spatDist  = f32(dx*dx + dy*dy);
      let colorDist = (neighbor - center) * (neighbor - center);
      let w = exp(-spatDist / sigS2 - colorDist / sigC2);
      valSum += w * neighbor;
      wSum   += w;
    }
  }
  output[y * W + x] = select(center, valSum / wSum, wSum > 1e-8);
}
