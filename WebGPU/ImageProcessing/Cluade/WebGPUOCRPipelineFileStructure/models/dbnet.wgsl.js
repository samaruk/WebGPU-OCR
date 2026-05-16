/**
 * models/dbnet.wgsl — DBNet Shared WGSL Shader Library
 *
 * This file contains the complete WGSL shader source for the DBNet
 * text detection pipeline. It is consumed by 05_dbnet.js as a static
 * import for the GPU pipeline.
 *
 * Contains:
 *   1. Shared type definitions and utility functions
 *   2. Conv2d compute kernel
 *   3. Batch normalization kernel
 *   4. Feature pyramid network (FPN) operations
 *   5. DBNet-specific probability and threshold head
 *   6. Differentiable binarization
 *   7. Sigmoid and activation functions
 */

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Shared Utilities
// ─────────────────────────────────────────────────────────────────────────────

export const WGSL_UTILS = /* wgsl */`
// ──────────────────────────────────────────────────────────────────────────────
// DBNet Shared Utilities
// ──────────────────────────────────────────────────────────────────────────────

fn sigmoid(x: f32) -> f32 {
  return 1.0 / (1.0 + exp(-clamp(x, -88.0, 88.0)));
}

fn relu(x: f32) -> f32 {
  return max(0.0, x);
}

fn tanh_act(x: f32) -> f32 {
  return tanh(x);
}

fn gelu(x: f32) -> f32 {
  // Gaussian Error Linear Unit
  return 0.5 * x * (1.0 + tanh(0.7978845608 * (x + 0.044715 * x*x*x)));
}

fn leaky_relu(x: f32, alpha: f32) -> f32 {
  return select(alpha * x, x, x > 0.0);
}

fn hardswish(x: f32) -> f32 {
  return x * clamp((x + 3.0) / 6.0, 0.0, 1.0);
}

fn apply_activation(x: f32, actType: u32) -> f32 {
  switch (actType) {
    case 0u:  { return x; }            // linear
    case 1u:  { return relu(x); }      // ReLU
    case 2u:  { return sigmoid(x); }   // sigmoid
    case 3u:  { return tanh_act(x); }  // tanh
    case 4u:  { return gelu(x); }      // GeLU
    case 5u:  { return leaky_relu(x, 0.1); }  // Leaky ReLU
    case 6u:  { return hardswish(x); } // hard-swish
    default:  { return x; }
  }
}

fn clamp01(x: f32) -> f32 {
  return clamp(x, 0.0, 1.0);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Generalized Conv2D
// ─────────────────────────────────────────────────────────────────────────────

export const WGSL_CONV2D = /* wgsl */`
// ──────────────────────────────────────────────────────────────────────────────
// Generalized 2D Convolution
// ──────────────────────────────────────────────────────────────────────────────
// Layout: NCHW (N=1, so CHW)
// Input:   [inC  * inH  * inW]
// Weights: [outC * inC  * kH  * kW]
// Bias:    [outC]
// Output:  [outC * outH * outW]
//
// Supports: stride, padding, dilations=1, depthwise via groups (not shown),
//           fused activation (relu/sigmoid/tanh/etc)

struct ConvUniforms {
  inC:      u32,
  inH:      u32,
  inW:      u32,
  outC:     u32,
  outH:     u32,
  outW:     u32,
  kH:       u32,
  kW:       u32,
  padH:     u32,
  padW:     u32,
  strideH:  u32,
  strideW:  u32,
  dilH:     u32,   // dilation height (default 1)
  dilW:     u32,   // dilation width  (default 1)
  hasBias:  u32,
  actType:  u32,   // activation type (see apply_activation)
}

@group(0) @binding(0) var<uniform>            conv_u:  ConvUniforms;
@group(0) @binding(1) var<storage,read>       conv_in: array<f32>;
@group(0) @binding(2) var<storage,read>       conv_w:  array<f32>;
@group(0) @binding(3) var<storage,read>       conv_b:  array<f32>;
@group(0) @binding(4) var<storage,read_write> conv_out:array<f32>;

