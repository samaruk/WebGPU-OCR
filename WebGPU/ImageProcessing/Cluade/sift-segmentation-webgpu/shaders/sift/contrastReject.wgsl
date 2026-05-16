// shaders/sift/contrastReject.wgsl — Remove low-contrast keypoints

struct Uniforms {
  width     : u32,
  height    : u32,
  count     : u32,
  thresh    : f32,
};
@group(0) @binding(0) var<uniform>            u       : Uniforms;
@group(0) @binding(1) var<storage,read>       dog_cur : array<f32>;
@group(0) @binding(2) var<storage,read>       kp_in   : array<u32>;
@group(0) @binding(3) var<storage,read_write> counter : atomic<u32>;
@group(0) @binding(4) var<storage,read_write> kp_out  : array<u32>;

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.count) { return; }
  let packed = kp_in[gid.x];
  let x = packed >> 16u;
  let y = packed & 0xFFFFu;
  let v = abs(dog_cur[y * u.width + x]);
  if (v >= u.thresh) {
    let slot = atomicAdd(&counter, 1u);
    kp_out[slot] = packed;
  }
}
