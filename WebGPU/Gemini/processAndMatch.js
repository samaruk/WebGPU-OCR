
const MAX_FEATURES = 10000;
const BRIEF_PAIRS = 256; // 256 bits = 8 x u32

// Pre-computed BRIEF sampling pattern (relative to keypoint)
const BRIEF_PATTERN = [];
for (let i = 0; i < BRIEF_PAIRS; i++) {
    const angle = (i * 137.508) * Math.PI / 180; // Golden angle distribution
    const r1 = 3 + (i % 7);
    const r2 = 3 + ((i + 13) % 7);
    BRIEF_PATTERN.push(
        Math.round(r1 * Math.cos(angle)),
        Math.round(r1 * Math.sin(angle)),
        Math.round(r2 * Math.cos(angle + 1.57)),
        Math.round(r2 * Math.sin(angle + 1.57))
    );
}

const SHADERS = {
    gaussian: `
            @group(0) @binding(0) var inTex: texture_2d<f32>;
            @group(0) @binding(1) var outTex: texture_storage_2d<rgba8unorm, write>;

            const kernel: array<f32, 25> = array<f32, 25>(
                1.0/256.0,  4.0/256.0,  6.0/256.0,  4.0/256.0, 1.0/256.0,
                4.0/256.0, 16.0/256.0, 24.0/256.0, 16.0/256.0, 4.0/256.0,
                6.0/256.0, 24.0/256.0, 36.0/256.0, 24.0/256.0, 6.0/256.0,
                4.0/256.0, 16.0/256.0, 24.0/256.0, 16.0/256.0, 4.0/256.0,
                1.0/256.0,  4.0/256.0,  6.0/256.0,  4.0/256.0, 1.0/256.0
            );

            @compute @workgroup_size(8, 8)
            fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                let dims = textureDimensions(inTex);
                if (id.x >= dims.x || id.y >= dims.y) { return; }

                var sum = vec3<f32>(0.0);
                for(var i=0; i<5; i++) {
                    for(var j=0; j<5; j++) {
                        let px = clamp(i32(id.x) + j - 2, 0, i32(dims.x) - 1);
                        let py = clamp(i32(id.y) + i - 2, 0, i32(dims.y) - 1);
                        let color = textureLoad(inTex, vec2<i32>(px, py), 0).rgb;
                        sum += color * kernel[i * 5 + j];
                    }
                }
                textureStore(outTex, vec2<i32>(id.xy), vec4(sum, 1.0));
            }
        `,

    harris: `
            struct Params { width: u32, height: u32, threshold: f32, max_f: u32 }
            @group(0) @binding(0) var tex: texture_2d<f32>;
            @group(0) @binding(1) var<storage, read_write> responses: array<f32>;
            @group(0) @binding(2) var<uniform> p: Params;

            @compute @workgroup_size(8, 8)
            fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                if (id.x >= p.width || id.y >= p.height) { return; }
                let pos = vec2<i32>(id.xy);

                // Sobel operator for gradients
                var Ix = 0.0; var Iy = 0.0;
                let sobelX = array<f32, 9>(-1.0, 0.0, 1.0, -2.0, 0.0, 2.0, -1.0, 0.0, 1.0);
                let sobelY = array<f32, 9>(-1.0, -2.0, -1.0, 0.0, 0.0, 0.0, 1.0, 2.0, 1.0);

                for(var i=-1; i<=1; i++) {
                    for(var j=-1; j<=1; j++) {
                        let pix = dot(textureLoad(tex, pos + vec2(j,i), 0).rgb, vec3(0.299, 0.587, 0.114));
                        let idx = (i + 1) * 3 + (j + 1);
                        Ix += pix * sobelX[idx];
                        Iy += pix * sobelY[idx];
                    }
                }

                // Structure tensor with box filter
                var Ixx = 0.0; var Iyy = 0.0; var Ixy = 0.0;
                for(var i=-1; i<=1; i++) {
                    for(var j=-1; j<=1; j++) {
                        let ppos = pos + vec2(j, i);
                        var gx = 0.0; var gy = 0.0;
                        for(var ki=-1; ki<=1; ki++) {
                            for(var kj=-1; kj<=1; kj++) {
                                let px = dot(textureLoad(tex, ppos + vec2(kj,ki), 0).rgb, vec3(0.299, 0.587, 0.114));
                                let kidx = (ki + 1) * 3 + (kj + 1);
                                gx += px * sobelX[kidx];
                                gy += px * sobelY[kidx];
                            }
                        }
                        Ixx += gx * gx;
                        Iyy += gy * gy;
                        Ixy += gx * gy;
                    }
                }

                // Harris corner response
                let k = 0.04;
                let det = Ixx * Iyy - Ixy * Ixy;
                let trace = Ixx + Iyy;
                let resp = det - k * trace * trace;
                responses[id.y * p.width + id.x] = select(0.0, resp, resp > p.threshold);
            }
        `,

    extract: `
            struct Keypoint { x: f32, y: f32, score: f32, angle: f32, desc: array<u32, 8> }
            struct Params { width: u32, height: u32, threshold: f32, max_f: u32 }
            struct Pattern { pairs: array<vec4<i32>, 256> }

            @group(0) @binding(0) var<storage, read> input: array<f32>;
            @group(0) @binding(1) var<storage, read_write> count: atomic<u32>;
            @group(0) @binding(2) var<storage, read_write> output: array<Keypoint>;
            @group(0) @binding(3) var<uniform> p: Params;
            @group(0) @binding(4) var tex: texture_2d<f32>;
            @group(0) @binding(5) var<storage, read> pattern: Pattern;

            @compute @workgroup_size(8, 8)
            fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                if (id.x < 15 || id.y < 15 || id.x >= p.width-15 || id.y >= p.height-15) { return; }
                let idx = id.y * p.width + id.x;
                let val = input[idx];
                if (val <= 0.0) { return; }

                // Non-maximum suppression (7x7 window)
                for(var i=-3; i<=3; i++) {
                    for(var j=-3; j<=3; j++) {
                        if (input[(id.y+u32(i)) * p.width + (id.x+u32(j))] > val) { return; }
                    }
                }

                let outIdx = atomicAdd(&count, 1u);
                if (outIdx >= p.max_f) { return; }

                output[outIdx].x = f32(id.x);
                output[outIdx].y = f32(id.y);
                output[outIdx].score = val;

                // Compute orientation using image moments
                var m01 = 0.0; var m10 = 0.0;
                for(var dy=-7; dy<=7; dy++) {
                    for(var dx=-7; dx<=7; dx++) {
                        let g = dot(textureLoad(tex, vec2<i32>(id.xy)+vec2(dx,dy), 0).rgb, vec3(0.299, 0.587, 0.114));
                        m10 += f32(dx) * g;
                        m01 += f32(dy) * g;
                    }
                }
                let angle = atan2(m01, m10);
                output[outIdx].angle = angle;

                // BRIEF descriptor with rotation
                let c = cos(angle);
                let s = sin(angle);

                for(var k=0u; k<8u; k++) {
                    var bits = 0u;
                    for(var b=0u; b<32u; b++) {
                        let pairIdx = k * 32u + b;
                        let pair = pattern.pairs[pairIdx];

                        // Rotate sampling points
                        let x1 = i32(f32(pair.x) * c - f32(pair.y) * s);
                        let y1 = i32(f32(pair.x) * s + f32(pair.y) * c);
                        let x2 = i32(f32(pair.z) * c - f32(pair.w) * s);
                        let y2 = i32(f32(pair.z) * s + f32(pair.w) * c);

                        let p1 = dot(textureLoad(tex, vec2<i32>(id.xy) + vec2(x1, y1), 0).rgb, vec3(0.299, 0.587, 0.114));
                        let p2 = dot(textureLoad(tex, vec2<i32>(id.xy) + vec2(x2, y2), 0).rgb, vec3(0.299, 0.587, 0.114));

                        if (p1 < p2) {
                            bits |= (1u << b);
                        }
                    }
                    output[outIdx].desc[k] = bits;
                }
            }
        `,

    match: `
            struct Keypoint { x: f32, y: f32, score: f32, angle: f32, desc: array<u32, 8> }
            struct Match { idxA: i32, idxB: i32, dist: u32 }
            @group(0) @binding(0) var<storage, read> listA: array<Keypoint>;
            @group(0) @binding(1) var<storage, read> listB: array<Keypoint>;
            @group(0) @binding(2) var<storage, read_write> matches: array<Match>;
            @group(0) @binding(3) var<uniform> counts: vec2<u32>;

            @compute @workgroup_size(64)
            fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                if (id.x >= counts.x) { return; }

                var bestDist = 256u;
                var secondDist = 256u;
                var bestIdx = -1;
                let descA = listA[id.x].desc;

                for(var i=0u; i<counts.y; i++) {
                    var dist = 0u;
                    for(var k=0; k<8; k++) {
                        dist += countOneBits(descA[k] ^ listB[i].desc[k]);
                    }

                    if (dist < bestDist) {
                        secondDist = bestDist;
                        bestDist = dist;
                        bestIdx = i32(i);
                    } else if (dist < secondDist) {
                        secondDist = dist;
                    }
                }

                matches[id.x].idxA = i32(id.x);
                matches[id.x].idxB = bestIdx;
                matches[id.x].dist = bestDist;
            }
        `
};

