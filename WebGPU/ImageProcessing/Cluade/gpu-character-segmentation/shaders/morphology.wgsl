// shaders/morphology.wgsl — Binary morphological operations (dilate, erode, open, close)

struct Uniforms {
  width: u32,
  height: u32,
  kernelSize: u32,   // half-size (radius), e.g. 1 = 3×3 kernel
  operation: u32,    // 0=dilate, 1=erode, 2=open, 3=close
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var inputTex: texture_2d<f32>;
@group(0) @binding(2) var outputTex: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = i32(gid.x);
  let y = i32(gid.y);
  if (x >= i32(uniforms.width) || y >= i32(uniforms.height)) { return; }

  let r = i32(uniforms.kernelSize);
  let op = uniforms.operation;

  // Dilation: output = 1 if any neighbor is 1
  // Erosion:  output = 1 if ALL neighbors are 1
  var dilated = 0.0;
  var eroded = 1.0;

  for (var dy = -r; dy <= r; dy++) {
    for (var dx = -r; dx <= r; dx++) {
      let nx = clamp(x + dx, 0, i32(uniforms.width) - 1);
      let ny = clamp(y + dy, 0, i32(uniforms.height) - 1);
      let val = textureLoad(inputTex, vec2<i32>(nx, ny), 0).r;
      dilated = max(dilated, val);
      eroded = min(eroded, val);
    }
  }

  var result: f32;
  if (op == 0u) {
    result = dilated;        // dilate
  } else if (op == 1u) {
    result = eroded;         // erode
  } else if (op == 2u) {
    // Open = erode then dilate (handled in two passes from JS side)
    result = eroded;
  } else {
    // Close = dilate then erode (handled in two passes from JS side)
    result = dilated;
  }

  textureStore(outputTex, vec2<i32>(x, y), vec4<f32>(result, result, result, 1.0));
}
