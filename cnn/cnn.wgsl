// =============================================================================
// cnn/cnn.wgsl
// WebGPU Compute Shader — CNN Feature Extraction Stage
//
// Implements three compute entry points used sequentially per filter:
//   convPass     : 3×3 convolution + bias  (weights in @binding(3))
//   reluPass     : element-wise ReLU       (in-place: reads binding 0, writes binding 1)
//   maxPoolPass  : 2×2 stride-2 max-pool   (produces outWidth × outHeight output)
//
// Binding layout:
//   @binding(0) inp     — read-only  f32 array  (input feature map)
//   @binding(1) out     — read-write f32 array  (output feature map)
//   @binding(2) unif    — uniform    CNNUniforms
//   @binding(3) weights — read-only  f32 array  (9 kernel weights + 1 bias, convPass only)
// =============================================================================

struct CNNUniforms {
    inWidth   : u32,
    inHeight  : u32,
    outWidth  : u32,   // = inWidth  / 2 for maxPool, = inWidth  for conv/relu
    outHeight : u32,   // = inHeight / 2 for maxPool, = inHeight for conv/relu
}

@group(0) @binding(0) var<storage, read>       inp     : array<f32>;
@group(0) @binding(1) var<storage, read_write> out     : array<f32>;
@group(0) @binding(2) var<uniform>             unif    : CNNUniforms;
// binding(3) only declared and used in convPass; absent in relu/pool pipelines
@group(0) @binding(3) var<storage, read>       weights : array<f32>;

// ─── Pass 1 : 3×3 Convolution ────────────────────────────────────────────────
//
// Kernel layout in weights[]:
//   [w00 w01 w02 w10 w11 w12 w20 w21 w22  bias]
//    idx: 0   1   2   3   4   5   6   7   8    9
//
// Same-padding: output has same spatial dimensions as input.
// Weights are uploaded per-filter from JS before each dispatch.
//
@compute @workgroup_size(16, 16)
fn convPass(@builtin(global_invocation_id) gid : vec3<u32>) {
    let x = gid.x;
    let y = gid.y;
    let W = unif.inWidth;
    let H = unif.inHeight;
    if (x >= W || y >= H) { return; }

    var acc : f32 = 0.0;

    for (var ky : i32 = -1; ky <= 1; ky++) {
        for (var kx : i32 = -1; kx <= 1; kx++) {
            let sx  = clamp(i32(x) + kx, 0, i32(W) - 1);
            let sy  = clamp(i32(y) + ky, 0, i32(H) - 1);
            let kid = u32((ky + 1) * 3 + (kx + 1));
            acc    += weights[kid] * inp[u32(sy) * W + u32(sx)];
        }
    }

    // Add bias (weights[9]) and store
    out[y * W + x] = acc + weights[9u];
}

// ─── Pass 2 : ReLU Activation ────────────────────────────────────────────────
//
// f(x) = max(0, x)
// Operates on the convolution output; result ready for pooling.
//
@compute @workgroup_size(16, 16)
fn reluPass(@builtin(global_invocation_id) gid : vec3<u32>) {
    let x = gid.x;
    let y = gid.y;
    if (x >= unif.inWidth || y >= unif.inHeight) { return; }
    let i   = y * unif.inWidth + x;
    out[i] = max(0.0, inp[i]);
}

// ─── Pass 3 : 2×2 Max Pooling (stride 2) ─────────────────────────────────────
//
// Each thread computes one output pixel corresponding to a 2×2 input patch.
// outWidth  = ceil(inWidth  / 2)
// outHeight = ceil(inHeight / 2)
//
@compute @workgroup_size(8, 8)
fn maxPoolPass(@builtin(global_invocation_id) gid : vec3<u32>) {
    let ox = gid.x;
    let oy = gid.y;
    let OW = unif.outWidth;
    let OH = unif.outHeight;
    let IW = unif.inWidth;
    let IH = unif.inHeight;
    if (ox >= OW || oy >= OH) { return; }

    let sx0 = ox * 2u;
    let sy0 = oy * 2u;
    let sx1 = min(sx0 + 1u, IW - 1u);
    let sy1 = min(sy0 + 1u, IH - 1u);

    let v00 = inp[sy0 * IW + sx0];
    let v01 = inp[sy0 * IW + sx1];
    let v10 = inp[sy1 * IW + sx0];
    let v11 = inp[sy1 * IW + sx1];

    out[oy * OW + ox] = max(max(v00, v01), max(v10, v11));
}
