import { wgsl } from './common.js';

/* ------------------------------------------------------------------ *
 * Stage 02 - decode / normalise
 *
 * Area-average downsample of the source texture into the working resolution,
 * packed to RGBA8 in a storage buffer (1 u32/px). Everything downstream reads
 * this instead of the texture, so the 12 MP source is touched exactly once.
 *
 * Box-averaging rather than a bilinear sampler is deliberate: at a 4x
 * reduction a bilinear tap ignores 15 of every 16 source pixels, which drops
 * hairline table rules entirely on some rows and keeps them on others. That
 * single decision is the difference between "the rule is dashed" and "the rule
 * is there" at stage 07.
 *
 * bindings: 1 srcTex, 2 dstRGBA(u32)
 * i0 srcW  i1 srcH  i2 max taps/axis    f0 gain  f1 bias
 * ------------------------------------------------------------------ */
export const RESAMPLE = wgsl(/* wgsl */ `
@group(0) @binding(1) var srcTex : texture_2d<f32>;
@group(0) @binding(2) var<storage, read_write> dst : array<u32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }

  let sw = f32(P.i0);
  let sh = f32(P.i1);
  let x0 = i32(floor(f32(gid.x) * sw / f32(P.w)));
  let x1 = max(x0 + 1, i32(ceil(f32(gid.x + 1u) * sw / f32(P.w))));
  let y0 = i32(floor(f32(gid.y) * sh / f32(P.h)));
  let y1 = max(y0 + 1, i32(ceil(f32(gid.y + 1u) * sh / f32(P.h))));

  let taps = max(1, i32(P.i2));
  let stepX = max(1, (x1 - x0 + taps - 1) / taps);
  let stepY = max(1, (y1 - y0 + taps - 1) / taps);

  var acc = vec4<f32>(0.0);
  var n : f32 = 0.0;
  var sy = y0;
  loop {
    if (sy >= y1) { break; }
    var sx = x0;
    loop {
      if (sx >= x1) { break; }
      let cx = clamp(sx, 0, i32(P.i0) - 1);
      let cy = clamp(sy, 0, i32(P.i1) - 1);
      acc = acc + textureLoad(srcTex, vec2<i32>(cx, cy), 0);
      n = n + 1.0;
      sx = sx + stepX;
    }
    sy = sy + stepY;
  }

  var c = acc / max(n, 1.0);
  c = clamp(c * P.f0 + vec4<f32>(P.f1, P.f1, P.f1, 0.0), vec4<f32>(0.0), vec4<f32>(1.0));
  let r = u32(c.r * 255.0 + 0.5);
  let g = u32(c.g * 255.0 + 0.5);
  let b = u32(c.b * 255.0 + 0.5);
  let a = u32(c.a * 255.0 + 0.5);
  dst[pxIndex(gid.x, gid.y)] = r | (g << 8u) | (b << 16u) | (a << 24u);
}
`);

/* ------------------------------------------------------------------ *
 * Stage 03 - luminance
 * Rec.601 luma. Also composites over white so that transparent PNG invoices
 * (common when exported from a viewer) do not read as solid black ink.
 * bindings: 1 srcRGBA(u32), 2 dstLum(f32)
 * ------------------------------------------------------------------ */
