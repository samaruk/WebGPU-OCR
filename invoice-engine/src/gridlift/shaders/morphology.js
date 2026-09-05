import { wgsl } from './common.js';

/* ------------------------------------------------------------------ *
 * Stages 07-09 - one generic separable 1D morphology kernel.
 *
 * Directional opening (erode then dilate) along x isolates long horizontal
 * structures; along y, long vertical ones. Directional closing (dilate then
 * erode) is stroke *linking* - it bridges the gaps that dashed, dotted and
 * badly-scanned rules leave behind.
 *
 * Working on the soft ink probability rather than a hard binary keeps faint
 * rules alive through the open/close cycle.
 *
 * bindings: 1 src, 2 dst
 * i0 axis (0 = x, 1 = y)   i1 op (0 = erode/min, 1 = dilate/max)   i2 radius
 * ------------------------------------------------------------------ */
export const MORPH_1D = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read> src : array<f32>;
@group(0) @binding(2) var<storage, read_write> dst : array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let r = i32(P.i2);
  let dilate = P.i1 == 1u;
  var acc : f32 = select(1.0e30, -1.0e30, dilate);

  for (var d = -r; d <= r; d = d + 1) {
    var v : f32;
    if (P.i0 == 0u) {
      v = src[pxIndex(clampX(i32(gid.x) + d), gid.y)];
    } else {
      v = src[pxIndex(gid.x, clampY(i32(gid.y) + d))];
    }
    acc = select(min(acc, v), max(acc, v), dilate);
  }
  dst[pxIndex(gid.x, gid.y)] = acc;
}
`);

/* ------------------------------------------------------------------ *
 * Directional stroke score.
 *
 * The opened mask alone would happily call the horizontal bar of a long word
 * ("Total Amount" underlined by its own baseline) a table rule. So the score is
 * not just "did it survive the opening" - it is the opening result damped by
 * how much *perpendicular* structure sits directly on top of it. A real rule is
 * thin: a few rows tall and nothing above or below. Text is not.
 *
 * bindings: 1 opened, 2 ink, 3 score
 * i0 axis (0 = horizontal rule, 1 = vertical rule)
 * i2 perpendicular probe distance   f0 damping strength
 * ------------------------------------------------------------------ */
export const STROKE_SCORE = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read> opened : array<f32>;
@group(0) @binding(2) var<storage, read> ink : array<f32>;
@group(0) @binding(3) var<storage, read_write> score : array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let i = pxIndex(gid.x, gid.y);
  let base = opened[i];
  if (base <= 0.02) { score[i] = 0.0; return; }

  let probe = i32(P.i2);
  var near : f32 = 0.0;
  var n : f32 = 0.0;
  // Sample perpendicular to the stroke direction, skipping the stroke body.
  for (var d = -probe; d <= probe; d = d + 1) {
    if (abs(d) <= 1) { continue; }
    var v : f32;
    if (P.i0 == 0u) {
      v = ink[pxIndex(gid.x, clampY(i32(gid.y) + d))];
    } else {
      v = ink[pxIndex(clampX(i32(gid.x) + d), gid.y)];
    }
    near = near + v;
    n = n + 1.0;
  }
  let crowding = select(0.0, near / n, n > 0.0);
  score[i] = clamp(base * (1.0 - P.f0 * crowding), 0.0, 1.0);
}
`);

/* ------------------------------------------------------------------ *
 * Binarise a soft mask.  bindings: 1 src, 2 dst   f0 threshold
 * ------------------------------------------------------------------ */
export const BINARIZE = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read> src : array<f32>;
@group(0) @binding(2) var<storage, read_write> dst : array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let i = pxIndex(gid.x, gid.y);
  dst[i] = select(0.0, 1.0, src[i] >= P.f0);
}
`);

/** Elementwise max of two masks. bindings: 1 a, 2 b, 3 dst */
export const COMBINE_MAX = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read> a : array<f32>;
@group(0) @binding(2) var<storage, read> b : array<f32>;
@group(0) @binding(3) var<storage, read_write> dst : array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let i = pxIndex(gid.x, gid.y);
  dst[i] = max(a[i], b[i]);
}
`);

/* ------------------------------------------------------------------ *
 * Stage 10 - border suppression.
 *
 * Produces the OCR-facing image: ink with rule pixels removed. The *geometry*
 * image (the stroke mask) is kept separately, because the borders are evidence
 * about layout even though they are noise for text recognition.
 *
 * A rule that runs through a glyph would leave a hole, so suppression is
 * proportional rather than binary and is skipped where the perpendicular ink
 * density says a glyph is sitting on the rule.
 *
 * bindings: 1 ink, 2 strokeDilated, 3 outOcrInk    f0 suppression strength
 * ------------------------------------------------------------------ */
export const SUPPRESS_BORDERS = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read> ink : array<f32>;
@group(0) @binding(2) var<storage, read> stroke : array<f32>;
@group(0) @binding(3) var<storage, read_write> dst : array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let i = pxIndex(gid.x, gid.y);
  let s = clamp(stroke[i], 0.0, 1.0);
  dst[i] = clamp(ink[i] * (1.0 - P.f0 * s), 0.0, 1.0);
}
`);

/* ------------------------------------------------------------------ *
 * Mask packing - the single full-resolution readback of the whole pipeline.
 * Four masks become four bytes of one u32, so the CPU stages get everything
 * they need for segment extraction in one transfer instead of four.
 * byte0 ink | byte1 horizontal | byte2 vertical | byte3 ocr-ink
 * bindings: 1 ink, 2 h, 3 v, 4 ocrInk, 5 dst(u32)
 * ------------------------------------------------------------------ */
export const PACK_MASKS = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read> ink : array<f32>;
@group(0) @binding(2) var<storage, read> hMask : array<f32>;
@group(0) @binding(3) var<storage, read> vMask : array<f32>;
@group(0) @binding(4) var<storage, read> ocrInk : array<f32>;
@group(0) @binding(5) var<storage, read_write> dst : array<u32>;

fn b(v : f32) -> u32 { return u32(clamp(v, 0.0, 1.0) * 255.0 + 0.5); }

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let i = pxIndex(gid.x, gid.y);
  dst[i] = b(ink[i]) | (b(hMask[i]) << 8u) | (b(vMask[i]) << 16u) | (b(ocrInk[i]) << 24u);
}
`);

/** Fill a u32 buffer. i0 = value, w = element count (1D dispatch). */
export const FILL_U32 = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read_write> dst : array<u32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w) { return; }
  dst[gid.x] = P.i0;
}
`);
