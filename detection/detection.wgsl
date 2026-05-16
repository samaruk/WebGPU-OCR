// =============================================================================
// detection/detection.wgsl
// WebGPU Compute Shader — DBNet-inspired Text Detection Stage
//
// Binding layout (same across all entry points):
//   @binding(0) inp  — read-only  f32 array  (grayscale/edge/probability map)
//   @binding(1) out  — read-write f32 array  (output map)
//   @binding(2) unif — uniform    DetUniforms
//
// Entry points
//   sobelPass          : grayscale → edge gradient magnitude (Sobel 3×3)
//   probabilityMapPass : edge map  → local-density text-probability map (7×7)
//   dilatePass         : binary    → dilated binary   (3×3 morphological max)
// =============================================================================

struct DetUniforms {
    width     : u32,
    height    : u32,
    threshold : f32,   // probability threshold for binary map
    _pad      : f32,
}

@group(0) @binding(0) var<storage, read>       inp  : array<f32>;
@group(0) @binding(1) var<storage, read_write> out  : array<f32>;
@group(0) @binding(2) var<uniform>             unif : DetUniforms;

// ─── Pass 1 : Sobel Edge Detection ───────────────────────────────────────────
//
// Gx = [[-1  0  1]    Gy = [[-1 -2 -1]
//        [-2  0  2]           [ 0  0  0]
//        [-1  0  1]]          [ 1  2  1]]
//
// Output: gradient magnitude, clamped to [0, 1].
//
@compute @workgroup_size(16, 16)
fn sobelPass(@builtin(global_invocation_id) gid : vec3<u32>) {
    let x = gid.x;
    let y = gid.y;
    let W = unif.width;
    let H = unif.height;
    if (x >= W || y >= H) { return; }

    // Helper: clamped sample
    var gx : f32 = 0.0;
    var gy : f32 = 0.0;

    let Gx = array<f32, 9>(-1.0, 0.0, 1.0,  -2.0, 0.0, 2.0,  -1.0, 0.0, 1.0);
    let Gy = array<f32, 9>(-1.0,-2.0,-1.0,   0.0, 0.0, 0.0,   1.0, 2.0, 1.0);

    for (var ky : i32 = -1; ky <= 1; ky++) {
        for (var kx : i32 = -1; kx <= 1; kx++) {
            let sx  = clamp(i32(x) + kx, 0, i32(W) - 1);
            let sy  = clamp(i32(y) + ky, 0, i32(H) - 1);
            let v   = inp[u32(sy) * W + u32(sx)];
            let kid = u32((ky + 1) * 3 + (kx + 1));
            gx     += Gx[kid] * v;
            gy     += Gy[kid] * v;
        }
    }

    let mag = clamp(sqrt(gx * gx + gy * gy) * 0.25, 0.0, 1.0);
    out[y * W + x] = mag;
}

// ─── Pass 2 : Probability Map (local edge density, DBNet-inspired) ────────────
//
// For each pixel we count what fraction of its 7×7 neighbourhood has a
// significant Sobel response. Dense-edge regions (character strokes) get high
// probability; blank areas get low probability.
//
@compute @workgroup_size(16, 16)
fn probabilityMapPass(@builtin(global_invocation_id) gid : vec3<u32>) {
    let x = gid.x;
    let y = gid.y;
    let W = unif.width;
    let H = unif.height;
    if (x >= W || y >= H) { return; }

    let edgeThresh : f32 = 0.05;
    var count : f32 = 0.0;
    var total : f32 = 0.0;

    for (var dy : i32 = -3; dy <= 3; dy++) {
        for (var dx : i32 = -3; dx <= 3; dx++) {
            let nx = clamp(i32(x) + dx, 0, i32(W) - 1);
            let ny = clamp(i32(y) + dy, 0, i32(H) - 1);
            let v  = inp[u32(ny) * W + u32(nx)];
            count += select(0.0, 1.0, v > edgeThresh);
            total += 1.0;
        }
    }

    // Smooth sigmoid-like scaling so text regions stand out
    let raw  = count / total;
    let prob = raw * raw * (3.0 - 2.0 * raw);   // smoothstep
    out[y * W + x] = prob;
}

// ─── Pass 3 : Morphological Dilation (3×3 square structuring element) ─────────
//
// Takes the thresholded probability map and expands text blobs to
// connect nearby strokes — mimics DBNet's dilation step before bounding-box
// extraction.
//
@compute @workgroup_size(16, 16)
fn dilatePass(@builtin(global_invocation_id) gid : vec3<u32>) {
    let x = gid.x;
    let y = gid.y;
    let W = unif.width;
    let H = unif.height;
    if (x >= W || y >= H) { return; }

    var maxVal : f32 = 0.0;

    // 5×5 dilation for stronger connectivity
    for (var dy : i32 = -2; dy <= 2; dy++) {
        for (var dx : i32 = -2; dx <= 2; dx++) {
            let nx = clamp(i32(x) + dx, 0, i32(W) - 1);
            let ny = clamp(i32(y) + dy, 0, i32(H) - 1);
            let v  = inp[u32(ny) * W + u32(nx)];
            // Only binary: threshold from uniform
            if (v > unif.threshold) { maxVal = 1.0; }
        }
    }

    out[y * W + x] = maxVal;
}
