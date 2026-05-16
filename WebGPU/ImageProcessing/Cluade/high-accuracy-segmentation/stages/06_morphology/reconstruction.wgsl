// reconstruction.wgsl — morphological erosion + reconstruction by dilation
struct Params { width: f32, height: f32, radius: f32, _pad: f32 }
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> p: Params;

@compute @workgroup_size(8, 8)
fn erode(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let r = i32(p.radius);
  var minVal = 1.0;
  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      let sp = vec2<i32>(clamp(pos.x+dx,0,W-1), clamp(pos.y+dy,0,H-1));
      minVal = min(minVal, textureLoad(inputTex, sp, 0).r);
    }
  }
  textureStore(outputTex, pos, vec4<f32>(minVal, minVal, minVal, 1.0));
}

@group(0) @binding(0) var seedTex: texture_2d<f32>;
@group(0) @binding(1) var maskTex: texture_2d<f32>;
@group(0) @binding(2) var reconOut: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> p2: Params;

@compute @workgroup_size(8, 8)
fn reconstruct(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p2.width); let H = i32(p2.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  // Dilation of seed
  var maxVal = 0.0;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let sp = vec2<i32>(clamp(pos.x+dx,0,W-1), clamp(pos.y+dy,0,H-1));
      maxVal = max(maxVal, textureLoad(seedTex, sp, 0).r);
    }
  }
  // Clip to mask
  let mask = textureLoad(maskTex, pos, 0).r;
  let result = min(maxVal, mask);
  textureStore(reconOut, pos, vec4<f32>(result, result, result, 1.0));
}
