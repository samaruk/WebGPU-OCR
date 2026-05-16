// =============================================================================
// preprocessing/preprocessing.wgsl
// WebGPU Compute Shader — Advanced OCR Preprocessing
//
// Pipeline:
//   grayscalePass    — BT.709 RGB→grey
//   claheHistPass    — per-tile histogram (atomics, workgroup shared mem)
//   claheLUTPass     — clip, redistribute, CDF → LUT per tile
//   claheApplyPass   — bilinear interpolation of tile LUTs (CLAHE output)
//   guidedFilterPass — edge-preserving smoothing (guided filter, single-pass)
//   sauvolaPass      — locally adaptive binarization (Sauvola thresholding)
//
// Bindings (@group 0):
//   @binding(0) inp  : array<f32>          — read-only input
//   @binding(1) out  : array<f32>          — read-write output
//   @binding(2) unif : PrepUniforms        — parameters (48 bytes)
//   @binding(3) hist : array<atomic<u32>>  — CLAHE tile histograms
//   @binding(4) lut  : array<f32>          — CLAHE tile LUTs
//
// layout:'auto' excludes bindings 3 & 4 from non-CLAHE pipeline layouts.
// =============================================================================

struct PrepUniforms {
    width      : u32,
    height     : u32,
    numTilesX  : u32,
    numTilesY  : u32,
    clipLimit  : f32,
    guidedEps  : f32,
    guidedR    : u32,
    sauvolaWin : u32,
    sauvolaK   : f32,
    sauvolaR   : f32,
    _p0        : f32,
    _p1        : f32,
}

@group(0) @binding(0) var<storage, read>       inp  : array<f32>;
@group(0) @binding(1) var<storage, read_write> out  : array<f32>;
@group(0) @binding(2) var<uniform>             unif : PrepUniforms;
@group(0) @binding(3) var<storage, read_write> hist : array<atomic<u32>>;
@group(0) @binding(4) var<storage, read_write> lut  : array<f32>;

// ─── Pass 0 : RGB → Grayscale (BT.709 luma) ─────────────────────────────────
@compute @workgroup_size(16, 16)
fn grayscalePass(@builtin(global_invocation_id) gid : vec3<u32>) {
    let x = gid.x; let y = gid.y;
    if (x >= unif.width || y >= unif.height) { return; }
    let base = (y * unif.width + x) * 4u;
    out[y * unif.width + x] = 0.2126 * inp[base]
                             + 0.7152 * inp[base + 1u]
                             + 0.0722 * inp[base + 2u];
}

// ─── Pass 1a : CLAHE Histogram ───────────────────────────────────────────────
// Dispatch: (numTilesX, numTilesY, 1). One workgroup per tile (256 threads).
// Uses workgroup atomics for a fast parallel histogram, then flushes to global.
var<workgroup> wg_hist : array<atomic<u32>, 256>;

@compute @workgroup_size(256)
fn claheHistPass(
    @builtin(workgroup_id)           wid : vec3<u32>,
    @builtin(local_invocation_index) lid : u32,
) {
    atomicStore(&wg_hist[lid], 0u);
    workgroupBarrier();

    let tX = wid.x; let tY = wid.y;
    let W  = unif.width; let H  = unif.height;
    let NX = unif.numTilesX; let NY = unif.numTilesY;
    let tW = (W + NX - 1u) / NX;
    let tH = (H + NY - 1u) / NY;
    let x0 = tX * tW; let y0 = tY * tH;
    let x1 = min(x0 + tW, W); let y1 = min(y0 + tH, H);
    let tw = x1 - x0; let th = y1 - y0;
    let cnt = tw * th;

    for (var p = lid; p < cnt; p += 256u) {
        let px  = x0 + (p % tw);
        let py  = y0 + (p / tw);
        let bin = min(u32(inp[py * W + px] * 255.0 + 0.5), 255u);
        atomicAdd(&wg_hist[bin], 1u);
    }
    workgroupBarrier();

    let tileIdx = tY * NX + tX;
    atomicStore(&hist[tileIdx * 256u + lid], atomicLoad(&wg_hist[lid]));
}

