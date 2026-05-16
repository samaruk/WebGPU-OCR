// shaders/common.wgsl – Shared utility functions

// Luminance weights (BT.709)
const LUM_R: f32 = 0.2126;
const LUM_G: f32 = 0.7152;
const LUM_B: f32 = 0.0722;

fn luminance(c: vec3<f32>) -> f32 {
    return dot(c, vec3<f32>(LUM_R, LUM_G, LUM_B));
}

fn clamp01(v: f32) -> f32 {
    return clamp(v, 0.0, 1.0);
}

fn sq(x: f32) -> f32 { return x * x; }

// Fast approximate sqrt (Newton-Raphson)
fn fast_sqrt(x: f32) -> f32 {
    return sqrt(x);   // GPU has native sqrt; kept for parity
}

// Pack (x, y) coordinates into a single u32 (each ≤ 0x7FFF)
fn pack_coord(x: u32, y: u32) -> u32 {
    return (y << 16u) | (x & 0xFFFFu);
}

// Unpack coordinate packed with pack_coord
fn unpack_x(v: u32) -> u32 { return v & 0xFFFFu; }
fn unpack_y(v: u32) -> u32 { return (v >> 16u) & 0xFFFFu; }

const INF_COORD: u32 = 0xFFFFFFFFu;

fn coord_valid(v: u32) -> bool {
    return v != INF_COORD;
}
