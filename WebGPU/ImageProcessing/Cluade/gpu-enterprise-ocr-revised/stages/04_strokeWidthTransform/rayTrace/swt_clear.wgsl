// Fill swtBuf with 0xFFFFFFFF so atomicMin can write real values.
// Must run before swt_raytrace each frame.
@group(0) @binding(0) var<storage, read_write> swtBuf : array<u32>;
@group(0) @binding(1) var<uniform> u : vec4<u32>;  // x = pixel count

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.x) { return; }
  swtBuf[gid.x] = 0xFFFFFFFFu;
}
