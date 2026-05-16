
struct Params { W: u32, H: u32, blockH: u32, blockW: u32 }
@group(0) @binding(0) var<storage, read>       input  : array<f32>;
@group(0) @binding(1) var<storage, read_write> blocks : array<f32>;
@group(0) @binding(2) var<uniform>             params : Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let bx = gid.x; let by = gid.y;
  let nBX = params.W / params.blockW;
  let nBY = params.H / params.blockH;
  if (bx >= nBX || by >= nBY) { return; }
  var sum = 0.0; var cnt = 0.0;
  for (var ky = 0u; ky < params.blockH; ky++) {
    for (var kx = 0u; kx < params.blockW; kx++) {
      let px = bx*params.blockW+kx; let py = by*params.blockH+ky;
      if (px < params.W && py < params.H) {
        sum += input[py*params.W+px]; cnt += 1.0;
      }
    }
  }
  blocks[by*nBX+bx] = sum / max(cnt, 1.0);
}
