// shaders/morph_vertical.wgsl — 1D vertical dilation

struct Params { width: u32, height: u32, kernel_half: u32, _pad: u32 }

@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var dst: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> p: Params;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let W = p.width; let H = p.height;
  if (gid.x >= W || gid.y >= H) { return; }
  let cx = i32(gid.x); let cy = i32(gid.y);
  let kh = i32(p.kernel_half);
  var maxV: f32 = 0.0;
  for (var dy: i32 = -kh; dy <= kh; dy++) {
    let ny = clamp(cy + dy, 0, i32(H) - 1);
    maxV = max(maxV, 1.0 - textureLoad(src, vec2<i32>(cx, ny), 0).r);
  }
  let v = 1.0 - maxV;
  textureStore(dst, vec2<i32>(gid.xy), vec4<f32>(v, v, v, 1.0));
}
