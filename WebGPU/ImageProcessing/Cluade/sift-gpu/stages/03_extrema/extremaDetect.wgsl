// ============================================================
// SIFT-GPU  –  Extrema Detection in DoG Scale-Space
//
// For each pixel (x,y) in the middle DoG layer we check whether
// it is a local maximum or minimum in the 3x3x3 neighbourhood
// spanning layers [s-1, s, s+1].
//
// Initial contrast filter: |D(x,y,s)| > contrastThreshold / S
// Edge filter:  Tr(H)^2 / Det(H) < (r+1)^2/r
//   where H is the 2x2 spatial Hessian of the DoG image.
//
// Surviving candidates are appended (atomically) to the keypoint buffer.
// ============================================================

struct Params {
  width             : u32,
  height            : u32,
  octave            : u32,
  scaleIdx          : u32,   // middle DoG layer index within octave (1..S)
  scalesPerOctave   : u32,
  _pad0             : u32,
  contrastThreshold : f32,
  edgeThreshold     : f32,   // r in the paper (e.g. 12)
  octaveScale       : f32,   // 2^octave (pixel stride in original image)
  sigma             : f32,   // absolute sigma of this keypoint level
};

// Keypoint struct  (8 x f32 = 32 bytes)
struct Keypoint {
  x           : f32,   // sub-pixel x in this octave
  y           : f32,   // sub-pixel y in this octave
  scale       : f32,   // absolute sigma
  response    : f32,   // |D| at keypoint
  orientation : f32,   // assigned later (0 here)
  octave      : u32,
  layer       : u32,
  flags       : u32,   // bit 0 = refined
};

@group(0) @binding(0) var<uniform>                params    : Params;
@group(0) @binding(1) var prevDog                           : texture_2d<f32>;
@group(0) @binding(2) var currDog                           : texture_2d<f32>;
@group(0) @binding(3) var nextDog                           : texture_2d<f32>;
@group(0) @binding(4) var<storage, read_write>    keypoints : array<Keypoint>;
@group(0) @binding(5) var<storage, read_write>    kpCount   : atomic<u32>;

fn sampleDog(tex: texture_2d<f32>, x: i32, y: i32, W: i32, H: i32) -> f32 {
  return textureLoad(tex, clamp(vec2<i32>(x,y), vec2<i32>(0,0), vec2<i32>(W-1,H-1)), 0).r;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let W = i32(params.width);
  let H = i32(params.height);
  let x = i32(gid.x);
  let y = i32(gid.y);

  // Exclude border (need 1-pixel margin for Hessian + 3x3 neighbourhood)
  if (x < 1 || y < 1 || x >= W-1 || y >= H-1) { return; }

  let cv = sampleDog(currDog, x, y, W, H);

  // Pre-filter: contrast threshold
  let thr = params.contrastThreshold / f32(params.scalesPerOctave);
  if (abs(cv) < thr) { return; }

  // 3x3 neighbours on current layer
  let c00 = sampleDog(currDog, x-1, y-1, W, H);
  let c10 = sampleDog(currDog, x,   y-1, W, H);
  let c20 = sampleDog(currDog, x+1, y-1, W, H);
  let c01 = sampleDog(currDog, x-1, y,   W, H);
  let c21 = sampleDog(currDog, x+1, y,   W, H);
  let c02 = sampleDog(currDog, x-1, y+1, W, H);
  let c12 = sampleDog(currDog, x,   y+1, W, H);
  let c22 = sampleDog(currDog, x+1, y+1, W, H);

  // 3x3 on prev and next scale layers (centre pixel only for extrema test)
  let pv = sampleDog(prevDog, x, y, W, H);
  let nv = sampleDog(nextDog, x, y, W, H);

  let isMax = cv > c00 && cv > c10 && cv > c20 && cv > c01 &&
              cv > c21 && cv > c02 && cv > c12 && cv > c22 &&
              cv > pv  && cv > nv;
  let isMin = cv < c00 && cv < c10 && cv < c20 && cv < c01 &&
              cv < c21 && cv < c02 && cv < c12 && cv < c22 &&
              cv < pv  && cv < nv;

  if (!isMax && !isMin) { return; }

  // Edge filter using 2x2 spatial Hessian of DoG
  // Dxx = D(x+1) - 2*D(x) + D(x-1)
  let dxx = c21 - 2.0*cv + c01;
  let dyy = c12 - 2.0*cv + c10;
  let dxy = (c22 - c02 - c20 + c00) * 0.25;
  let trH  = dxx + dyy;
  let detH = dxx*dyy - dxy*dxy;

  if (detH <= 0.0) { return; }  // saddle point

  let r     = params.edgeThreshold;
  let ratio = (r+1.0)*(r+1.0) / r;
  if (trH*trH / detH >= ratio) { return; }

  // Append keypoint
  let idx = atomicAdd(&kpCount, 1u);
  let maxKP = arrayLength(&keypoints);
  if (idx >= maxKP) { return; }

  keypoints[idx] = Keypoint(
    f32(x),
    f32(y),
    params.sigma,
    abs(cv),
    0.0,
    params.octave,
    params.scaleIdx,
    0u,
  );
}
