/**
 * @file shaders.js
 * @description WGSL compute shader sources for the Sauvola binarisation pipeline.
 *
 * ─── PIPELINE OVERVIEW ───────────────────────────────────────────────────────
 *
 *  Pass 1   SH_GRAY         RGBA → greyscale luminance + SAT seed values.
 *
 *  Passes 2a–2c  Horizontal (row) parallel prefix scan (replaces old SH_ROW):
 *    2a  SH_ROW_LOCAL       Tile-wise Kogge-Stone scan within each workgroup +
 *                           write each tile total to a side buffer.
 *    2b  SH_ROW_TILES       Sequential prefix scan of the tile totals per row
 *                           (only ⌈W/256⌉ ≈ 3–23 ops per row, not W ops).
 *    2c  SH_ROW_APPLY       Add accumulated tile offset to every element
 *                           in tiles 1, 2, … (fully parallel).
 *
 *  Passes 3a–3c  Vertical (column) parallel prefix scan (replaces old SH_COL):
 *    3a  SH_COL_LOCAL
 *    3b  SH_COL_TILES
 *    3c  SH_COL_APPLY
 *
 *  Pass 4   SH_SAUVOLA      Sauvola adaptive threshold via SAT four-corner formula.
 *
 * ─── WHY THIS IS FASTER ──────────────────────────────────────────────────────
 *
 *  Old approach — workgroup_size(1), one thread per row:
 *    Each thread executes W sequential add operations.
 *    For a 4000-pixel row: 4 000 sequential ops, 1 active thread per wavefront.
 *    GPU utilisation ≈ 1/64 of theoretical peak.
 *
 *  New approach — workgroup_size(256), Kogge-Stone:
 *    256 threads share the work for 256 elements: log₂(256) = 8 parallel steps.
 *    Sub-pass 2b is still sequential but only ⌈W/256⌉ ≈ 3–23 iterations.
 *    Sub-pass 2c is fully parallel.
 *
 *  Sequential ops comparison for a 4000×3000 image:
 *    Old SH_ROW:         3000 × 4000 = 12 000 000  sequential ops
 *    New SH_ROW_TILES:   3000 ×   16 =     48 000  sequential ops  (250× fewer)
 *    New LOCAL / APPLY:  fully parallel
 *
 * ─── KOGGE-STONE SCAN (CORRECTNESS NOTE) ────────────────────────────────────
 *
 *  We use explicit if-guards (not select) for the read:
 *    select(0.0, sA[lx - s], lx >= s)   ← UNSAFE: evaluates sA[lx-s] always;
 *                                           u32 underflow when lx=0, s=1.
 *    if (lx >= s) { addA = sA[lx - s]; } ← SAFE: index computed only when valid.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  PASS 1 — RGBA → GREYSCALE + SAT SEED
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BT.601 luminance conversion + SAT seed initialisation.
 * Dispatch: ceil(N/256) workgroups × 256 threads.
 * @type {string}
 */
export const SH_GRAY = /* wgsl */`
struct U { width: u32, height: u32 }
@group(0) @binding(0) var<uniform>            u      : U;
@group(0) @binding(1) var<storage, read>       pixels : array<u32>;
@group(0) @binding(2) var<storage, read_write> gray   : array<f32>;
@group(0) @binding(3) var<storage, read_write> iSum   : array<f32>;
@group(0) @binding(4) var<storage, read_write> iSumSq : array<f32>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) g: vec3<u32>) {
  let i = g.x;
  if (i >= u.width * u.height) { return; }
  let p  = pixels[i];
  let r  = f32(p         & 0xFFu) / 255.0;
  let gn = f32((p >>  8u)& 0xFFu) / 255.0;
  let b  = f32((p >> 16u)& 0xFFu) / 255.0;
  let v  = 0.2989*r + 0.5870*gn + 0.1140*b;
  gray[i]   = v;
  iSum[i]   = v;
  iSumSq[i] = v * v;
}
`;

