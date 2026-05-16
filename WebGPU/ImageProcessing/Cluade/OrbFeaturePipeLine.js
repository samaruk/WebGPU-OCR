
let device, img;
const state = {
    maxFeatures: 10000,
    threshold: 0.0001,
    levels: 4
};

function log(msg) {
    const debug = document.getElementById('debug');
    debug.style.display = 'block';
    debug.innerHTML += msg + '<br>';
    debug.scrollTop = debug.scrollHeight;
    console.log(msg);
}

// Improved Harris shader with proper Gaussian smoothing
const harrisShader = `
            @group(0) @binding(0) var inputTex: texture_2d<f32>;
            @group(0) @binding(1) var<storage, read_write> output: array<vec4<f32>>;
            @group(0) @binding(2) var<uniform> params: vec2<u32>;

            fn getGray(pos: vec2<i32>) -> f32 {
                let dims = vec2<i32>(params);
                let clamped = clamp(pos, vec2<i32>(0), dims - 1);
                let color = textureLoad(inputTex, clamped, 0);
                return dot(color.rgb, vec3<f32>(0.299, 0.587, 0.114));
            }

            @compute @workgroup_size(8, 8)
            fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                let dims = vec2<u32>(params);
                if (gid.x >= dims.x || gid.y >= dims.y) { return; }

                let pos = vec2<i32>(gid.xy);
                let idx = gid.y * dims.x + gid.x;

                // Compute gradients with Sobel
                var Ix = 0.0;
                var Iy = 0.0;

                // Sobel kernel
                let sobelX = array<array<f32, 3>, 3>(
                    array<f32, 3>(-1.0, 0.0, 1.0),
                    array<f32, 3>(-2.0, 0.0, 2.0),
                    array<f32, 3>(-1.0, 0.0, 1.0)
                );

                let sobelY = array<array<f32, 3>, 3>(
                    array<f32, 3>(-1.0, -2.0, -1.0),
                    array<f32, 3>(0.0, 0.0, 0.0),
                    array<f32, 3>(1.0, 2.0, 1.0)
                );

                for (var dy = 0; dy < 3; dy++) {
                    for (var dx = 0; dx < 3; dx++) {
                        let p = pos + vec2<i32>(dx - 1, dy - 1);
                        let gray = getGray(p);
                        Ix += gray * sobelX[dy][dx];
                        Iy += gray * sobelY[dy][dx];
                    }
                }

                // Normalize gradients
                Ix *= 0.125;
                Iy *= 0.125;

                // Structure tensor with Gaussian smoothing
                var Ixx = 0.0;
                var Iyy = 0.0;
                var Ixy = 0.0;

                // Gaussian kernel 5x5 (sigma=1.0)
                let gauss = array<array<f32, 5>, 5>(
                    array<f32, 5>(0.003765, 0.015019, 0.023792, 0.015019, 0.003765),
                    array<f32, 5>(0.015019, 0.059912, 0.094907, 0.059912, 0.015019),
                    array<f32, 5>(0.023792, 0.094907, 0.150342, 0.094907, 0.023792),
                    array<f32, 5>(0.015019, 0.059912, 0.094907, 0.059912, 0.015019),
                    array<f32, 5>(0.003765, 0.015019, 0.023792, 0.015019, 0.003765)
                );

                for (var dy = 0; dy < 5; dy++) {
                    for (var dx = 0; dx < 5; dx++) {
                        let p = pos + vec2<i32>(dx - 2, dy - 2);

                        // Compute gradients at this position
                        var gx = 0.0;
                        var gy = 0.0;
                        for (var sdy = 0; sdy < 3; sdy++) {
                            for (var sdx = 0; sdx < 3; sdx++) {
                                let sp = p + vec2<i32>(sdx - 1, sdy - 1);
                                let g = getGray(sp);
                                gx += g * sobelX[sdy][sdx];
                                gy += g * sobelY[sdy][sdx];
                            }
                        }
                        gx *= 0.125;
                        gy *= 0.125;

                        let w = gauss[dy][dx];
                        Ixx += w * gx * gx;
                        Iyy += w * gy * gy;
                        Ixy += w * gx * gy;
                    }
                }

                // Harris corner response
                let det = Ixx * Iyy - Ixy * Ixy;
                let trace = Ixx + Iyy;
                let k = 0.04;
                let response = det - k * trace * trace;

                output[idx] = vec4<f32>(response, f32(gid.x), f32(gid.y), 0.0);
            }
        `;

