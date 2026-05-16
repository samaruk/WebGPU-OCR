/**
 * 07_unclip_score.js — Polygon Unclipping & Quality Scoring
 *
 * DBNet polygons are slightly shrunk during training (Vatti clipping).
 * This stage expands them back by a ratio and assigns per-region scores.
 *
 * Operations:
 *   1. Vatti-style polygon expansion (unclip) by ratio r
 *   2. Filter by minimum confidence score and area
 *   3. Non-maximum suppression (NMS) via polygon IoU
 *   4. Assign text-region score combining: probability + textness + aspect ratio
 *
 * This is primarily CPU-side geometry work (polygon counts are small),
 * with a GPU pass for the IoU matrix if region count is large.
 */

import { gpuContext } from '../core/gpuContext.js';
import { Tensor, createUniformBuffer } from '../core/tensor.js';

// GPU IoU computation for NMS (only beneficial with many regions)
const SHADER_POLY_IOU = /* wgsl */`
// Simplified axis-aligned bounding box IoU for NMS pre-screening
struct U {
  n:   u32,
  _p0: u32,
  _p1: u32,
  _p2: u32,
}

struct BBox { x: f32, y: f32, w: f32, h: f32, }

@group(0) @binding(0) var<uniform>            u:    U;
@group(0) @binding(1) var<storage,read>       bboxA: array<f32>;  // [n*4]  x,y,w,h
@group(0) @binding(2) var<storage,read>       bboxB: array<f32>;  // [n*4]
@group(0) @binding(3) var<storage,read_write> iou:   array<f32>;  // [n*n]

fn bboxIoU(ai: u32, bi: u32) -> f32 {
  let ax1 = bboxA[ai*4u + 0u];
  let ay1 = bboxA[ai*4u + 1u];
  let ax2 = ax1 + bboxA[ai*4u + 2u];
  let ay2 = ay1 + bboxA[ai*4u + 3u];
  let bx1 = bboxB[bi*4u + 0u];
  let by1 = bboxB[bi*4u + 1u];
  let bx2 = bx1 + bboxB[bi*4u + 2u];
  let by2 = by1 + bboxB[bi*4u + 3u];

  let ix1 = max(ax1, bx1);
  let iy1 = max(ay1, by1);
  let ix2 = min(ax2, bx2);
  let iy2 = min(ay2, by2);

  let iw = max(0.0, ix2 - ix1);
  let ih = max(0.0, iy2 - iy1);
  let inter = iw * ih;

  let areaA = bboxA[ai*4u+2u] * bboxA[ai*4u+3u];
  let areaB = bboxB[bi*4u+2u] * bboxB[bi*4u+3u];
  let uni = areaA + areaB - inter;

  return select(0.0, inter / uni, uni > 0.0);
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n || gid.y >= u.n) { return; }
  iou[gid.y * u.n + gid.x] = bboxIoU(gid.x, gid.y);
}
`;

// ─── Stage Class ─────────────────────────────────────────────────────────────

export class UnclipScoreStage {
  constructor() {
    this._p = null;
  }

  async _build() {
    if (this._p) return;
    this._p = {
      polyIoU: gpuContext.createComputePipeline(
        gpuContext.createShaderModule(SHADER_POLY_IOU, 'unclip:iou'), 'main'),
    };
  }

  /**
   * @param {DetectedPolygon[]} polygons
   * @param {Tensor} textnessMap - [H, W] f32
   * @param {number} mapH, mapW
   * @param {Object} opts
   * @returns {Promise<UnclipResult>}
   */
  async run(polygons, textnessMap, mapH, mapW, opts = {}) {
    const {
      unclipRatio    = 1.5,
      minScore       = 0.25,
      minArea        = 100,
      nmsThreshold   = 0.5,
      maxDetections  = 512,
    } = opts;

    // ── 1. Unclip polygons ────────────────────────────────────────────────
    const expanded = polygons
      .map(p => ({ ...p, polygon: unclipPolygon(p.polygon, unclipRatio) }))
      .map(p => ({ ...p, bbox: polyBBox(p.polygon) }));

    // ── 2. Textness score augmentation ────────────────────────────────────
    // Sample textness at polygon center
    let textnessData = null;
    if (textnessMap) {
      await gpuContext.sync();
      textnessData = await textnessMap.download(); // Float32Array
    }

    const scored = expanded.map(poly => {
      const cx = poly.bbox.x + poly.bbox.w / 2;
      const cy = poly.bbox.y + poly.bbox.h / 2;
      const tcx = Math.round(cx * mapW / (poly._imgW ?? mapW));
      const tcy = Math.round(cy * mapH / (poly._imgH ?? mapH));
      const tx  = Math.max(0, Math.min(mapW - 1, tcx));
      const ty  = Math.max(0, Math.min(mapH - 1, tcy));
      const textness = textnessData ? textnessData[ty * mapW + tx] : 0.5;

      // Aspect ratio score: penalize very elongated or very square regions
      const ar = poly.bbox.w / (poly.bbox.h + 1e-6);
      const arScore = ar > 20 ? 0.5 : 1.0;  // penalize unreasonably wide boxes

      const combinedScore = poly.score * 0.5 + textness * 0.3 + arScore * 0.2;
      return { ...poly, textness, arScore, combinedScore };
    });

    // ── 3. Filter by score and area ───────────────────────────────────────
    const filtered = scored.filter(p =>
      p.combinedScore >= minScore &&
      p.bbox.w * p.bbox.h >= minArea
    );

    // Sort by score descending
    filtered.sort((a, b) => b.combinedScore - a.combinedScore);

    // ── 4. NMS ─────────────────────────────────────────────────────────────
    let nmsResult;
    if (filtered.length > 64) {
      // GPU-accelerated bbox IoU matrix
      nmsResult = await this._gpuNMS(filtered, nmsThreshold, maxDetections);
    } else {
      nmsResult = cpuNMS(filtered, nmsThreshold, maxDetections);
    }

    return {
      regions: nmsResult,
      count: nmsResult.length,
    };
  }

