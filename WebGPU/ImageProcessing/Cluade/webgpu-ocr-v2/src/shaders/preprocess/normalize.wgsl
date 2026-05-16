// ─────────────────────────────────────────────────────────────
//  shaders/preprocess/normalize.wgsl
//  ImageNet-style per-channel mean/std normalization
//  Operates in-place on NCHW float32 tensor
// ─────────────────────────────────────────────────────────────

struct Uniforms {
  width    : u32,
  height   : u32,
  channels : u32,
  _pad     : u32,
  mean     : vec4<f32>,
  sigma    : vec4<f32>,   // better name
}

@group(0) @binding(0) var<storage, read_write> tensor : array<f32>;  // NCHW in-place
@group(0) @binding(1) var<uniform>             uni    : Uniforms;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let x = gid.x; let y = gid.y;
  let W = uni.width; let H = uni.height; let C = uni.channels;
  if (x >= W || y >= H) { return; }

  let N    = W * H;
  let idx  = y * W + x;

  let means = array<f32,3>(uni.mean.x, uni.mean.y, uni.mean.z);
  let stds = array<f32,3>(uni.sigma.x, uni.sigma.y, uni.sigma.z);

  for (var c = 0u; c < C; c++) {
    let offset = c * N + idx;
    tensor[offset] = (tensor[offset] - means[c]) / (stds[c] + 1e-7);
  }
}
