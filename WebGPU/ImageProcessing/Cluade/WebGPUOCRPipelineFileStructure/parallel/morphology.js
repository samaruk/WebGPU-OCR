/**
 * parallel/morphology.js — GPU Binary Morphological Operations
 *
 * Implements erosion, dilation, opening, closing, and gradient on binary images.
 * All operations run in parallel GPU compute shaders.
 *
 * Used for:
 *   - Post-processing binarized maps (remove noise via opening)
 *   - Connecting broken text strokes (dilation before CCA)
 *   - Computing morphological gradient for edge detection
 *   - Tophat/blackhat transforms for background estimation
 */

import { gpuContext } from '../core/gpuContext.js';
import { Tensor, createUniformBuffer } from '../core/tensor.js';

// ─── WGSL ─────────────────────────────────────────────────────────────────────

// Generic morphological operation kernel
// opType: 0 = erosion (min), 1 = dilation (max)
const SHADER_MORPH = /* wgsl */`
struct U {
  width:   u32,
  height:  u32,
  radius:  u32,   // structuring element radius
  opType:  u32,   // 0=erosion, 1=dilation
  shape:   u32,   // 0=rectangle, 1=cross, 2=ellipse
  _p0:     u32,
  _p1:     u32,
  _p2:     u32,
}

@group(0) @binding(0) var<uniform>            u:   U;
@group(0) @binding(1) var<storage,read>       src: array<u32>;
@group(0) @binding(2) var<storage,read_write> dst: array<u32>;

fn inSE(dx: i32, dy: i32, r: i32, shape: u32) -> bool {
  if (shape == 0u) {
    // Rectangle
    return abs(dx) <= r && abs(dy) <= r;
  } else if (shape == 1u) {
    // Cross (plus sign)
    return (dx == 0) || (dy == 0);
  } else {
    // Ellipse
    return f32(dx*dx + dy*dy) <= f32(r*r) + 0.5;
  }
}

fn rd(x: i32, y: i32) -> u32 {
  if (x < 0 || x >= i32(u.width) || y < 0 || y >= i32(u.height)) {
    // Erosion: out-of-bounds = 1 (don't erode edge)
    // Dilation: out-of-bounds = 0 (don't dilate edge)
    return select(1u, 0u, u.opType == 1u);
  }
  return src[u32(y) * u.width + u32(x)];
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let x = i32(gid.x);
  let y = i32(gid.y);
  let r = i32(u.radius);

  var result = select(1u, 0u, u.opType == 0u);  // erosion starts at 1, dilation at 0

  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      if (!inSE(dx, dy, r, u.shape)) { continue; }
      let v = rd(x+dx, y+dy);
      if (u.opType == 0u) {
        result = min(result, v);  // erosion = AND / min
      } else {
        result = max(result, v);  // dilation = OR / max
      }
    }
  }

  dst[gid.y * u.width + gid.x] = result;
}
`;

// Element-wise binary operations on two binary maps
const SHADER_BINARY_OP = /* wgsl */`
struct U { n: u32, op: u32, _p0: u32, _p1: u32, }
// op: 0=AND, 1=OR, 2=XOR, 3=SUB(A-B, clamped)

@group(0) @binding(0) var<uniform>            u:   U;
@group(0) @binding(1) var<storage,read>       A:   array<u32>;
@group(0) @binding(2) var<storage,read>       B:   array<u32>;
@group(0) @binding(3) var<storage,read_write> dst: array<u32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  let a = A[gid.x];
  let b = B[gid.x];
  var r = 0u;
  switch (u.op) {
    case 0u:  { r = a & b; }
    case 1u:  { r = a | b; }
    case 2u:  { r = a ^ b; }
    case 3u:  { r = select(0u, a - b, a > b); }
    default:  { r = a; }
  }
  dst[gid.x] = r;
}
`;

// Bitwise NOT (invert binary image)
const SHADER_NOT = /* wgsl */`
struct U { n: u32, _p0: u32, _p1: u32, _p2: u32, }
@group(0) @binding(0) var<uniform>            u:   U;
@group(0) @binding(1) var<storage,read>       src: array<u32>;
@group(0) @binding(2) var<storage,read_write> dst: array<u32>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  dst[gid.x] = 1u - src[gid.x];
}
`;