export const LUMINANCE = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read> src : array<u32>;
@group(0) @binding(2) var<storage, read_write> lum : array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let i = pxIndex(gid.x, gid.y);
  let p = src[i];
  let r = f32(p & 0xffu) / 255.0;
  let g = f32((p >> 8u) & 0xffu) / 255.0;
  let b = f32((p >> 16u) & 0xffu) / 255.0;
  let a = f32((p >> 24u) & 0xffu) / 255.0;
  let y = 0.299 * r + 0.587 * g + 0.114 * b;
  lum[i] = mix(1.0, y, a);
}
`);

/* ------------------------------------------------------------------ *
 * Stage 04a - separable local statistics (horizontal half)
 * Accumulates sum and sum-of-squares along x with edge clamping, so the second
 * pass sees a constant window count and needs no per-pixel area correction.
 * bindings: 1 lum, 2 sumX, 3 sumsqX      i0 radius
 * ------------------------------------------------------------------ */
export const BOX_STATS_X = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read> lum : array<f32>;
@group(0) @binding(2) var<storage, read_write> sumX : array<f32>;
@group(0) @binding(3) var<storage, read_write> sumsqX : array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let r = i32(P.i0);
  var s : f32 = 0.0;
  var q : f32 = 0.0;
  for (var d = -r; d <= r; d = d + 1) {
    let v = lum[pxIndex(clampX(i32(gid.x) + d), gid.y)];
    s = s + v;
    q = q + v * v;
  }
  let i = pxIndex(gid.x, gid.y);
  sumX[i] = s;
  sumsqX[i] = q;
}
`);

/* ------------------------------------------------------------------ *
 * Stage 04b - vertical half + adaptive (Sauvola) ink probability
 *
 * A global threshold destroys faint characters under a scanner shadow. Sauvola
 * adapts the threshold to the local mean and standard deviation:
 *     T = m * (1 + k * (sd / R - 1))
 * We emit a *soft* ink probability rather than a hard binary mask, because
 * downstream stroke morphology and projection analysis both benefit from
 * keeping the confidence around faint strokes.
 *
 * The sd gate suppresses flat paper: a region with no local contrast has no
 * ink in it no matter where the threshold lands.
 *
 * bindings: 1 sumX, 2 sumsqX, 3 lum, 4 ink
 * i0 radius   f0 k   f1 R   f2 softness   f3 minStdDev
 * ------------------------------------------------------------------ */
export const SAUVOLA_Y = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read> sumX : array<f32>;
@group(0) @binding(2) var<storage, read> sumsqX : array<f32>;
@group(0) @binding(3) var<storage, read> lum : array<f32>;
@group(0) @binding(4) var<storage, read_write> ink : array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let r = i32(P.i0);
  var s : f32 = 0.0;
  var q : f32 = 0.0;
  for (var d = -r; d <= r; d = d + 1) {
    let j = pxIndex(gid.x, clampY(i32(gid.y) + d));
    s = s + sumX[j];
    q = q + sumsqX[j];
  }
  let n = f32((2 * r + 1) * (2 * r + 1));
  let m = s / n;
  let variance = max(q / n - m * m, 0.0);
  let sd = sqrt(variance);

  let t = m * (1.0 + P.f0 * (sd / max(P.f1, 1e-4) - 1.0));
  let i = pxIndex(gid.x, gid.y);
  let l = lum[i];

  // 1 where the pixel is clearly darker than the local threshold.
  var v = 1.0 - smoothstep(t - P.f2, t + P.f2, l);
  // Flat-paper gate.
  v = v * smoothstep(P.f3 * 0.4, P.f3, sd);
  ink[i] = clamp(v, 0.0, 1.0);
}
`);

/* ------------------------------------------------------------------ *
 * Stage 05 - 3x3 median denoise
 * Removes scanner speckle and JPEG ringing without eating 1px table rules the
 * way a Gaussian would. Full 9-element sorting network (19 compare-exchanges);
 * only element 4 is needed but the network is branch-free either way.
 * bindings: 1 src, 2 dst
 * ------------------------------------------------------------------ */
export const MEDIAN3 = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read> src : array<f32>;
@group(0) @binding(2) var<storage, read_write> dst : array<f32>;

fn cswap(a : ptr<function, f32>, b : ptr<function, f32>) {
  let x = *a;
  let y = *b;
  *a = min(x, y);
  *b = max(x, y);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  var v : array<f32, 9>;
  var n = 0u;
  for (var dy = -1; dy <= 1; dy = dy + 1) {
    for (var dx = -1; dx <= 1; dx = dx + 1) {
      v[n] = src[pxIndex(clampX(i32(gid.x) + dx), clampY(i32(gid.y) + dy))];
      n = n + 1u;
    }
  }
  cswap(&v[1], &v[2]); cswap(&v[4], &v[5]); cswap(&v[7], &v[8]);
  cswap(&v[0], &v[1]); cswap(&v[3], &v[4]); cswap(&v[6], &v[7]);
  cswap(&v[1], &v[2]); cswap(&v[4], &v[5]); cswap(&v[7], &v[8]);
  cswap(&v[0], &v[3]); cswap(&v[5], &v[8]); cswap(&v[4], &v[7]);
  cswap(&v[3], &v[6]); cswap(&v[1], &v[4]); cswap(&v[2], &v[5]);
  cswap(&v[4], &v[7]); cswap(&v[4], &v[2]); cswap(&v[6], &v[4]);
  cswap(&v[4], &v[2]);
  dst[pxIndex(gid.x, gid.y)] = v[4];
}
`);

