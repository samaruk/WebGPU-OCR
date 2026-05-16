// shaders/ccl_flatten.wgsl — Flatten label tree so all pixels point to their root

struct Uniforms {
  width: u32,
  height: u32,
  padding0: u32,
  padding1: u32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> labels: array<u32>;

fn findRoot(startIdx: u32) -> u32 {
  var cur = startIdx;
  var safety = 0u;
  loop {
    let label = labels[cur];
    if (label == 0u || label == cur + 1u) { break; }
    cur = label - 1u;
    safety += 1u;
    if (safety > 128u) { break; }
  }
  return cur;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x;
  let y = gid.y;
  if (x >= uniforms.width || y >= uniforms.height) { return; }

  let idx = y * uniforms.width + x;
  if (labels[idx] == 0u) { return; } // background

  // Point directly to canonical root (1-indexed)
  let root = findRoot(idx);
  labels[idx] = root + 1u;
}
