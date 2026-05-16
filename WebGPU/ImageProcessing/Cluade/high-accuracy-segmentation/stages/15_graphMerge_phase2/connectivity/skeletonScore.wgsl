// skeletonScore.wgsl
struct Params { width: f32, height: f32, connect_radius: f32, _pad: f32 }
@group(0) @binding(0) var endpointTex: texture_2d<f32>;
@group(0) @binding(1) var labelTex: texture_2d<u32>;
@group(0) @binding(2) var<storage, read_write> score: array<atomic<u32>>;
@group(0) @binding(3) var<uniform> p: Params;
@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  if (textureLoad(endpointTex, pos, 0).r < 0.5) { return; }
  let myLabel = textureLoad(labelTex, pos, 0).r;
  let r = i32(p.connect_radius);
  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      let sp = vec2<i32>(clamp(pos.x+dx,0,W-1), clamp(pos.y+dy,0,H-1));
      if (textureLoad(endpointTex, sp, 0).r > 0.5) {
        let nl = textureLoad(labelTex, sp, 0).r;
        if (nl != myLabel && nl > 0u) { atomicAdd(&score[0], 1u); }
      }
    }
  }
}
