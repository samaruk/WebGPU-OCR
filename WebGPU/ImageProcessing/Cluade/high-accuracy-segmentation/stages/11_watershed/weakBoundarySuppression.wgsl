// weakBoundarySuppression.wgsl
struct Params { width: f32, height: f32, grad_min: f32, _pad: f32 }
@group(0) @binding(0) var labelTex: texture_2d<u32>;
@group(0) @binding(1) var grayTex: texture_2d<f32>;
@group(0) @binding(2) var outputTex: texture_storage_2d<r32uint, write>;
@group(0) @binding(3) var<uniform> p: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let label = textureLoad(labelTex, pos, 0).r;
  // At boundaries: check gradient in original image
  var maxNeighborLabel = label;
  var maxNeighborDist = 0.0;
  var isBoundary = false;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) { continue; }
      let sp = vec2<i32>(clamp(pos.x+dx,0,W-1), clamp(pos.y+dy,0,H-1));
      let nl = textureLoad(labelTex, sp, 0).r;
      if (nl != label) { isBoundary = true; }
    }
  }
  if (!isBoundary) { textureStore(outputTex, pos, vec4<u32>(label,0u,0u,0u)); return; }
  // Measure gradient
  let gx = textureLoad(grayTex, vec2<i32>(clamp(pos.x+1,0,W-1),pos.y),0).r
           - textureLoad(grayTex, vec2<i32>(clamp(pos.x-1,0,W-1),pos.y),0).r;
  let gy = textureLoad(grayTex, vec2<i32>(pos.x,clamp(pos.y+1,0,H-1)),0).r
           - textureLoad(grayTex, vec2<i32>(pos.x,clamp(pos.y-1,0,H-1)),0).r;
  let grad = length(vec2<f32>(gx, gy));
  var outLabel = label;
  if (grad < p.grad_min) {
    // Absorb into the neighbor with most common label
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        let sp = vec2<i32>(clamp(pos.x+dx,0,W-1), clamp(pos.y+dy,0,H-1));
        let nl = textureLoad(labelTex, sp, 0).r;
        if (nl > outLabel) { outLabel = nl; }
      }
    }
  }
  textureStore(outputTex, pos, vec4<u32>(outLabel,0u,0u,0u));
}
