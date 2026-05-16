// shaders/threshold.wgsl — Binarize pass (Otsu or fixed threshold)

struct Uniforms {
  width: u32,
  height: u32,
  threshold: u32,   // 0-255
  invert: u32,      // 0 = dark-on-light, 1 = light-on-dark
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var inputTex: texture_2d<f32>;
@group(0) @binding(2) var outputTex: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = i32(gid.x);
  let y = i32(gid.y);
  if (x >= i32(uniforms.width) || y >= i32(uniforms.height)) { return; }

  let pixel = textureLoad(inputTex, vec2<i32>(x, y), 0);
  let lum = dot(pixel.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let thresh = f32(uniforms.threshold) / 255.0;

  var binary: f32;
  if (uniforms.invert == 0u) {
    // Dark foreground on light background
    binary = select(1.0, 0.0, lum > thresh);
  } else {
    // Light foreground on dark background
    binary = select(0.0, 1.0, lum > thresh);
  }

  textureStore(outputTex, vec2<i32>(x, y), vec4<f32>(binary, binary, binary, 1.0));
}
