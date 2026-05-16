// Detect watershed seeds: local maxima of the distance transform.
// Seeds are foreground pixels whose distance-to-background is a local maximum.
// These correspond to stroke center pixels (medial axis).
//
// Bindings: 3
//   0 = dist   array<f32>  distance values
//   1 = seeds  array<u32>  output seed labels
//   2 = u      uniform vec4<u32>  x=W, y=H, z=minDist*10 (as fixed-point)

@group(0) @binding(0) var<storage, read>       dist  : array<f32>;
@group(0) @binding(1) var<storage, read_write> seeds : array<u32>;
@group(0) @binding(2) var<uniform> u : vec4<u32>;

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = u.x; let H = u.y;
  if (gid.x >= W || gid.y >= H) { return; }
  let idx = gid.y * W + gid.x;
  let d   = dist[idx];

  // minDist stored as float threshold directly in u.z bits
  let minD = f32(u.z) * 0.1;  // u.z=5 → minD=0.5px (half a pixel from BG)

  if (d <= minD) { seeds[idx] = 0u; return; }

  // Check if local maximum in 3×3 neighbourhood
  var isMax = true;
  let x = i32(gid.x); let y = i32(gid.y);
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) { continue; }
      let nx = x+dx; let ny = y+dy;
      if (nx < 0 || ny < 0 || nx >= i32(W) || ny >= i32(H)) { continue; }
      if (dist[u32(ny)*W + u32(nx)] > d) { isMax = false; }
    }
  }
  seeds[idx] = select(0u, idx+1u, isMax);
}