// ─── Pass 1b : CLAHE LUT (clip → redistribute → CDF → normalise) ────────────
// Dispatch: (numTilesX, numTilesY, 1). One workgroup per tile.
// Parallel prefix sum (Hillis–Steele) computes CDF entirely on-chip.
var<workgroup> wg_h   : array<u32, 256>;
var<workgroup> wg_tmp : array<u32, 256>;

@compute @workgroup_size(256)
fn claheLUTPass(
    @builtin(workgroup_id)           wid : vec3<u32>,
    @builtin(local_invocation_index) lid : u32,
) {
    let tX = wid.x; let tY = wid.y;
    let NX = unif.numTilesX; let NY = unif.numTilesY;
    let W  = unif.width; let H  = unif.height;
    let tW = (W + NX - 1u) / NX;
    let tH = (H + NY - 1u) / NY;
    let tw = min(tX * tW + tW, W) - tX * tW;
    let th = min(tY * tH + tH, H) - tY * tH;
    let pixCount  = tw * th;
    let tileIdx   = tY * NX + tX;

    wg_h[lid] = atomicLoad(&hist[tileIdx * 256u + lid]);

    // ── Clip ──────────────────────────────────────────────────────────────────
    let clipLim = max(1u, u32(unif.clipLimit * f32(pixCount) / 256.0));
    var excess = 0u;
    if (wg_h[lid] > clipLim) { excess = wg_h[lid] - clipLim; wg_h[lid] = clipLim; }
    wg_tmp[lid] = excess;
    workgroupBarrier();

    // ── Redistribute excess (thread 0 sums, all threads add) ─────────────────
    if (lid == 0u) {
        var totalExcess = 0u;
        for (var i = 0u; i < 256u; i++) { totalExcess += wg_tmp[i]; }
        wg_tmp[0] = totalExcess / 256u;
    }
    workgroupBarrier();
    wg_h[lid] += wg_tmp[0];
    workgroupBarrier();

    // ── Inclusive prefix sum (Hillis–Steele scan) → CDF ─────────────────────
    wg_tmp[lid] = wg_h[lid];
    workgroupBarrier();
    for (var stride = 1u; stride < 256u; stride <<= 1u) {
        let myVal  = wg_tmp[lid];
        let lftIdx = select(lid, lid - stride, lid >= stride);
        let lftVal = select(0u, wg_tmp[lftIdx], lid >= stride);
        workgroupBarrier();
        wg_tmp[lid] = myVal + lftVal;
        workgroupBarrier();
    }

    // ── Normalise → LUT [0, 1] ───────────────────────────────────────────────
    let total = max(wg_tmp[255], 1u);
    lut[tileIdx * 256u + lid] = f32(wg_tmp[lid]) / f32(total);
}

// ─── Pass 1c : CLAHE Apply (bilinear LUT interpolation) ─────────────────────
// Each pixel finds its four surrounding tile centres and bilinearly
// interpolates their LUT values, eliminating tile boundary artefacts.
@compute @workgroup_size(16, 16)
fn claheApplyPass(@builtin(global_invocation_id) gid : vec3<u32>) {
    let x = gid.x; let y = gid.y;
    let W = unif.width; let H = unif.height;
    if (x >= W || y >= H) { return; }

    let NX = unif.numTilesX; let NY = unif.numTilesY;
    let tW = (W + NX - 1u) / NX;
    let tH = (H + NY - 1u) / NY;

    // Fractional tile coordinate (tile centre i is at (i + 0.5) * tileSize)
    let fx  = (f32(x) + 0.5) / f32(tW) - 0.5;
    let fy  = (f32(y) + 0.5) / f32(tH) - 0.5;
    let tx0 = u32(clamp(i32(fx), 0, i32(NX) - 2));
    let ty0 = u32(clamp(i32(fy), 0, i32(NY) - 2));
    let tx1 = min(tx0 + 1u, NX - 1u);
    let ty1 = min(ty0 + 1u, NY - 1u);
    let ax  = clamp(fx - f32(tx0), 0.0, 1.0);
    let ay  = clamp(fy - f32(ty0), 0.0, 1.0);

    let bin = min(u32(inp[y * W + x] * 255.0 + 0.5), 255u);
    let v00 = lut[(ty0 * NX + tx0) * 256u + bin];
    let v10 = lut[(ty0 * NX + tx1) * 256u + bin];
    let v01 = lut[(ty1 * NX + tx0) * 256u + bin];
    let v11 = lut[(ty1 * NX + tx1) * 256u + bin];

    out[y * W + x] = clamp(
        (1.0 - ay) * ((1.0 - ax) * v00 + ax * v10)
      +       ay   * ((1.0 - ax) * v01 + ax * v11),
        0.0, 1.0
    );
}

