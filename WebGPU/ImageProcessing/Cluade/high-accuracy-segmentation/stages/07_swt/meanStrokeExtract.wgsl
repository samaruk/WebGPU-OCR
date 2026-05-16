// meanStrokeExtract.wgsl
// GPU histogram reduction of SWT values → mean and variance.
struct Params { width: u32, height: u32, max_val: f32, _pad: f32 }
@group(0) @binding(0) var swtTex: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> histogram: array<atomic<u32>>; // 256 bins
@group(0) @binding(2) var<uniform> p: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= p.width || gid.y >= p.height) { return; }
  let sw = textureLoad(swtTex, vec2<i32>(gid.xy), 0).r;
  if (sw > 0.5 && sw < p.max_val) {
    let bin = u32(clamp(sw / p.max_val * 255.0, 0.0, 255.0));
    atomicAdd(&histogram[bin], 1u);
  }
}