const nmsShader = `
            @group(0) @binding(0) var<storage, read> input: array<vec4<f32>>;
            @group(0) @binding(1) var<storage, read_write> output: array<vec4<f32>>;
            @group(0) @binding(2) var<uniform> params: vec4<f32>; // width, height, threshold, radius

            @compute @workgroup_size(8, 8)
            fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                let width = u32(params.x);
                let height = u32(params.y);
                let threshold = params.z;
                let radius = i32(params.w);

                if (gid.x >= width || gid.y >= height) { return; }

                let idx = gid.y * width + gid.x;
                let response = input[idx].x;

                // Check threshold
                if (response < threshold) {
                    output[idx] = vec4<f32>(0.0);
                    return;
                }

                // Non-maximum suppression in local window
                var isMax = true;
                for (var dy = -radius; dy <= radius; dy++) {
                    for (var dx = -radius; dx <= radius; dx++) {
                        if (dx == 0 && dy == 0) { continue; }

                        let nx = i32(gid.x) + dx;
                        let ny = i32(gid.y) + dy;

                        if (nx >= 0 && nx < i32(width) && ny >= 0 && ny < i32(height)) {
                            let nidx = u32(ny) * width + u32(nx);
                            if (input[nidx].x > response) {
                                isMax = false;
                                break;
                            }
                        }
                    }
                    if (!isMax) { break; }
                }

                if (isMax) {
                    output[idx] = input[idx];
                } else {
                    output[idx] = vec4<f32>(0.0);
                }
            }
        `;

async function initWebGPU() {
    if (!navigator.gpu) {
        showError('WebGPU not supported in this browser');
        return false;
    }

    try {
        const adapter = await navigator.gpu.requestAdapter();
        device = await adapter.requestDevice();
        log('WebGPU initialized successfully');
        return true;
    } catch (e) {
        showError('Failed to initialize WebGPU: ' + e.message);
        return false;
    }
}

function showError(msg) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
    log('ERROR: ' + msg);
}

async function processImage() {
    if (!img || !device) return;

    const startTime = performance.now();
    document.getElementById('loading').style.display = 'block';
    document.getElementById('processBtn').disabled = true;
    document.getElementById('debug').innerHTML = '';

    try {
        log('Starting feature detection...');

        // Process at original scale first
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        log(`Image size: ${img.width}x${img.height}`);

        // Create pyramid
        const pyramid = [];
        let w = img.width, h = img.height;
        for (let i = 0; i < state.levels; i++) {
            const levelCanvas = document.createElement('canvas');
            levelCanvas.width = w;
            levelCanvas.height = h;
            const levelCtx = levelCanvas.getContext('2d');
            levelCtx.drawImage(img, 0, 0, w, h);
            pyramid.push({
                width: w,
                height: h,
                data: levelCtx.getImageData(0, 0, w, h)
            });
            log(`Level ${i}: ${w}x${h}`);
            w = Math.floor(w / 2);
            h = Math.floor(h / 2);
        }

        // Process each level
        const allKeypoints = [];
        for (let level = 0; level < pyramid.length; level++) {
            log(`Processing level ${level}...`);
            const kps = await processLevel(pyramid[level], level);
            log(`Level ${level} found ${kps.length} keypoints`);
            allKeypoints.push(...kps);
        }

        log(`Total keypoints before sorting: ${allKeypoints.length}`);

        // Sort by response and keep top-k
        allKeypoints.sort((a, b) => b.response - a.response);
        const topK = allKeypoints.slice(0, state.maxFeatures);

        log(`Keeping top ${topK.length} features`);

        // Visualize
        visualizeFeatures(topK);

        const endTime = performance.now();

        // Update stats
        document.getElementById('stats').style.display = 'grid';
        document.getElementById('featureCount').textContent = topK.length;
        document.getElementById('processTime').textContent = Math.round(endTime - startTime) + 'ms';
        document.getElementById('pyramidLevels').textContent = pyramid.length;

    } catch (e) {
        showError('Processing failed: ' + e.message);
        console.error(e);
    }

    document.getElementById('loading').style.display = 'none';
    document.getElementById('processBtn').disabled = false;
}