/* ------------------------------------------------------------------ *
 * Stage 06 - gradient extraction (Scharr)
 * Scharr rather than Sobel: better rotational symmetry, which matters because
 * the angle channel is later used to separate near-horizontal rules from
 * near-vertical ones on slightly skewed scans.
 * mag is normalised to [0,1]; ang is normalised turns in [0,1) where
 * 0 = horizontal edge, 0.25 = vertical edge.
 * bindings: 1 lum, 2 mag, 3 ang
 * ------------------------------------------------------------------ */
export const SCHARR = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read> lum : array<f32>;
@group(0) @binding(2) var<storage, read_write> mag : array<f32>;
@group(0) @binding(3) var<storage, read_write> ang : array<f32>;

fn L(x : i32, y : i32) -> f32 {
  return lum[pxIndex(clampX(x), clampY(y))];
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let x = i32(gid.x);
  let y = i32(gid.y);

  let a00 = L(x - 1, y - 1); let a10 = L(x, y - 1); let a20 = L(x + 1, y - 1);
  let a01 = L(x - 1, y);                            let a21 = L(x + 1, y);
  let a02 = L(x - 1, y + 1); let a12 = L(x, y + 1); let a22 = L(x + 1, y + 1);

  let gx = (3.0 * a00 + 10.0 * a01 + 3.0 * a02) - (3.0 * a20 + 10.0 * a21 + 3.0 * a22);
  let gy = (3.0 * a00 + 10.0 * a10 + 3.0 * a20) - (3.0 * a02 + 10.0 * a12 + 3.0 * a22);

  let i = pxIndex(gid.x, gid.y);
  mag[i] = clamp(sqrt(gx * gx + gy * gy) / 16.0, 0.0, 1.0);
  var t = atan2(gy, gx) / 6.28318530718;
  if (t < 0.0) { t = t + 1.0; }
  ang[i] = t;
}
`);

/* ------------------------------------------------------------------ *
 * Stage 06b - edge-orientation histogram (skew estimate).
 *
 * The angle channel earns its keep here. A page scanned 1.5 degrees off square
 * has every "horizontal" rule drifting a row every 40px, which quietly turns
 * one rule into six segments at stage 07 and wrecks the row hypothesis. The
 * histogram peak near 90 degrees (gradient normal to a horizontal edge) gives
 * the skew, so the caller can either deskew or widen the stroke-linking
 * tolerance to match.
 *
 * bindings: 1 mag, 2 ang, 3 hist(atomic u32, i0 bins over 180 degrees)
 * i0 bins   f0 magnitude threshold
 * ------------------------------------------------------------------ */
export const ANGLE_HIST = wgsl(/* wgsl */ `
@group(0) @binding(1) var<storage, read> mag : array<f32>;
@group(0) @binding(2) var<storage, read> ang : array<f32>;
@group(0) @binding(3) var<storage, read_write> hist : array<atomic<u32>>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }
  let i = pxIndex(gid.x, gid.y);
  let m = mag[i];
  if (m < P.f0) { return; }
  // Orientation is mod 180 degrees: an edge and its reverse are the same line.
  var deg = ang[i] * 360.0;
  if (deg >= 180.0) { deg = deg - 180.0; }
  let bin = min(u32(deg / 180.0 * f32(P.i0)), P.i0 - 1u);
  atomicAdd(&hist[bin], u32(m * 64.0 + 0.5));
}
`);

/* ------------------------------------------------------------------ *
 * Stage 02R - decode / normalise THROUGH A HOMOGRAPHY.
 *
 * Rectification is free: stage 02 already maps every working pixel to a place
 * in the source texture, so replacing that axis-aligned box mapping with a
 * homography costs one extra matrix-vector product per pixel and removes
 * rotation, skew and perspective in the same pass the resample was doing
 * anyway. No separate warp, no second copy of the page.
 *
 * The footprint is derived from the local Jacobian rather than assumed square:
 * under keystone the top of the page is minified far more than the bottom, and
 * a fixed box would alias one end while blurring the other.
 *
 * bindings: 1 srcTex, 2 dstRGBA(u32), 3 warp uniform (rectified -> source)
 * i0 srcW  i1 srcH  i2 taps/axis    f0 gain  f1 bias
 * ------------------------------------------------------------------ */
export const RESAMPLE_WARP = wgsl(/* wgsl */ `
struct Warp { m : mat3x3<f32> };