@compute @workgroup_size(8, 8, 4)
fn conv2d_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let ow = gid.x;
  let oh = gid.y;
  let oc = gid.z;
  if (ow >= conv_u.outW || oh >= conv_u.outH || oc >= conv_u.outC) { return; }

  var acc = 0.0;
  for (var ic = 0u; ic < conv_u.inC; ic++) {
    for (var kh = 0u; kh < conv_u.kH; kh++) {
      for (var kw = 0u; kw < conv_u.kW; kw++) {
        let ih = i32(oh * conv_u.strideH + kh * conv_u.dilH) - i32(conv_u.padH);
        let iw = i32(ow * conv_u.strideW + kw * conv_u.dilW) - i32(conv_u.padW);
        var v = 0.0;
        if (ih >= 0 && ih < i32(conv_u.inH) && iw >= 0 && iw < i32(conv_u.inW)) {
          v = conv_in[ic * conv_u.inH * conv_u.inW + u32(ih) * conv_u.inW + u32(iw)];
        }
        let wIdx = oc * (conv_u.inC * conv_u.kH * conv_u.kW)
                 + ic * (conv_u.kH * conv_u.kW)
                 + kh * conv_u.kW + kw;
        acc += v * conv_w[wIdx];
      }
    }
  }
  if (conv_u.hasBias != 0u) { acc += conv_b[oc]; }
  acc = apply_activation(acc, conv_u.actType);
  conv_out[oc * conv_u.outH * conv_u.outW + oh * conv_u.outW + ow] = acc;
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Batch Normalization
// ─────────────────────────────────────────────────────────────────────────────

export const WGSL_BATCHNORM = /* wgsl */`
// ──────────────────────────────────────────────────────────────────────────────
// Inference Batch Normalization
// Applies pre-computed running statistics (no training-time mean/var computation)
// ──────────────────────────────────────────────────────────────────────────────

struct BNUniforms {
  C:    u32,   // number of channels
  HW:   u32,   // H * W (spatial size)
  eps:  f32,   // epsilon for numerical stability
  actType: u32,
}

@group(0) @binding(0) var<uniform>            bn_u:     BNUniforms;
@group(0) @binding(1) var<storage,read>       bn_gamma: array<f32>;
@group(0) @binding(2) var<storage,read>       bn_beta:  array<f32>;
@group(0) @binding(3) var<storage,read>       bn_mean:  array<f32>;
@group(0) @binding(4) var<storage,read>       bn_var:   array<f32>;
@group(0) @binding(5) var<storage,read_write> bn_data:  array<f32>;  // in-place [C*HW]

@compute @workgroup_size(256)
fn batchnorm_main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let n = bn_u.C * bn_u.HW;
  if (gid.x >= n) { return; }
  let c  = gid.x / bn_u.HW;
  let x  = bn_data[gid.x];
  let xn = (x - bn_mean[c]) / sqrt(bn_var[c] + bn_u.eps);
  let y  = bn_gamma[c] * xn + bn_beta[c];
  bn_data[gid.x] = apply_activation(y, bn_u.actType);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Feature Pyramid Network (FPN)
// ─────────────────────────────────────────────────────────────────────────────

export const WGSL_FPN = /* wgsl */`
// ──────────────────────────────────────────────────────────────────────────────
// FPN Operations: upsample + lateral connection
// ──────────────────────────────────────────────────────────────────────────────

struct UpsampleUniforms {
  inC:   u32,
  inH:   u32,
  inW:   u32,
  scale: u32,   // integer upscale factor (2, 4, ...)
  _p:    u32,
}

@group(0) @binding(0) var<uniform>            up_u:   UpsampleUniforms;
@group(0) @binding(1) var<storage,read>       up_src: array<f32>;
@group(0) @binding(2) var<storage,read_write> up_dst: array<f32>;

@compute @workgroup_size(8, 8, 4)
fn upsample_nearest(@builtin(global_invocation_id) gid: vec3<u32>) {
  let outH = up_u.inH * up_u.scale;
  let outW = up_u.inW * up_u.scale;
  let ow   = gid.x;
  let oh   = gid.y;
  let c    = gid.z;
  if (ow >= outW || oh >= outH || c >= up_u.inC) { return; }
  let iw = ow / up_u.scale;
  let ih = oh / up_u.scale;
  up_dst[c * outH * outW + oh * outW + ow] =
    up_src[c * up_u.inH * up_u.inW + ih * up_u.inW + iw];
}

