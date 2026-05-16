
// Average multi-scale feature maps (all same size)
struct Params { N: u32 }
@group(0) @binding(0) var<storage, read>       inputs : array<f32>;  // [N * size]
@group(0) @binding(1) var<storage, read_write> output : array<f32>;  // [size]
@group(0) @binding(2) var<uniform>             params : Params;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  let size = arrayLength(&output);
  if (i >= size) { return; }
  var sum = 0.0;
  for (var n = 0u; n < params.N; n++) { sum += inputs[n*size+i]; }
  output[i] = sum / f32(params.N);
}
