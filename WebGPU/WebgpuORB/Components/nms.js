import shader from "./shaders/nms.wgsl";

export function nonMaxSuppression(device, responseTex) {
    const maskTex = device.createTexture({
        size: responseTex.size,
        format: "r8uint",
        usage: GPUTextureUsage.STORAGE_BINDING
    });

    return maskTex;
}
