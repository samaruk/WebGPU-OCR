
struct Params { N: u32, indent: f32 }
@group(0) @binding(0) var<storage, read>       bboxes  : array<f32>;
@group(0) @binding(1) var<storage, read_write> isList  : array<u32>;
@group(0) @binding(2) var<uniform>             params  : Params;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let n = gid.x; if (n >= params.N) { return; }
  let x0 = bboxes[n*4u];
  // Consistent left indent → likely a list item
  isList[n] = select(0u, 1u, x0 > params.indent && x0 < params.indent * 3.0);
}
