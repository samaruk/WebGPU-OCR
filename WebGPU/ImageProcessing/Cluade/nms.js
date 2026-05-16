import { shader } from "/Content/WebGPU/ImageProcessing/Cluade/Shaders/NMSShader.js";

export function nms(device, buffer, width, height, threshold) {
    const nmsBuffer = device.createBuffer({
        size: width * height * 16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    const nmsParamsBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(nmsParamsBuffer, 0, new Float32Array([width, height, threshold, 2]));

    const nmsModule = device.createShaderModule({ code: shader });
    const nmsPipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: nmsModule, entryPoint: 'main' }
    });

    const nmsBindGroup = device.createBindGroup({
        layout: nmsPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: buffer } },
            { binding: 1, resource: { buffer: nmsBuffer } },
            { binding: 2, resource: { buffer: nmsParamsBuffer } }
        ]
    });

    const nmsEncoder = device.createCommandEncoder();
    const nmsPass = nmsEncoder.beginComputePass();
    nmsPass.setPipeline(nmsPipeline);
    nmsPass.setBindGroup(0, nmsBindGroup);
    nmsPass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    nmsPass.end();
    device.queue.submit([nmsEncoder.finish()]);

    return nmsBuffer;
}
