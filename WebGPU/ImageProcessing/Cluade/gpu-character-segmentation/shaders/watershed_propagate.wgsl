// shaders/watershed_propagate.wgsl
// Propagate watershed labels outward from seeds into foreground pixels.

struct Uniforms {
  width: u32,
  height: u32,
  iteration: u32,
  padding: u32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read>       binaryLabels: array<u32>; // CCL labels (background=0)
@group(0) @binding(2) var<storage, read_write> wsLabels: array<u32>;    // watershed output
@group(0) @binding(3) var<storage, read_write> changedFlag: array<atomic<u32>>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = i32(gid.x);
  let y = i32(gid.y);
  let w = i32(uniforms.width);
  let h = i32(uniforms.height);
  if (x >= w || y >= h) { return; }

  let idx = u32(y) * uniforms.width + u32(x);

  // Only propagate into foreground pixels that are unlabeled
  if (binaryLabels[idx] == 0u) { return; } // background
  if (wsLabels[idx] != 0u) { return; }     // already labeled

  // Check 4-connected neighbors for a label to propagate from
  let neighbors = array<vec2<i32>, 4>(
    vec2<i32>(x - 1, y),
    vec2<i32>(x + 1, y),
    vec2<i32>(x, y - 1),
    vec2<i32>(x, y + 1),
  );

  var bestLabel = 0u;
  for (var i = 0; i < 4; i++) {
    let nx = neighbors[i].x;
    let ny = neighbors[i].y;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) { continue; }
    let nlabel = wsLabels[u32(ny) * uniforms.width + u32(nx)];
    if (nlabel != 0u) {
      bestLabel = nlabel;
      break;
    }
  }

  if (bestLabel != 0u) {
    wsLabels[idx] = bestLabel;
    atomicStore(&changedFlag[0], 1u);
  }
}
