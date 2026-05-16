/**
 * 08_deskew.js — Per-Region Deskew
 *
 * For each detected text region polygon, computes the skew angle from
 * the polygon's primary axis and applies an affine rotation to produce
 * an upright text crop.
 *
 * GPU pipeline:
 *   1. Per-polygon: compute rotation angle from polygon corners
 *   2. Batch affine warp kernel: transforms the source image patch into
 *      an axis-aligned rectangle using inverse affine mapping
 *   3. Output: array of GPU textures, one per region, ready for normalization
 *
 * The affine warp runs fully on GPU with bilinear interpolation.
 */

import { gpuContext } from '../core/gpuContext.js';
import { Tensor, createUniformBuffer } from '../core/tensor.js';

// ─── WGSL ─────────────────────────────────────────────────────────────────────

// Affine warp: sample src image at inverse-transformed coordinates
// One dispatch per region (small, fast per-region dispatches)
const SHADER_AFFINE_WARP = /* wgsl */`
struct WarpUniforms {
  // Inverse 2×3 affine matrix [a,b,tx,c,d,ty]
  a:  f32, b:  f32, tx: f32,
  c:  f32, d:  f32, ty: f32,
  // Source image dimensions
  srcW: u32, srcH: u32,
  // Destination dimensions
  dstW: u32, dstH: u32,
}

@group(0) @binding(0) var<uniform>            u:   WarpUniforms;
@group(0) @binding(1) var<storage,read>       src: array<u32>;   // packed RGBA8 [srcH*srcW]
@group(0) @binding(2) var<storage,read_write> dst: array<u32>;   // packed RGBA8 [dstH*dstW]

fn sampleBilinear(fx: f32, fy: f32) -> u32 {
  let x0 = i32(floor(fx));
  let y0 = i32(floor(fy));
  let x1 = x0 + 1;
  let y1 = y0 + 1;
  let ax = fx - f32(x0);
  let ay = fy - f32(y0);

  fn clampRead(x: i32, y: i32) -> vec4<f32> {
    let cx = u32(clamp(x, 0, i32(u.srcW) - 1));
    let cy = u32(clamp(y, 0, i32(u.srcH) - 1));
    let p  = src[cy * u.srcW + cx];
    return vec4<f32>(
      f32((p >>  0u) & 0xFFu),
      f32((p >>  8u) & 0xFFu),
      f32((p >> 16u) & 0xFFu),
      f32((p >> 24u) & 0xFFu),
    );
  }

  let p00 = clampRead(x0, y0);
  let p10 = clampRead(x1, y0);
  let p01 = clampRead(x0, y1);
  let p11 = clampRead(x1, y1);

  let mixed = mix(mix(p00, p10, ax), mix(p01, p11, ax), ay);
  let r = u32(clamp(mixed.x, 0.0, 255.0));
  let g = u32(clamp(mixed.y, 0.0, 255.0));
  let b = u32(clamp(mixed.z, 0.0, 255.0));
  let a = u32(clamp(mixed.w, 0.0, 255.0));
  return r | (g << 8u) | (b << 16u) | (a << 24u);
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.dstW || gid.y >= u.dstH) { return; }

  // Destination pixel in float coordinates
  let dx = f32(gid.x);
  let dy = f32(gid.y);

  // Apply inverse affine transform: src = M_inv * dst
  let sx = u.a * dx + u.b * dy + u.tx;
  let sy = u.c * dx + u.d * dy + u.ty;

  dst[gid.y * u.dstW + gid.x] = sampleBilinear(sx, sy);
}
`;

// ─── Stage Class ─────────────────────────────────────────────────────────────

export class DeskewStage {
  constructor() {
    this._pipeline = null;
  }

  async _build() {
    if (this._pipeline) return;
    this._pipeline = gpuContext.createComputePipeline(
      gpuContext.createShaderModule(SHADER_AFFINE_WARP, 'deskew:affine'), 'main');
  }

