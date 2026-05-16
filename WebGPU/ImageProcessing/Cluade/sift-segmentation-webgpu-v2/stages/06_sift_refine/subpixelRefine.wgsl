// subpixelRefine.wgsl — quadratic subpixel interpolation (Taylor expansion)

struct Uni {
  width  : u32,
  height : u32,
  count  : u32,
  sigma  : f32,
  octave : u32,
  layer  : u32,
  _p0    : u32,
  _p1    : u32
};

@group(0) @binding(0) var<uniform>            u      : Uni;
@group(0) @binding(1) var<storage,read>       dog_p  : array<f32>;
@group(0) @binding(2) var<storage,read>       dog_c  : array<f32>;
@group(0) @binding(3) var<storage,read>       dog_n  : array<f32>;
@group(0) @binding(4) var<storage,read>       kp_in  : array<u32>;
@group(0) @binding(5) var<storage,read_write> ctr    : atomic<u32>;
@group(0) @binding(6) var<storage,read_write> kp_out : array<vec4<f32>>; // x,y,sigma,resp

// layer: 0 = dog_p, 1 = dog_c, 2 = dog_n
fn at(layer: u32, x: i32, y: i32) -> f32 {
  let cx = clamp(x, 0, i32(u.width)  - 1);
  let cy = clamp(y, 0, i32(u.height) - 1);
  let idx = u32(cy) * u.width + u32(cx);

  switch(layer) {
    case 0u: { return dog_p[idx]; }
    case 1u: { return dog_c[idx]; }
    default: { return dog_n[idx]; }
  }
}

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {

  if (gid.x >= u.count) { return; }

  let pk = kp_in[gid.x];
  let xi = i32(pk >> 16u);
  let yi = i32(pk & 0xFFFFu);

  let v = at(1u, xi, yi);

  // First derivatives
  let dx = (at(1u, xi+1, yi) - at(1u, xi-1, yi)) * 0.5;
  let dy = (at(1u, xi, yi+1) - at(1u, xi, yi-1)) * 0.5;
  let ds = (at(2u, xi, yi)   - at(0u, xi, yi))   * 0.5;

  // Second derivatives
  let dxx = at(1u, xi+1, yi) - 2.0*v + at(1u, xi-1, yi);
  let dyy = at(1u, xi, yi+1) - 2.0*v + at(1u, xi, yi-1);
  let dss = at(2u, xi, yi)   - 2.0*v + at(0u, xi, yi);

  let dxy =
    (at(1u, xi+1, yi+1) - at(1u, xi-1, yi+1)
    -at(1u, xi+1, yi-1) + at(1u, xi-1, yi-1)) * 0.25;

  let dxs =
    (at(2u, xi+1, yi) - at(2u, xi-1, yi)
    -at(0u, xi+1, yi) + at(0u, xi-1, yi)) * 0.25;

  let dys =
    (at(2u, xi, yi+1) - at(2u, xi, yi-1)
    -at(0u, xi, yi+1) + at(0u, xi, yi-1)) * 0.25;

  // 3x3 Hessian determinant
  let det =
      dxx*dyy*dss
    + 2.0*dxy*dxs*dys
    - dxx*dys*dys
    - dyy*dxs*dxs
    - dss*dxy*dxy;

  if (abs(det) < 1e-10) { return; }

  // Solve offset using Cramer's rule
  let ox =
    -(dyy*dss - dys*dys) * dx
    -(dxs*dys - dxy*dss) * dy
    -(dxy*dys - dyy*dxs) * ds;

  let oy =
    -(dxs*dys - dxy*dss) * dx
    -(dxx*dss - dxs*dxs) * dy
    -(dxy*dxs - dxx*dys) * ds;

  let offx = ox / det;
  let offy = oy / det;

  if (abs(offx) > 0.5 || abs(offy) > 0.5) { return; }

  let slot = atomicAdd(&ctr, 1u);

  kp_out[slot] = vec4<f32>(
    f32(xi) + offx,
    f32(yi) + offy,
    u.sigma,
    abs(v)
  );
}