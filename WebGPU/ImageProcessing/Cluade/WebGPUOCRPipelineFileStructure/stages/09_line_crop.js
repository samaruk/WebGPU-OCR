/**
 * 09_line_crop.js — Text Line Crop
 *
 * Crops individual text line patches from the (deskewed) image.
 * Each crop corresponds to one detected text region.
 *
 * GPU pipeline:
 *   1. For each region: extract exact rectangular subimage from the
 *      full image tensor (no rotation — rotation was handled in deskew)
 *   2. Optionally apply a binary mask inside the crop area
 *   3. Return array of crop tensors
 *
 * This stage handles regions where deskew was identity (angle ≈ 0)
 * and uses an efficient GPU copy rather than a full affine warp.
 */

import { gpuContext } from '../core/gpuContext.js';
import { Tensor, createUniformBuffer } from '../core/tensor.js';

// Crop a rectangular patch from a source image
const SHADER_CROP = /* wgsl */`
struct CropUniforms {
  srcW: u32,
  srcH: u32,
  x0:   u32,
  y0:   u32,
  dstW: u32,
  dstH: u32,
  _p0:  u32,
  _p1:  u32,
}

@group(0) @binding(0) var<uniform>            u:   CropUniforms;
@group(0) @binding(1) var<storage,read>       src: array<u32>;   // [srcH * srcW]
@group(0) @binding(2) var<storage,read_write> dst: array<u32>;   // [dstH * dstW]

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.dstW || gid.y >= u.dstH) { return; }
  let sx = gid.x + u.x0;
  let sy = gid.y + u.y0;
  var pixel = 0xFFFFFFFFu;  // white default for out-of-bounds
  if (sx < u.srcW && sy < u.srcH) {
    pixel = src[sy * u.srcW + sx];
  }
  dst[gid.y * u.dstW + gid.x] = pixel;
}
`;

// Mask crop: keep only pixels inside polygon mask (set others to white)
const SHADER_MASK_CROP = /* wgsl */`
struct MaskUniforms {
  dstW:      u32,
  dstH:      u32,
  numVerts:  u32,
  _p:        u32,
}

@group(0) @binding(0) var<uniform>             u:    MaskUniforms;
@group(0) @binding(1) var<storage,read_write>  data: array<u32>;    // [dstH * dstW]
@group(0) @binding(2) var<storage,read>        vx:   array<f32>;    // polygon x coords
@group(0) @binding(3) var<storage,read>        vy:   array<f32>;    // polygon y coords

// Point-in-polygon ray casting
fn pip(px: f32, py: f32) -> bool {
  var inside = false;
  let n = u.numVerts;
  var j = n - 1u;
  for (var i = 0u; i < n; i++) {
    let xi = vx[i]; let yi = vy[i];
    let xj = vx[j]; let yj = vy[j];
    if ((yi > py) != (yj > py)) {
      let intersect = (xj - xi) * (py - yi) / (yj - yi) + xi;
      if (px < intersect) { inside = !inside; }
    }
    j = i;
  }
  return inside;
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.dstW || gid.y >= u.dstH) { return; }
  if (!pip(f32(gid.x), f32(gid.y))) {
    data[gid.y * u.dstW + gid.x] = 0xFFFFFFFFu;  // white background
  }
}
`;

// ─── Stage Class ─────────────────────────────────────────────────────────────

export class LineCropStage {
  constructor() {
    this._p = null;
  }

  async _build() {
    if (this._p) return;
    this._p = {
      crop:     gpuContext.createComputePipeline(
                  gpuContext.createShaderModule(SHADER_CROP,      'crop:main'),  'main'),
      maskCrop: gpuContext.createComputePipeline(
                  gpuContext.createShaderModule(SHADER_MASK_CROP, 'crop:mask'),  'main'),
    };
  }

