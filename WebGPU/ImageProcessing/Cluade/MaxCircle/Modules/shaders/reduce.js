/**
 * shaders/reduce.js
 * WGSL sources for Stage 4 — Parallel Max Reduction.
 *
 * Two shaders:
 *
 * 1. wgslDistReduce(fp16)
 *    First-level reduction: reads distBuf (array<f32|f16>).
 *    Each 256-thread workgroup finds its local (maxDist, pixelIdx) pair.
 *    Outputs array<vec2u> where vec2u = (bitcast<u32>(maxDist), pixelIdx).
 *    Bitcasting float to uint is safe for positive IEEE-754 floats:
 *    their bit ordering preserves numerical ordering.
 *
 * 2. WGSL_REDUCE
 *    Generic reduction: reads array<vec2u> from a prior reduction pass,
 *    emits another array<vec2u>. Reused for levels 2, 3, … of the cascade.
 *
 * Workgroup size: 256 threads.
 * Cascade depth:
 *   Level 1: TOTAL / 256  partial results
 *   Level 2: Level1 / 256 partial results
 *   Level 3: Level2 / 256 (only needed for images > 16 Mpx)
 */

/**
 * First-level reduction: distBuf (f16 or f32) → partial max vec2u array.
 * @param {boolean} fp16
 * @returns {string} WGSL source
 */
export function wgslDistReduce(fp16) {
  const T  = fp16 ? 'f16' : 'f32';
  const en = fp16 ? 'enable f16;\n' : '';

  return /* wgsl */`${en}
@group(0) @binding(0) var<storage, read>       distBuf : array<${T}>;
@group(0) @binding(1) var<storage, read_write> outBuf  : array<vec2u>;
@group(0) @binding(2) var<uniform>             cnt     : vec4u;  // .x = total pixels

var<workgroup> sd : array<f32, 256>;  // local max distances
var<workgroup> si : array<u32, 256>;  // local best pixel indices

@compute @workgroup_size(256)
fn main(
  @builtin(global_invocation_id) g : vec3u,
  @builtin(local_invocation_id)  l : vec3u,
  @builtin(workgroup_id)         w : vec3u,
) {
  let li = l.x;

  // Load — threads beyond the data boundary get -1 (never win)
  if (g.x < cnt.x) { sd[li] = f32(distBuf[g.x]); si[li] = g.x; }
  else              { sd[li] = -1.0;               si[li] = 0u;  }
  workgroupBarrier();

  // Parallel tree reduction — 8 halvings for 256 threads
  for (var stride = 128u; stride > 0u; stride >>= 1u) {
    if (li < stride && sd[li + stride] > sd[li]) {
      sd[li] = sd[li + stride];
      si[li] = si[li + stride];
    }
    workgroupBarrier();
  }

  // Thread 0 writes this workgroup's winner
  if (li == 0u) {
    outBuf[w.x] = vec2u(bitcast<u32>(sd[0]), si[0]);
  }
}
`;
}

/**
 * Generic reduction pass: array<vec2u> → array<vec2u>.
 * Used for all cascade levels after the first.
 */
export const WGSL_REDUCE = /* wgsl */`
@group(0) @binding(0) var<storage, read>       inBuf  : array<vec2u>;
@group(0) @binding(1) var<storage, read_write> outBuf : array<vec2u>;
@group(0) @binding(2) var<uniform>             cnt    : vec4u;

var<workgroup> sd : array<f32, 256>;
var<workgroup> si : array<u32, 256>;

@compute @workgroup_size(256)
fn main(
  @builtin(global_invocation_id) g : vec3u,
  @builtin(local_invocation_id)  l : vec3u,
  @builtin(workgroup_id)         w : vec3u,
) {
  let li = l.x;

  if (g.x < cnt.x) {
    let e  = inBuf[g.x];
    sd[li] = bitcast<f32>(e.x);
    si[li] = e.y;
  } else {
    sd[li] = -1.0;
    si[li] = 0u;
  }
  workgroupBarrier();

  for (var stride = 128u; stride > 0u; stride >>= 1u) {
    if (li < stride && sd[li + stride] > sd[li]) {
      sd[li] = sd[li + stride];
      si[li] = si[li + stride];
    }
    workgroupBarrier();
  }

  if (li == 0u) {
    outBuf[w.x] = vec2u(bitcast<u32>(sd[0]), si[0]);
  }
}
`;
