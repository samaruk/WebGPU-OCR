// peakProminence.wgsl
struct Params { width: f32, height: f32, min_prominence: f32, _pad: f32 }
@group(0) @binding(0) var maxTex: texture_2d<f32>;
@group(0) @binding(1) var distTex: texture_2d<f32>;
@group(0) @binding(2) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> p: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let isMax = textureLoad(maxTex, pos, 0).r > 0.5;
  if (!isMax) { textureStore(outputTex, pos, vec4<f32>(0.,0.,0.,1.)); return; }
  let peakVal = textureLoad(distTex, pos, 0).r;
  // Find minimum distance value in neighborhood (saddle point approximation)
  let r = 8;
  var saddleMin = peakVal;
  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      let sp = vec2<i32>(clamp(pos.x+dx,0,W-1), clamp(pos.y+dy,0,H-1));
      saddleMin = min(saddleMin, textureLoad(distTex, sp, 0).r);
    }
  }
  let prominence = peakVal - saddleMin;
  let keep = select(0.0, 1.0, prominence >= p.min_prominence);
  textureStore(outputTex, pos, vec4<f32>(keep, keep, keep, 1.0));
}