  /**
   * Crop a single axis-aligned region from the source image.
   * @param {Tensor} srcTensor - [srcH * srcW] u32
   * @param {number} srcH, srcW
   * @param {{x,y,w,h}} bbox - in source image coordinates
   * @param {[number,number][]|null} polygon - optional tight polygon mask
   * @returns {Promise<{cropTensor: Tensor, cropH: number, cropW: number}>}
   */
  async cropRegion(srcTensor, srcH, srcW, bbox, polygon = null) {
    gpuContext.assertReady();
    await this._build();

    const x0 = Math.max(0, Math.floor(bbox.x));
    const y0 = Math.max(0, Math.floor(bbox.y));
    const x1 = Math.min(srcW, Math.ceil(bbox.x + bbox.w));
    const y1 = Math.min(srcH, Math.ceil(bbox.y + bbox.h));
    const dstW = Math.max(1, x1 - x0);
    const dstH = Math.max(1, y1 - y0);

    const cropTensor = new Tensor([dstH, dstW], 'u32', 0, 'crop:out');

    // ── Crop ──────────────────────────────────────────────────────────────
    {
      const u = createUniformBuffer({
        srcW, srcH, x0, y0, dstW, dstH, _p0: 0, _p1: 0,
      });
      const bg = gpuContext.device.createBindGroup({
        layout: this._p.crop.getBindGroupLayout(0),
        entries: [
          u.bindingEntry(0),
          srcTensor.bindingEntry(1, true),
          cropTensor.bindingEntry(2),
        ],
      });
      gpuContext.dispatch(this._p.crop, bg,
        [Math.ceil(dstW / 16), Math.ceil(dstH / 16), 1]);
    }

    // ── Optional polygon mask ──────────────────────────────────────────────
    if (polygon && polygon.length >= 3) {
      // Transform polygon coords relative to crop top-left
      const localPoly = polygon.map(([px, py]) => [px - x0, py - y0]);
      const vxData = new Float32Array(localPoly.map(p => p[0]));
      const vyData = new Float32Array(localPoly.map(p => p[1]));
      const vxBuf  = Tensor.fromData(vxData, [localPoly.length], 'f32', 'crop:vx');
      const vyBuf  = Tensor.fromData(vyData, [localPoly.length], 'f32', 'crop:vy');

      const u = createUniformBuffer({
        dstW, dstH, numVerts: localPoly.length, _p: 0,
      });
      const bg = gpuContext.device.createBindGroup({
        layout: this._p.maskCrop.getBindGroupLayout(0),
        entries: [
          u.bindingEntry(0),
          cropTensor.bindingEntry(1),         // read_write (in-place mask)
          vxBuf.bindingEntry(2, true),
          vyBuf.bindingEntry(3, true),
        ],
      });
      gpuContext.dispatch(this._p.maskCrop, bg,
        [Math.ceil(dstW / 16), Math.ceil(dstH / 16), 1]);

      vxBuf.destroy();
      vyBuf.destroy();
    }

    return { cropTensor, cropH: dstH, cropW: dstW };
  }

  /**
   * Batch crop all regions.
   * @param {Tensor} srcTensor - [srcH * srcW] u32 full image
   * @param {number} srcH, srcW
   * @param {DeskewedRegion[]} regions - from DeskewStage
   * @param {Object} opts
   * @returns {Promise<LineRegion[]>}
   */
  async run(srcTensor, srcH, srcW, regions, opts = {}) {
    gpuContext.assertReady();
    await this._build();

    const { useDeskewed = true, applyMask = false } = opts;

    const results = [];

    for (const region of regions) {
      let cropTensor, cropH, cropW;

      if (useDeskewed && region.deskewedTensor) {
        // Already deskewed — use deskewed tensor directly
        cropTensor = region.deskewedTensor;
        cropH      = region.dstH;
        cropW      = region.dstW;
      } else {
        // Crop from original image
        const result = await this.cropRegion(
          srcTensor, srcH, srcW,
          region.bbox,
          applyMask ? region.polygon : null
        );
        cropTensor = result.cropTensor;
        cropH      = result.cropH;
        cropW      = result.cropW;
      }

      results.push({
        ...region,
        cropTensor,
        cropH,
        cropW,
        // Preserve metadata
        score:    region.combinedScore ?? region.score,
        bbox:     region.bbox,
        polygon:  region.polygon,
        angle:    region.angle ?? 0,
      });
    }

    await gpuContext.sync();
    return results;
  }
}

/**
 * @typedef {Object} LineRegion
 * @property {Tensor} cropTensor - [cropH * cropW] u32 RGBA8
 * @property {number} cropH
 * @property {number} cropW
 * @property {number} score
 * @property {{x,y,w,h}} bbox
 * @property {[number,number][]} polygon
 * @property {number} angle - skew angle (radians)
 */
