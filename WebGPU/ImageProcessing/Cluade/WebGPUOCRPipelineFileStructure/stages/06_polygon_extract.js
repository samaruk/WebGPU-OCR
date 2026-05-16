/**
 * 06_polygon_extract.js — Text Region Polygon Extraction
 *
 * Converts DBNet binary maps into tight polygons around text regions.
 *
 * GPU pipeline:
 *   1. Threshold binary map → hard 0/1 mask
 *   2. Run GPU-based contour tracing (Moore neighborhood)
 *   3. Read contour point lists back to CPU
 *   4. Fit minimum-area quadrilateral on CPU via rotating calipers
 *   5. Return array of {polygon, bbox, score, area}
 *
 * Heavy geometry is on CPU (contour fitting is hard to GPU-parallelize
 * at small polygon counts). The GPU work is the threshold + contour label stage.
 */

import { gpuContext } from '../core/gpuContext.js';
import { Tensor, createUniformBuffer } from '../core/tensor.js';

// ─── WGSL ─────────────────────────────────────────────────────────────────────

// Hard threshold binary map
const SHADER_THRESHOLD = /* wgsl */`
struct U { n: u32, threshold: f32, _p0: u32, _p1: u32, }
@group(0) @binding(0) var<uniform>            u:   U;
@group(0) @binding(1) var<storage,read>       src: array<f32>;
@group(0) @binding(2) var<storage,read_write> dst: array<u32>;  // 0 or 1

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.n) { return; }
  dst[gid.x] = select(0u, 1u, src[gid.x] >= u.threshold);
}
`;

// Mark edge pixels (have at least one background 4-neighbor)
const SHADER_EDGE_MASK = /* wgsl */`
struct U { width: u32, height: u32, _p0: u32, _p1: u32, }
@group(0) @binding(0) var<uniform>            u:    U;
@group(0) @binding(1) var<storage,read>       mask: array<u32>;
@group(0) @binding(2) var<storage,read_write> edge: array<u32>;

fn rd(x: i32, y: i32) -> u32 {
  if (x < 0 || x >= i32(u.width) || y < 0 || y >= i32(u.height)) { return 0u; }
  return mask[u32(y) * u.width + u32(x)];
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let x = i32(gid.x);
  let y = i32(gid.y);
  let c = rd(x, y);
  var isEdge = 0u;
  if (c == 1u) {
    if (rd(x-1,y)==0u || rd(x+1,y)==0u || rd(x,y-1)==0u || rd(x,y+1)==0u) {
      isEdge = 1u;
    }
  }
  edge[gid.y * u.width + gid.x] = isEdge;
}
`;

// Pack edge pixel coordinates into a flat list
const SHADER_PACK_EDGES = /* wgsl */`
struct U { width: u32, height: u32, _p0: u32, _p1: u32, }
@group(0) @binding(0) var<uniform>            u:       U;
@group(0) @binding(1) var<storage,read>       edge:    array<u32>;
@group(0) @binding(2) var<storage,read_write> coords:  array<u32>;  // [x,y] pairs
@group(0) @binding(3) var<storage,read_write> counter: array<atomic<u32>>;  // [1]

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = u.width * u.height;
  if (gid.x >= n) { return; }
  if (edge[gid.x] != 1u) { return; }
  let slot = atomicAdd(&counter[0], 1u);
  let x = gid.x % u.width;
  let y = gid.x / u.width;
  coords[slot * 2u]     = x;
  coords[slot * 2u + 1u] = y;
}
`;

// ─── Stage Class ─────────────────────────────────────────────────────────────

export class PolygonExtractStage {
  constructor() {
    this._p = null;
  }

  async _build() {
    if (this._p) return;
    const mk = (src, lbl) => gpuContext.createComputePipeline(
      gpuContext.createShaderModule(src, lbl), 'main');
    this._p = {
      threshold: mk(SHADER_THRESHOLD,  'poly:thresh'),
      edgeMask:  mk(SHADER_EDGE_MASK,  'poly:edge'),
      packEdges: mk(SHADER_PACK_EDGES, 'poly:pack'),
    };
  }

