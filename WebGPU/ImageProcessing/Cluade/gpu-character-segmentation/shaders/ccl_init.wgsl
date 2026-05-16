// shaders/ccl_init.wgsl — Initialize label buffer for Connected Component Labeling
// Each foreground pixel gets its own index as initial label.
// Background pixels get label 0 (reserved).

struct Uniforms {
  width: u32,
  height: u32,
  padding0: u32,
  padding1: u32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var binaryTex: texture_2d<f32>;
@group(0) @binding(2) var<storage, read_write> labels: array<u32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let x = gid.x;
  let y = gid.y;
  if (x >= uniforms.width || y >= uniforms.height) { return; }

  let idx = y * uniforms.width + x;
  let pixelVal = textureLoad(binaryTex, vec2<i32>(i32(x), i32(y)), 0).r;

  if (pixelVal > 0.5) {
    labels[idx] = idx + 1u; // 1-based labeling (0 = background)
  } else {
    labels[idx] = 0u; // background
  }
}
