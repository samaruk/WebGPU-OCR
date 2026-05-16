// adjacencyGraph_phase2.wgsl — same as phase 1 but used with strict thresholds
struct Params { width: u32, height: u32, max_gap: f32, _pad: f32 }
@group(0) @binding(0) var labelTex: texture_2d<u32>;
@group(0) @binding(1) var<storage, read_write> adjacency: array<atomic<u32>>;
@group(0) @binding(2) var<uniform> p: Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.width || gid.y >= p.height) { return; }
  let pos = vec2<i32>(gid.xy);
  let label = textureLoad(labelTex, pos, 0).r;
  if (label == 0u) { return; }
  let r = i32(p.max_gap);
  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      if (dx == 0 && dy == 0) { continue; }
      let sp = vec2<i32>(clamp(pos.x+dx,0,i32(p.width)-1), clamp(pos.y+dy,0,i32(p.height)-1));
      let nl = textureLoad(labelTex, sp, 0).r;
      if (nl > 0u && nl != label) {
        let pairIdx = (min(label, nl) - 1u) * 65536u + (max(label, nl) - 1u);
        if (pairIdx < arrayLength(&adjacency)) {
          let dist = u32(sqrt(f32(dx*dx + dy*dy)));
          atomicMin(&adjacency[pairIdx], dist);
        }
      }
    }
  }
}
