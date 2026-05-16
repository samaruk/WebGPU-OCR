/**
 * shaders/render.js — WGSL compute shader for GPU-parallel OBB rendering.
 *
 * WHY A DEDICATED RENDER SHADER INSTEAD OF CANVAS 2D:
 *   Canvas 2D fillRect with a rotation transform is single-threaded and must serial-loop
 *   over all pixels inside each box. For 30 text lines, each spanning ~50 000 px², Canvas
 *   2D processes ~1.5 M pixel-tests sequentially. The GPU version evaluates ALL pixels
 *   simultaneously — each thread handles exactly one output pixel and tests membership
 *   in all OBBs with O(ncomp) arithmetic, fully parallelised.
 *
 * ALGORITHM — Point-in-OBB test:
 *   For output pixel P = (fx, fy) and OBB with centre C, primary axis V, half-extents hw, hh:
 *     u = (P − C) · V          — projection along primary axis
 *     v = (P − C) · (−Vy, Vx) — projection along perpendicular axis
 *     inside ↔ |u| < hw  AND  |v| < hh
 *   This is the standard separating-axis test for aligned rectangles applied in the OBB's
 *   local coordinate frame, which avoids any trigonometric functions.
 *
 * RENDERING PASSES (for each OBB the pixel is inside):
 *   1. Fill:   r,g,b = mix(original, obbColour, 0.28) — translucent tint overlay.
 *   2. Stroke: if within 2.5 px of any edge, r,g,b = obbColour — fully opaque border.
 *   The stroke check |u| > hw − 2.5 OR |v| > hh − 2.5 is done in the same coordinate
 *   frame as the containment test, so the border is always exactly 2.5 px thick regardless
 *   of OBB orientation.
 *
 * OBB BUFFER LAYOUT (10 floats per entry, see OBB_STRIDE in config.js):
 *   [0..1] cx, cy  [2..3] vx, vy  [4..5] hw, hh  [6..8] cr, cg, cb  [9] pad
 *
 * WHY COMPUTE (not render pipeline):
 *   A render pipeline would need vertex buffers, a render pass, a swap chain texture, and
 *   fragment shader plumbing. A compute shader can read from and write to plain storage
 *   buffers, which integrate seamlessly with the rest of the compute-only pipeline and avoid
 *   the texture-format constraints of render passes.
 */
export const SHADER_RENDER = `
struct P { width: u32, height: u32, ncomp: u32, _pad: u32 }
@group(0) @binding(0) var<storage, read>       src: array<u32>;
@group(0) @binding(1) var<storage, read>       obb: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<u32>;
@group(0) @binding(3) var<uniform>             p:   P;
@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.width || gid.y >= p.height) { return; }
  let i = gid.y * p.width + gid.x;
  let px = src[i];
  var r = f32(px & 0xFFu) / 255.0;
  var g = f32((px >> 8u) & 0xFFu) / 255.0;
  var b = f32((px >> 16u) & 0xFFu) / 255.0;
  let fx = f32(gid.x) + 0.5;
  let fy = f32(gid.y) + 0.5;
  for (var k = 0u; k < p.ncomp; k++) {
    let base = k * 10u;
    let cx = obb[base];     let cy = obb[base+1u];
    let vx = obb[base+2u];  let vy = obb[base+3u];
    let hw = obb[base+4u];  let hh = obb[base+5u];
    let cr = obb[base+6u];  let cg = obb[base+7u];  let cb = obb[base+8u];
    let dx = fx - cx; let dy = fy - cy;
    let u = dx*vx + dy*vy;
    let v = dx*(-vy) + dy*vx;
    if (abs(u) < hw && abs(v) < hh) {
      r = r*0.72 + cr*0.28;
      g = g*0.72 + cg*0.28;
      b = b*0.72 + cb*0.28;
      if (abs(u) > hw-2.5 || abs(v) > hh-2.5) { r = cr; g = cg; b = cb; }
    }
  }
  let or = min(255u, u32(r*255.5));
  let og = min(255u, u32(g*255.5));
  let ob = min(255u, u32(b*255.5));
  dst[i] = or | (og<<8u) | (ob<<16u) | 0xFF000000u;
}`;
