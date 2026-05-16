// shaders/morphology_horizontal.wgsl
// Separable horizontal morphology (dilation or erosion) on r32float texture.
// op: 0 = dilate (max), 1 = erode (min)

struct Params {
    width:  u32,
    height: u32,
    radius: u32,    // kernel half-width
    op:     u32,    // 0 = dilate, 1 = erode
}

@group(0) @binding(0) var<uniform>       params  : Params;
@group(0) @binding(1) var                src_tex : texture_2d<f32>;
@group(0) @binding(2) var                dst_tex : texture_storage_2d<r32float, write>;

@compute @workgroup_size(256, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let W = params.width;
    let H = params.height;
    if (gid.x >= W || gid.y >= H) { return; }

    let px = i32(gid.x);
    let py = i32(gid.y);
    let r  = i32(params.radius);

    var result: f32;
    if (params.op == 0u) {
        // Dilation: max
        result = -1e38;
        for (var dx = -r; dx <= r; dx++) {
            let nx = clamp(px + dx, 0, i32(W) - 1);
            let v  = textureLoad(src_tex, vec2<i32>(nx, py), 0).r;
            result = max(result, v);
        }
    } else {
        // Erosion: min
        result = 1e38;
        for (var dx = -r; dx <= r; dx++) {
            let nx = clamp(px + dx, 0, i32(W) - 1);
            let v  = textureLoad(src_tex, vec2<i32>(nx, py), 0).r;
            result = min(result, v);
        }
    }

    textureStore(dst_tex, vec2<i32>(px, py), vec4<f32>(result, 0.0, 0.0, 0.0));
}