let device, gaussianPipe, harrisPipe, extractPipe, matchPipe;
const state = { imgA: null, imgB: null };

async function init() {
    try {
        if (!navigator.gpu) {
            showError("WebGPU is not supported in this browser.");
            return;
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            showError("Failed to get GPU adapter.");
            return;
        }

        device = await adapter.requestDevice();

        gaussianPipe = device.createComputePipeline({
            layout: 'auto',
            compute: { module: device.createShaderModule({ code: SHADERS.gaussian }), entryPoint: 'main' }
        });

        harrisPipe = device.createComputePipeline({
            layout: 'auto',
            compute: { module: device.createShaderModule({ code: SHADERS.harris }), entryPoint: 'main' }
        });

        extractPipe = device.createComputePipeline({
            layout: 'auto',
            compute: { module: device.createShaderModule({ code: SHADERS.extract }), entryPoint: 'main' }
        });

        matchPipe = device.createComputePipeline({
            layout: 'auto',
            compute: { module: device.createShaderModule({ code: SHADERS.match }), entryPoint: 'main' }
        });

        log("✓ WebGPU initialized successfully");
    } catch (err) {
        showError(`WebGPU initialization failed: ${err.message}`);
    }
}

async function runFeaturePipeline(img) {
    const w = img.width;
    const h = img.height;
    const threshold = parseFloat(document.getElementById('threshold').value);

    // Create textures
    const srcTex = device.createTexture({
        size: [w, h],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });

    const blurTex = device.createTexture({
        size: [w, h],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
    });

    device.queue.copyExternalImageToTexture({ source: img }, { texture: srcTex }, [w, h]);

    // Buffers
    const resBuf = device.createBuffer({ size: w * h * 4, usage: GPUBufferUsage.STORAGE });
    const countBuf = device.createBuffer({ size: 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
    const kpBuf = device.createBuffer({ size: MAX_FEATURES * 64, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const pBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const patternBuf = device.createBuffer({ size: BRIEF_PAIRS * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });

    device.queue.writeBuffer(pBuf, 0, new Uint32Array([w, h]));
    device.queue.writeBuffer(pBuf, 8, new Float32Array([threshold]));
    device.queue.writeBuffer(pBuf, 12, new Uint32Array([MAX_FEATURES]));
    device.queue.writeBuffer(patternBuf, 0, new Int32Array(BRIEF_PATTERN));
    device.queue.writeBuffer(countBuf, 0, new Uint32Array([0]));

    const encoder = device.createCommandEncoder();

    // Gaussian blur pass
    const gPass = encoder.beginComputePass();
    gPass.setPipeline(gaussianPipe);
    gPass.setBindGroup(0, device.createBindGroup({
        layout: gaussianPipe.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: srcTex.createView() },
            { binding: 1, resource: blurTex.createView() }
        ]
    }));
    gPass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
    gPass.end();

    // Harris corner detection
    const hPass = encoder.beginComputePass();
    hPass.setPipeline(harrisPipe);
    hPass.setBindGroup(0, device.createBindGroup({
        layout: harrisPipe.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: blurTex.createView() },
            { binding: 1, resource: { buffer: resBuf } },
            { binding: 2, resource: { buffer: pBuf } }
        ]
    }));
    hPass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
    hPass.end();

    // Feature extraction
    const ePass = encoder.beginComputePass();
    ePass.setPipeline(extractPipe);
    ePass.setBindGroup(0, device.createBindGroup({
        layout: extractPipe.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: resBuf } },
            { binding: 1, resource: { buffer: countBuf } },
            { binding: 2, resource: { buffer: kpBuf } },
            { binding: 3, resource: { buffer: pBuf } },
            { binding: 4, resource: blurTex.createView() },
            { binding: 5, resource: { buffer: patternBuf } }
        ]
    }));
    ePass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
    ePass.end();

    const readCount = device.createBuffer({ size: 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const readKps = device.createBuffer({ size: MAX_FEATURES * 64, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    encoder.copyBufferToBuffer(countBuf, 0, readCount, 0, 4);
    encoder.copyBufferToBuffer(kpBuf, 0, readKps, 0, MAX_FEATURES * 64);

    device.queue.submit([encoder.finish()]);
    await Promise.all([readCount.mapAsync(GPUMapMode.READ), readKps.mapAsync(GPUMapMode.READ)]);

    const count = new Uint32Array(readCount.getMappedRange())[0];
    const data = new Float32Array(readKps.getMappedRange().slice(0));

    readCount.unmap();
    readKps.unmap();

    return { count: Math.min(count, MAX_FEATURES), data, buffer: kpBuf };
}

async function processAndMatch() {
    if (!state.imgA || !state.imgB || !device) return;

    const startTime = performance.now();
    document.getElementById('processBtn').disabled = true;
    log("🔍 Detecting features in both images...");

    try {
        const featA = await runFeaturePipeline(state.imgA);
        const featB = await runFeaturePipeline(state.imgB);

        log(`✓ Found ${featA.count} features in A, ${featB.count} in B`);
        document.getElementById('featA').textContent = featA.count;
        document.getElementById('featB').textContent = featB.count;

        if (featA.count === 0 || featB.count === 0) {
            log("⚠ Not enough features detected. Try adjusting the threshold.");
            document.getElementById('processBtn').disabled = false;
            return;
        }

        log("🔗 Matching features...");

        const matchBuf = device.createBuffer({
            size: MAX_FEATURES * 12,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });
        const countBuf = device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(countBuf, 0, new Uint32Array([featA.count, featB.count]));

        const encoder = device.createCommandEncoder();
        const mPass = encoder.beginComputePass();
        mPass.setPipeline(matchPipe);
        mPass.setBindGroup(0, device.createBindGroup({
            layout: matchPipe.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: featA.buffer } },
                { binding: 1, resource: { buffer: featB.buffer } },
                { binding: 2, resource: { buffer: matchBuf } },
                { binding: 3, resource: { buffer: countBuf } }
            ]
        }));
        mPass.dispatchWorkgroups(Math.ceil(featA.count / 64));
        mPass.end();

        const readMatches = device.createBuffer({
            size: MAX_FEATURES * 12,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        });
        encoder.copyBufferToBuffer(matchBuf, 0, readMatches, 0, MAX_FEATURES * 12);
        device.queue.submit([encoder.finish()]);

        await readMatches.mapAsync(GPUMapMode.READ);
        const matchData = new Uint32Array(readMatches.getMappedRange());

        const matches = [];
        for (let i = 0; i < featA.count; i++) {
            const idxA = matchData[i * 3];
            const idxB = matchData[i * 3 + 1];
            const dist = matchData[i * 3 + 2];
            matches.push({ idxA, idxB, dist });
        }

        readMatches.unmap();

        const endTime = performance.now();
        const procTime = Math.round(endTime - startTime);

        renderResults(featA, featB, matches);

        document.getElementById('procTime').textContent = `${procTime}ms`;
        document.getElementById('stats').style.display = 'grid';
        log(`✓ Matching complete in ${procTime}ms`);
    } catch (err) {
        showError(`Processing failed: ${err.message}`);
        console.error(err);
    }

    document.getElementById('processBtn').disabled = false;
}

