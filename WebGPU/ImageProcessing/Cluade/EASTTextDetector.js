
class EASTDetector {
    constructor() {
        this.device = null;
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentImage = null;
    }

    async init() {
        if (!navigator.gpu) {
            throw new Error('WebGPU not supported');
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error('No GPU adapter found');
        }

        this.device = await adapter.requestDevice();
    }

    // WGSL shader for image pyramid generation
    getPyramidShader() {
        return `
                    @group(0) @binding(0) var inputTex: texture_2d<f32>;
                    @group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;
                    @group(0) @binding(2) var texSampler: sampler;

                    @compute @workgroup_size(8, 8)
                    fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                        let dims = textureDimensions(outputTex);
                        if (id.x >= dims.x || id.y >= dims.y) {
                            return;
                        }

                        let uv = vec2<f32>(f32(id.x) + 0.5, f32(id.y) + 0.5) / vec2<f32>(f32(dims.x), f32(dims.y));
                        let color = textureSampleLevel(inputTex, texSampler, uv, 0.0);
                        textureStore(outputTex, vec2<i32>(i32(id.x), i32(id.y)), color);
                    }
                `;
    }

    // WGSL shader for simple feature extraction (placeholder backbone)
    getFeatureShader() {
        return `
                    @group(0) @binding(0) var inputTex: texture_2d<f32>;
                    @group(0) @binding(1) var outputTex: texture_storage_2d<rgba32float, write>;
                    @group(0) @binding(2) var texSampler: sampler;

                    @compute @workgroup_size(8, 8)
                    fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                        let dims = textureDimensions(outputTex);
                        if (id.x >= dims.x || id.y >= dims.y) {
                            return;
                        }

                        // Simple edge detection kernel (Sobel-like)
                        var sum = vec4<f32>(0.0);
                        let pos = vec2<i32>(i32(id.x), i32(id.y));

                        for (var dy: i32 = -1; dy <= 1; dy++) {
                            for (var dx: i32 = -1; dx <= 1; dx++) {
                                let samplePos = pos + vec2<i32>(dx, dy);
                                let uv = (vec2<f32>(samplePos) + 0.5) / vec2<f32>(dims);
                                let sample = textureSampleLevel(inputTex, texSampler, uv, 0.0);

                                // Sobel weights
                                let wx = f32(dx);
                                let wy = f32(dy);
                                sum += sample * sqrt(wx * wx + wy * wy);
                            }
                        }

                        textureStore(outputTex, pos, sum);
                    }
                `;
    }

    // WGSL shader for EAST head (score and geometry prediction)
    getEASTHeadShader() {
        return `
                    @group(0) @binding(0) var inputTex: texture_2d<f32>;
                    @group(0) @binding(1) var scoreMap: texture_storage_2d<r32float, write>;
                    @group(0) @binding(2) var geoMap: texture_storage_2d<rgba32float, write>;

                    @compute @workgroup_size(8, 8)
                    fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                        let dims = textureDimensions(scoreMap);
                        if (id.x >= dims.x || id.y >= dims.y) {
                            return;
                        }

                        let pos = vec2<i32>(i32(id.x), i32(id.y));
                        let uv = (vec2<f32>(pos) + 0.5) / vec2<f32>(dims);

                        let features = textureLoad(inputTex, pos, 0);

                        // Simple heuristic: high variance -> likely text
                        let variance = features.r + features.g + features.b;
                        let score = clamp(variance * 0.3, 0.0, 1.0);

                        // Geometry: top, right, bottom, left distances
                        let geo = vec4<f32>(16.0, 16.0, 16.0, 16.0);

                        textureStore(scoreMap, pos, vec4<f32>(score, 0.0, 0.0, 0.0));
                        textureStore(geoMap, pos, geo);
                    }
                `;
    }

