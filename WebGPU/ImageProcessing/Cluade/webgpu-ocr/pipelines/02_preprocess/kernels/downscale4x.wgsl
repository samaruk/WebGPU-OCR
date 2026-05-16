
struct Params { srcW: u32, srcH: u32 }
@group(0) @binding(0) var<storage, read>       input  : array<f32>;
@group(0) @binding(1) var<storage, read_write> output : array<f32>;
@group(0) @binding(2) var<uniform>             params : Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let dx = gid.x; let dy = gid.y;
  let dstW = params.srcW / 4u; let dstH = params.srcH / 4u;
  if (dx >= dstW || dy >= dstH) { return; }
  var sum = 0.0;
  for (var ky = 0u; ky < 4u; ky++) {
    for (var kx = 0u; kx < 4u; kx++) {
      let sx = min(dx*4u+kx, params.srcW-1u);
      let sy = min(dy*4u+ky, params.srcH-1u);
      sum += input[sy*params.srcW+sx];
    }
  }
  output[dy*dstW+dx] = sum / 16.0;
}
