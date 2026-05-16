

function harrisGPUBufferToTexture(
    device,
    srcBuffer,     // GPUBuffer: array<vec4<f32>>
    width,
    height,
    minValue,
    maxValue,
    threshold
) {
    /* =========================
       Uniform buffer (32 bytes)
       ========================= */
    const paramsBuffer = device.createBuffer({
        size: 32, // aligned
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const paramsData = new ArrayBuffer(32);
    const u32 = new Uint32Array(paramsData);
    const f32 = new Float32Array(paramsData);

    u32[0] = width;
    u32[1] = height;
    f32[2] = minValue;
    f32[3] = maxValue;
    f32[4] = threshold;

    device.queue.writeBuffer(paramsBuffer, 0, paramsData);

    /* =========================
       Output texture
       ========================= */
    const outputTexture = device.createTexture({
        size: [width, height],
        format: "rgba8unorm",
        usage:
            GPUTextureUsage.STORAGE_BINDING |
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_SRC
    });

    /* =========================
       Shader
       ========================= */
    const shaderModule = device.createShaderModule({
        code: `
@group(0) @binding(0)
var<storage, read> srcBuffer: array<vec4<f32>>;

@group(0) @binding(1)
var dstTex: texture_storage_2d<rgba8unorm, write>;

struct Params {
    width: u32,
    height: u32,
    minVal: f32,
    maxVal: f32,
    threshold: f32,
};

@group(0) @binding(2)
var<uniform> params: Params;

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {

    if (gid.x >= params.width || gid.y >= params.height) {
        return;
    }

    let idx = gid.y * params.width + gid.x;
    let response = srcBuffer[idx].x;

    var r = 0.0;
    var alpha=0.0;
    if (response >= params.threshold) {
        r = clamp(
            (response - params.minVal) / (params.maxVal - params.minVal),
            0.0,
            1.0
        );
    r = 1.0;
    alpha=1.0;
    }
    textureStore(
        dstTex,
        vec2<i32>(gid.xy),
        vec4<f32>(r, r, r, alpha)
    );
}
`
    });

    /* =========================
       Pipeline
       ========================= */
    const pipeline = device.createComputePipeline({
        layout: "auto",
        compute: {
            module: shaderModule,
            entryPoint: "main"
        }
    });

    /* =========================
       Bind group
       ========================= */
    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: srcBuffer } },
            { binding: 1, resource: outputTexture.createView() },
            { binding: 2, resource: { buffer: paramsBuffer } }
        ]
    });

    /* =========================
       Dispatch
       ========================= */
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);

    pass.dispatchWorkgroups(
        Math.ceil(width / 16),
        Math.ceil(height / 16)
    );

    pass.end();
    device.queue.submit([encoder.finish()]);

    return outputTexture;
}
function sobalTextureToImageTexture(
    device,
    srcTexture,     // GPUBuffer: array<vec4<f32>>
    width,
    height,
    minValue,
    maxValue,
    threshold
) {
    /* =========================
       Uniform buffer (32 bytes)
       ========================= */
    const paramsBuffer = device.createBuffer({
        size: 32, // aligned
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    const paramsData = new ArrayBuffer(32);
    const u32 = new Uint32Array(paramsData);
    const f32 = new Float32Array(paramsData);

    u32[0] = width;
    u32[1] = height;
    f32[2] = minValue;
    f32[3] = maxValue;
    f32[4] = threshold;

    device.queue.writeBuffer(paramsBuffer, 0, paramsData);

    /* =========================
       Output texture
       ========================= */
    const outputTexture = device.createTexture({
        size: [width, height],
        format: "rgba8unorm",
        usage:
            GPUTextureUsage.STORAGE_BINDING |
            GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_SRC
    });

    /* =========================
       Shader
       ========================= */
    const shaderModule = device.createShaderModule({
        code: `
@group(0) @binding(0)
var<storage, read> srcBuffer: array<vec4<f32>>;

@group(0) @binding(1)
var dstTex: texture_storage_2d<rgba8unorm, write>;

struct Params {
    width: u32,
    height: u32,
    minVal: f32,
    maxVal: f32,
    threshold: f32,
};

@group(0) @binding(2)
var<uniform> params: Params;

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {

    if (gid.x >= params.width || gid.y >= params.height) {
        return;
    }

    let idx = gid.y * params.width + gid.x;
    let response = srcBuffer[idx].x;

    var r = 0.0;
    if (response >= params.threshold) {
        r = clamp(
            (response - params.minVal) / (params.maxVal - params.minVal),
            0.0,
            1.0
        );
    r = 1.0;
    }
    textureStore(
        dstTex,
        vec2<i32>(gid.xy),
        vec4<f32>(r, r, r, 1.0)
    );
}
`
    });

    /* =========================
       Pipeline
       ========================= */
    const pipeline = device.createComputePipeline({
        layout: "auto",
        compute: {
            module: shaderModule,
            entryPoint: "main"
        }
    });

    /* =========================
       Bind group
       ========================= */
    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: srcBuffer } },
            { binding: 1, resource: outputTexture.createView() },
            { binding: 2, resource: { buffer: paramsBuffer } }
        ]
    });

    /* =========================
       Dispatch
       ========================= */
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);

    pass.dispatchWorkgroups(
        Math.ceil(width / 16),
        Math.ceil(height / 16)
    );

    pass.end();
    device.queue.submit([encoder.finish()]);

    return outputTexture;
}

