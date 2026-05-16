// shaders/watershed_seed.wgsl
// Find local maxima in distance transform as watershed seeds.
// A pixel is a seed if its distance value is >= threshold AND it's a local max in 3×3 neighborhood.

struct Uniforms {
  width: u32,
  height: u32,
  seedThreshold: f32, // min distance to be a seed
  padding: u32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read>       dist: array<f32>;
@group(0) @binding(2) var<storage, read_write> seeds: array<u32>; // 1=seed, 0=not
@group(0) @binding(3) var<storage, read_write> seedCount: array<atomic<u32>>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = i32(gid.x);
  let y = i32(gid.y);
  let w = i32(uniforms.width);
  let h = i32(uniforms.height);
  if (x >= w || y >= h) { return; }

  let idx = u32(y) * uniforms.width + u32(x);
  seeds[idx] = 0u;

  let centerDist = dist[idx];
  if (centerDist < uniforms.seedThreshold) { return; }

  // Check if local maximum in 3×3
  var isMax = true;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) { continue; }
      let nx = clamp(x + dx, 0, w - 1);
      let ny = clamp(y + dy, 0, h - 1);
      let nd = dist[u32(ny) * uniforms.width + u32(nx)];
      if (nd > centerDist) { isMax = false; }
    }
  }

  if (isMax) {
    seeds[idx] = 1u;
    atomicAdd(&seedCount[0], 1u);
  }
}
