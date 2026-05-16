// shaders/sobel.wgsl — Sobel edge detection pass

struct Uniforms {
  width: u32,
  height: u32,
  threshold: u32,
  padding: u32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var inputTex: texture_2d<f32>;
@group(0) @binding(2) var outputTex: texture_storage_2d<rgba8unorm, write>;

fn luminance(c: vec4<f32>) -> f32 {
  return dot(c.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
}

fn sampleLum(x: i32, y: i32) -> f32 {
  let cx = clamp(x, 0, i32(uniforms.width) - 1);
  let cy = clamp(y, 0, i32(uniforms.height) - 1);
  return luminance(textureLoad(inputTex, vec2<i32>(cx, cy), 0));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = i32(gid.x);
  let y = i32(gid.y);
  if (x >= i32(uniforms.width) || y >= i32(uniforms.height)) { return; }

  // 3×3 Sobel kernels
  // Gx
  let gx =
    -1.0 * sampleLum(x-1, y-1) + 1.0 * sampleLum(x+1, y-1) +
    -2.0 * sampleLum(x-1, y  ) + 2.0 * sampleLum(x+1, y  ) +
    -1.0 * sampleLum(x-1, y+1) + 1.0 * sampleLum(x+1, y+1);

  // Gy
  let gy =
    -1.0 * sampleLum(x-1, y-1) - 2.0 * sampleLum(x, y-1) - 1.0 * sampleLum(x+1, y-1) +
     1.0 * sampleLum(x-1, y+1) + 2.0 * sampleLum(x, y+1) + 1.0 * sampleLum(x+1, y+1);

  let magnitude = sqrt(gx * gx + gy * gy);
  let thresh = f32(uniforms.threshold) / 255.0;
  let edge = select(0.0, 1.0, magnitude > thresh);

  textureStore(outputTex, vec2<i32>(x, y), vec4<f32>(edge, edge, edge, 1.0));
}
