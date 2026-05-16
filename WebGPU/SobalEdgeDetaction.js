const canvas = document.getElementById("canvas");

if (!navigator.gpu) throw new Error("WebGPU not supported");

// ---------------- GPU ----------------
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

// ---------------- Image ----------------
const img = new Image();
img.src = "/Content/WebGPU/Invoice.jpeg";   // <-- replace
await img.decode();

canvas.width = img.width;
canvas.height = img.height;

// ---------------- Source texture ----------------
const srcTexture = device.createTexture({
    size: [img.width, img.height],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
});

device.queue.copyExternalImageToTexture(
    { source: img },
    { texture: srcTexture },
    [img.width, img.height]
);
// Destination texture
const dstTexture = device.createTexture({
    size: [img.width, img.height],
    format: "rgba8unorm",
    usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_SRC
});

// ================= Shader =================

const shaderCluade = device.createShaderModule({
    code: `
@group(0) @binding(0) var srcTex : texture_2d<f32>;
@group(0) @binding(1) var dstTex : texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    let size = textureDimensions(srcTex);
    if (gid.x >= size.x || gid.y >= size.y) { return; }
    
    let x = i32(gid.x);
    let y = i32(gid.y);
    
    // Sobel kernels
    let gx = array<f32,9>(
        -1.0, 0.0, 1.0,
        -2.0, 0.0, 2.0,
        -1.0, 0.0, 1.0
    );
    let gy = array<f32,9>(
        -1.0, -2.0, -1.0,
         0.0,  0.0,  0.0,
         1.0,  2.0,  1.0
    );
    
    var sumX : f32 = 0.0;
    var sumY : f32 = 0.0;
    var i = 0;
    
    for (var oy = -1; oy <= 1; oy++) {
        for (var ox = -1; ox <= 1; ox++) {
            let px = clamp(x + ox, 0, i32(size.x - 1));
            let py = clamp(y + oy, 0, i32(size.y - 1));
            let c = textureLoad(srcTex, vec2<i32>(px, py), 0);
            
            // Convert to grayscale using standard luminance weights
            let gray = dot(c.rgb, vec3<f32>(0.299, 0.587, 0.114));
            
            sumX += gray * gx[i];
            sumY += gray * gy[i];
            i++;
        }
    }
    
    // Calculate gradient magnitude
    let mag = sqrt(sumX * sumX + sumY * sumY);
    
    // Normalize: theoretical max for Sobel is 4*sqrt(2) ≈ 5.657
    // Using 8.0 provides good contrast while preventing overflow
    let edge = clamp(mag / 8.0, 0.0, 1.0);
    
    textureStore(dstTex, vec2<i32>(x, y), vec4<f32>(edge, edge, edge, 1.0));
}
`
});
const shader = device.createShaderModule({
    code: `
@group(0) @binding(0) var srcTex : texture_2d<f32>;
@group(0) @binding(1) var dstTex : texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    let size = textureDimensions(srcTex);
    if (gid.x >= size.x || gid.y >= size.y) { return; }

    let x = i32(gid.x);
    let y = i32(gid.y);

    let gx = array<i32,9>(
        -1,0,1,
        -2,0,2,
        -1,0,1
    );
    let gy = array<i32,9>(
        -1,-2,-1,
         0, 0, 0,
         1, 2, 1
    );

    var sumX : f32 = 0.0;
    var sumY : f32 = 0.0;
    var i = 0;

    for (var oy = -1; oy <= 1; oy++) {
        for (var ox = -1; ox <= 1; ox++) {
            let px = clamp(x + ox, 0, i32(size.x - 1));
            let py = clamp(y + oy, 0, i32(size.y - 1));

            let c = textureLoad(srcTex, vec2<i32>(px, py), 0);
            let gray = dot(c.rgb, vec3<f32>(0.299, 0.587, 0.114));

            sumX += gray * f32(gx[i]);
            sumY += gray * f32(gy[i]);
            i++;
        }
    }

    let mag = sqrt(sumX * sumX + sumY * sumY);
    let edge = clamp(mag, 0.0, 1.0);

    textureStore(dstTex, vec2<i32>(x,y), vec4<f32>(edge, edge, edge, 1.0));
}
`
});

// ================= Pipeline =================
const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
        module: shader,
        entryPoint: "main"
    }
});

const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: srcTexture.createView() },
        { binding: 1, resource: dstTexture.createView() }
    ]
});

// ================= Dispatch =================
const encoder = device.createCommandEncoder();
const pass = encoder.beginComputePass();
pass.setPipeline(pipeline);
pass.setBindGroup(0, bindGroup);
pass.dispatchWorkgroups(
    Math.ceil(img.width / 16),
    Math.ceil(img.height / 16)
);
pass.end();
device.queue.submit([encoder.finish()]);



// ---------------- Readback helper ----------------


async function textureToCanvas(texture, bytesPerPixel) {
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
        if (y > 1000 && y < 1100) {
            console.log([`${y}`,[...mapped.subarray(srcOffset, srcOffset + unpaddedBytesPerRow)]]);
        }
        imageData.set(
            mapped.subarray(srcOffset, srcOffset + unpaddedBytesPerRow),
            dstOffset
        );
    }

    buffer.unmap();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    c.getContext("2d").putImageData(
        new ImageData(imageData, img.width, img.height), 0, 0
    );
    document.body.appendChild(c);

};


// ---------------- Show results ----------------
//await textureToCanvas(srcTexture, 4);   // Display Back orginal Image
await textureToCanvas(dstTexture, 4);   // sobal edged iamge
//await textureToCanvas(labelTexture, 4); // colored labels
