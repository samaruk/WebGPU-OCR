// shaders/sift/hessianReject.wgsl — Edge rejection via Hessian ratio (Brown & Lowe)

struct Uniforms {
  width      : u32,
  height     : u32,
  count      : u32,
  edge_thresh: f32,  // typically 10.0 → ratio = (r+1)^2/r = 12.1
};
@group(0) @binding(0) var<uniform>            u      : Uniforms;
@group(0) @binding(1) var<storage,read>       dog    : array<f32>;
@group(0) @binding(2) var<storage,read>       kp_in  : array<u32>;
@group(0) @binding(3) var<storage,read_write> ctr    : atomic<u32>;
@group(0) @binding(4) var<storage,read_write> kp_out : array<u32>;

fn d(x:i32,y:i32)->f32{
  let cx=clamp(x,0,i32(u.width)-1); let cy=clamp(y,0,i32(u.height)-1);
  return dog[u32(cy*i32(u.width)+cx)];
}

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.count) { return; }
  let packed = kp_in[gid.x];
  let x = i32(packed >> 16u);
  let y = i32(packed & 0xFFFFu);
  let dxx = d(x+1,y) - 2.0*d(x,y) + d(x-1,y);
  let dyy = d(x,y+1) - 2.0*d(x,y) + d(x,y-1);
  let dxy = (d(x+1,y+1) - d(x-1,y+1) - d(x+1,y-1) + d(x-1,y-1)) * 0.25;
  let tr  = dxx + dyy;
  let det = dxx * dyy - dxy * dxy;
  let r   = u.edge_thresh;
  let thr = (r + 1.0) * (r + 1.0) / r;
  if (det <= 0.0 || (tr * tr / det) >= thr) { return; }
  let slot = atomicAdd(&ctr, 1u);
  kp_out[slot] = packed;
}
