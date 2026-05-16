// strokeConsistencyFilter.wgsl
struct Params { width: f32, height: f32, mean_sw: f32, tolerance: f32, _p0: f32, _p1: f32, _p2: f32, _p3: f32 }
@group(0) @binding(0) var markerTex: texture_2d<f32>;
@group(0) @binding(1) var swtTex: texture_2d<f32>;
@group(0) @binding(2) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> p: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let isMarker = textureLoad(markerTex, pos, 0).r > 0.5;
  if (!isMarker) { textureStore(outputTex, pos, vec4<f32>(0.,0.,0.,1.)); return; }
  let r = 4;
  var swSum = 0.0; var swCount = 0.0;
  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      let sp = vec2<i32>(clamp(pos.x+dx,0,W-1), clamp(pos.y+dy,0,H-1));
      let sw = textureLoad(swtTex, sp, 0).r;
      if (sw > 0.0) { swSum += sw; swCount += 1.0; }
    }
  }
  var keep = 0.0;
  if (swCount > 0.0) {
    let localMean = swSum / swCount;
    if (abs(localMean - p.mean_sw) <= p.tolerance * 2.0) { keep = 1.0; }
  } else { keep = 1.0; } // no SWT data → keep by default
  textureStore(outputTex, pos, vec4<f32>(keep, keep, keep, 1.0));
}
