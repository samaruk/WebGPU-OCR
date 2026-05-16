// shaders/jfa_jump.wgsl
// One JFA jump-flood pass with step size k.
// Reads from src_jfa, writes to dst_jfa.
// For each pixel: check 8 neighbours at offset ±k; adopt the closest seed.
// Uses rg32uint: r = seedX, g = seedY (INF = no seed).

struct Params {
    width:  u32,
    height: u32,
    step:   u32,   // jump step = floor(max(W,H) / 2^pass)
    _pad:   u32,
}

@group(0) @binding(0) var<uniform>       params   : Params;
@group(0) @binding(1) var                src_jfa  : texture_2d<u32>;
@group(0) @binding(2) var                dst_jfa  : texture_storage_2d<rg32uint, write>;

const INF: u32 = 0xFFFFu;

fn sq_dist(ax: u32, ay: u32, bx: u32, by: u32) -> u32 {
    let dx = u32(max(i32(ax) - i32(bx), i32(bx) - i32(ax)));
    let dy = u32(max(i32(ay) - i32(by), i32(by) - i32(ay)));
    // Avoid overflow: clamp large values
    return min(dx * dx + dy * dy, 0x7FFFFFFFu);
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let W = params.width;
    let H = params.height;
    if (gid.x >= W || gid.y >= H) { return; }

    let px = i32(gid.x);
    let py = i32(gid.y);
    let k  = i32(params.step);

    // Load own seed
    var best = textureLoad(src_jfa, vec2<i32>(px, py), 0).xy;
    var best_dist: u32;
    if (best.x == INF) {
        best_dist = 0xFFFFFFFFu;
    } else {
        best_dist = sq_dist(gid.x, gid.y, best.x, best.y);
    }

    // Check 3×3 neighbourhood at stride k
    for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
            if (dx == 0 && dy == 0) { continue; }
            let nx = px + dx * k;
            let ny = py + dy * k;
            if (nx < 0 || ny < 0 || u32(nx) >= W || u32(ny) >= H) { continue; }

            let s = textureLoad(src_jfa, vec2<i32>(nx, ny), 0).xy;
            if (s.x == INF) { continue; }

            let d = sq_dist(gid.x, gid.y, s.x, s.y);
            if (d < best_dist) {
                best_dist = d;
                best = s;
            }
        }
    }

    textureStore(dst_jfa, vec2<i32>(px, py), vec4<u32>(best.x, best.y, 0u, 0u));
}