// Bilinear upsample (higher quality)
@compute @workgroup_size(8, 8, 4)
fn upsample_bilinear(@builtin(global_invocation_id) gid: vec3<u32>) {
  let outH = up_u.inH * up_u.scale;
  let outW = up_u.inW * up_u.scale;
  let ow   = gid.x;
  let oh   = gid.y;
  let c    = gid.z;
  if (ow >= outW || oh >= outH || c >= up_u.inC) { return; }

  let fx = (f32(ow) + 0.5) / f32(up_u.scale) - 0.5;
  let fy = (f32(oh) + 0.5) / f32(up_u.scale) - 0.5;

  let x0 = i32(floor(fx));
  let y0 = i32(floor(fy));
  let ax = fx - floor(fx);
  let ay = fy - floor(fy);

  fn clampRead(ix: i32, iy: i32) -> f32 {
    let cx = u32(clamp(ix, 0, i32(up_u.inW) - 1));
    let cy = u32(clamp(iy, 0, i32(up_u.inH) - 1));
    return up_src[c * up_u.inH * up_u.inW + cy * up_u.inW + cx];
  }

  let v00 = clampRead(x0,   y0);
  let v10 = clampRead(x0+1, y0);
  let v01 = clampRead(x0,   y0+1);
  let v11 = clampRead(x0+1, y0+1);
  up_dst[c * outH * outW + oh * outW + ow] =
    mix(mix(v00, v10, ax), mix(v01, v11, ax), ay);
}

// Element-wise feature map addition (FPN lateral + top-down)
struct AddUniforms { n: u32, _p0: u32, _p1: u32, _p2: u32, }

@group(0) @binding(0) var<uniform>            add_u: AddUniforms;
@group(0) @binding(1) var<storage,read>       add_a: array<f32>;
@group(0) @binding(2) var<storage,read>       add_b: array<f32>;
@group(0) @binding(3) var<storage,read_write> add_c: array<f32>;

@compute @workgroup_size(256)
fn feature_add(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= add_u.n) { return; }
  add_c[gid.x] = add_a[gid.x] + add_b[gid.x];
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — DBNet Detection Head
// ─────────────────────────────────────────────────────────────────────────────