    // WGSL shader for box restoration
    getBoxRestoreShader() {
        return `
                    struct Box {
                        x: f32,
                        y: f32,
                        w: f32,
                        h: f32,
                        score: f32,
                        padding: vec3<f32>,
                    }

                    @group(0) @binding(0) var scoreMap: texture_2d<f32>;
                    @group(0) @binding(1) var geoMap: texture_2d<f32>;
                    @group(0) @binding(2) var<storage, read_write> boxes: array<Box>;
                    @group(0) @binding(3) var<uniform> params: vec4<f32>; // stride, scoreThreshold, width, height

                    @compute @workgroup_size(64)
                    fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                        let dims = textureDimensions(scoreMap);
                        let stride = u32(params.x);
                        let threshold = params.y;

                        let total = (dims.x / stride) * (dims.y / stride);
                        if (id.x >= total) {
                            return;
                        }

                        let gridX = id.x % (dims.x / stride);
                        let gridY = id.x / (dims.x / stride);
                        let pos = vec2<i32>(i32(gridX * stride), i32(gridY * stride));

                        let score = textureLoad(scoreMap, pos, 0).r;

                        if (score > threshold) {
                            let geo = textureLoad(geoMap, pos, 0);

                            let cx = f32(pos.x);
                            let cy = f32(pos.y);

                            boxes[id.x].x = cx - geo.w;
                            boxes[id.x].y = cy - geo.r;
                            boxes[id.x].w = geo.r + geo.w;
                            boxes[id.x].h = geo.r + geo.b;
                            boxes[id.x].score = score;
                        } else {
                            boxes[id.x].score = 0.0;
                        }
                    }
                `;
    }

    async loadImageToTexture(image) {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const texture = this.device.createTexture({
            size: [canvas.width, canvas.height],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        this.device.queue.writeTexture(
            { texture },
            imageData.data,
            { bytesPerRow: canvas.width * 4 },
            { width: canvas.width, height: canvas.height }
        );

        return texture;
    }

    async detect(image, scoreThreshold = 0.7, nmsThreshold = 0.3) {
        const startTime = performance.now();

        // Load image to texture
        const inputTexture = await this.loadImageToTexture(image);
        const width = image.width;
        const height = image.height;

        // Create feature map
        const featureTexture = this.device.createTexture({
            size: [width, height],
            format: 'rgba32float',
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
        });

        // Create score and geometry maps
        const scoreTexture = this.device.createTexture({
            size: [width, height],
            format: 'r32float',
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
        });

        const geoTexture = this.device.createTexture({
            size: [width, height],
            format: 'rgba32float',
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
        });

        const sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });

        // Run feature extraction
        await this.runFeatureExtraction(inputTexture, featureTexture, sampler, width, height);

        // Run EAST head
        await this.runEASTHead(featureTexture, scoreTexture, geoTexture, width, height);

        // Run box restoration
        const boxes = await this.runBoxRestore(scoreTexture, geoTexture, width, height, scoreThreshold);

        // Run NMS
        const finalBoxes = this.nms(boxes, nmsThreshold);

        const endTime = performance.now();

        return {
            boxes: finalBoxes,
            processingTime: Math.round(endTime - startTime),
        };
    }

