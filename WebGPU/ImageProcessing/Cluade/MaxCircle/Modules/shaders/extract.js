/**
 * shaders/extract.js
 * WGSL source for Stage 5 — Circle Extraction.
 *
 * Algorithm:
 *   Single workgroup (256 threads) performs the final reduction over
 *   ≤256 partial results from the cascade.  Thread 0 decodes the winning
 *   pixel index back to (cx, cy) and writes [cx, cy, radius, 0] as f32[4].
 *
 * This is the ONLY 16-byte result that ever leaves the GPU.
 *
 * Workgroup size: 256 threads (single workgroup dispatch).
 * Bindings:
 *   0 → inBuf  : array<vec2u>  (final partial results from reduce cascade)
 *   1 → resBuf : array<f32>    (output: [cx, cy, radius, 0])
 *   2 → ep     : EP uniform    (count of partials, image width)
 */
export const WGSL_EXTRACT = /* wgsl */`
struct EP {
  count : u32,   // number of valid entries in inBuf (≤ 256)
  width : u32,   // image width, used to decode pixelIdx → (x, y)
  pad0  : u32,
  pad1  : u32,
}

@group(0) @binding(0) var<storage, read>       inBuf  : array<vec2u>;
@group(0) @binding(1) var<storage, read_write> resBuf : array<f32>;
@group(0) @binding(2) var<uniform>             ep     : EP;

var<workgroup> sd : array<f32, 256>;
var<workgroup> si : array<u32, 256>;

@compute @workgroup_size(256)
fn main(@builtin(local_invocation_id) l : vec3u) {
  let li = l.x;

  if (li < ep.count) {
    let e  = inBuf[li];
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
    let bi    = si[0];
    resBuf[0] = f32(bi % ep.width);  // center X
    resBuf[1] = f32(bi / ep.width);  // center Y
    resBuf[2] = sd[0];               // radius (max distance to background)
    resBuf[3] = 0.0;                 // padding
  }
}
`;
