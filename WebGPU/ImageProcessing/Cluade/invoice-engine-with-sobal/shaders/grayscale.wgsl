// shaders/grayscale.wgsl – RGBA8 → r32float grayscale (BT.709)

@group(0) @binding(0) var src_tex  : texture_2d<f32>;
@group(0) @binding(1) var dst_tex  : texture_storage_2d<r32float, write>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dims = textureDimensions(src_tex);
    if (gid.x >= dims.x || gid.y >= dims.y) { return; }

    let rgba = textureLoad(src_tex, vec2<i32>(gid.xy), 0);
    // BT.709 luminance
    let gray = 0.2126 * rgba.r + 0.7152 * rgba.g + 0.0722 * rgba.b;
    textureStore(dst_tex, vec2<i32>(gid.xy), vec4<f32>(gray, 0.0, 0.0, 0.0));
}