function renderResults(fa, fb, matches) {
    const canvas = document.getElementById('matchCanvas');
    const ctx = canvas.getContext('2d');
    const w = state.imgA.width;
    const h = state.imgA.height;
    const ratio = parseFloat(document.getElementById('ratio').value);

    canvas.width = w * 2;
    canvas.height = h;
    ctx.drawImage(state.imgA, 0, 0);
    ctx.drawImage(state.imgB, w, 0);

    // Apply ratio test
    const goodMatches = [];
    for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        if (m.idxB === -1 || m.dist > 80) continue;

        // Find second best match
        let secondBest = 256;
        for (let j = 0; j < matches.length; j++) {
            if (i === j) continue;
            if (matches[j].idxB === m.idxB && matches[j].dist < secondBest) {
                secondBest = matches[j].dist;
            }
        }

        // Ratio test: best_dist / second_best_dist < threshold
        if (secondBest > 0 && m.dist / secondBest < ratio) {
            goodMatches.push(m);
        }
    }

    document.getElementById('rawMatches').textContent = matches.filter(m => m.idxB !== -1).length;
    document.getElementById('goodMatches').textContent = goodMatches.length;

    ctx.lineWidth = 1.5;
    goodMatches.forEach((m, i) => {
        const ax = fa.data[m.idxA * 16];
        const ay = fa.data[m.idxA * 16 + 1];
        const bx = fb.data[m.idxB * 16] + w;
        const by = fb.data[m.idxB * 16 + 1];

        const hue = (i * 137.508) % 360;
        ctx.strokeStyle = `hsl(${hue}, 80%, 60%)`;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();

        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(ax, ay, 3, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, 2 * Math.PI);
        ctx.fill();
    });
}

function handleFile(id, key) {
    document.getElementById(id).onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const img = new Image();
        img.onload = () => {
            state[key] = img;
            if (state.imgA && state.imgB) {
                document.getElementById('processBtn').disabled = false;
            }
            log(`✓ Loaded ${key}: ${img.width}x${img.height}`);
        };
        img.src = URL.createObjectURL(file);
    };
}

function log(msg) {
    const d = document.getElementById('debug');
    const timestamp = new Date().toLocaleTimeString();
    d.textContent += `\n[${timestamp}] ${msg}`;
    d.scrollTop = d.scrollHeight;
}

function showError(msg) {
    const container = document.querySelector('.container');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = `❌ ${msg}`;
    container.insertBefore(errorDiv, container.firstChild);
    log(`ERROR: ${msg}`);
}

// UI bindings
document.getElementById('threshold').oninput = (e) => {
    document.getElementById('threshVal').textContent = e.target.value;
};

document.getElementById('ratio').oninput = (e) => {
    document.getElementById('ratioVal').textContent = e.target.value;
};

handleFile('imgA', 'imgA');
handleFile('imgB', 'imgB');
document.getElementById('processBtn').onclick = processAndMatch;

init();