
struct Params { S: u32, inD: u32, outD: u32 }
@group(0) @binding(0) var<storage, read>       x   : array<f32>;
@group(0) @binding(1) var<storage, read>       W   : array<f32>;
@group(0) @binding(2) var<storage, read>       b   : array<f32>;
@group(0) @binding(3) var<storage, read_write> out : array<f32>;
@group(0) @binding(4) var<uniform>             params: Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let s = gid.x; let o = gid.y;
  if (s >= params.S || o >= params.outD) { return; }
  var sum = b[o];
  for (var d = 0u; d < params.inD; d++) { sum += x[s*params.inD+d] * W[d*params.outD+o]; }
  out[s*params.outD+o] = sum;
}
