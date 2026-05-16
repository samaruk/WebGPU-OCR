
struct Params { srcW: u32, srcH: u32, dstW: u32, dstH: u32, C: u32 }
@group(0) @binding(0) var<storage, read>       src    : array<f32>;  // [C,H,W]
@group(0) @binding(1) var<storage, read>       grid   : array<f32>;  // [dstH,dstW,2] in [-1,1]
@group(0) @binding(2) var<storage, read_write> dst    : array<f32>;  // [C,dstH,dstW]
@group(0) @binding(3) var<uniform>             params : Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dx = gid.x; let dy = gid.y;
  if (dx >= params.dstW || dy >= params.dstH) { return; }
  let gi = (dy * params.dstW + dx) * 2u;
  let gx = (grid[gi  ] + 1.0) * 0.5 * f32(params.srcW - 1u);
  let gy = (grid[gi+1u] + 1.0) * 0.5 * f32(params.srcH - 1u);
  let sx0 = u32(clamp(floor(gx), 0.0, f32(params.srcW-1u)));
  let sy0 = u32(clamp(floor(gy), 0.0, f32(params.srcH-1u)));
  let sx1 = min(sx0+1u, params.srcW-1u); let sy1 = min(sy0+1u, params.srcH-1u);
  let wx = gx - floor(gx); let wy = gy - floor(gy);
  for (var c = 0u; c < params.C; c++) {
    let v00 = src[(c*params.srcH+sy0)*params.srcW+sx0];
    let v01 = src[(c*params.srcH+sy0)*params.srcW+sx1];
    let v10 = src[(c*params.srcH+sy1)*params.srcW+sx0];
    let v11 = src[(c*params.srcH+sy1)*params.srcW+sx1];
    dst[(c*params.dstH+dy)*params.dstW+dx] = mix(mix(v00,v01,wx), mix(v10,v11,wx), wy);
  }
}
