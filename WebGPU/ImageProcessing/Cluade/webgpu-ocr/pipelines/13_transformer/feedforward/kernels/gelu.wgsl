
@group(0) @binding(0) var<storage, read_write> x : array<f32>;
const SQRT2OVERPI = 0.7978845608028654;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= arrayLength(&x)) { return; }
  let v = x[i];
  x[i] = 0.5 * v * (1.0 + tanh(SQRT2OVERPI * (v + 0.044715 * v * v * v)));
}
