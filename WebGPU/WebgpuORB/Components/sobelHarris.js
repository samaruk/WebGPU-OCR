import sobelHarrisWGSL from "./shaders/sobelHarris.wgsl";

/**
 * Fused Sobel + Harris Corner Response
 * @param {GPUDevice} device
 * @param {GPUTexture} levelTex - grayscale pyramid level
 * @returns {GPUTexture} responseTex (r32float)
 */
export function sobelHarris(device, levelTex) {
    const width = levelTex.width;
    const height = levelTex.height;

    // ----------------------------
    // Output texture (Harris response)
    // ----------------------------
    const responseTex = device.createTexture({
        size: [width, height],
        format: "r32float",
        usage:
            GPUTextureUsage.STORAGE_BINDING |
            GPUTextureUsage.TEXTURE_BINDING
    });

    // ----------------------------
    // Compute pipeline
    // ----------------------------
    const module = device.createShaderModule({
        code: sobelHarrisWGSL
    });

    const pipeline = device.createComputePipeline({
        layout: "auto",
        compute: {
            module,
            entryPoint: "main"
        }
    });

    // ----------------------------
    // Bind group
    // ----------------------------
    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: levelTex.createView()
            },
            {
                binding: 1,
                resource: responseTex.createView()
            }
        ]
    });

    // ----------------------------
    // Dispatch
    // ----------------------------
    const commandEncoder = device.createCommandEncoder();

    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);

    const WORKGROUP_SIZE = 16;
    pass.dispatchWorkgroups(
        Math.ceil(width / WORKGROUP_SIZE),
        Math.ceil(height / WORKGROUP_SIZE)
    );

    pass.end();
    device.queue.submit([commandEncoder.finish()]);

    return responseTex;
}