// ─────────────────────────────────────────────────────────────────────────────
//  PASSES 2a-2c — HORIZONTAL PARALLEL PREFIX SCAN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pass 2a — Kogge-Stone tile scan for rows + store tile totals.
 *
 * Each workgroup handles one 256-element tile of one row.
 * After this pass each tile holds its LOCAL prefix sums (not yet globally
 * correct) and the total sum of each tile is in tSum/tSumSq.
 *
 * Dispatch: (H, ceil(W/256))
 * @type {string}
 */
export const SH_ROW_LOCAL = /* wgsl */`
struct U { width: u32, height: u32 }
@group(0) @binding(0) var<uniform>            u      : U;
@group(0) @binding(1) var<storage, read_write> iSum   : array<f32>;
@group(0) @binding(2) var<storage, read_write> iSumSq : array<f32>;
@group(0) @binding(3) var<storage, read_write> tSum   : array<f32>;
@group(0) @binding(4) var<storage, read_write> tSumSq : array<f32>;

var<workgroup> sA: array<f32, 256>;
var<workgroup> sB: array<f32, 256>;

@compute @workgroup_size(256)
fn main(@builtin(local_invocation_id) lid: vec3<u32>,
        @builtin(workgroup_id)        wid: vec3<u32>) {
  let row      = wid.x;
  let tile     = wid.y;
  let lx       = lid.x;
  let gx       = tile * 256u + lx;
  let numTiles = (u.width + 255u) / 256u;
  let flatIdx  = row * u.width + gx;

  // Load with zero-padding for out-of-bounds columns
  if (gx < u.width) {
    sA[lx] = iSum  [flatIdx];
    sB[lx] = iSumSq[flatIdx];
  } else {
    sA[lx] = 0.0;
    sB[lx] = 0.0;
  }
  workgroupBarrier();

  // Kogge-Stone inclusive prefix scan — 8 iterations for 256 elements
  for (var s = 1u; s < 256u; s <<= 1u) {
    var addA: f32 = 0.0;
    var addB: f32 = 0.0;
    if (lx >= s) { addA = sA[lx - s]; addB = sB[lx - s]; }
    workgroupBarrier();
    sA[lx] += addA;
    sB[lx] += addB;
    workgroupBarrier();
  }

  // Write local prefix sums back
  if (gx < u.width) {
    iSum  [flatIdx] = sA[lx];
    iSumSq[flatIdx] = sB[lx];
  }
  // Thread 255: write tile total (sA[255] = sum of all 256 elements incl. zeros)
  if (lx == 255u) {
    tSum  [row * numTiles + tile] = sA[255u];
    tSumSq[row * numTiles + tile] = sB[255u];
  }
}
`;

/**
 * Pass 2b — prefix scan of per-row tile totals (sequential but tiny).
 *
 * Input: tSum[row*numTiles + t] = total of tile t for that row.
 * After: tSum[row*numTiles + t] = sum of tiles 0..t for that row.
 *
 * Dispatch: (H, 1)
 * @type {string}
 */
export const SH_ROW_TILES = /* wgsl */`
struct U { width: u32, height: u32 }
@group(0) @binding(0) var<uniform>            u      : U;
@group(0) @binding(1) var<storage, read_write> tSum   : array<f32>;
@group(0) @binding(2) var<storage, read_write> tSumSq : array<f32>;
@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) g: vec3<u32>) {
  let row      = g.x;
  let numTiles = (u.width + 255u) / 256u;
  let base     = row * numTiles;
  for (var t = 1u; t < numTiles; t++) {
    tSum  [base + t] += tSum  [base + t - 1u];
    tSumSq[base + t] += tSumSq[base + t - 1u];
  }
}
`;

/**
 * Pass 2c — add accumulated tile prefix sum to elements in tiles >= 1 (parallel).
 *
 * Tile 0 already correct; tile t (t>0) gets tSum[row*numTiles + t-1] added.
 *
 * Dispatch: (H, ceil(W/256))
 * @type {string}
 */
