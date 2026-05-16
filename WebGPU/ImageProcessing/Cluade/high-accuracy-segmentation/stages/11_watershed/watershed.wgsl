// watershed.wgsl — marker-controlled flooding
struct Params { width: f32, height: f32, _p0: f32, _p1: f32 }
@group(0) @binding(0) var distTex: texture_2d<f32>;
@group(0) @binding(1) var markerTex: texture_2d<f32>;
@group(0) @binding(2) var binaryTex: texture_2d<f32>;
@group(0) @binding(3) var labelOut: texture_storage_2d<r32uint, write>;
@group(0) @binding(4) var<uniform> p: Params;

@compute @workgroup_size(8, 8)
fn flood(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let isFg = textureLoad(binaryTex, pos, 0).r < 0.5;
  if (!isFg) { textureStore(labelOut, pos, vec4<u32>(0u,0u,0u,0u)); return; }
  // Assign label from highest-distance neighbor (uphill propagation)
  var bestDist = textureLoad(distTex, pos, 0).r;
  var bestLabel = u32(gid.y * u32(W) + gid.x + 1u); // unique seed
  let isMarker = textureLoad(markerTex, pos, 0).r > 0.5;
  if (isMarker) {
    textureStore(labelOut, pos, vec4<u32>(bestLabel, 0u, 0u, 0u));
    return;
  }
  // Propagate from neighbors with higher distance
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) { continue; }
      let sp = vec2<i32>(clamp(pos.x+dx,0,W-1), clamp(pos.y+dy,0,H-1));
      let nd = textureLoad(distTex, sp, 0).r;
      if (nd > bestDist) { bestDist = nd; bestLabel = u32(sp.y * W + sp.x + 1); }
    }
  }
  textureStore(labelOut, pos, vec4<u32>(bestLabel, 0u, 0u, 0u));
}