    async runFeatureExtraction(inputTex, outputTex, sampler, width, height) {
        const shaderModule = this.device.createShaderModule({
            code: this.getFeatureShader(),
        });

        const pipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main',
            },
        });

        const bindGroup = this.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: inputTex.createView() },
                { binding: 1, resource: outputTex.createView() },
                { binding: 2, resource: sampler },
            ],
        });

        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
        await this.device.queue.onSubmittedWorkDone();
    }

    async runEASTHead(featureTex, scoreTex, geoTex, width, height) {
        const shaderModule = this.device.createShaderModule({
            code: this.getEASTHeadShader(),
        });

        const pipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main',
            },
        });

        const bindGroup = this.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: featureTex.createView() },
                { binding: 1, resource: scoreTex.createView() },
                { binding: 2, resource: geoTex.createView() },
            ],
        });

        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
        await this.device.queue.onSubmittedWorkDone();
    }

    async runBoxRestore(scoreTex, geoTex, width, height, threshold) {
        const stride = 4;
        const maxBoxes = Math.ceil(width / stride) * Math.ceil(height / stride);

        const boxBuffer = this.device.createBuffer({
            size: maxBoxes * 32, // 8 floats per box
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        const paramsBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const paramsData = new Float32Array([stride, threshold, width, height]);
        this.device.queue.writeBuffer(paramsBuffer, 0, paramsData);

        const shaderModule = this.device.createShaderModule({
            code: this.getBoxRestoreShader(),
        });

        const pipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main',
            },
        });

        const bindGroup = this.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: scoreTex.createView() },
                { binding: 1, resource: geoTex.createView() },
                { binding: 2, resource: { buffer: boxBuffer } },
                { binding: 3, resource: { buffer: paramsBuffer } },
            ],
        });

        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.dispatchWorkgroups(Math.ceil(maxBoxes / 64));
        passEncoder.end();

        const readBuffer = this.device.createBuffer({
            size: maxBoxes * 32,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        commandEncoder.copyBufferToBuffer(boxBuffer, 0, readBuffer, 0, maxBoxes * 32);
        this.device.queue.submit([commandEncoder.finish()]);

        await readBuffer.mapAsync(GPUMapMode.READ);
        const arrayBuffer = readBuffer.getMappedRange();
        const data = new Float32Array(arrayBuffer);

        const boxes = [];
        for (let i = 0; i < maxBoxes; i++) {
            const offset = i * 8;
            const score = data[offset + 4];
            if (score > 0) {
                boxes.push({
                    x: data[offset],
                    y: data[offset + 1],
                    w: data[offset + 2],
                    h: data[offset + 3],
                    score: score,
                });
            }
        }

        readBuffer.unmap();

        return boxes;
    }

    nms(boxes, threshold) {
        boxes.sort((a, b) => b.score - a.score);
        const keep = [];

        while (boxes.length > 0) {
            const current = boxes.shift();
            keep.push(current);

            boxes = boxes.filter(box => {
                const iou = this.calculateIoU(current, box);
                return iou < threshold;
            });
        }

        return keep;
    }

    calculateIoU(box1, box2) {
        const x1 = Math.max(box1.x, box2.x);
        const y1 = Math.max(box1.y, box2.y);
        const x2 = Math.min(box1.x + box1.w, box2.x + box2.w);
        const y2 = Math.min(box1.y + box1.h, box2.y + box2.h);

        const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
        const area1 = box1.w * box1.h;
        const area2 = box2.w * box2.h;
        const union = area1 + area2 - intersection;

        return union > 0 ? intersection / union : 0;
    }

    drawResults(image, boxes) {
        this.canvas.width = image.width;
        this.canvas.height = image.height;
        this.ctx.drawImage(image, 0, 0);

        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 3;
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = '#00ff00';

        boxes.forEach((box, i) => {
            this.ctx.strokeRect(box.x, box.y, box.w, box.h);
            this.ctx.fillText(
                `${(box.score * 100).toFixed(0)}%`,
                box.x,
                box.y - 5
            );
        });
    }
}

// UI handling
const detector = new EASTDetector();
let currentImage = null;

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const detectBtn = document.getElementById('detectBtn');
const canvasContainer = document.getElementById('canvasContainer');
const loading = document.getElementById('loading');
const errorMsg = document.getElementById('errorMsg');
const stats = document.getElementById('stats');
const scoreThreshold = document.getElementById('scoreThreshold');
const scoreValue = document.getElementById('scoreValue');
const nmsThreshold = document.getElementById('nmsThreshold');
const nmsValue = document.getElementById('nmsValue');

uploadArea.onclick = () => fileInput.click();

uploadArea.ondragover = (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
};

uploadArea.ondragleave = () => {
    uploadArea.classList.remove('dragover');
};

uploadArea.ondrop = (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
};

fileInput.onchange = (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
};

scoreThreshold.oninput = (e) => {
    scoreValue.textContent = (e.target.value / 100).toFixed(2);
};

nmsThreshold.oninput = (e) => {
    nmsValue.textContent = (e.target.value / 100).toFixed(2);
};

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        showError('Please select an image file');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            currentImage = img;
            detectBtn.disabled = false;
            canvasContainer.style.display = 'block';
            detector.canvas.width = img.width;
            detector.canvas.height = img.height;
            detector.ctx.drawImage(img, 0, 0);
            document.getElementById('imageSize').textContent = `${img.width}x${img.height}`;
            stats.style.display = 'grid';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

detectBtn.onclick = async () => {
    if (!currentImage) return;

    try {
        loading.style.display = 'block';
        errorMsg.innerHTML = '';
        detectBtn.disabled = true;

        const scoreThresh = parseFloat(scoreThreshold.value) / 100;
        const nmsThresh = parseFloat(nmsThreshold.value) / 100;

        const result = await detector.detect(currentImage, scoreThresh, nmsThresh);
        console.log(['result', result]);
        detector.drawResults(currentImage, result.boxes);

        document.getElementById('detectionCount').textContent = result.boxes.length;
        document.getElementById('processingTime').textContent = `${result.processingTime}ms`;

    } catch (error) {
        showError(error.message);
    } finally {
        loading.style.display = 'none';
        detectBtn.disabled = false;
    }
};

function showError(message) {
    errorMsg.innerHTML = `<div class="error">❌ ${message}</div>`;
}

// Initialize
(async () => {
    try {
        await detector.init();
    } catch (error) {
        showError(`Initialization failed: ${error.message}`);
    }
})();