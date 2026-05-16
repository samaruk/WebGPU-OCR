
let device, adapter;
let currentImage = null;

// Initialize WebGPU
async function initGPU() {
    if (!navigator.gpu) {
        alert("WebGPU not supported");
        return false;
    }
    adapter = await navigator.gpu.requestAdapter();
    device = await adapter.requestDevice();
    return true;
}

// Load and display image
async function loadImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

// Process image
async function processImage(img, bias) {
    const results = document.getElementById('results');
    results.innerHTML = '';

    // Show original
    const origDiv = document.createElement('div');
    origDiv.className = 'result-item';
    origDiv.innerHTML = '<h3>Original Image</h3>';
    const origCanvas = document.createElement('canvas');
    origCanvas.width = img.width;
    origCanvas.height = img.height;
    const ctx = origCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    origDiv.appendChild(origCanvas);
    results.appendChild(origDiv);

    // Create source texture
    const srcTexture = device.createTexture({
        size: [img.width, img.height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });

    device.queue.copyExternalImageToTexture(
        { source: img },
        { texture: srcTexture },
        [img.width, img.height]
    );

    // Create output textures
    const binTexture = device.createTexture({
        size: [img.width, img.height],
        format: "r8unorm",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC
    });

    const labelTexture = device.createTexture({
        size: [img.width, img.height],
        format: "r32uint",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC
    });

    // Uniforms
    const paramBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(
        paramBuffer, 0,
        new Float32Array([img.width, img.height, bias, 0])
    );

    // Fixed shader - consistent grayscale calculation
    const shaderCode = `
struct Params {
    width  : f32,
    height : f32,
    bias   : f32,
    pad    : f32,
};

@group(0) @binding(0) var src : texture_2d<f32>;
@group(0) @binding(1) var bin : texture_storage_2d<r8unorm, write>;
@group(0) @binding(2) var labels : texture_storage_2d<r32uint, write>;
@group(0) @binding(3) var<uniform> params : Params;

fn toGray(rgb: vec3<f32>) -> f32 {
    return dot(rgb, vec3(0.299, 0.587, 0.114));
}

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
    let x = i32(id.x);
    let y = i32(id.y);
    let w = i32(params.width);
    let h = i32(params.height);

    if (x < 1 || y < 1 || x >= w-1 || y >= h-1) {
        let p = vec2<i32>(x,y);
        textureStore(bin, p, vec4(0.0));
        textureStore(labels, p, vec4<u32>(0u));
        return;
    }

    let p = vec2<i32>(x,y);
    let gray = toGray(textureLoad(src,p,0).rgb);

    // Fixed: consistent grayscale calculation for all neighbors
    let mean = (
        toGray(textureLoad(src, p+vec2(-1,0), 0).rgb) +
        toGray(textureLoad(src, p+vec2( 1,0), 0).rgb) +
        toGray(textureLoad(src, p+vec2(0,-1), 0).rgb) +
        toGray(textureLoad(src, p+vec2(0, 1), 0).rgb) +
        gray
    ) / 5.0;

    // Ink is darker than local mean
    let ink = gray < mean - params.bias;

    textureStore(bin, p, vec4(select(0.0, 1.0, ink)));
    textureStore(labels, p, vec4<u32>(select(0u, u32(y*w + x), ink)));
}
`;

    const pipeline = device.createComputePipeline({
        layout: "auto",
        compute: {
            module: device.createShaderModule({ code: shaderCode }),
            entryPoint: "main"
        }
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: srcTexture.createView() },
            { binding: 1, resource: binTexture.createView() },
            { binding: 2, resource: labelTexture.createView() },
            { binding: 3, resource: { buffer: paramBuffer } }
        ]
    });

    // Dispatch
    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(
        Math.ceil(img.width / 16),
        Math.ceil(img.height / 16)
    );
    pass.end();
    device.queue.submit([enc.finish()]);
    await device.queue.onSubmittedWorkDone();

    // Readback and display
    const binResult = await textureToCanvas(binTexture, 1, img.width, img.height, 'Binary Mask');
    const labelResult = await textureToCanvas(labelTexture, 4, img.width, img.height, 'Connected Components');

    results.appendChild(binResult.div);
    results.appendChild(labelResult.div);
}

async function textureToCanvas(texture, bpp, width, height, title) {
    const rowPitch = Math.ceil(width * bpp / 256) * 256;
    const buffer = device.createBuffer({
        size: rowPitch * height,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    const enc = device.createCommandEncoder();
    enc.copyTextureToBuffer(
        { texture },
        { buffer, bytesPerRow: rowPitch },
        [width, height]
    );
    device.queue.submit([enc.finish()]);
    await device.queue.onSubmittedWorkDone();

    await buffer.mapAsync(GPUMapMode.READ);

    const src = bpp === 1
        ? new Uint8Array(buffer.getMappedRange())
        : new Uint32Array(buffer.getMappedRange());

    const out = new Uint8ClampedArray(width * height * 4);
    const stride = rowPitch / bpp;

    let nonZeroCount = 0;
    let minVal = Infinity, maxVal = -Infinity;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const v = src[y * stride + x];
            const i = (y * width + x) * 4;

            if (v > 0) nonZeroCount++;
            minVal = Math.min(minVal, v);
            maxVal = Math.max(maxVal, v);

            if (bpp === 1) {
                // Binary: 255 = white (ink), 0 = black (background)
                out[i] = out[i + 1] = out[i + 2] = v * 255;
            } else {
                // Labels: colorize
                const id = v & 0xFFFF;
                out[i] = (id * 53) % 255;
                out[i + 1] = (id * 97) % 255;
                out[i + 2] = (id * 193) % 255;
            }
            out[i + 3] = 255;
        }
    }

    buffer.unmap();

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').putImageData(
        new ImageData(out, width, height), 0, 0
    );

    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `<h3>${title}</h3>`;
    div.appendChild(canvas);

    const stats = document.createElement('div');
    stats.className = 'stats';
    stats.innerHTML = `
                Non-zero pixels: ${nonZeroCount} / ${width * height} (${(nonZeroCount / (width * height) * 100).toFixed(2)}%)<br>
                Value range: ${minVal} - ${maxVal}
            `;
    div.appendChild(stats);

    return { div, canvas, nonZeroCount };
}

// Event listeners
document.getElementById('fileInput').addEventListener('change', async (e) => {
    if (e.target.files[0]) {
        currentImage = await loadImage(e.target.files[0]);
        document.getElementById('processBtn').disabled = false;
    }
});

document.getElementById('biasSlider').addEventListener('input', (e) => {
    document.getElementById('biasValue').textContent = e.target.value;
});

document.getElementById('processBtn').addEventListener('click', async () => {
    if (currentImage) {
        const bias = parseFloat(document.getElementById('biasSlider').value);
        await processImage(currentImage, bias);
    }
});

// Initialize
initGPU().then(success => {
    if (success) {
        console.log('WebGPU initialized');
    }
});