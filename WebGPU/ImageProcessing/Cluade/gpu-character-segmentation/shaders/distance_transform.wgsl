// shaders/distance_transform.wgsl
// Approximate Euclidean Distance Transform using chamfer distance.
// Pass 0: top-left to bottom-right sweep
// Pass 1: bottom-right to top-left sweep (done from JS with passIndex uniform)

struct Uniforms {
  width: u32,
  height: u32,
  passIndex: u32,   // 0 = forward pass, 1 = backward pass
  padding: u32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read_write> dist: array<f32>;
@group(0) @binding(2) var binaryTex: texture_2d<f32>;

const INF: f32 = 1e9;
// Chamfer 3-4 approximation weights
const D1: f32 = 3.0;  // horizontal/vertical
const D2: f32 = 4.0;  // diagonal

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = i32(gid.x);
  let y = i32(gid.y);
  let w = i32(uniforms.width);
  let h = i32(uniforms.height);
  if (x >= w || y >= h) { return; }

  let idx = u32(y) * uniforms.width + u32(x);

  // Initialize: foreground=INF, background=0
  let fg = textureLoad(binaryTex, vec2<i32>(x, y), 0).r > 0.5;
  if (!fg) {
    dist[idx] = 0.0;
    return;
  }

  var best = dist[idx];

  if (uniforms.passIndex == 0u) {
    // Forward pass: look at top-left neighbors
    let offsets = array<vec2<i32>, 4>(
      vec2<i32>(-1, -1),
      vec2<i32>( 0, -1),
      vec2<i32>( 1, -1),
      vec2<i32>(-1,  0),
    );
    let weights = array<f32, 4>(D2, D1, D2, D1);

    for (var i = 0; i < 4; i++) {
      let nx = x + offsets[i].x;
      let ny = y + offsets[i].y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) { continue; }
      let nd = dist[u32(ny) * uniforms.width + u32(nx)] + weights[i];
      best = min(best, nd);
    }
  } else {
    // Backward pass: look at bottom-right neighbors
    let offsets = array<vec2<i32>, 4>(
      vec2<i32>( 1,  1),
      vec2<i32>( 0,  1),
      vec2<i32>(-1,  1),
      vec2<i32>( 1,  0),
    );
    let weights = array<f32, 4>(D2, D1, D2, D1);

    for (var i = 0; i < 4; i++) {
      let nx = x + offsets[i].x;
      let ny = y + offsets[i].y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) { continue; }
      let nd = dist[u32(ny) * uniforms.width + u32(nx)] + weights[i];
      best = min(best, nd);
    }
  }

  dist[idx] = best;
}
