@group(0) @binding(0)
var srcTex : texture_2d<f32>;

@group(0) @binding(1)
var dstTex : texture_storage_2d<r32float, write>;

const K : f32 = 0.04;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    let size = textureDimensions(srcTex);
    let x = i32(gid.x);
    let y = i32(gid.y);

    if (x <= 0 || y <= 0 || x >= i32(size.x - 1) || y >= i32(size.y - 1)) {
        return;
    }

    // Sobel gradients
    let gx =
        textureLoad(srcTex, vec2<i32>(x+1, y-1), 0).r +
        2.0 * textureLoad(srcTex, vec2<i32>(x+1, y), 0).r +
        textureLoad(srcTex, vec2<i32>(x+1, y+1), 0).r -
        textureLoad(srcTex, vec2<i32>(x-1, y-1), 0).r -
        2.0 * textureLoad(srcTex, vec2<i32>(x-1, y), 0).r -
        textureLoad(srcTex, vec2<i32>(x-1, y+1), 0).r;

    let gy =
        textureLoad(srcTex, vec2<i32>(x-1, y+1), 0).r +
        2.0 * textureLoad(srcTex, vec2<i32>(x, y+1), 0).r +
        textureLoad(srcTex, vec2<i32>(x+1, y+1), 0).r -
        textureLoad(srcTex, vec2<i32>(x-1, y-1), 0).r -
        2.0 * textureLoad(srcTex, vec2<i32>(x, y-1), 0).r -
        textureLoad(srcTex, vec2<i32>(x+1, y-1), 0).r;

    // Harris matrix
    let ix2 = gx * gx;
    let iy2 = gy * gy;
    let ixy = gx * gy;

    let det = ix2 * iy2 - ixy * ixy;
    let trace = ix2 + iy2;

    let response = det - K * trace * trace;

    textureStore(dstTex, vec2<i32>(x, y), vec4<f32>(response, 0.0, 0.0, 0.0));
}
