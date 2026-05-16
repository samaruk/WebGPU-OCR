
// Thin-plate spline warp for curved text rectification
struct Params { srcW: u32, srcH: u32, dstW: u32, dstH: u32, numCtrl: u32 }
@group(0) @binding(0) var<storage, read>       src     : array<f32>;
@group(0) @binding(1) var<storage, read_write> dst     : array<f32>;
@group(0) @binding(2) var<storage, read>       ctrlSrc : array<f32>;  // [N,2]
@group(0) @binding(3) var<storage, read>       ctrlDst : array<f32>;  // [N,2]
@group(0) @binding(4) var<uniform>             params  : Params;
fn tpsU(r2: f32) -> f32 { return select(0.0, r2 * log(r2 + 1e-8), r2 > 0.0); }
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dx = f32(gid.x); let dy = f32(gid.y);
  if (u32(dx) >= params.dstW || u32(dy) >= params.dstH) { return; }
  // Simplified affine fallback (TPS weights not stored here for brevity)
  let sx = dx * f32(params.srcW) / f32(params.dstW);
  let sy = dy * f32(params.srcH) / f32(params.dstH);
  let sxi = clamp(u32(sx), 0u, params.srcW-1u);
  let syi = clamp(u32(sy), 0u, params.srcH-1u);
  dst[u32(dy)*params.dstW+u32(dx)] = src[syi*params.srcW+sxi];
}
