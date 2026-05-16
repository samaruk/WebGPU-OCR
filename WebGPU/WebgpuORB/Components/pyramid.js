import pyramidWGSL from "./shaders/pyramid.wgsl";

export function buildPyramid(device, srcTex, levels) {
    const outputs = [];

    let prev = srcTex;
    for (let i = 0; i < levels; i++) {
        const dst = device.createTexture({
            size: [prev.width >> 1, prev.height >> 1],
            format: "rgba8unorm",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });

        // dispatch compute shader here
        outputs.push(dst);
        prev = dst;
    }
    return outputs;
}
