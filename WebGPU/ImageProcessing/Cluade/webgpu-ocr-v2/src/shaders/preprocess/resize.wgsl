// ─────────────────────────────────────────────────────────────
//  shaders/preprocess/resize.wgsl
//  Bilinear resize – scales any RGBA texture to target dims
//  Output: float32 NCHW [1, 3, dstH, dstW]
// ─────────────────────────────────────────────────────────────

struct Uniforms {
  srcW   : u32,
  srcH   : u32,
  dstW   : u32,
  dstH   : u32,
}

@group(0) @binding(0) var<storage, read>       src  : array<f32>;   // NHWC u8-as-f32 [srcH*srcW*4]
@group(0) @binding(1) var<storage, read_write> dst  : array<f32>;   // NCHW f32 [3*dstH*dstW]
@group(0) @binding(2) var<uniform>             uni  : Uniforms;

fn sampleBilinear(px: f32, py: f32, ch: u32) -> f32 {
  let W = uni.srcW; let H = uni.srcH;
  let x0 = i32(floor(px)); let y0 = i32(floor(py));
  let x1 = x0 + 1;         let y1 = y0 + 1;
  let fx = px - f32(x0);   let fy = py - f32(y0);

  let cx0 = u32(clamp(x0, 0, i32(W)-1));
  let cx1 = u32(clamp(x1, 0, i32(W)-1));
  let cy0 = u32(clamp(y0, 0, i32(H)-1));
  let cy1 = u32(clamp(y1, 0, i32(H)-1));

  let q00 = src[(cy0*W + cx0)*4u + ch];
  let q10 = src[(cy0*W + cx1)*4u + ch];
  let q01 = src[(cy1*W + cx0)*4u + ch];
  let q11 = src[(cy1*W + cx1)*4u + ch];

  return q00*(1.0-fx)*(1.0-fy) + q10*fx*(1.0-fy)
       + q01*(1.0-fx)*fy       + q11*fx*fy;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let x = gid.x; let y = gid.y;
  if (x >= uni.dstW || y >= uni.dstH) { return; }

  let scaleX = f32(uni.srcW) / f32(uni.dstW);
  let scaleY = f32(uni.srcH) / f32(uni.dstH);
  let px = (f32(x) + 0.5) * scaleX - 0.5;
  let py = (f32(y) + 0.5) * scaleY - 0.5;

  let N = uni.dstW * uni.dstH;
  let idx = y * uni.dstW + x;

  // NCHW layout – channel-first
  dst[0u*N + idx] = sampleBilinear(px, py, 0u) / 255.0;  // R
  dst[1u*N + idx] = sampleBilinear(px, py, 1u) / 255.0;  // G
  dst[2u*N + idx] = sampleBilinear(px, py, 2u) / 255.0;  // B
}
