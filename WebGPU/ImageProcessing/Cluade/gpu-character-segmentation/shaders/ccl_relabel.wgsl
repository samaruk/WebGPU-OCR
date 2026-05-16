// shaders/ccl_relabel.wgsl
// Assign compact sequential labels 1..N using a pre-built remap table.
// Input:  labels[] with sparse root indices
// Input:  remap[]  where remap[rootIdx] = compactLabel (1-based)
// Output: labels[] overwritten with compact labels

struct Uniforms {
  width: u32,
  height: u32,
  numComponents: u32,
  padding: u32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> labels: array<u32>;
@group(0) @binding(2) var<storage, read>       remap: array<u32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x;
  let y = gid.y;
  if (x >= uniforms.width || y >= uniforms.height) { return; }

  let idx = y * uniforms.width + x;
  let label = labels[idx];
  if (label == 0u) { return; } // background stays 0

  let rootIdx = label - 1u;
  let compact = remap[rootIdx];
  labels[idx] = compact;
}
