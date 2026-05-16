
struct Params { width: u32, height: u32 }
@group(0) @binding(0) var<storage, read>       gx   : array<f32>;
@group(0) @binding(1) var<storage, read>       gy   : array<f32>;
@group(0) @binding(2) var<storage, read_write> mag  : array<f32>;
@group(0) @binding(3) var<storage, read_write> ang  : array<f32>;
@group(0) @binding(4) var<uniform>             params: Params;

const PI = 3.14159265358979;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.y * params.width + gid.x;
  if (gid.x >= params.width || gid.y >= params.height) { return; }
  let gxv = gx[i]; let gyv = gy[i];
  mag[i] = sqrt(gxv*gxv + gyv*gyv);
  ang[i] = atan2(gyv, gxv) + PI;   // [0, 2π]
}
