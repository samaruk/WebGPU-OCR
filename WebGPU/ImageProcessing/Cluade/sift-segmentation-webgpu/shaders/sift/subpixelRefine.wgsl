// shaders/sift/subpixelRefine.wgsl — 3D quadratic subpixel refinement (Taylor expansion)

struct Uniforms {
  width    : u32,
  height   : u32,
  count    : u32,
  sigma    : f32,
  octave   : u32,
  layer    : u32,
  _pad0    : u32,
  _pad1    : u32,
};
@group(0) @binding(0) var<uniform>            u       : Uniforms;
@group(0) @binding(1) var<storage,read>       dog_p   : array<f32>;
@group(0) @binding(2) var<storage,read>       dog_c   : array<f32>;
@group(0) @binding(3) var<storage,read>       dog_n   : array<f32>;
@group(0) @binding(4) var<storage,read>       kp_in   : array<u32>;
@group(0) @binding(5) var<storage,read_write> ctr     : atomic<u32>;
@group(0) @binding(6) var<storage,read_write> kp_out  : array<vec4<f32>>; // x,y,sigma,response

fn at(buf:ptr<storage,array<f32>,read>,x:i32,y:i32)->f32{
  let cx=clamp(x,0,i32(u.width)-1); let cy=clamp(y,0,i32(u.height)-1);
  return (*buf)[u32(cy*i32(u.width)+cx)];
}

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.count) { return; }
  let packed = kp_in[gid.x];
  let xi = i32(packed >> 16u);
  let yi = i32(packed & 0xFFFFu);

  let v   = at(&dog_c, xi, yi);
  // First-order derivatives
  let dx  = (at(&dog_c,xi+1,yi)   - at(&dog_c,xi-1,yi))   * 0.5;
  let dy  = (at(&dog_c,xi,yi+1)   - at(&dog_c,xi,yi-1))   * 0.5;
  let ds  = (at(&dog_n,xi,yi)     - at(&dog_p,xi,yi))      * 0.5;
  // Second-order
  let dxx = at(&dog_c,xi+1,yi)   - 2.0*v + at(&dog_c,xi-1,yi);
  let dyy = at(&dog_c,xi,yi+1)   - 2.0*v + at(&dog_c,xi,yi-1);
  let dss = at(&dog_n,xi,yi)     - 2.0*v + at(&dog_p,xi,yi);
  let dxy = (at(&dog_c,xi+1,yi+1)-at(&dog_c,xi-1,yi+1)-at(&dog_c,xi+1,yi-1)+at(&dog_c,xi-1,yi-1))*0.25;
  let dxs = (at(&dog_n,xi+1,yi)  -at(&dog_n,xi-1,yi)  -at(&dog_p,xi+1,yi)  +at(&dog_p,xi-1,yi))  *0.25;
  let dys = (at(&dog_n,xi,yi+1)  -at(&dog_n,xi,yi-1)  -at(&dog_p,xi,yi+1)  +at(&dog_p,xi,yi-1))  *0.25;

  // Solve H * offset = -grad  (approximate with diagonal for stability)
  let det = dxx*dyy*dss + 2.0*dxy*dxs*dys
           - dxx*dys*dys - dyy*dxs*dxs - dss*dxy*dxy;
  if (abs(det) < 1e-10) { return; }
  let ox = -(dyy*dss - dys*dys)*dx - (dxs*dys - dxy*dss)*dy - (dxy*dys - dyy*dxs)*ds;
  let oy = -(dxs*dys - dxy*dss)*dx - (dxx*dss - dxs*dxs)*dy - (dxy*dxs - dxx*dys)*ds;

  if (abs(ox/det) > 0.5 || abs(oy/det) > 0.5) { return; }

  let fx   = f32(xi) + ox / det;
  let fy   = f32(yi) + oy / det;
  let resp = abs(v);
  let slot = atomicAdd(&ctr, 1u);
  kp_out[slot] = vec4<f32>(fx, fy, u.sigma, resp);
}
