// perspectiveCorrect.wgsl — applies 3x3 homography warp
struct Params { h: array<f32, 9>, width: f32, height: f32, _p0: f32, _p1: f32 }
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> p: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u32(p.width) || gid.y >= u32(p.height)) { return; }
  let x = f32(gid.x); let y = f32(gid.y);
  // Apply inverse homography H^-1 to find source pixel
  let h = p.h;
  let w_denom = h[6]*x + h[7]*y + h[8];
  let srcX = (h[0]*x + h[1]*y + h[2]) / w_denom;
  let srcY = (h[3]*x + h[4]*y + h[5]) / w_denom;
  let si = vec2<i32>(i32(srcX), i32(srcY));
  var color = vec4<f32>(1.0);
  if (si.x >= 0 && si.y >= 0 && si.x < i32(p.width) && si.y < i32(p.height)) {
    color = textureLoad(inputTex, si, 0);
  }
  textureStore(outputTex, vec2<i32>(gid.xy), color);
}
