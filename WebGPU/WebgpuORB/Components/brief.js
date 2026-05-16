import shader from "./shaders/brief.wgsl";

export function computeBRIEF(device, keypoints, imageTex) {
    const descriptorBuffer = device.createBuffer({
        size: keypoints.count * 32,
        usage: GPUBufferUsage.STORAGE
    });
    return descriptorBuffer;
}
