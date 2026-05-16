// shaders/jfa_pass.wgsl — One pass of Jump Flooding Algorithm

struct Params { width: u32, height: u32, step: u32, _pad: u32 }

@group(0) @binding(0) var seed_in:  texture_2d<u32>;
@group(0) @binding(1) var seed_out: texture_storage_2d<rgba16uint, write>;
@group(0) @binding(2) var<uniform> p: Params;

const SENTINEL: u32 = 0xFFFFu;

fn dist2(ax: u32, ay: u32, bx: u32, by: u32) -> u32 {
  let dx = i32(ax) - i32(bx);
  let dy = i32(ay) - i32(by);
  return u32(dx * dx + dy * dy);
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = p.width; let H = p.height;
  if (gid.x >= W || gid.y >= H) { return; }

  let cx = i32(gid.x); let cy = i32(gid.y);
  let step = i32(p.step);

  var best_seed = textureLoad(seed_in, vec2<i32>(cx, cy), 0).xy;
  var best_dist: u32 = 0xFFFFFFFFu;
  if (best_seed.x != SENTINEL) {
    best_dist = dist2(gid.x, gid.y, best_seed.x, best_seed.y);
  }

  for (var dy: i32 = -1; dy <= 1; dy++) {
    for (var dx: i32 = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) { continue; }
      let nx = cx + dx * step;
      let ny = cy + dy * step;
      if (nx < 0 || ny < 0 || nx >= i32(W) || ny >= i32(H)) { continue; }
      let ns = textureLoad(seed_in, vec2<i32>(nx, ny), 0).xy;
      if (ns.x == SENTINEL) { continue; }
      let d = dist2(gid.x, gid.y, ns.x, ns.y);
      if (d < best_dist) { best_dist = d; best_seed = ns; }
    }
  }

  if (best_seed.x == SENTINEL) {
    textureStore(seed_out, vec2<i32>(gid.xy), vec4<u32>(SENTINEL, SENTINEL, 0u, 0u));
  } else {
    textureStore(seed_out, vec2<i32>(gid.xy), vec4<u32>(best_seed.x, best_seed.y, 0u, 0u));
  }
}
