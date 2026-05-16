
struct Params { srcW: u32, srcH: u32, dstW: u32, dstH: u32, C: u32 }
@group(0) @binding(0) var<storage, read>       input  : array<f32>;
@group(0) @binding(1) var<storage, read_write> output : array<f32>;
@group(0) @binding(2) var<uniform>             params : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dx = gid.x; let dy = gid.y; let c = gid.z;
  if (dx >= params.dstW || dy >= params.dstH || c >= params.C) { return; }
  let sx = u32(f32(dx) * f32(params.srcW) / f32(params.dstW));
  let sy = u32(f32(dy) * f32(params.srcH) / f32(params.dstH));
  let si = (c*params.srcH + min(sy,params.srcH-1u))*params.srcW + min(sx,params.srcW-1u);
  output[(c*params.dstH+dy)*params.dstW+dx] = input[si];
}
