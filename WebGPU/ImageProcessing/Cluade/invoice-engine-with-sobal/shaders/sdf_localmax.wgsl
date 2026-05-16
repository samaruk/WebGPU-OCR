// shaders/sdf_localmax.wgsl
// 1) Convert JFA nearest-seed output → SDF (Euclidean distance to nearest foreground pixel)
// 2) Apply local maxima suppression in a 2*radius+1 neighbourhood
// 3) Write SDF values to sdf_tex (r32float) for visualisation
// 4) Write local-maxima flags to maxima_tex (r32float, 1.0 = maxima centre)
//    The SDF value at a local maximum == radius of the maximal inscribed circle.

struct Params {
    width:     u32,
    height:    u32,
    lm_radius: u32,    // local maxima neighbourhood radius (pixels)
    min_r:     f32,    // discard maxima below this radius
    max_r:     f32,    // discard maxima above this radius
    _pad0:     u32,
    _pad1:     u32,
    _pad2:     u32,
}

@group(0) @binding(0) var<uniform>       params     : Params;
@group(0) @binding(1) var                jfa_tex    : texture_2d<u32>;
@group(0) @binding(2) var                sdf_tex    : texture_storage_2d<r32float, write>;
@group(0) @binding(3) var                maxima_tex : texture_storage_2d<r32float, write>;

// Shared memory for cooperative loading in a 16×16 tile
// We load (16 + 2*lm_radius) × (16 + 2*lm_radius) region — capped at max radius 8
// For simplicity we do a serial neighbourhood check per thread (radius ≤ 8)

fn eucl_dist(ax: u32, ay: u32, bx: u32, by: u32) -> f32 {
    let dx = f32(i32(ax) - i32(bx));
    let dy = f32(i32(ay) - i32(by));
    return sqrt(dx * dx + dy * dy);
}

const INF: u32 = 0xFFFFu;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let W = params.width;
    let H = params.height;
    if (gid.x >= W || gid.y >= H) { return; }

    let px = i32(gid.x);
    let py = i32(gid.y);

    // ── Step 1: Compute SDF at this pixel ───────────────────────────────
    let seed = textureLoad(jfa_tex, vec2<i32>(px, py), 0).xy;
    var sdf: f32 = 0.0;
    if (seed.x != INF) {
        sdf = eucl_dist(gid.x, gid.y, seed.x, seed.y);
    }
    textureStore(sdf_tex, vec2<i32>(px, py), vec4<f32>(sdf, 0.0, 0.0, 0.0));

    // ── Step 2: Local maxima check ───────────────────────────────────────
    // A pixel is a local maximum if its SDF value is >= all neighbours in a window
    // and falls within [min_r, max_r].
    var is_max: f32 = 0.0;

    if (sdf >= params.min_r && sdf <= params.max_r) {
        let r = i32(params.lm_radius);
        var all_le = true;

        for (var dy = -r; dy <= r; dy++) {
            if (!all_le) { break; }

            for (var dx = -r; dx <= r; dx++) {
                if (dx == 0 && dy == 0) { continue; }

                let nx = px + dx;
                let ny = py + dy;
                if (nx < 0 || ny < 0 || u32(nx) >= W || u32(ny) >= H) {
                    continue;
                }

                let ns = textureLoad(jfa_tex, vec2<i32>(nx, ny), 0).xy;
                var nd: f32 = 0.0;
                if (ns.x != INF) {
                    nd = eucl_dist(u32(nx), u32(ny), ns.x, ns.y);
                }

                if (nd > sdf) {
                    all_le = false;
                    break;
                }
            }
        }

        if (all_le) {
            is_max = sdf;   // store actual radius value (not just 1.0)
        }
    }

    textureStore(maxima_tex, vec2<i32>(px, py), vec4<f32>(is_max, 0.0, 0.0, 0.0));
}