  /**
   * @param {Tensor} binaryTensor - [mapH * mapW] f32 from DBNet
   * @param {number} mapH
   * @param {number} mapW
   * @param {Tensor} probTensor - [mapH * mapW] f32 probability scores
   * @param {number} scaleH, scaleW - scale back to original image coordinates
   * @param {Object} opts
   * @returns {Promise<PolygonResult>}
   */
  async run(binaryTensor, mapH, mapW, probTensor, scaleH, scaleW, opts = {}) {
    gpuContext.assertReady();
    await this._build();

    const {
      binaryThreshold = 0.3,
      minArea = 16,
      maxRegions = 2048,
    } = opts;

    const N = mapH * mapW;
    const p = this._p;

    // ── 1. Hard threshold ──────────────────────────────────────────────────
    const hardMask = new Tensor([N], 'u32', 0, 'poly:mask');
    {
      const u = createUniformBuffer({ n: N, threshold: binaryThreshold, _p0: 0, _p1: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.threshold.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), binaryTensor.bindingEntry(1, true), hardMask.bindingEntry(2)],
      });
      gpuContext.dispatch(p.threshold, bg, [Math.ceil(N / 256), 1, 1]);
    }

    // ── 2. Edge mask ───────────────────────────────────────────────────────
    const edgeTensor = new Tensor([N], 'u32', 0, 'poly:edge');
    {
      const u = createUniformBuffer({ width: mapW, height: mapH, _p0: 0, _p1: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.edgeMask.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), hardMask.bindingEntry(1, true), edgeTensor.bindingEntry(2)],
      });
      gpuContext.dispatch(p.edgeMask, bg, [Math.ceil(mapW / 16), Math.ceil(mapH / 16), 1]);
    }

    // ── 3. Pack edge coordinates ───────────────────────────────────────────
    const maxEdges = Math.min(N, 200000);
    const coordsTensor  = new Tensor([maxEdges * 2], 'u32', 0, 'poly:coords');
    const counterTensor = Tensor.zeros([1], 'u32', 'poly:counter');
    {
      const u = createUniformBuffer({ width: mapW, height: mapH, _p0: 0, _p1: 0 });
      const bg = gpuContext.device.createBindGroup({
        layout: p.packEdges.getBindGroupLayout(0),
        entries: [u.bindingEntry(0), edgeTensor.bindingEntry(1, true),
                  coordsTensor.bindingEntry(2), counterTensor.bindingEntry(3)],
      });
      gpuContext.dispatch(p.packEdges, bg, [Math.ceil(N / 256), 1, 1]);
    }

    await gpuContext.sync();

    // ── 4. Read back data ──────────────────────────────────────────────────
    const maskData   = await hardMask.download();    // Uint32Array
    const coordCount = (await counterTensor.download())[0];
    const coordData  = await coordsTensor.download(); // Uint32Array [x, y, x, y, ...]
    const probData   = await probTensor.download();   // Float32Array

    hardMask.destroy();
    edgeTensor.destroy();
    coordsTensor.destroy();
    counterTensor.destroy();

    // ── 5. CPU: connected components via simple flood fill ─────────────────
    const regions = floodFillComponents(maskData, mapH, mapW, minArea);

    // ── 6. Fit polygons for each region ────────────────────────────────────
    const polygons = [];
    for (const region of regions) {
      if (region.length < minArea) continue;
      if (polygons.length >= maxRegions) break;

      // Compute mean probability score for this region
      let scoreSum = 0;
      for (const [x, y] of region) {
        scoreSum += probData[y * mapW + x];
      }
      const score = scoreSum / region.length;
      if (score < 0.3) continue;

      // Convex hull → min-area rectangle
      const hull = convexHull(region);
      const quad = minAreaRect(hull);

      // Scale coordinates back to original image space
      const scaledPoly = quad.map(([x, y]) => [x * scaleW, y * scaleH]);
      const bbox = polyBBox(scaledPoly);

      polygons.push({
        polygon: scaledPoly,
        bbox,
        score,
        area: region.length * scaleW * scaleH,
        hull: hull.map(([x, y]) => [x * scaleW, y * scaleH]),
      });
    }

    return { polygons };
  }
}

// ─── CPU Geometry Helpers ──────────────────────────────────────────────────────

/**
 * Simple 4-connected flood fill component analysis.
 * Returns array of pixel-coordinate arrays per component.
 */
