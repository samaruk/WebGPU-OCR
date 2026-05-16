// shaders/projection_local.wgsl
// Local partial reduction: each workgroup sums a tile of a row (for row projection)
// or a column (for col projection).
// axis: 0 = row projection (sum each row → rowSums[H]), 1 = col (→ colSums[W])

struct Params {
    width:  u32,
    height: u32,
    axis:   u32,    // 0 = horizontal (sum each row), 1 = vertical (sum each col)
    _pad:   u32,
}

@group(0) @binding(0) var<uniform>                params   : Params;
@group(0) @binding(1) var                         src_tex  : texture_2d<f32>;
@group(0) @binding(2) var<storage, read_write>    sums     : array<atomic<u32>>;
// sums[y] for axis=0, sums[x] for axis=1
// We accumulate as fixed-point: multiply by 1000, store as u32, divide later.

const FIXED: f32 = 1000.0;

@compute @workgroup_size(256, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let W = params.width;
    let H = params.height;

    if (params.axis == 0u) {
        // Row projection: gid.x = x, gid.y = row
        if (gid.x >= W || gid.y >= H) { return; }
        let v = textureLoad(src_tex, vec2<i32>(gid.xy), 0).r;
        let fixed_v = u32(clamp(v, 0.0, 1.0) * FIXED);
        atomicAdd(&sums[gid.y], fixed_v);
    } else {
        // Col projection: gid.x = col, gid.y = y
        if (gid.x >= W || gid.y >= H) { return; }
        let v = textureLoad(src_tex, vec2<i32>(gid.xy), 0).r;
        let fixed_v = u32(clamp(v, 0.0, 1.0) * FIXED);
        atomicAdd(&sums[gid.x], fixed_v);
    }
}
