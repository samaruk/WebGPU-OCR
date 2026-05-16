// shaders/fusion/confidenceScore.wgsl — Per-pixel confidence combining multiple cues

struct Uniforms { pixel_count:u32, thresh:f32, _pad0:u32, _pad1:u32 };
@group(0) @binding(0) var<uniform>            u       : Uniforms;
@group(0) @binding(1) var<storage,read>       mask    : array<f32>;
@group(0) @binding(2) var<storage,read>       density : array<f32>;
@group(0) @binding(3) var<storage,read_write> conf    : array<f32>;
@group(0) @binding(4) var<storage,read_write> binary  : array<u32>;

@compute @workgroup_size(256,1,1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u.pixel_count) { return; }
  let c = sqrt(mask[gid.x] * clamp(density[gid.x], 0.0, 1.0));
  conf[gid.x]   = c;
  binary[gid.x] = select(0u, 1u, c >= u.thresh);
}