// Distance transform (approximate Euclidean via two-pass)
// Pass 1: horizontal, Pass 2: vertical + combine
const SHADER_DIST_H = /* wgsl */`
struct U { width: u32, height: u32, _p0: u32, _p1: u32, }
@group(0) @binding(0) var<uniform>            u:   U;
@group(0) @binding(1) var<storage,read>       bin: array<u32>;  // binary
@group(0) @binding(2) var<storage,read_write> hdist: array<f32>;  // horizontal distances

@compute @workgroup_size(1, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let y = gid.y;
  if (y >= u.height) { return; }
  // Forward scan
  var d = f32(u.width) + 1.0;
  for (var x = 0u; x < u.width; x++) {
    if (bin[y * u.width + x] == 0u) { d = 0.0; } else { d += 1.0; }
    hdist[y * u.width + x] = d;
  }
  // Backward scan
  d = f32(u.width) + 1.0;
  for (var xi = u.width; xi > 0u; xi--) {
    let x = xi - 1u;
    if (bin[y * u.width + x] == 0u) { d = 0.0; } else { d += 1.0; }
    hdist[y * u.width + x] = min(hdist[y * u.width + x], d);
  }
}
`;

const SHADER_DIST_V = /* wgsl */`
struct U { width: u32, height: u32, _p0: u32, _p1: u32, }
@group(0) @binding(0) var<uniform>            u:     U;
@group(0) @binding(1) var<storage,read>       hdist: array<f32>;
@group(0) @binding(2) var<storage,read_write> dist:  array<f32>;  // final Euclidean distance

@compute @workgroup_size(16, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x;
  if (x >= u.width) { return; }
  var f = array<f32, 1024>();  // parabola envelope (max height support)
  var v = array<u32, 1024>();
  var z = array<f32, 1025>();
  var k = 0u;
  v[0] = 0u;
  z[0] = -1e30;
  z[1] =  1e30;

  // Parabola lower envelope (standard 2D distance transform)
  for (var q = 1u; q < u.height; q++) {
    let sq = hdist[q * u.width + x];
    let fq = sq * sq + f32(q*q);  // distance contribution
    loop {
      if (k == 0u) { break; }
      let vk = v[k];
      let fvk = hdist[vk * u.width + x];
      let fvk2 = fvk*fvk + f32(vk*vk);
      let s = (fq - fvk2) / (2.0*f32(q) - 2.0*f32(vk));
      if (s > z[k]) { break; }
      k -= 1u;
    }
    k += 1u;
    v[k] = q;
    z[k] = (fq - (hdist[v[k-1u]*u.width+x]*hdist[v[k-1u]*u.width+x] + f32(v[k-1u]*v[k-1u])))
          / (2.0*f32(q) - 2.0*f32(v[k-1u]));
    z[k+1u] = 1e30;
  }

  k = 0u;
  for (var q = 0u; q < u.height; q++) {
    while (k < 1023u && z[k+1u] < f32(q)) { k += 1u; }
    let vk = v[k];
    let d = hdist[vk * u.width + x];
    let dd = d*d + f32((i32(q) - i32(vk))*(i32(q) - i32(vk)));
    dist[q * u.width + x] = sqrt(dd);
  }
}
`;

// ─── Stage Class ─────────────────────────────────────────────────────────────

export class MorphologyStage {
  constructor() {
    this._p = null;
  }

  async _build() {
    if (this._p) return;
    const mk = (src, lbl) => gpuContext.createComputePipeline(
      gpuContext.createShaderModule(src, lbl), 'main');
    this._p = {
      morph:    mk(SHADER_MORPH,     'morph:op'),
      binOp:    mk(SHADER_BINARY_OP, 'morph:binop'),
      not:      mk(SHADER_NOT,       'morph:not'),
      distH:    mk(SHADER_DIST_H,    'morph:distH'),
      distV:    mk(SHADER_DIST_V,    'morph:distV'),
    };
  }

  _morphOp(src, H, W, radius, opType, shape = 0, label = '') {
    const dst = new Tensor([H * W], 'u32', 0, `morph:${label || opType}`);
    const u = createUniformBuffer({ width: W, height: H, radius, opType, shape, _p0: 0, _p1: 0, _p2: 0 });
    const bg = gpuContext.device.createBindGroup({
      layout: this._p.morph.getBindGroupLayout(0),
      entries: [u.bindingEntry(0), src.bindingEntry(1, true), dst.bindingEntry(2)],
    });
    gpuContext.dispatch(this._p.morph, bg, [Math.ceil(W / 16), Math.ceil(H / 16), 1]);
    return dst;
  }

  /** Erosion: shrink foreground regions */
  async erode(binaryTensor, H, W, radius = 1, shape = 0) {
    gpuContext.assertReady(); await this._build();
    return this._morphOp(binaryTensor, H, W, radius, 0, shape, 'erode');
  }

  /** Dilation: expand foreground regions */
  async dilate(binaryTensor, H, W, radius = 1, shape = 0) {
    gpuContext.assertReady(); await this._build();
    return this._morphOp(binaryTensor, H, W, radius, 1, shape, 'dilate');
  }

