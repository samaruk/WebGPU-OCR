// ============================================================
// SIFT-GPU  –  Sub-pixel Keypoint Refinement
//
// Fits a 3-D quadratic to the DoG scale-space using first and
// second derivatives, then solves H * delta = -g to get the
// sub-pixel offset.  Keypoints with large offsets or low
// contrast are discarded (flags bit1 set = rejected).
//
// One thread per keypoint.
// ============================================================

struct RefinementParams {
  width             : u32,
  height            : u32,
  scalesPerOctave   : u32,
  maxIter           : u32,   // max Newton steps (typically 5)
  contrastThreshold : f32,
  edgeThreshold     : f32,
  _pad0             : f32,
  _pad1             : f32,
};

struct Keypoint {
  x           : f32,
  y           : f32,
  scale       : f32,
  response    : f32,
  orientation : f32,
  octave      : u32,
  layer       : u32,
  flags       : u32,
};

@group(0) @binding(0) var<uniform>               rp         : RefinementParams;
// DoG pyramid for this octave stored as array of textures – we pass
// up to S+2 layers; index via layer field of keypoint.
// (WebGPU does not support dynamic indexing of texture arrays easily,
//  so we unroll to a fixed size of 8 DoG layers, padding with dummies.)
@group(0) @binding(1) var dog0 : texture_2d<f32>;
@group(0) @binding(2) var dog1 : texture_2d<f32>;
@group(0) @binding(3) var dog2 : texture_2d<f32>;
@group(0) @binding(4) var dog3 : texture_2d<f32>;
@group(0) @binding(5) var dog4 : texture_2d<f32>;
@group(0) @binding(6) var dog5 : texture_2d<f32>;
@group(0) @binding(7) var dog6 : texture_2d<f32>;
@group(0) @binding(8) var<storage, read_write>   keypoints  : array<Keypoint>;
@group(0) @binding(9) var<storage, read>         kpCount    : u32;

fn sampleLayer(layer: u32, x: i32, y: i32, W: i32, H: i32) -> f32 {
  let c = clamp(vec2<i32>(x,y), vec2<i32>(0,0), vec2<i32>(W-1,H-1));
  switch layer {
    case 0u: { return textureLoad(dog0, c, 0).r; }
    case 1u: { return textureLoad(dog1, c, 0).r; }
    case 2u: { return textureLoad(dog2, c, 0).r; }
    case 3u: { return textureLoad(dog3, c, 0).r; }
    case 4u: { return textureLoad(dog4, c, 0).r; }
    case 5u: { return textureLoad(dog5, c, 0).r; }
    default: { return textureLoad(dog6, c, 0).r; }
  }
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let tid = gid.x;
  if (tid >= kpCount) { return; }

  var kp  = keypoints[tid];
  if ((kp.flags & 2u) != 0u) { return; }  // already rejected

  let W   = i32(rp.width);
  let H   = i32(rp.height);

  var xi  = i32(kp.x + 0.5);
  var yi  = i32(kp.y + 0.5);
  var si  = kp.layer;

  var dx  = 0.0;
  var dy  = 0.0;
  var ds  = 0.0;

  for (var iter = 0u; iter < rp.maxIter; iter++) {
    // Sample 3x3x3
    let v  = sampleLayer(si,   xi,   yi,   W, H);
    let vp = sampleLayer(si+1u, xi,  yi,   W, H);
    let vn = sampleLayer(si-1u, xi,  yi,   W, H);

    // First-order finite differences
    dx = (sampleLayer(si, xi+1, yi,   W, H) - sampleLayer(si, xi-1, yi,   W, H)) * 0.5;
    dy = (sampleLayer(si, xi,   yi+1, W, H) - sampleLayer(si, xi,   yi-1, W, H)) * 0.5;
    ds = (vp - vn) * 0.5;

    // Second-order
    let dxx = sampleLayer(si, xi+1, yi,   W, H) - 2.0*v + sampleLayer(si, xi-1, yi,   W, H);
    let dyy = sampleLayer(si, xi,   yi+1, W, H) - 2.0*v + sampleLayer(si, xi,   yi-1, W, H);
    let dss = vp - 2.0*v + vn;
    let dxy = (sampleLayer(si, xi+1, yi+1, W, H) - sampleLayer(si, xi-1, yi+1, W, H)
             - sampleLayer(si, xi+1, yi-1, W, H) + sampleLayer(si, xi-1, yi-1, W, H)) * 0.25;
    let dxs = (sampleLayer(si+1u, xi+1, yi, W, H) - sampleLayer(si+1u, xi-1, yi, W, H)
             - sampleLayer(si-1u, xi+1, yi, W, H) + sampleLayer(si-1u, xi-1, yi, W, H)) * 0.25;
    let dys = (sampleLayer(si+1u, xi, yi+1, W, H) - sampleLayer(si+1u, xi, yi-1, W, H)
             - sampleLayer(si-1u, xi, yi+1, W, H) + sampleLayer(si-1u, xi, yi-1, W, H)) * 0.25;

    // 3x3 Hessian (symmetric) – solve via Cramer's rule
    // H = [[dxx, dxy, dxs],[dxy, dyy, dys],[dxs, dys, dss]]
    let detH = dxx*(dyy*dss - dys*dys)
             - dxy*(dxy*dss - dys*dxs)
             + dxs*(dxy*dys - dyy*dxs);

    if (abs(detH) < 1e-10) { kp.flags |= 2u; keypoints[tid] = kp; return; }

    let invDet = -1.0 / detH;  // negative because we solve H*delta = -g
    let deltax = invDet * ((dyy*dss - dys*dys)*dx + (dxs*dys - dxy*dss)*dy + (dxy*dys - dyy*dxs)*ds);
    let deltay = invDet * ((dxs*dys - dxy*dss)*dx + (dxx*dss - dxs*dxs)*dy + (dxs*dxy - dxx*dys)*ds);
    let deltas = invDet * ((dxy*dys - dyy*dxs)*dx + (dxs*dxy - dxx*dys)*dy + (dxx*dyy - dxy*dxy)*ds);

    if (abs(deltax) < 0.5 && abs(deltay) < 0.5 && abs(deltas) < 0.5) {
      // Converged – update response
      let response = v + 0.5*(dx*deltax + dy*deltay + ds*deltas);
      let thr = rp.contrastThreshold / f32(rp.scalesPerOctave);
      if (abs(response) < thr) { kp.flags |= 2u; keypoints[tid] = kp; return; }

      // Edge test on refined position
      let trH  = dxx + dyy;
      let detH2 = dxx*dyy - dxy*dxy;
      if (detH2 <= 0.0) { kp.flags |= 2u; keypoints[tid] = kp; return; }
      let r = rp.edgeThreshold;
      if (trH*trH / detH2 >= (r+1.0)*(r+1.0)/r) {
        kp.flags |= 2u; keypoints[tid] = kp; return;
      }

      kp.x        = f32(xi) + deltax;
      kp.y        = f32(yi) + deltay;
      kp.response = abs(response);
      kp.flags   |= 1u;  // refined
      keypoints[tid] = kp;
      return;
    }

    // Shift integer position and iterate
    xi += i32(round(deltax));
    yi += i32(round(deltay));
    si  = u32(clamp(i32(si) + i32(round(deltas)), 1, i32(rp.scalesPerOctave)));

    if (xi < 1 || yi < 1 || xi >= W-1 || yi >= H-1) {
      kp.flags |= 2u; keypoints[tid] = kp; return;
    }
  }

  // Did not converge
  kp.flags |= 2u;
  keypoints[tid] = kp;
}
