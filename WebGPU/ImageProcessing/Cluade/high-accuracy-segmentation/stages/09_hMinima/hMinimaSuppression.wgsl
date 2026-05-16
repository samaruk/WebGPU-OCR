// hMinimaSuppression.wgsl
// Adds h to the distance map, then propagates local minima suppression.
// One pass of reconstruction by erosion under the raised mask.
struct Params { width: f32, height: f32, h: f32, _pad: f32 }
@group(0) @binding(0) var distTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<r32float, write>;
@group(0) @binding(2) var<uniform> p: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let center = textureLoad(distTex, pos, 0).r;
  if (center <= 0.0) { textureStore(outputTex, pos, vec4<f32>(0.,0.,0.,0.)); return; }
  // Raise the distance map by h, then take element-wise min with original
  // This suppresses minima shallower than h
  let raised = center + p.h;
  var nbMin = raised;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) { continue; }
      let sp = vec2<i32>(clamp(pos.x+dx,0,W-1), clamp(pos.y+dy,0,H-1));
      let nv = textureLoad(distTex, sp, 0).r + p.h;
      nbMin = min(nbMin, nv);
    }
  }
  let suppressed = min(raised, max(center, nbMin - p.h));
  textureStore(outputTex, pos, vec4<f32>(suppressed, 0., 0., 0.));
}
