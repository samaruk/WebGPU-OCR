
// Sigmoid activation → probability map
@group(0) @binding(0) var<storage, read>       input  : array<f32>;
@group(0) @binding(1) var<storage, read_write> probMap: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= arrayLength(&input)) { return; }
  probMap[i] = 1.0 / (1.0 + exp(-input[i]));
}
