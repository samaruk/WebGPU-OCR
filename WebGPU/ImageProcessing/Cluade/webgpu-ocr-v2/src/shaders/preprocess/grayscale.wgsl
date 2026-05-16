// ─────────────────────────────────────────────────────────────
//  shaders/preprocess/grayscale.wgsl
//  Convert RGB NCHW [1,3,H,W] → grayscale [1,1,H,W]
//  Uses ITU-R BT.601 luminance weights
// ─────────────────────────────────────────────────────────────

struct Uniforms {
  width  : u32,
  height : u32,
  _pad0  : u32,
  _pad1  : u32,
}

@group(0) @binding(0) var<storage, read>       rgb  : array<f32>;   // [3, H, W]
@group(0) @binding(1) var<storage, read_write> gray : array<f32>;   // [1, H, W]
@group(0) @binding(2) var<uniform>             uni  : Uniforms;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let x = gid.x; let y = gid.y;
  let W = uni.width; let H = uni.height;
  if (x >= W || y >= H) { return; }

  let N   = W * H;
  let idx = y * W + x;

  let r = rgb[0u * N + idx];
  let g = rgb[1u * N + idx];
  let b = rgb[2u * N + idx];

  // BT.601 luminance
  gray[idx] = 0.2989 * r + 0.5870 * g + 0.1140 * b;
}