export const SH_ROW_APPLY = /* wgsl */`
struct U { width: u32, height: u32 }
@group(0) @binding(0) var<uniform>        u      : U;
@group(0) @binding(1) var<storage, read_write> iSum   : array<f32>;
@group(0) @binding(2) var<storage, read_write> iSumSq : array<f32>;
@group(0) @binding(3) var<storage, read>  tSum   : array<f32>;
@group(0) @binding(4) var<storage, read>  tSumSq : array<f32>;
@compute @workgroup_size(256)
fn main(@builtin(local_invocation_id) lid: vec3<u32>,
        @builtin(workgroup_id)        wid: vec3<u32>) {
  let row      = wid.x;
  let tile     = wid.y;
  if (tile == 0u) { return; }
  let lx       = lid.x;
  let gx       = tile * 256u + lx;
  if (gx >= u.width) { return; }
  let numTiles = (u.width + 255u) / 256u;
  let off   = tSum  [row * numTiles + tile - 1u];
  let offSq = tSumSq[row * numTiles + tile - 1u];
  let idx = row * u.width + gx;
  iSum  [idx] += off;
  iSumSq[idx] += offSq;
}
`;

// ─────────────────────────────────────────────────────────────────────────────
//  PASSES 3a-3c — VERTICAL PARALLEL PREFIX SCAN  (mirror of passes 2a-2c)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pass 3a — Kogge-Stone tile scan for columns + store tile totals.
 *
 * Elements in a column are strided (spacing = width), so we gather into
 * shared memory, scan, then scatter back — same pattern as rows.
 *
 * Dispatch: (W, ceil(H/256))
 * @type {string}
 */
export const SH_COL_LOCAL = /* wgsl */`
struct U { width: u32, height: u32 }
@group(0) @binding(0) var<uniform>            u      : U;
@group(0) @binding(1) var<storage, read_write> iSum   : array<f32>;
@group(0) @binding(2) var<storage, read_write> iSumSq : array<f32>;
@group(0) @binding(3) var<storage, read_write> tSum   : array<f32>;
@group(0) @binding(4) var<storage, read_write> tSumSq : array<f32>;

var<workgroup> sA: array<f32, 256>;
var<workgroup> sB: array<f32, 256>;

@compute @workgroup_size(256)
fn main(@builtin(local_invocation_id) lid: vec3<u32>,
        @builtin(workgroup_id)        wid: vec3<u32>) {
  let col      = wid.x;
  let tile     = wid.y;
  let lx       = lid.x;
  let gy       = tile * 256u + lx;
  let numTiles = (u.height + 255u) / 256u;

  if (gy < u.height) {
    sA[lx] = iSum  [gy * u.width + col];
    sB[lx] = iSumSq[gy * u.width + col];
  } else {
    sA[lx] = 0.0;
    sB[lx] = 0.0;
  }
  workgroupBarrier();

  for (var s = 1u; s < 256u; s <<= 1u) {
    var addA: f32 = 0.0;
    var addB: f32 = 0.0;
    if (lx >= s) { addA = sA[lx - s]; addB = sB[lx - s]; }
    workgroupBarrier();
    sA[lx] += addA;
    sB[lx] += addB;
    workgroupBarrier();
  }

  if (gy < u.height) {
    iSum  [gy * u.width + col] = sA[lx];
    iSumSq[gy * u.width + col] = sB[lx];
  }
  if (lx == 255u) {
    tSum  [col * numTiles + tile] = sA[255u];
    tSumSq[col * numTiles + tile] = sB[255u];
  }
}
`;

/**
 * Pass 3b — prefix scan of per-column tile totals.
 * Dispatch: (W, 1)
 * @type {string}
 */
export const SH_COL_TILES = /* wgsl */`
struct U { width: u32, height: u32 }
@group(0) @binding(0) var<uniform>            u      : U;
@group(0) @binding(1) var<storage, read_write> tSum   : array<f32>;
@group(0) @binding(2) var<storage, read_write> tSumSq : array<f32>;
@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) g: vec3<u32>) {
  let col      = g.x;
  let numTiles = (u.height + 255u) / 256u;
  let base     = col * numTiles;
  for (var t = 1u; t < numTiles; t++) {
    tSum  [base + t] += tSum  [base + t - 1u];
    tSumSq[base + t] += tSumSq[base + t - 1u];
  }
}
`;