function floodFillComponents(mask, H, W, minArea) {
  const visited = new Uint8Array(H * W);
  const components = [];

  for (let startY = 0; startY < H; startY++) {
    for (let startX = 0; startX < W; startX++) {
      const si = startY * W + startX;
      if (mask[si] === 0 || visited[si]) continue;

      // BFS flood fill
      const stack = [[startX, startY]];
      const pixels = [];
      visited[si] = 1;

      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        pixels.push([cx, cy]);

        const neighbors = [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const ni = ny * W + nx;
          if (mask[ni] === 0 || visited[ni]) continue;
          visited[ni] = 1;
          stack.push([nx, ny]);
        }
      }

      if (pixels.length >= minArea) {
        components.push(pixels);
      }
    }
  }

  return components;
}

/**
 * Convex hull via Graham scan.
 * @param {[number,number][]} points
 * @returns {[number,number][]}
 */
function convexHull(points) {
  if (points.length < 3) return points;

  // Find bottom-most (then left-most) point
  let pivot = points[0];
  for (const p of points) {
    if (p[1] < pivot[1] || (p[1] === pivot[1] && p[0] < pivot[0])) pivot = p;
  }

  const sorted = points
    .filter(p => p !== pivot)
    .sort((a, b) => {
      const angA = Math.atan2(a[1] - pivot[1], a[0] - pivot[0]);
      const angB = Math.atan2(b[1] - pivot[1], b[0] - pivot[0]);
      return angA - angB;
    });

  const hull = [pivot];
  for (const p of sorted) {
    while (hull.length >= 2 && cross(hull[hull.length-2], hull[hull.length-1], p) <= 0) {
      hull.pop();
    }
    hull.push(p);
  }
  return hull;
}

function cross([ox, oy], [ax, ay], [bx, by]) {
  return (ax - ox) * (by - oy) - (ay - oy) * (bx - ox);
}

/**
 * Minimum-area enclosing rectangle (rotating calipers).
 * Returns 4 corner points.
 */
function minAreaRect(hull) {
  if (hull.length === 0) return [[0,0],[0,0],[0,0],[0,0]];
  if (hull.length < 3) {
    // Degenerate: return axis-aligned bbox
    const [minX, minY, maxX, maxY] = [
      Math.min(...hull.map(p=>p[0])), Math.min(...hull.map(p=>p[1])),
      Math.max(...hull.map(p=>p[0])), Math.max(...hull.map(p=>p[1])),
    ];
    return [[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY]];
  }

  const n = hull.length;
  let minArea = Infinity;
  let bestRect = null;

  for (let i = 0; i < n; i++) {
    const [x1, y1] = hull[i];
    const [x2, y2] = hull[(i + 1) % n];
    const ex = x2 - x1;
    const ey = y2 - y1;
    const len = Math.hypot(ex, ey);
    if (len < 1e-10) continue;
    const ux = ex / len;
    const uy = ey / len;
    // Project all hull points
    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;
    for (const [px, py] of hull) {
      const u = (px - x1) * ux + (py - y1) * uy;
      const v = (px - x1) * (-uy) + (py - y1) * ux;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const area = (maxU - minU) * (maxV - minV);
    if (area < minArea) {
      minArea = area;
      bestRect = { x1, y1, ux, uy, minU, maxU, minV, maxV };
    }
  }

  if (!bestRect) {
    const [minX, minY, maxX, maxY] = [
      Math.min(...hull.map(p=>p[0])), Math.min(...hull.map(p=>p[1])),
      Math.max(...hull.map(p=>p[0])), Math.max(...hull.map(p=>p[1])),
    ];
    return [[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY]];
  }

  const { x1, y1, ux, uy, minU, maxU, minV, maxV } = bestRect;
  const vx = -uy, vy = ux;
  const corners = [
    [x1 + minU*ux + minV*vx, y1 + minU*uy + minV*vy],
    [x1 + maxU*ux + minV*vx, y1 + maxU*uy + minV*vy],
    [x1 + maxU*ux + maxV*vx, y1 + maxU*uy + maxV*vy],
    [x1 + minU*ux + maxV*vx, y1 + minU*uy + maxV*vy],
  ];
  return corners;
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
 * @typedef {Object} DetectedPolygon
 * @property {[number,number][]} polygon - 4 corners in original image coordinates
 * @property {{x,y,w,h}} bbox
 * @property {number} score - mean probability
 * @property {number} area
 */

/**
 * @typedef {Object} PolygonResult
 * @property {DetectedPolygon[]} polygons
 */