  async _gpuNMS(polygons, threshold, maxDet) {
    gpuContext.assertReady();
    await this._build();

    const n = Math.min(polygons.length, 1024);
    const bboxData = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const b = polygons[i].bbox;
      bboxData[i * 4 + 0] = b.x;
      bboxData[i * 4 + 1] = b.y;
      bboxData[i * 4 + 2] = b.w;
      bboxData[i * 4 + 3] = b.h;
    }

    const bboxA = Tensor.fromData(bboxData, [n * 4], 'f32', 'nms:bboxA');
    const bboxB = Tensor.fromData(bboxData, [n * 4], 'f32', 'nms:bboxB');
    const iouTensor = new Tensor([n * n], 'f32', 0, 'nms:iou');

    {
      const u = createUniformBuffer({ n, _p0: 0, _p1: 0, _p2: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: this._p.polyIoU.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), bboxA.bindingEntry(1, true),
                  bboxB.bindingEntry(2, true), iouTensor.bindingEntry(3)],
      });
      gpuContext.dispatch(this._p.polyIoU, bg, [Math.ceil(n / 16), Math.ceil(n / 16), 1]);
    }

    await gpuContext.sync();
    const iouData = await iouTensor.download();
    bboxA.destroy(); bboxB.destroy(); iouTensor.destroy();

    // CPU NMS using precomputed IoU matrix
    const keep = new Uint8Array(n).fill(1);
    const result = [];

    for (let i = 0; i < n && result.length < maxDet; i++) {
      if (!keep[i]) continue;
      result.push(polygons[i]);
      for (let j = i + 1; j < n; j++) {
        if (iouData[i * n + j] > threshold) keep[j] = 0;
      }
    }

    return result;
  }
}

// ─── CPU Geometry ──────────────────────────────────────────────────────────────

/**
 * Expand a polygon outward by a ratio using the Vatti/offset method.
 * Uses the Minkowski sum approximation: offset each edge outward by distance d.
 * @param {[number,number][]} poly
 * @param {number} ratio - expansion ratio (e.g., 1.5 = expand by 50%)
 * @returns {[number,number][]}
 */
function unclipPolygon(poly, ratio) {
  if (poly.length < 3) return poly;

  // Compute polygon area and perimeter
  let area = 0;
  let perimeter = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
    perimeter += Math.hypot(x2 - x1, y2 - y1);
  }
  area = Math.abs(area) / 2;

  // Offset distance from area/perimeter formula
  const distance = area * (ratio - 1.0) / perimeter;

  // Expand each vertex outward along its bisector
  const cx = poly.reduce((s, p) => s + p[0], 0) / n;
  const cy = poly.reduce((s, p) => s + p[1], 0) / n;

  return poly.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) + 1e-10;
    return [x + (dx / len) * distance, y + (dy / len) * distance];
  });
}

function cpuNMS(polygons, threshold, maxDet) {
  const keep = new Uint8Array(polygons.length).fill(1);
  const result = [];

  for (let i = 0; i < polygons.length && result.length < maxDet; i++) {
    if (!keep[i]) continue;
    result.push(polygons[i]);
    for (let j = i + 1; j < polygons.length; j++) {
      if (bboxIoU(polygons[i].bbox, polygons[j].bbox) > threshold) keep[j] = 0;
    }
  }

  return result;
}

function bboxIoU(a, b) {
  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(a.x + a.w, b.x + b.w);
  const iy2 = Math.min(a.y + a.h, b.y + b.h);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const uni = a.w * a.h + b.w * b.h - inter;
  return uni > 0 ? inter / uni : 0;
}

function polyBBox(poly) {
  const xs = poly.map(p => p[0]);
  const ys = poly.map(p => p[1]);
  return {
    x: Math.min(...xs), y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}

/**
 * @typedef {Object} UnclipResult
 * @property {DetectedPolygon[]} regions - expanded, scored, NMS-filtered regions
 * @property {number} count
 */
