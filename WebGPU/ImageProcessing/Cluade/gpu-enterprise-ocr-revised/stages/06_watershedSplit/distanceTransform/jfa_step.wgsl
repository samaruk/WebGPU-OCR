
// JFA step: flood-fill seeds at a given offset.
// Reads seedXIn[]/seedYIn[], writes seedXOut[]/seedYOut[].
//
// Bindings: 6
//   0 = seedXIn   array<u32> read
//   1 = seedYIn   array<u32> read
//   2 = seedXOut  array<u32> read_write
//   3 = seedYOut  array<u32> read_write
//   4 = dims      uniform vec4<u32>  x=W, y=H, z=step

@group(0) @binding(0) var<storage, read>       seedXIn  : array<u32>;
@group(0) @binding(1) var<storage, read>       seedYIn  : array<u32>;
@group(0) @binding(2) var<storage, read_write> seedXOut : array<u32>;
@group(0) @binding(3) var<storage, read_write> seedYOut : array<u32>;
@group(0) @binding(4) var<uniform> dims : vec4<u32>;

const EMPTY : u32 = 0xFFFFFFFFu;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W    = i32(dims.x); let H = i32(dims.y);
  let step = i32(dims.z);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }

  let idx  = u32(gid.y) * dims.x + gid.x;
  let cx   = f32(gid.x); let cy = f32(gid.y);

  var bx   = seedXIn[idx];
  var by_  = seedYIn[idx];
  var bDist = select(1e30f,
    distSq(cx, cy, f32(bx), f32(by_)),
    bx != EMPTY);

  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) { continue; }
      let nx = i32(gid.x) + dx * step;
      let ny = i32(gid.y) + dy * step;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) { continue; }
      let ni  = u32(ny) * dims.x + u32(nx);
      let nsx = seedXIn[ni];
      let nsy = seedYIn[ni];
      if (nsx == EMPTY) { continue; }
      let d = distSq(cx, cy, f32(nsx), f32(nsy));
      if (d < bDist) { bDist = d; bx = nsx; by_ = nsy; }
    }
  }

  seedXOut[idx] = bx;
  seedYOut[idx] = by_;
}

fn distSq(ax: f32, ay: f32, bx: f32, by_: f32) -> f32 {
  let dx = ax - bx; let dy = ay - by_;
  return dx*dx + dy*dy;
}
