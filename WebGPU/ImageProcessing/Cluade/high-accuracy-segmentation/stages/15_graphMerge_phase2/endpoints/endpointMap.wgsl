// endpointMap.wgsl — detects skeleton endpoints
struct Params { width: f32, height: f32, _p0: f32, _p1: f32 }
@group(0) @binding(0) var skelTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> p: Params;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let x = i32(gid.x); let y = i32(gid.y);
  let c = textureLoad(skelTex, vec2<i32>(x, y), 0).r;
  if (c > 0.5) { textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(0.,0.,0.,1.)); return; }
  var nbCount = 0u;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (dx==0 && dy==0) { continue; }
      let sp = vec2<i32>(clamp(x+dx,0,W-1), clamp(y+dy,0,H-1));
      if (textureLoad(skelTex, sp, 0).r < 0.5) { nbCount++; }
    }
  }
  let isEndpoint = (nbCount == 1u);
  let v = select(0.0, 1.0, isEndpoint);
  textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(v,v,v,1.));
}