/**
 * Pass 3c — add accumulated column tile offsets to elements in tiles >= 1.
 * Dispatch: (W, ceil(H/256))
 * @type {string}
 */
export const SH_COL_APPLY = /* wgsl */`
struct U { width: u32, height: u32 }
@group(0) @binding(0) var<uniform>        u      : U;
@group(0) @binding(1) var<storage, read_write> iSum   : array<f32>;
@group(0) @binding(2) var<storage, read_write> iSumSq : array<f32>;
@group(0) @binding(3) var<storage, read>  tSum   : array<f32>;
@group(0) @binding(4) var<storage, read>  tSumSq : array<f32>;
@compute @workgroup_size(256)
fn main(@builtin(local_invocation_id) lid: vec3<u32>,
        @builtin(workgroup_id)        wid: vec3<u32>) {
  let col      = wid.x;
  let tile     = wid.y;
  if (tile == 0u) { return; }
  let lx       = lid.x;
  let gy       = tile * 256u + lx;
  if (gy >= u.height) { return; }
  let numTiles = (u.height + 255u) / 256u;
  let off   = tSum  [col * numTiles + tile - 1u];
  let offSq = tSumSq[col * numTiles + tile - 1u];
  let idx = gy * u.width + col;
  iSum  [idx] += off;
  iSumSq[idx] += offSq;
}
`;

// ─────────────────────────────────────────────────────────────────────────────
//  PASS 4 — SAUVOLA ADAPTIVE THRESHOLD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sauvola local threshold via four-corner SAT lookup.
 * T = μ · [1 + k · (σ/R − 1)].  Foreground where gray < T.
 * Dispatch: ceil(W/16) × ceil(H/16) workgroups of 16×16.
 * @type {string}
 */
export const SH_SAUVOLA = /* wgsl */`
struct U {
  width  : u32, height : u32,
  halfW  : i32, k      : f32,
  R      : f32, _pad   : u32,
}
@group(0) @binding(0) var<uniform>            u      : U;
@group(0) @binding(1) var<storage, read>       iSum   : array<f32>;
@group(0) @binding(2) var<storage, read>       iSumSq : array<f32>;
@group(0) @binding(3) var<storage, read>       gray   : array<f32>;
@group(0) @binding(4) var<storage, read_write> bin    : array<u32>;

fn sat  (x: i32, y: i32) -> f32 {
  if (x < 0 || y < 0) { return 0.0; }
  return iSum[u32(y) * u.width + u32(x)];
}
fn satSq(x: i32, y: i32) -> f32 {
  if (x < 0 || y < 0) { return 0.0; }
  return iSumSq[u32(y) * u.width + u32(x)];
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) g: vec3<u32>) {
  if (g.x >= u.width || g.y >= u.height) { return; }
  let x = i32(g.x); let y = i32(g.y);
  let x1 = max(0, x - u.halfW);  let y1 = max(0, y - u.halfW);
  let x2 = min(i32(u.width)-1,  x + u.halfW);
  let y2 = min(i32(u.height)-1, y + u.halfW);
  let n   = f32((x2-x1+1)*(y2-y1+1));
  let sm  = sat  (x2,y2)-sat  (x1-1,y2)-sat  (x2,y1-1)+sat  (x1-1,y1-1);
  let ssm = satSq(x2,y2)-satSq(x1-1,y2)-satSq(x2,y1-1)+satSq(x1-1,y1-1);
  let mean   = sm / n;
  let stdDev = sqrt(max(0.0, ssm/n - mean*mean));
  let thresh = mean * (1.0 + u.k * (stdDev/u.R - 1.0));
  bin[g.y * u.width + g.x] = select(0u, 1u, gray[g.y * u.width + g.x] < thresh);
}
`;