async function processLevel(levelData, scale) {
    const { width, height, data } = levelData;

    // Create texture
    const texture = device.createTexture({
        size: [width, height],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });

    device.queue.writeTexture(
        { texture },
        data.data,
        { bytesPerRow: width * 4 },
        [width, height]
    );

    // Create buffers
    const responseBuffer = device.createBuffer({
        size: width * height * 16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    const paramsBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([width, height]));

    // Harris pipeline
    const harrisModule = device.createShaderModule({ code: harrisShader });
    const harrisPipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: harrisModule, entryPoint: 'main' }
    });

    const harrisBindGroup = device.createBindGroup({
        layout: harrisPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: texture.createView() },
            { binding: 1, resource: { buffer: responseBuffer } },
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

    // NMS
    const nmsBuffer = device.createBuffer({
        size: width * height * 16,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    const nmsParamsBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    device.queue.writeBuffer(nmsParamsBuffer, 0, new Float32Array([width, height, state.threshold, 2]));

    const nmsModule = device.createShaderModule({ code: nmsShader });
    const nmsPipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: nmsModule, entryPoint: 'main' }
    });

    const nmsBindGroup = device.createBindGroup({
        layout: nmsPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: responseBuffer } },
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

    // Read back
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

    const keypoints = [];
    const scaleFactor = Math.pow(2, scale);
    let maxResp = -Infinity, minResp = Infinity;

    for (let i = 0; i < result.length; i += 4) {
        const resp = result[i];
        if (resp > 0) {
            maxResp = Math.max(maxResp, resp);
            minResp = Math.min(minResp, resp);
            keypoints.push({
                response: resp,
                x: result[i + 1] * scaleFactor,
                y: result[i + 2] * scaleFactor,
                scale: scale,
                angle: Math.random() * Math.PI * 2
            });
        }
    }

    readBuffer.unmap();

    if (keypoints.length > 0) {
        log(`  Response range: ${minResp.toExponential(2)} to ${maxResp.toExponential(2)}`);
    }

    return keypoints;
}

function visualizeFeatures(keypoints) {
    const output = document.getElementById('outputCanvas');
    const ctx = output.getContext('2d');

    output.width = img.width;
    output.height = img.height;

    ctx.drawImage(img, 0, 0);

    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];

    keypoints.forEach(kp => {
        const size = 5 + kp.scale * 3;
        const color = colors[kp.scale % colors.length];

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;

        // Draw circle
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, size, 0, Math.PI * 2);
        ctx.stroke();

        // Draw orientation line
        const len = size * 1.5;
        const dx = Math.cos(kp.angle) * len;
        const dy = Math.sin(kp.angle) * len;
        ctx.beginPath();
        ctx.moveTo(kp.x, kp.y);
        ctx.lineTo(kp.x + dx, kp.y + dy);
        ctx.stroke();

        // Draw center dot
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 2, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Event listeners
document.getElementById('imageInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    img = new Image();
    img.onload = () => {
        const input = document.getElementById('inputCanvas');
        const ctx = input.getContext('2d');
        input.width = img.width;
        input.height = img.height;
        ctx.drawImage(img, 0, 0);
        document.getElementById('processBtn').disabled = false;
        log('Image loaded: ' + img.width + 'x' + img.height);
    };
    img.src = URL.createObjectURL(file);
});

document.getElementById('maxFeatures').addEventListener('input', (e) => {
    state.maxFeatures = parseInt(e.target.value);
    document.getElementById('maxFeaturesValue').textContent = state.maxFeatures;
});

document.getElementById('threshold').addEventListener('input', (e) => {
    state.threshold = parseFloat(e.target.value);
    document.getElementById('thresholdValue').textContent = state.threshold.toFixed(5);
});

document.getElementById('levels').addEventListener('input', (e) => {
    state.levels = parseInt(e.target.value);
    document.getElementById('levelsValue').textContent = state.levels;
});

document.getElementById('processBtn').addEventListener('click', processImage);

// Initialize
initWebGPU();