// ─── Pass 2 : Guided Filter (edge-preserving smoothing) ──────────────────────
//
// Self-guided filter (I = p = CLAHE output).  For a (2r+1)² window:
//
//   μ  = local mean,  σ² = local variance
//   a  = σ² / (σ² + ε)    → ≈1 at edges (preserve), ≈0 in flat regions (blur)
//   b  = μ · (1 − a)
//   q  = a · I  +  b
//
// This single-pass approximation centres the window at the OUTPUT pixel
// (rather than averaging over all windows containing that pixel).
// Slightly less perfectly smooth in flat regions than the two-pass formulation,
// but edge-sharpness is equivalent and one dispatch is sufficient for OCR.
//
@compute @workgroup_size(16, 16)
fn guidedFilterPass(@builtin(global_invocation_id) gid : vec3<u32>) {
    let x = gid.x; let y = gid.y;
    let W = unif.width; let H = unif.height;
    if (x >= W || y >= H) { return; }

    let r   = i32(unif.guidedR);
    let eps = unif.guidedEps;
    var sumI = 0.0; var sumI2 = 0.0; var cnt = 0.0;

    for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
            let sx = clamp(i32(x) + dx, 0, i32(W) - 1);
            let sy = clamp(i32(y) + dy, 0, i32(H) - 1);
            let v  = inp[u32(sy) * W + u32(sx)];
            sumI  += v; sumI2 += v * v; cnt += 1.0;
        }
    }
    let meanI = sumI / cnt;
    let varI  = max(sumI2 / cnt - meanI * meanI, 0.0);
    let a     = varI / (varI + eps);
    let b     = meanI * (1.0 - a);
    out[y * W + x] = clamp(a * inp[y * W + x] + b, 0.0, 1.0);
}

// ─── Pass 3 : Sauvola Adaptive Thresholding ──────────────────────────────────
//
// Gold standard for degraded / unevenly-lit documents.
//
// T(x,y) = μ · [ 1 + k · (σ/R − 1) ]
//
//   μ  = local mean in (2·win+1)² window
//   σ  = local standard deviation
//   k  = sensitivity (0.2–0.5; higher → more text pixels detected)
//   R  = 0.5 (max possible σ for normalised [0,1] greyscale)
//
// Dark text on light background: pixel < T  →  output 1 (text).
//
@compute @workgroup_size(16, 16)
fn sauvolaPass(@builtin(global_invocation_id) gid : vec3<u32>) {
    let x = gid.x; let y = gid.y;
    let W = unif.width; let H = unif.height;
    if (x >= W || y >= H) { return; }

    let win = i32(unif.sauvolaWin);
    let k   = unif.sauvolaK;
    let R   = unif.sauvolaR;
    var sumV = 0.0; var sumV2 = 0.0; var cnt = 0.0;

    for (var dy = -win; dy <= win; dy++) {
        for (var dx = -win; dx <= win; dx++) {
            let sx = clamp(i32(x) + dx, 0, i32(W) - 1);
            let sy = clamp(i32(y) + dy, 0, i32(H) - 1);
            let v  = inp[u32(sy) * W + u32(sx)];
            sumV += v; sumV2 += v * v; cnt += 1.0;
        }
    }
    let mean   = sumV / cnt;
    let stdDev    = sqrt(max(sumV2 / cnt - mean * mean, 0.0));
    let thresh = mean * (1.0 + k * (stdDev / R - 1.0));
    out[y * W + x] = select(0.0, 1.0, inp[y * W + x] < thresh);
}
