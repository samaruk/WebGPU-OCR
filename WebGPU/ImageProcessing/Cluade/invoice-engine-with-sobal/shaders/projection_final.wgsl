// shaders/projection_final.wgsl
// Normalize the raw integer projection sums to [0,1] floats.

struct Params {
    length:   u32,   // H for row proj, W for col proj
    divisor:  f32,   // pixel count per line (W or H)
    _pad0:    u32,
    _pad1:    u32,
}

@group(0) @binding(0) var<uniform>             params     : Params;
@group(0) @binding(1) var<storage, read>       raw_sums   : array<u32>;
@group(0) @binding(2) var<storage, read_write> norm_sums  : array<f32>;

const FIXED: f32 = 1000.0;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    if (gid.x >= params.length) { return; }
    // Un-fix and normalize
    norm_sums[gid.x] = (f32(raw_sums[gid.x]) / FIXED) / params.divisor;
}
