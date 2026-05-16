/**
 * shaders/jfa.js
 * WGSL source for Stage 2 — Jump Flood Algorithm (JFA).
 *
 * Algorithm:
 *   Each thread checks its 8 neighbours at distance ±step.
 *   It keeps whichever neighbour's seed is closest (squared Euclidean).
 *   After log₂(max(W,H)) passes with step = N/2, N/4, … 2, 1,
 *   every pixel holds the coordinate of its nearest background seed.
 *
 * Workgroup size: 8×8 threads.
 * Bindings:
 *   0 → inBuf  : array<vec2u>  (read  — seed coords from previous pass)
 *   1 → outBuf : array<vec2u>  (write — updated seed coords)
 *   2 → p      : JFA uniform   (step, width, height)
 *
 * Note: caller ping-pongs inBuf/outBuf each pass to avoid hazards.
 */
export const WGSL_JFA = /* wgsl */`
struct JFA { step : u32, w : u32, h : u32, pad : u32 }

@group(0) @binding(0) var<storage, read>       inBuf  : array<vec2u>;
@group(0) @binding(1) var<storage, read_write> outBuf : array<vec2u>;
@group(0) @binding(2) var<uniform>             p      : JFA;

const INV : u32 = 0xFFFFFFFFu;

/// Squared Euclidean distance between pixel (ax,ay) and seed (bx,by)
fn sq(ax : u32, ay : u32, bx : u32, by : u32) -> f32 {
  let dx = f32(i32(ax) - i32(bx));
  let dy = f32(i32(ay) - i32(by));
  return dx * dx + dy * dy;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) g : vec3u) {
  if (g.x >= p.w || g.y >= p.h) { return; }

  let idx   = g.y * p.w + g.x;
  var best  = inBuf[idx];
  var bestD = select(1.0e20, sq(g.x, g.y, best.x, best.y), best.x != INV);
  let s     = i32(p.step);

  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) { continue; }

      let nx = i32(g.x) + dx * s;
      let ny = i32(g.y) + dy * s;
      if (nx < 0 || ny < 0 || u32(nx) >= p.w || u32(ny) >= p.h) { continue; }

      let ns = inBuf[u32(ny) * p.w + u32(nx)];
      if (ns.x == INV) { continue; }

      let nd = sq(g.x, g.y, ns.x, ns.y);
      if (nd < bestD) { bestD = nd; best = ns; }
    }
  }

  outBuf[idx] = best;
}
`;
