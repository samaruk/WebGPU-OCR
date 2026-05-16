// widthGateFilter.wgsl
// Merges original and line-removed image based on local run-length (stroke width estimate).
// Pixels in narrow runs (< gateWidth) are restored from original → text strokes protected.
struct Params { width: f32, height: f32, gate_width: f32, _pad: f32 }
@group(0) @binding(0) var originalTex: texture_2d<f32>;
@group(0) @binding(1) var processedTex: texture_2d<f32>;
@group(0) @binding(2) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> p: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = i32(p.width); let H = i32(p.height);
  if (i32(gid.x) >= W || i32(gid.y) >= H) { return; }
  let pos = vec2<i32>(gid.xy);
  let origVal  = textureLoad(originalTex, pos, 0);
  let procVal  = textureLoad(processedTex, pos, 0);
  // Measure vertical run length at this column
  let gray = dot(origVal.rgb, vec3<f32>(0.2126,0.7152,0.0722));
  var run = 0;
  if (gray < 0.5) {
    var up = 1; var dn = 1;
    loop { if (up > 50 || pos.y - up < 0) { break; }
      if (dot(textureLoad(originalTex, vec2<i32>(pos.x, pos.y - up), 0).rgb, vec3<f32>(0.2126,0.7152,0.0722)) >= 0.5) { break; }
      up++; }
    loop { if (dn > 50 || pos.y + dn >= H) { break; }
      if (dot(textureLoad(originalTex, vec2<i32>(pos.x, pos.y + dn), 0).rgb, vec3<f32>(0.2126,0.7152,0.0722)) >= 0.5) { break; }
      dn++; }
    run = up + dn - 1;
  }
  // Restore original if run is narrow (text stroke)
  if (f32(run) < p.gate_width && run > 0) {
    textureStore(outputTex, pos, origVal);
  } else {
    textureStore(outputTex, pos, procVal);
  }
}
