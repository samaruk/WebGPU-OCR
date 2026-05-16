// shaders/postprocess/finalMaskWrite.wgsl — Write kept labels to output RGBA texture

struct Uniforms { width:u32, height:u32, num_labels:u32, _pad:u32 };
@group(0) @binding(0) var<uniform>            u      : Uniforms;
@group(0) @binding(1) var<storage,read>       labels : array<u32>;
@group(0) @binding(2) var<storage,read>       keep   : array<u32>;
@group(0) @binding(3) var                     out_tex: texture_storage_2d<rgba8unorm, write>;

// Simple palette: encode label ID as colour
fn label_to_color(l: u32) -> vec4<f32> {
  if (l == 0u) { return vec4<f32>(0.0,0.0,0.0,1.0); }
  let r = f32((l * 7u)  & 0xFFu) / 255.0;
  let g = f32((l * 13u) & 0xFFu) / 255.0;
  let b = f32((l * 31u) & 0xFFu) / 255.0;
  return vec4<f32>(r, g, b, 1.0);
}

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x>=u.width||gid.y>=u.height) { return; }
  let idx = gid.y*u.width + gid.x;
  let l   = labels[idx];
  let col = select(vec4<f32>(0.0), label_to_color(l), l<u.num_labels && keep[l]!=0u);
  textureStore(out_tex, vec2<i32>(gid.xy), col);
}
