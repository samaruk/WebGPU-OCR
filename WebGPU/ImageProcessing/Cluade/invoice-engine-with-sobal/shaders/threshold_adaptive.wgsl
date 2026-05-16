// shaders/threshold_adaptive.wgsl
// Sauvola adaptive threshold.
// For each pixel: T = mean * (1 + k*(std/R - 1))
// Pixel is foreground (1.0) if gray < T, else background (0.0).

struct Params {
    width:    u32,
    height:   u32,
    window:   u32,    // half-window (radius), e.g. 15 for 31x31
    k:        f32,    // Sauvola k, typically 0.15–0.2
    R:        f32,    // dynamic range constant, typically 128
    invert:   u32,    // 1 = white text on black bg
}

@group(0) @binding(0) var<uniform>              params  : Params;
@group(0) @binding(1) var                       src_tex : texture_2d<f32>;
@group(0) @binding(2) var                       dst_tex : texture_storage_2d<r32float, write>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let W = params.width;
    let H = params.height;
    if (gid.x >= W || gid.y >= H) { return; }

    let cx = i32(gid.x);
    let cy = i32(gid.y);
    let r  = i32(params.window);

    // Gather local statistics over a (2r+1)×(2r+1) window
    var sum  : f32 = 0.0;
    var sum2 : f32 = 0.0;
    var cnt  : f32 = 0.0;

    let x0 = max(0, cx - r);
    let x1 = min(i32(W) - 1, cx + r);
    let y0 = max(0, cy - r);
    let y1 = min(i32(H) - 1, cy + r);

    for (var y = y0; y <= y1; y++) {
        for (var x = x0; x <= x1; x++) {
            let v = textureLoad(src_tex, vec2<i32>(x, y), 0).r;
            sum  += v;
            sum2 += v * v;
            cnt  += 1.0;
        }
    }

    let mean     = sum / cnt;
    let variance = max(0.0, sum2 / cnt - mean * mean);
    let sigma    = sqrt(variance);

    // Sauvola threshold
    let T = mean * (1.0 + params.k * (sigma / params.R - 1.0));

    let gray = textureLoad(src_tex, vec2<i32>(cx, cy), 0).r;
    var fg: f32;
    if (params.invert == 1u) {
        fg = select(0.0, 1.0, gray > T);
    } else {
        fg = select(0.0, 1.0, gray < T);
    }

    textureStore(dst_tex, vec2<i32>(cx, cy), vec4<f32>(fg, 0.0, 0.0, 0.0));
}
