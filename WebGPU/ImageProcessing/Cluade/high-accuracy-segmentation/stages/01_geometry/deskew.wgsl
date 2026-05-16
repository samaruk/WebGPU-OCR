// deskew.wgsl — rotates input texture around its center
struct Params { angle_rad: f32, width: f32, height: f32, _pad: f32 }
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> p: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = f32(gid.x); let y = f32(gid.y);
  if (gid.x >= u32(p.width) || gid.y >= u32(p.height)) { return; }
  let cx = p.width * 0.5; let cy = p.height * 0.5;
  let dx = x - cx; let dy = y - cy;
  let cos_a = cos(-p.angle_rad); let sin_a = sin(-p.angle_rad);
  let srcX = dx * cos_a - dy * sin_a + cx;
  let srcY = dx * sin_a + dy * cos_a + cy;
  let si = vec2<i32>(i32(srcX), i32(srcY));
  var color = vec4<f32>(1.0);
  if (si.x >= 0 && si.y >= 0 && si.x < i32(p.width) && si.y < i32(p.height)) {
    color = textureLoad(inputTex, si, 0);
  }
  textureStore(outputTex, vec2<i32>(gid.xy), color);
}
