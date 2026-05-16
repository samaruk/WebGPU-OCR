// shaders/ccl_union.wgsl — Union-Find step for Connected Component Labeling
// Iteratively merges adjacent foreground pixel labels.
// Uses a parallel label propagation (pointer jumping) approach.

struct Uniforms {
  width: u32,
  height: u32,
  changed: atomic<u32>,  // set to 1 if any label was updated this iteration
  padding: u32,
}

@group(0) @binding(0) var<uniform> uBase: Uniforms;
@group(0) @binding(1) var<storage, read_write> labels: array<u32>;
@group(0) @binding(2) var<storage, read_write> changedFlag: array<atomic<u32>>;

// Find root with path compression (iterative)
fn findRoot(idx: u32) -> u32 {
  var cur = idx;
  var safety = 0u;
  loop {
    let parent = labels[cur];
    if (parent == 0u || parent == cur + 1u) { break; }
    // Path compression: point directly to grandparent
    let grandparent = labels[parent - 1u];
    if (grandparent != 0u && grandparent != parent) {
      labels[cur] = grandparent;
    }
    cur = parent - 1u;
    safety += 1u;
    if (safety > 64u) { break; }
  }
  return cur;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x;
  let y = gid.y;
  let w = uBase.width;
  let h = uBase.height;
  if (x >= w || y >= h) { return; }

  let idx = y * w + x;
  if (labels[idx] == 0u) { return; } // background

  let rootA = findRoot(idx);

  // Check 4-connected neighbors
  let neighbors = array<vec2<i32>, 4>(
    vec2<i32>(i32(x) - 1, i32(y)),
    vec2<i32>(i32(x) + 1, i32(y)),
    vec2<i32>(i32(x), i32(y) - 1),
    vec2<i32>(i32(x), i32(y) + 1),
  );

  for (var i = 0; i < 4; i++) {
    let nx = neighbors[i].x;
    let ny = neighbors[i].y;
    if (nx < 0 || ny < 0 || u32(nx) >= w || u32(ny) >= h) { continue; }

    let nidx = u32(ny) * w + u32(nx);
    if (labels[nidx] == 0u) { continue; } // neighbor is background

    let rootB = findRoot(nidx);

    if (rootA != rootB) {
      // Union: smaller root wins
      let minRoot = min(rootA, rootB);
      let maxRoot = max(rootA, rootB);
      labels[maxRoot] = minRoot + 1u;
      atomicStore(&changedFlag[0], 1u);
    }
  }
}