  /**
   * Deskew a single region from the source image.
   * @param {Tensor} srcTensor - [H, W] u32 packed RGBA8 (full image)
   * @param {number} srcH, srcW
   * @param {[number,number][]} polygon - 4 corners in image coordinates
   * @param {Object} opts
   * @returns {Promise<{deskewedTensor: Tensor, dstH: number, dstW: number, angle: number}>}
   */
  async deskewRegion(srcTensor, srcH, srcW, polygon, opts = {}) {
    gpuContext.assertReady();
    await this._build();

    // Compute skew angle from polygon's dominant edge
    const angle = computeSkewAngle(polygon);

    // Compute output dimensions from rotated bounding box
    const { dstW, dstH, M_inv } = computeWarpParams(polygon, angle);

    const actualDstW = Math.max(1, Math.round(dstW));
    const actualDstH = Math.max(1, Math.round(dstH));

    const dstTensor = new Tensor([actualDstH, actualDstW], 'u32', 0, 'deskew:out');

    const u = {
      a: M_inv[0], b: M_inv[1], tx: M_inv[2],
      c: M_inv[3], d: M_inv[4], ty: M_inv[5],
      srcW, srcH,
      dstW: actualDstW, dstH: actualDstH,
    };

    // Pack into buffer (10 floats = 40 bytes, padded to 48)
    const uniformData = new Float32Array(12);
    uniformData[0] = u.a;   uniformData[1] = u.b;   uniformData[2] = u.tx;
    uniformData[3] = u.c;   uniformData[4] = u.d;   uniformData[5] = u.ty;
    uniformData[6] = u.srcW; uniformData[7] = u.srcH;
    uniformData[8] = u.dstW; uniformData[9] = u.dstH;

    const uniformBuf = gpuContext.createBufferWithData(uniformData,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);

    const bg = gpuContext.device.createBindGroup({
      layout: this._pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuf } },
        srcTensor.bindingEntry(1, true),
        dstTensor.bindingEntry(2, false),
      ],
    });

    gpuContext.dispatch(this._pipeline, bg,
      [Math.ceil(actualDstW / 16), Math.ceil(actualDstH / 16), 1]);

    uniformBuf.destroy();
    return { deskewedTensor: dstTensor, dstH: actualDstH, dstW: actualDstW, angle };
  }

  /**
   * Batch deskew all regions.
   * @param {Tensor} srcTensor
   * @param {number} srcH, srcW
   * @param {DetectedPolygon[]} regions
   * @returns {Promise<DeskewedRegion[]>}
   */
  async run(srcTensor, srcH, srcW, regions) {
    const results = [];
    for (const region of regions) {
      const r = await this.deskewRegion(srcTensor, srcH, srcW, region.polygon);
      results.push({ ...region, ...r });
    }
    await gpuContext.sync();
    return results;
  }
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/**
 * Compute skew angle from polygon's longest edge.
 * Returns angle in radians (small angles typically).
 */
function computeSkewAngle(polygon) {
  if (polygon.length < 2) return 0;

  // Find longest edge
  let maxLen = 0;
  let bestEdge = null;
  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len > maxLen) {
      maxLen = len;
      bestEdge = [x1, y1, x2, y2];
    }
  }

  if (!bestEdge) return 0;
  const [x1, y1, x2, y2] = bestEdge;
  return Math.atan2(y2 - y1, x2 - x1);
}

/**
 * Compute the inverse affine warp matrix and output dimensions.
 * The forward transform rotates the region to be axis-aligned.
 * We compute its inverse for use in the sampling shader.
 */
function computeWarpParams(polygon, angle) {
  // Compute bounding box of the polygon
  const xs = polygon.map(p => p[0]);
  const ys = polygon.map(p => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const cosA = Math.cos(-angle);
  const sinA = Math.sin(-angle);

  // Rotated polygon corners
  const rotated = polygon.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    return [cosA * dx - sinA * dy + cx, sinA * dx + cosA * dy + cy];
  });

  const rxs = rotated.map(p => p[0]);
  const rys = rotated.map(p => p[1]);
  const rMinX = Math.min(...rxs);
  const rMinY = Math.min(...rys);
  const dstW  = Math.max(...rxs) - rMinX;
  const dstH  = Math.max(...rys) - rMinY;

  // Forward: dst pixel (dx, dy) → (dx + rMinX, dy + rMinY) → rotate back → src
  // Inverse transform: given dst coord, find src coord
  // rotate by +angle around center
  const cosF = Math.cos(angle);
  const sinF = Math.sin(angle);

  // M_inv applies: rotate by +angle and offset by rMinX, rMinY
  // src.x = cosF*(dx+rMinX-cx) - sinF*(dy+rMinY-cy) + cx
  //       = cosF*dx - sinF*dy + (cosF*(rMinX-cx) - sinF*(rMinY-cy) + cx)
  const tx = cosF * (rMinX - cx) - sinF * (rMinY - cy) + cx;
  const ty = sinF * (rMinX - cx) + cosF * (rMinY - cy) + cy;

  const M_inv = [cosF, -sinF, tx, sinF, cosF, ty];

  return { dstW, dstH, M_inv };
}

/**
 * @typedef {Object} DeskewedRegion
 * @property {Tensor} deskewedTensor - [dstH, dstW] u32 packed RGBA8
 * @property {number} dstH
 * @property {number} dstW
 * @property {number} angle - skew angle in radians
 */