  /** Opening: erosion followed by dilation (remove small noise blobs) */
  async open(binaryTensor, H, W, radius = 1, shape = 0) {
    gpuContext.assertReady(); await this._build();
    const eroded = this._morphOp(binaryTensor, H, W, radius, 0, shape, 'open:e');
    const opened = this._morphOp(eroded, H, W, radius, 1, shape, 'open:d');
    eroded.destroy();
    return opened;
  }

  /** Closing: dilation followed by erosion (fill small holes) */
  async close(binaryTensor, H, W, radius = 1, shape = 0) {
    gpuContext.assertReady(); await this._build();
    const dilated = this._morphOp(binaryTensor, H, W, radius, 1, shape, 'close:d');
    const closed  = this._morphOp(dilated, H, W, radius, 0, shape, 'close:e');
    dilated.destroy();
    return closed;
  }

  /** Morphological gradient: dilation - erosion (edge detector) */
  async gradient(binaryTensor, H, W, radius = 1) {
    gpuContext.assertReady(); await this._build();
    const N = H * W;
    const dilated = this._morphOp(binaryTensor, H, W, radius, 1, 0, 'grad:d');
    const eroded  = this._morphOp(binaryTensor, H, W, radius, 0, 0, 'grad:e');
    const result  = new Tensor([N], 'u32', 0, 'morph:grad');
    const u = createUniformBuffer({ n: N, op: 3, _p0: 0, _p1: 0 }); // SUB
    const bg = gpuContext.device.createBindGroup({
      layout: this._p.binOp.getBindGroupLayout(0),
      entries: [u.bindingEntry(0), dilated.bindingEntry(1, true),
                eroded.bindingEntry(2, true), result.bindingEntry(3)],
    });
    gpuContext.dispatch(this._p.binOp, bg, [Math.ceil(N / 256), 1, 1]);
    dilated.destroy(); eroded.destroy();
    return result;
  }

  /** Top-hat: src - opening (bright small structures on dark background) */
  async tophat(binaryTensor, H, W, radius = 5) {
    gpuContext.assertReady(); await this._build();
    const N = H * W;
    const opened = await this.open(binaryTensor, H, W, radius);
    const result = new Tensor([N], 'u32', 0, 'morph:tophat');
    const u = createUniformBuffer({ n: N, op: 3, _p0: 0, _p1: 0 }); // SUB
    const bg = gpuContext.device.createBindGroup({
      layout: this._p.binOp.getBindGroupLayout(0),
      entries: [u.bindingEntry(0), binaryTensor.bindingEntry(1, true),
                opened.bindingEntry(2, true), result.bindingEntry(3)],
    });
    gpuContext.dispatch(this._p.binOp, bg, [Math.ceil(N / 256), 1, 1]);
    opened.destroy();
    return result;
  }

  /** Invert binary image */
  async invert(binaryTensor, H, W) {
    gpuContext.assertReady(); await this._build();
    const N = H * W;
    const result = new Tensor([N], 'u32', 0, 'morph:not');
    const u = createUniformBuffer({ n: N, _p0: 0, _p1: 0, _p2: 0 });
    const bg = gpuContext.device.createBindGroup({
      layout: this._p.not.getBindGroupLayout(0),
      entries: [u.bindingEntry(0), binaryTensor.bindingEntry(1, true), result.bindingEntry(2)],
    });
    gpuContext.dispatch(this._p.not, bg, [Math.ceil(N / 256), 1, 1]);
    return result;
  }

  /**
   * Compute approximate Euclidean distance transform.
   * Returns float tensor: each pixel = distance to nearest background pixel.
   * @param {Tensor} binaryTensor - [H*W] u32 (1=foreground, 0=background)
   * @returns {Promise<Tensor>} - [H*W] f32 distances
   */
  async distanceTransform(binaryTensor, H, W) {
    gpuContext.assertReady(); await this._build();

    const hdist = new Tensor([H * W], 'f32', 0, 'morph:hdist');
    const dist  = new Tensor([H * W], 'f32', 0, 'morph:dist');
    const u = createUniformBuffer({ width: W, height: H, _p0: 0, _p1: 0 });

    const bgH = gpuContext.device.createBindGroup({
      layout: this._p.distH.getBindGroupLayout(0),
      entries: [u.bindingEntry(0), binaryTensor.bindingEntry(1, true), hdist.bindingEntry(2)],
    });
    gpuContext.dispatch(this._p.distH, bgH, [1, Math.ceil(H / 16), 1]);

    const bgV = gpuContext.device.createBindGroup({
      layout: this._p.distV.getBindGroupLayout(0),
      entries: [u.bindingEntry(0), hdist.bindingEntry(1, true), dist.bindingEntry(2)],
    });
    gpuContext.dispatch(this._p.distV, bgV, [Math.ceil(W / 16), 1, 1]);

    hdist.destroy();
    return dist;
  }
}
