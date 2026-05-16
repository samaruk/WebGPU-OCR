import { sobel } from "/Content/WebGPU/ImageProcessing/Cluade/SobalEdgeDetection.js";
import { harrisResponse } from "/Content/WebGPU/ImageProcessing/Cluade/HarrisResponse.js";
import { nms } from "/Content/WebGPU/ImageProcessing/Cluade/nms.js";
import { harrisGPUBufferToTexture, textureToCanvas, drawGrayscaleImage, gpuBufferToArray } from "/Content/WebGPU/ImageProcessing/Cluade/Healper.js";
let device, img;
const state = {
    maxFeatures: 30000,
    threshold: 0.000001,
    levels: 4
};

function log(msg) {
    const debug = document.getElementById('debug');
    debug.style.display = 'block';
    debug.innerHTML += msg + '<br>';
    debug.scrollTop = debug.scrollHeight;
    console.log(msg);
}


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
        const allKeypoints = [];//
        let max = -Infinity, min = Infinity;
        for (let level = 0; level < pyramid.length; level++) {
            log(`Processing level ${level}...`);
            var time = new Date();
            const { keypoints, maxResp, minResp } = await processLevel(pyramid[level], level);
            log(`Level ${level} found ${keypoints.length} keypoints, Time ${(new Date() - time)} ms`);
            allKeypoints.push(...keypoints);
            max = Math.max(max, maxResp);
            min = Math.min(min, minResp);
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

    //console.log(['texture, texture.size', texture, texture.width, texture.height]);
    device.queue.writeTexture(
        { texture },
        data.data,
        { bytesPerRow: width * 4 },
        [width, height]
    );

    // Create buffers
    const sobelTexture = sobel(device, texture);
    const responseBuffer = harrisResponse(device, sobelTexture);

    // NMS
    const nmsBuffer = nms(device, responseBuffer, width, height, state.threshold);
   // Read back

    const { result, readBuffer } = await gpuBufferToArray(device, nmsBuffer);

    const keypoints = [], sobelPoints = [], harrisPoints = [];
    const scaleFactor = Math.pow(2, scale);
    let maxResp = -Infinity, minResp = Infinity, maxSobel = -Infinity, minSobel = Infinity, maxHarris = -Infinity, minHarris = Infinity;

    for (let i = 0; i < result.length; i += 4) {
        const resp = result[i], sobelValue = result[i + 3];
        var harrisValue = result[i + 2];
        sobelPoints.push(sobelValue);
        maxSobel = Math.max(maxSobel, sobelValue);
        minSobel = Math.min(minSobel, sobelValue);
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
            harrisValue = resp;
        } else if (harrisValue < 0) {
            harrisValue = 0;
        }

        maxHarris = Math.max(maxHarris, harrisValue);
        minHarris = Math.min(minHarris, harrisValue);
        harrisPoints.push(harrisValue);
    }
    if (keypoints.length > 0) {
        var harrisTexture = harrisGPUBufferToTexture(device, responseBuffer, width, height, minResp, maxResp, state.threshold);//device, outputBuffer, width, height, minValue, maxValue, hreshold
        var imageModel = await textureToCanvas(device, harrisTexture, 4);
        var sobelModel = drawGrayscaleImage(sobelPoints, width, height, maxSobel, minSobel);
        var harrisModel = drawGrayscaleImage(harrisPoints, width, height, maxHarris, minHarris);
        const img = new Image();
        img.src = imageModel.canvas.toDataURL();
        //const harrisImg = new Image();
        //harrisImg.src = imageModel.canvas.toDataURL();
        //console.log(['harrisPoints, width, height, maxHarris, minHarris', harrisPoints, width, height, maxHarris, minHarris]);
        setTimeout(() => {
            sobelModel.ctx.drawImage(img, 0, 0, width, height);
            //harrisModel.ctx.drawImage(img, 0, 0, width, height);
        },300);
    }
    readBuffer.unmap();

    if (keypoints.length > 0) {
        log(`  Response range: ${minResp.toExponential(2)} to ${maxResp.toExponential(2)}`);
    }

    return { keypoints, maxResp, minResp };
;
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
    document.getElementById('thresholdValue').textContent = state.threshold.toFixed(6);
});

document.getElementById('levels').addEventListener('input', (e) => {
    state.levels = parseInt(e.target.value);
    document.getElementById('levelsValue').textContent = state.levels;
});

document.getElementById('processBtn').addEventListener('click', processImage);

// Initialize
initWebGPU();