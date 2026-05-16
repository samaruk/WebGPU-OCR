// holeFill.wgsl — flood fill from borders to identify true background, then fill holes
struct Params { width: f32, height: f32, _p0: f32, _p1: f32 }
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> p: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let v = textureLoad(inputTex, pos, 0).r;
  // Simple 1-iteration spread: if any 4-neighbor is background (1.0) and current is background,
  // propagate. Inverse-flood-fill requires iterating until convergence.
  // This simplified version just preserves foreground and fills small isolated background regions.
  var bgCount = 0;
  if (textureLoad(inputTex, vec2<i32>(clamp(pos.x-1,0,W-1), pos.y), 0).r > 0.5) { bgCount++; }
  if (textureLoad(inputTex, vec2<i32>(clamp(pos.x+1,0,W-1), pos.y), 0).r > 0.5) { bgCount++; }
  if (textureLoad(inputTex, vec2<i32>(pos.x, clamp(pos.y-1,0,H-1)), 0).r > 0.5) { bgCount++; }
  if (textureLoad(inputTex, vec2<i32>(pos.x, clamp(pos.y+1,0,H-1)), 0).r > 0.5) { bgCount++; }
  // If surrounded by foreground, fill
  let isBorderPx = (pos.x == 0 || pos.y == 0 || pos.x == W-1 || pos.y == H-1);
  var result = v;
  if (!isBorderPx && bgCount == 0 && v > 0.5) { result = 0.0; } // surrounded → fill
  textureStore(outputTex, pos, vec4<f32>(result, result, result, 1.0));
}
