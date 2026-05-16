// stroke/strokeWidthTransform.wgsl – GPU ray-marching SWT (reference / partial)
struct Uniforms { width: u32, height: u32, maxStroke: u32, _pad: u32 }
@group(0) @binding(0) var<uniform> u       : Uniforms;
@group(0) @binding(1) var edgeTex  : texture_2d<f32>;
@group(0) @binding(2) var dirTex   : texture_2d<f32>;
@group(0) @binding(3) var<storage, read_write> swtBuf : array<f32>;

@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  let p = vec2<i32>(gid.xy);
  if (textureLoad(edgeTex, p, 0).r < 0.5) { swtBuf[gid.y * u.width + gid.x] = 0.0; return; }
  let theta = textureLoad(dirTex, p, 0).r;
  let cos0 = cos(theta); let sin0 = sin(theta);
  var width = 0.0;
  for (var t = 1u; t <= u.maxStroke; t++) {
    let nx = i32(round(f32(p.x) + cos0 * f32(t)));
    let ny = i32(round(f32(p.y) + sin0 * f32(t)));
    if (nx < 0 || ny < 0 || nx >= i32(u.width) || ny >= i32(u.height)) { break; }
    if (textureLoad(edgeTex, vec2<i32>(nx, ny), 0).r >= 0.5) {
      let oppTheta = textureLoad(dirTex, vec2<i32>(nx, ny), 0).r;
      let diff = abs(3.14159265 - abs(theta - oppTheta));
      if (diff < 3.14159265 / 6.0) { width = f32(t); }
      break;
    }
  }
  swtBuf[gid.y * u.width + gid.x] = width;
}
