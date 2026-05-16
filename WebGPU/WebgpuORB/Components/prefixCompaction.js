import prefixWGSL from "./shaders/prefixSum.wgsl";
import compactWGSL from "./shaders/compact.wgsl";

export function compactKeypoints(device, maskTex) {
    const countBuffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    const keypointBuffer = device.createBuffer({
        size: 1024 * 1024,
        usage: GPUBufferUsage.STORAGE
    });

    return { keypointBuffer, countBuffer };
}
