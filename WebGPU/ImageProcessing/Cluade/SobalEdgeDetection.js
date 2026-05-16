import { shader } from "/Content/WebGPU/ImageProcessing/Cluade/Shaders/SobelShader.js";

//texture.width, texture.height

// Create buffers


export function sobel(device, texture) {
    const width = texture.width,
        height = texture.height;
    const responseBuffer = device.createBuffer({
        size: width * height * 16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    const responseTexture = device.createTexture({
        size: [width, height],
        format: "rgba32float",
        usage:
            GPUTextureUsage.STORAGE_BINDING |
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_SRC
    });


    const paramsBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([width, height]));

    // Harris pipeline
    const harrisModule = device.createShaderModule({ code: shader });
    const harrisPipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: harrisModule, entryPoint: 'main' }
    });

    const harrisBindGroup = device.createBindGroup({
        layout: harrisPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: texture.createView() },
            { binding: 1, resource: responseTexture },
            { binding: 2, resource: { buffer: paramsBuffer } }
        ]
    });

    const harrisEncoder = device.createCommandEncoder();
    const harrisPass = harrisEncoder.beginComputePass();
    harrisPass.setPipeline(harrisPipeline);
    harrisPass.setBindGroup(0, harrisBindGroup);
    harrisPass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    harrisPass.end();
    device.queue.submit([harrisEncoder.finish()]);

    return responseTexture;
}