@group(0) @binding(1) var srcTex : texture_2d<f32>;
@group(0) @binding(2) var<storage, read_write> dst : array<u32>;
@group(0) @binding(3) var<uniform> W : Warp;

fn project(x : f32, y : f32) -> vec2<f32> {
  let p = W.m * vec3<f32>(x, y, 1.0);
  let w = select(p.z, 1.0e-6, abs(p.z) < 1.0e-6);
  return vec2<f32>(p.x / w, p.y / w);
}

fn tap(p : vec2<f32>) -> vec4<f32> {
  let maxX = i32(P.i0) - 1;
  let maxY = i32(P.i1) - 1;
  let f = floor(p);
  let a = p - f;
  let x0 = clamp(i32(f.x), 0, maxX);
  let y0 = clamp(i32(f.y), 0, maxY);
  let x1 = clamp(x0 + 1, 0, maxX);
  let y1 = clamp(y0 + 1, 0, maxY);
  let c00 = textureLoad(srcTex, vec2<i32>(x0, y0), 0);
  let c10 = textureLoad(srcTex, vec2<i32>(x1, y0), 0);
  let c01 = textureLoad(srcTex, vec2<i32>(x0, y1), 0);
  let c11 = textureLoad(srcTex, vec2<i32>(x1, y1), 0);
  return mix(mix(c00, c10, a.x), mix(c01, c11, a.x), a.y);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= P.w || gid.y >= P.h) { return; }

  let fx = f32(gid.x) + 0.5;
  let fy = f32(gid.y) + 0.5;
  let p0 = project(fx, fy);
  // Local Jacobian: how far one output step moves us in the source.
  let ex = project(fx + 1.0, fy) - p0;
  let ey = project(fx, fy + 1.0) - p0;

  let taps = max(1, i32(P.i2));
  var acc = vec4<f32>(0.0);
  var n : f32 = 0.0;
  for (var j = 0; j < taps; j = j + 1) {
    for (var i = 0; i < taps; i = i + 1) {
      let ox = (f32(i) + 0.5) / f32(taps) - 0.5;
      let oy = (f32(j) + 0.5) / f32(taps) - 0.5;
      acc = acc + tap(p0 + ex * ox + ey * oy);
      n = n + 1.0;
    }
  }

  var c = acc / max(n, 1.0);
  c = clamp(c * P.f0 + vec4<f32>(P.f1, P.f1, P.f1, 0.0), vec4<f32>(0.0), vec4<f32>(1.0));
  let r = u32(c.r * 255.0 + 0.5);
  let g = u32(c.g * 255.0 + 0.5);
  let b = u32(c.b * 255.0 + 0.5);
  let a = u32(c.a * 255.0 + 0.5);
  dst[pxIndex(gid.x, gid.y)] = r | (g << 8u) | (b << 16u) | (a << 24u);
}
`);
