let device, labelBuffer, tempBuffer, size = 256;

// Initialize WebGPU
async function initWebGPU() {
    if (!navigator.gpu) {
        throw new Error('WebGPU not supported');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error('No GPU adapter found');
    }

    device = await adapter.requestDevice();
    return device;
}

// Generate random binary image
function generateBinaryImage(size, density) {
    const data = new Uint32Array(size * size);
    const threshold = density / 100;

    for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() < threshold ? 1 : 0;
    }

    return data;
}

// Visualize input
function visualizeInput(data, canvas) {
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);

    for (let i = 0; i < data.length; i++) {
        const idx = i * 4;
        const val = data[i] ? 255 : 0;
        imageData.data[idx] = val;
        imageData.data[idx + 1] = val;
        imageData.data[idx + 2] = val;
        imageData.data[idx + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
}

// Visualize output with colors
function visualizeOutput(data, canvas, numComponents) {
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(size, size);

    // Generate distinct colors for each component
    const colors = [];
    for (let i = 0; i <= numComponents; i++) {
        const hue = (i * 137.508) % 360; // Golden angle for good distribution
        colors.push(hslToRgb(hue / 360, 0.7, 0.5));
    }
    colors[0] = [0, 0, 0]; // Background is black

    for (let i = 0; i < data.length; i++) {
        const idx = i * 4;
        const label = data[i];
        const color = colors[label % colors.length];
        imageData.data[idx] = color[0];
        imageData.data[idx + 1] = color[1];
        imageData.data[idx + 2] = color[2];
        imageData.data[idx + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
}

// HSL to RGB conversion
function hslToRgb(h, s, l) {
    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// WebGPU CCL implementation
async function runCCL(inputData, width, height, maxIterations) {
    const numElements = width* height;

    // Create buffers
    const inputBuffer = device.createBuffer({
        size: numElements * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    labelBuffer = device.createBuffer({
        size: numElements * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    tempBuffer = device.createBuffer({
        size: numElements * 4,
        usage: GPUBufferUsage.STORAGE,
    });

    const readBuffer = device.createBuffer({
        size: numElements * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    // Upload input data
    device.queue.writeBuffer(inputBuffer, 0, inputData);

    // Initialization shader - assign unique labels to foreground pixels
    const initShader = `
                @group(0) @binding(0) var<storage, read> input: array<u32>;
                @group(0) @binding(1) var<storage, read_write> labels: array<u32>;
                
                @compute @workgroup_size(16, 16)
                fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                    let width = ${width}u;
                    let height = ${height}u;
                    
                    if (id.x >= width || id.y >= height) {
                        return;
                    }
                    
                    let idx = id.y * width + id.x;
                    
                    if (input[idx] > 0u) {
                        labels[idx] = idx + 1u; // Start labels at 1
                    } else {
                        labels[idx] = 0u;
                    }
                }
            `;

    // Label propagation shader - 8-connectivity
    const propagateShader = `
                @group(0) @binding(0) var<storage, read> labelsIn: array<u32>;
                @group(0) @binding(1) var<storage, read_write> labelsOut: array<u32>;
                
                @compute @workgroup_size(16, 16)
                fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                    let width = ${width}u;
                    let height = ${height}u;
                    
                    if (id.x >= width || id.y >= height) {
                        return;
                    }
                    
                    let idx = id.y * width + id.x;
                    let currentLabel = labelsIn[idx];
                    
                    if (currentLabel == 0u) {
                        labelsOut[idx] = 0u;
                        return;
                    }
                    
                    var minLabel = currentLabel;
                    
                    // Check 8 neighbors
                    let offsets = array<vec2<i32>, 8>(
                        vec2<i32>(-1, -1), vec2<i32>(0, -1), vec2<i32>(1, -1),
                        vec2<i32>(-1,  0),                   vec2<i32>(1,  0),
                        vec2<i32>(-1,  1), vec2<i32>(0,  1), vec2<i32>(1,  1)
                    );
                    
                    for (var i = 0; i < 8; i++) {
                        let nx = i32(id.x) + offsets[i].x;
                        let ny = i32(id.y) + offsets[i].y;
                        
                        if (nx >= 0 && nx < i32(width) && ny >= 0 && ny < i32(height)) {
                            let nidx = u32(ny) * width + u32(nx);
                            let neighborLabel = labelsIn[nidx];
                            
                            if (neighborLabel > 0u && neighborLabel < minLabel) {
                                minLabel = neighborLabel;
                            }
                        }
                    }
                    
                    labelsOut[idx] = minLabel;
                }
            `;

    // Create pipelines
    const initModule = device.createShaderModule({ code: initShader });
    const propagateModule = device.createShaderModule({ code: propagateShader });

    const initPipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: initModule, entryPoint: 'main' }
    });

    const propagatePipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: propagateModule, entryPoint: 'main' }
    });

    // Create bind groups
    const initBindGroup = device.createBindGroup({
        layout: initPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: inputBuffer } },
            { binding: 1, resource: { buffer: labelBuffer } }
        ]
    });

    const workgroupsX = Math.ceil(size / 16);
    const workgroupsY = Math.ceil(size / 16);

    // Execute initialization
    const commandEncoder1 = device.createCommandEncoder();
    const passEncoder1 = commandEncoder1.beginComputePass();
    passEncoder1.setPipeline(initPipeline);
    passEncoder1.setBindGroup(0, initBindGroup);
    passEncoder1.dispatchWorkgroups(workgroupsX, workgroupsY);
    passEncoder1.end();
    device.queue.submit([commandEncoder1.finish()]);

    // Iterative propagation
    let iterations = 0;
    for (let iter = 0; iter < maxIterations; iter++) {
        iterations++;

        const propagateBindGroup = device.createBindGroup({
            layout: propagatePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: labelBuffer } },
                { binding: 1, resource: { buffer: tempBuffer } }
            ]
        });

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(propagatePipeline);
        passEncoder.setBindGroup(0, propagateBindGroup);
        passEncoder.dispatchWorkgroups(workgroupsX, workgroupsY);
        passEncoder.end();
        commandEncoder.copyBufferToBuffer(tempBuffer, 0, labelBuffer, 0, numElements * 4);
        device.queue.submit([commandEncoder.finish()]);
    }

    // Read back results
    const commandEncoder2 = device.createCommandEncoder();
    commandEncoder2.copyBufferToBuffer(labelBuffer, 0, readBuffer, 0, numElements * 4);
    device.queue.submit([commandEncoder2.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const result = new Uint32Array(readBuffer.getMappedRange()).slice();
    readBuffer.unmap();

    // Clean up
    inputBuffer.destroy();
    labelBuffer.destroy();
    tempBuffer.destroy();
    readBuffer.destroy();

    return { labels: result, iterations };
}

// Count unique components
function countComponents(labels) {
    const uniqueLabels = new Set();
    let foregroundPixels = 0;

    for (let i = 0; i < labels.length; i++) {
        if (labels[i] > 0) {
            uniqueLabels.add(labels[i]);
            foregroundPixels++;
        }
    }

    return { count: uniqueLabels.size, foregroundPixels };
}

// Main execution
async function run(inputData,width,height, maxIter=5) {
    try {
        const inputCanvas = document.getElementById('inputCanvas');
        const outputCanvas = document.getElementById('outputCanvas');
        const density = parseInt(document.getElementById('densitySlider').value);
        //const maxIter = parseInt(document.getElementById('iterSlider').value);

        document.getElementById('runBtn').disabled = true;
        document.getElementById('errorMsg').innerHTML = '';

        // Generate input
        //const inputData = generateBinaryImage(size, density);
        //visualizeInput(inputData, inputCanvas);

        // Run CCL
        const startTime = performance.now();
        const { labels, iterations } = await runCCL(inputData, width, height, maxIter);
        const endTime = performance.now();

        // Count components
        const { count, foregroundPixels } = countComponents(labels);

        // Visualize output
        visualizeOutput(labels, outputCanvas, count);

        //// Update stats
        //document.getElementById('componentCount').textContent = count;
        //document.getElementById('iterationCount').textContent = iterations;
        //document.getElementById('processingTime').textContent = (endTime - startTime).toFixed(2) + 'ms';
        //document.getElementById('pixelCount').textContent = foregroundPixels;

        //document.getElementById('runBtn').disabled = false;
    } catch (error) {
        document.getElementById('errorMsg').innerHTML = `<div class="error">Error: ${error.message}</div>`;
        document.getElementById('runBtn').disabled = false;
    }
}

// UI Controls
document.getElementById('sizeSlider').addEventListener('input', (e) => {
    size = parseInt(e.target.value);
    document.getElementById('sizeValue').textContent = size;
    document.getElementById('sizeValue2').textContent = size;
});

document.getElementById('densitySlider').addEventListener('input', (e) => {
    document.getElementById('densityValue').textContent = e.target.value;
});

document.getElementById('iterSlider').addEventListener('input', (e) => {
    document.getElementById('iterValue').textContent = e.target.value;
});

document.getElementById('runBtn').addEventListener('click', run);

// Initialize
initWebGPU().then(() => {
    console.log('WebGPU initialized');
    run();
}).catch(error => {
    document.getElementById('errorMsg').innerHTML = `<div class="error">WebGPU initialization failed: ${error.message}<br>Please use a browser that supports WebGPU (Chrome/Edge 113+, Firefox with flag enabled)</div>`;
});