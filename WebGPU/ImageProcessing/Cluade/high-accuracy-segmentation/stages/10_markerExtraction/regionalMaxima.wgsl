// regionalMaxima.wgsl
struct Params { width: f32, height: f32, _p0: f32, _p1: f32 }
@group(0) @binding(0) var distTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> p: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let center = textureLoad(distTex, pos, 0).r;
  if (center <= 0.0) { textureStore(outputTex, pos, vec4<f32>(0.,0.,0.,1.)); return; }
  var isMax = true;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) { continue; }
      let sp = vec2<i32>(clamp(pos.x+dx,0,W-1), clamp(pos.y+dy,0,H-1));
      if (textureLoad(distTex, sp, 0).r > center) { isMax = false; }
    }
  }
  let v = select(0.0, 1.0, isMax);
  textureStore(outputTex, pos, vec4<f32>(v, v, v, 1.0));
}
