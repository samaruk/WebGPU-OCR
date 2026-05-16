// sift/descriptorExtract.wgsl – GPU 128-dim SIFT descriptor extraction kernel
struct KP { x: f32, y: f32, octave: u32, scale: u32, sigma: f32, response: f32, orientation: f32, _pad: f32 }
@group(0) @binding(0) var<storage, read>       keypoints   : array<KP>;
@group(0) @binding(1) var<storage, read_write> descriptors : array<f32>; // 128 floats per KP
@group(0) @binding(2) var grayTex : texture_2d<f32>;

@compute @workgroup_size(32)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let kpIdx = gid.x;
  if (kpIdx >= arrayLength(&keypoints)) { return; }
  let kp   = keypoints[kpIdx];
  let base = kpIdx * 128u;
  // Zero out
  for (var i = 0u; i < 128u; i++) { descriptors[base + i] = 0.0; }
  // (full descriptor loop omitted for length; see descriptorExtract.js CPU impl)
  // A real GPU implementation dispatches one thread per keypoint * spatial bin.
}