async function textureToCanvas(device,texture, bytesPerPixel) {
    const img = texture;
    const unpaddedBytesPerRow = img.width * bytesPerPixel;
    const paddedBytesPerRow =
        Math.ceil(unpaddedBytesPerRow / 256) * 256;

    const buffer = device.createBuffer({
        size: paddedBytesPerRow * img.height,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    const encoder = device.createCommandEncoder();
    encoder.copyTextureToBuffer(
        { texture },
        {
            buffer,
            bytesPerRow: paddedBytesPerRow
        },
        [img.width, img.height]
    );
    device.queue.submit([encoder.finish()]);

    await buffer.mapAsync(GPUMapMode.READ);

    const mapped = new Uint8Array(buffer.getMappedRange());
    const imageData = new Uint8ClampedArray(img.width * img.height * 4);

    // Remove row padding
    for (let y = 0; y < img.height; y++) {
        const srcOffset = y * paddedBytesPerRow;
        const dstOffset = y * unpaddedBytesPerRow;

        imageData.set(
            mapped.subarray(srcOffset, srcOffset + unpaddedBytesPerRow),
            dstOffset
        );
    }

    buffer.unmap();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    var context = c.getContext("2d");
    context.putImageData(
        new ImageData(imageData, img.width, img.height), 0, 0
    );
    document.body.appendChild(c);
    return { canvas: c, ctx: context, data: imageData, width: img.width, height: img.height };

};//{ data: sobelPoints, max:maxSobel, min:minSobel }

async function arrayToCanvas(model) {

    const imageData = new Uint8ClampedArray(model.data.length * 4);

    // Remove row padding
    for (let y = 0; y < model.data.length; y++) {
        var value = 255 * (model.data[y] - model.data.min) / (model.data.max - model.data.min);
        var index = y * 4;
        imageData[index] = value;
        imageData[index + 1] = value;
        imageData[index +2] = value;
        imageData[index +3] = 255;
    }

    buffer.unmap();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    var context = c.getContext("2d");
    context.putImageData(
        new ImageData(imageData, img.width, img.height), 0, 0
    );
    document.body.appendChild(c);
    return { context, canvas: c, imageData };

};//{ data: sobelPoints, max:maxSobel, min:minSobel }

/**
 * Draws a grayscale image from a 1D pixel array onto a new canvas
 * and appends it to the document body.
 *
 * @param {Uint8Array|Array<number>} grayArray - 1D grayscale pixel values (0–255)
 * @param {number} width - Image width
 * @param {number} height - Image height
 */
function drawGrayscaleImage(grayArray, width, height, max, min) {
    if (grayArray.length !== width * height) {
        throw new Error("Array length must be width × height");
    }

    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");

    // Create ImageData
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data; // RGBA buffer

    // Fill RGBA buffer
    for (let i = 0; i < grayArray.length; i++) {
        const v = 255 * (grayArray[i] - min) / (max - min);
        const j = i * 4;

        data[j] = v;   // R
        data[j + 1] = 0;   // G
        data[j + 2] = 0;   // B
        data[j + 3] = 255; // A
    }

    // Draw to canvas
    ctx.putImageData(imageData, 0, 0);
    return { canvas: canvas, ctx, data, width, height };
}
async function gpuBufferToArray(device, nmsBuffer) {

    await device.queue.onSubmittedWorkDone();
    const readBuffer = device.createBuffer({
        size: nmsBuffer.size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    const copyEncoder = device.createCommandEncoder();
    copyEncoder.copyBufferToBuffer(nmsBuffer, 0, readBuffer, 0, nmsBuffer.size);
    device.queue.submit([copyEncoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(readBuffer.getMappedRange());
    return {
        result, readBuffer
    };
}

export { harrisGPUBufferToTexture, sobalTextureToImageTexture, textureToCanvas, arrayToCanvas, drawGrayscaleImage, gpuBufferToArray };

