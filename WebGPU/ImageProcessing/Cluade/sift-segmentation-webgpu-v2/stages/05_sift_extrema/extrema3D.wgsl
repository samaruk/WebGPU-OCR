// extrema3D.wgsl — find local min/max in 3×3×3 DoG neighbourhood

struct Uni {
  width  : u32,
  height : u32,
  max_kp : u32,
  thresh : f32
};

@group(0) @binding(0) var<uniform>            u    : Uni;
@group(0) @binding(1) var<storage,read>       prev : array<f32>;
@group(0) @binding(2) var<storage,read>       cur  : array<f32>;
@group(0) @binding(3) var<storage,read>       next : array<f32>;
@group(0) @binding(4) var<storage,read_write> ctr  : atomic<u32>;
@group(0) @binding(5) var<storage,read_write> kpxy : array<u32>; // x<<16 | y

// layer: 0 = prev, 1 = cur, 2 = next
fn at(layer: u32, x: i32, y: i32) -> f32 {
  let cx = clamp(x, 0, i32(u.width)  - 1);
  let cy = clamp(y, 0, i32(u.height) - 1);
  let idx = u32(cy) * u.width + u32(cx);

  switch(layer) {
    case 0u: { return prev[idx]; }
    case 1u: { return cur[idx]; }
    default: { return next[idx]; }
  }
}

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {

  if (gid.x < 1u || gid.y < 1u ||
      gid.x >= u.width - 1u ||
      gid.y >= u.height - 1u) {
    return;
  }

  let x = i32(gid.x);
  let y = i32(gid.y);

  let v = at(1u, x, y); // current layer

  if (abs(v) < u.thresh) {
    return;
  }

  let isMax = v > 0.0;

  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {

      if (dx == 0 && dy == 0) { continue; }

      let vc = at(1u, x + dx, y + dy);
      let vp = at(0u, x + dx, y + dy);
      let vn = at(2u, x + dx, y + dy);

      if (isMax && (vc >= v || vp >= v || vn >= v)) { return; }
      if (!isMax && (vc <= v || vp <= v || vn <= v)) { return; }
    }
  }

  let vp0 = at(0u, x, y);
  let vn0 = at(2u, x, y);

  if (isMax && (vp0 >= v || vn0 >= v)) { return; }
  if (!isMax && (vp0 <= v || vn0 <= v)) { return; }

  let slot = atomicAdd(&ctr, 1u);

  if (slot < u.max_kp) {
    kpxy[slot] = (gid.x << 16u) | gid.y;
  }
}