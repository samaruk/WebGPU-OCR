
// DB differentiable binarization
struct Params { k: f32 }
@group(0) @binding(0) var<storage, read>       probMap : array<f32>;
@group(0) @binding(1) var<storage, read>       thrMap  : array<f32>;
@group(0) @binding(2) var<storage, read_write> binMap  : array<f32>;
@group(0) @binding(3) var<uniform>             params  : Params;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= arrayLength(&probMap)) { return; }
  let p = probMap[i]; let t = thrMap[i];
  // Differentiable binarization: sigmoid(k * (P - T))
  binMap[i] = 1.0 / (1.0 + exp(-params.k * (p - t)));
}