export const WGSL_DBNET_HEAD = /* wgsl */`
// ──────────────────────────────────────────────────────────────────────────────
// DBNet Probability Map Head
// ──────────────────────────────────────────────────────────────────────────────
// Takes the fused FPN feature map and produces:
//   - prob map  P ∈ [0,1]  (text vs background probability)
//   - thresh map T ∈ [0,1] (adaptive threshold)
//   - binary map B = sigmoid(k * (P - T))

struct HeadUniforms {
  inC:      u32,
  H:        u32,
  W:        u32,
  _p:       u32,
}

// Probability head: 1×1 conv + sigmoid
@group(0) @binding(0) var<uniform>            hd_u:    HeadUniforms;
@group(0) @binding(1) var<storage,read>       hd_feat: array<f32>;   // [inC, H, W]
@group(0) @binding(2) var<storage,read>       hd_w:    array<f32>;   // [1, inC, 1, 1]
@group(0) @binding(3) var<storage,read>       hd_b:    array<f32>;   // [1]
@group(0) @binding(4) var<storage,read_write> hd_out:  array<f32>;   // [H, W]

@compute @workgroup_size(16, 16)
fn prob_head(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= hd_u.W || gid.y >= hd_u.H) { return; }
  var acc = 0.0;
  for (var ic = 0u; ic < hd_u.inC; ic++) {
    acc += hd_feat[ic * hd_u.H * hd_u.W + gid.y * hd_u.W + gid.x] * hd_w[ic];
  }
  acc += hd_b[0];
  hd_out[gid.y * hd_u.W + gid.x] = sigmoid(acc);
}

// ─────────────────────────────────────────────────────────────────────────────
// Differentiable Binarization
// binary = sigmoid(k * (prob - thresh))
// ─────────────────────────────────────────────────────────────────────────────

struct DBUniforms { n: u32, k: f32, _p0: u32, _p1: u32, }

@group(0) @binding(0) var<uniform>            db_u:      DBUniforms;
@group(0) @binding(1) var<storage,read>       db_prob:   array<f32>;
@group(0) @binding(2) var<storage,read>       db_thresh: array<f32>;
@group(0) @binding(3) var<storage,read_write> db_binary: array<f32>;

@compute @workgroup_size(256)
fn differentiable_binarize(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= db_u.n) { return; }
  db_binary[gid.x] = sigmoid(db_u.k * (db_prob[gid.x] - db_thresh[gid.x]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Hard threshold: binary_hard = (binary > t) ? 1 : 0
// ─────────────────────────────────────────────────────────────────────────────

struct ThreshUniforms { n: u32, t: f32, _p0: u32, _p1: u32, }

@group(0) @binding(0) var<uniform>            th_u:   ThreshUniforms;
@group(0) @binding(1) var<storage,read>       th_src: array<f32>;
@group(0) @binding(2) var<storage,read_write> th_dst: array<u32>;   // 0 or 1

@compute @workgroup_size(256)
fn hard_threshold(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= th_u.n) { return; }
  th_dst[gid.x] = select(0u, 1u, th_src[gid.x] >= th_u.t);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — Normalization
// ─────────────────────────────────────────────────────────────────────────────

export const WGSL_NORMALIZE = /* wgsl */`
// ──────────────────────────────────────────────────────────────────────────────
// ImageNet-style normalization for DBNet input preprocessing
// Input: packed RGBA8 u32 array
// Output: CHW float32 array (3 channels, normalized)
// mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225]
// ──────────────────────────────────────────────────────────────────────────────

const IMAGENET_MEAN = array<f32,3>(0.485, 0.456, 0.406);
const IMAGENET_STD  = array<f32,3>(0.229, 0.224, 0.225);

struct NormUniforms { n: u32, _p0: u32, _p1: u32, _p2: u32, }

@group(0) @binding(0) var<uniform>            nm_u:    NormUniforms;
@group(0) @binding(1) var<storage,read>       nm_rgba: array<u32>;
@group(0) @binding(2) var<storage,read_write> nm_chw:  array<f32>;

@compute @workgroup_size(256)
fn normalize_imagenet(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= nm_u.n) { return; }
  let p = nm_rgba[gid.x];
  let rgb = array<f32,3>(
    f32((p >>  0u) & 0xFFu) / 255.0,
    f32((p >>  8u) & 0xFFu) / 255.0,
    f32((p >> 16u) & 0xFFu) / 255.0,
  );
  for (var c = 0u; c < 3u; c++) {
    nm_chw[c * nm_u.n + gid.x] = (rgb[c] - IMAGENET_MEAN[c]) / IMAGENET_STD[c];
  }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — Complete DBNet Library Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Complete WGSL shader source for the DBNet pipeline.
 * This is a concatenation of all sections above.
 * Use this when creating a single monolithic shader module.
 */
export const DBNET_SHADER_LIBRARY = [
  WGSL_UTILS,
  WGSL_CONV2D,
  WGSL_BATCHNORM,
  WGSL_FPN,
  WGSL_DBNET_HEAD,
  WGSL_NORMALIZE,
].join('\n\n');

/**
 * Entry point catalog for the DBNet shader library.
 * Maps semantic names to WGSL entry function names.
 */
export const DBNET_ENTRY_POINTS = {
  conv2d:               'conv2d_main',
  batchnorm:            'batchnorm_main',
  upsampleNearest:      'upsample_nearest',
  upsampleBilinear:     'upsample_bilinear',
  featureAdd:           'feature_add',
  probHead:             'prob_head',
  differentiableBinary: 'differentiable_binarize',
  hardThreshold:        'hard_threshold',
  normalizeImageNet:    'normalize_imagenet',
};
