
struct Params { srcW: u32, srcH: u32 }
@group(0) @binding(0) var<storage, read>       input  : array<f32>;
@group(0) @binding(1) var<storage, read_write> output : array<f32>;
@group(0) @binding(2) var<uniform>             params : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dx = gid.x; let dy = gid.y;
  let dstW = params.srcW / 2u;
  let dstH = params.srcH / 2u;
  if (dx >= dstW || dy >= dstH) { return; }
  let sx = dx * 2u; let sy = dy * 2u;
  let v00 = input[sy*params.srcW+sx];
  let v01 = input[sy*params.srcW+sx+1u];
  let v10 = input[(sy+1u)*params.srcW+sx];
  let v11 = input[(sy+1u)*params.srcW+sx+1u];
  output[dy*dstW+dx] = (v00+v01+v10+v11) * 0.25;
}
