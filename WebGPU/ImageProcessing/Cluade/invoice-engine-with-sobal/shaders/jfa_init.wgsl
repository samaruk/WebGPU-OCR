// shaders/jfa_init.wgsl
// Initialize the JFA seed texture.
// For background pixels (value == 0): store INF_COORD (no seed).
// For foreground pixels (value == 1): store their own coordinate as seed.
// Output format: rg32uint where r = packed x|y seed coord, g = unused (0).
// We store (seedX, seedY) as separate u32 channels.

struct Params {
    width:   u32,
    height:  u32,
    _pad0:   u32,
    _pad1:   u32,
}

@group(0) @binding(0) var<uniform>       params    : Params;
@group(0) @binding(1) var                binary    : texture_2d<f32>;
@group(0) @binding(2) var                jfa_out   : texture_storage_2d<rg32uint, write>;

const INF: u32 = 0xFFFFu;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    if (gid.x >= params.width || gid.y >= params.height) { return; }

    let val = textureLoad(binary, vec2<i32>(gid.xy), 0).r;

    var seed_x: u32;
    var seed_y: u32;

    if (val > 0.5) {
        // Foreground pixel: it is its own seed
        seed_x = gid.x;
        seed_y = gid.y;
    } else {
        // Background: no seed yet
        seed_x = INF;
        seed_y = INF;
    }

    textureStore(jfa_out, vec2<i32>(gid.xy), vec4<u32>(seed_x, seed_y, 0u, 0u));
}
