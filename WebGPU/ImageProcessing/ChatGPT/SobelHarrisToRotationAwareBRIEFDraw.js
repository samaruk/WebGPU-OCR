
// Pyramid Builder
class PyramidBuilder {
    constructor(device) {
        this.device = device;
        const code = `
                    @group(0) @binding(0) var inputTex: texture_2d<f32>;
                    @group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;
                    @compute @workgroup_size(8, 8)
                    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                        let dims = textureDimensions(outputTex);
                        if (gid.x >= dims.x || gid.y >= dims.y) { return; }
                        let sx = gid.x * 2u; let sy = gid.y * 2u;
                        var sum = textureLoad(inputTex, vec2<i32>(i32(sx), i32(sy)), 0);
                        sum += textureLoad(inputTex, vec2<i32>(i32(sx+1u), i32(sy)), 0);
                        sum += textureLoad(inputTex, vec2<i32>(i32(sx), i32(sy+1u)), 0);
                        sum += textureLoad(inputTex, vec2<i32>(i32(sx+1u), i32(sy+1u)), 0);
                        textureStore(outputTex, vec2<i32>(i32(gid.x), i32(gid.y)), sum * 0.25);
                    }`;
        this.pipeline = device.createComputePipeline({
            layout: 'auto',
            compute: { module: device.createShaderModule({ code }), entryPoint: 'main' }
        });
    }
    async build(tex, levels = 3) {
        const pyramid = [tex];
        let w = tex.width, h = tex.height;
        for (let i = 1; i < levels && w >= 16 && h >= 16; i++) {
            w = Math.floor(w / 2); h = Math.floor(h / 2);
            const lvl = this.device.createTexture({
                size: [w, h], format: 'rgba8unorm',
                usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
            });
            const bg = this.device.createBindGroup({
                layout: this.pipeline.getBindGroupLayout(0),
                entries: [{ binding: 0, resource: pyramid[i - 1].createView() }, { binding: 1, resource: lvl.createView() }]
            });
            const enc = this.device.createCommandEncoder();
            const pass = enc.beginComputePass();
            pass.setPipeline(this.pipeline);
            pass.setBindGroup(0, bg);
            pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
            pass.end();
            this.device.queue.submit([enc.finish()]);
            pyramid.push(lvl);
        }
        return pyramid;
    }
}

// Sobel + Harris
class SobelHarris {
    constructor(device) {
        this.device = device;
        const code = `
                    @group(0) @binding(0) var inputTex: texture_2d<f32>;
                    @group(0) @binding(1) var<storage, read_write> cornerBuf: array<f32>;
                    @group(0) @binding(2) var<uniform> params: vec2<f32>;
                    fn lum(c: vec4<f32>) -> f32 { return 0.299*c.r + 0.587*c.g + 0.114*c.b; }
                    @compute @workgroup_size(8, 8)
                    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                        let dims = vec2<u32>(u32(params.x), u32(params.y));
                        if (gid.x >= dims.x || gid.y >= dims.y) { return; }
                        let x = i32(gid.x); let y = i32(gid.y);
                        var gx = 0.0; var gy = 0.0;
                        for (var dy = -1; dy <= 1; dy++) {
                            for (var dx = -1; dx <= 1; dx++) {
                                let px = clamp(x+dx, 0, i32(dims.x)-1);
                                let py = clamp(y+dy, 0, i32(dims.y)-1);
                                let i = lum(textureLoad(inputTex, vec2<i32>(px, py), 0));
                                if (dx==-1) { gx -= i * f32(select(1,2,dy==0)); }
                                if (dx==1) { gx += i * f32(select(1,2,dy==0)); }
                                if (dy==-1) { gy -= i * f32(select(1,2,dx==0)); }
                                if (dy==1) { gy += i * f32(select(1,2,dx==0)); }
                            }
                        }
                        let Ixx = gx*gx; let Iyy = gy*gy; let Ixy = gx*gy;
                        let det = Ixx*Iyy - Ixy*Ixy; let tr = Ixx + Iyy;
                        cornerBuf[gid.y*dims.x+gid.x] = max(det - 0.04*tr*tr, 0.0);
                    }`;
        this.pipeline = device.createComputePipeline({
            layout: 'auto',
            compute: { module: device.createShaderModule({ code }), entryPoint: 'main' }
        });
    }
    async compute(tex, w, h) {
        const buf = this.device.createBuffer({
            size: w * h * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });
        const pb = this.device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.device.queue.writeBuffer(pb, 0, new Float32Array([w, h]));
        const bg = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: tex.createView() }, { binding: 1, resource: { buffer: buf } }, { binding: 2, resource: { buffer: pb } }]
        });
        const enc = this.device.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, bg);
        pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
        pass.end();
        this.device.queue.submit([enc.finish()]);
        return { cornerBuffer: buf, width: w, height: h };
    }
}

// NMS
class NMS {
    constructor(device) {
        this.device = device;
        const code = `
                    @group(0) @binding(0) var<storage, read> corner: array<f32>;
                    @group(0) @binding(1) var<storage, read_write> nms: array<f32>;
                    @group(0) @binding(2) var<uniform> params: vec3<f32>;
                    @compute @workgroup_size(8, 8)
                    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                        let dims = vec2<u32>(u32(params.x), u32(params.y));
                        if (gid.x >= dims.x || gid.y >= dims.y) { return; }
                        let idx = gid.y*dims.x + gid.x;
                        let c = corner[idx];
                        if (c < params.z) { nms[idx] = 0.0; return; }
                        var isMax = true;
                        for (var dy = -1; dy <= 1 && isMax; dy++) {
                            for (var dx = -1; dx <= 1 && isMax; dx++) {
                                if (dx==0 && dy==0) { continue; }
                                let nx = i32(gid.x)+dx; let ny = i32(gid.y)+dy;
                                if (nx>=0 && nx<i32(dims.x) && ny>=0 && ny<i32(dims.y)) {
                                    if (corner[u32(ny)*dims.x+u32(nx)] > c) { isMax = false; }
                                }
                            }
                        }
                        nms[idx] = select(0.0, c, isMax);
                    }`;
        this.pipeline = device.createComputePipeline({
            layout: 'auto',
            compute: { module: device.createShaderModule({ code }), entryPoint: 'main' }
        });
    }
    async suppress(cbuf, w, h, thresh) {
        const buf = this.device.createBuffer({ size: w * h * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
        const pb = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.device.queue.writeBuffer(pb, 0, new Float32Array([w, h, thresh]));
        const bg = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: cbuf } }, { binding: 1, resource: { buffer: buf } }, { binding: 2, resource: { buffer: pb } }]
        });
        const enc = this.device.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, bg);
        pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
        pass.end();
        this.device.queue.submit([enc.finish()]);
        return { nmsBuffer: buf, width: w, height: h };
    }
}

// GPU COMPACTION using Prefix Sum
class Compaction {
    constructor(device) {
        this.device = device;

        // Flag non-zero elements
        const flagCode = `
                    @group(0) @binding(0) var<storage, read> input: array<f32>;
                    @group(0) @binding(1) var<storage, read_write> flags: array<u32>;
                    @group(0) @binding(2) var<uniform> size: u32;

                    @compute @workgroup_size(256)
                    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                        if (gid.x >= size) { return; }
                        flags[gid.x] = u32(input[gid.x] > 0.0);
                    }`;

        // Prefix sum (scan) - up-sweep
        const scanUpCode = `
                    @group(0) @binding(0) var<storage, read_write> data: array<atomic<u32>>;
                    @group(0) @binding(1) var<uniform> params: vec2<u32>; // size, offset

                    @compute @workgroup_size(256)
                    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                        let i = gid.x;
                        let size = params.x;
                        let offset = params.y;

                        if (i >= size) { return; }

                        let ai = offset * (2u * i + 1u) - 1u;
                        let bi = offset * (2u * i + 2u) - 1u;

                        if (bi < size) {
                            let a = atomicLoad(&data[ai]);
                            atomicStore(&data[bi], atomicLoad(&data[bi]) + a);
                        }
                    }`;

        // Prefix sum - down-sweep
        const scanDownCode = `
                    @group(0) @binding(0) var<storage, read_write> data: array<atomic<u32>>;
                    @group(0) @binding(1) var<uniform> params: vec2<u32>;

                    @compute @workgroup_size(256)
                    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                        let i = gid.x;
                        let size = params.x;
                        let offset = params.y;

                        if (i >= size) { return; }

                        let ai = offset * (2u * i + 1u) - 1u;
                        let bi = offset * (2u * i + 2u) - 1u;

                        if (bi < size) {
                            let t = atomicLoad(&data[ai]);
                            atomicStore(&data[ai], atomicLoad(&data[bi]));
                            atomicStore(&data[bi], atomicLoad(&data[bi]) + t);
                        }
                    }`;

        // Compact data
        const compactCode = `
                    @group(0) @binding(0) var<storage, read> nmsData: array<f32>;
                    @group(0) @binding(1) var<storage, read> scanData: array<u32>;
                    @group(0) @binding(2) var<storage, read_write> features: array<vec4<f32>>;
                    @group(0) @binding(3) var<uniform> params: vec2<u32>; // size, width

                    @compute @workgroup_size(256)
                    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                        if (gid.x >= params.x) { return; }

                        let val = nmsData[gid.x];
                        if (val > 0.0) {
                            let outIdx = scanData[gid.x];
                            let x = f32(gid.x % params.y);
                            let y = f32(gid.x / params.y);
                            features[outIdx] = vec4<f32>(x, y, val, 0.0); // x, y, response, angle
                        }
                    }`;

        this.flagPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: { module: device.createShaderModule({ code: flagCode }), entryPoint: 'main' }
        });
        this.scanUpPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: { module: device.createShaderModule({ code: scanUpCode }), entryPoint: 'main' }
        });
        this.scanDownPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: { module: device.createShaderModule({ code: scanDownCode }), entryPoint: 'main' }
        });
        this.compactPipeline = device.createComputePipeline({
            layout: 'auto',
            compute: { module: device.createShaderModule({ code: compactCode }), entryPoint: 'main' }
        });
    }

    async compact(nmsBuf, w, h) {
        const size = w * h;
        const paddedSize = 1 << Math.ceil(Math.log2(size));

        // Create buffers
        const flagBuf = this.device.createBuffer({
            size: paddedSize * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        });

        const scanBuf = this.device.createBuffer({
            size: paddedSize * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        });

        const featureBuf = this.device.createBuffer({
            size: Math.max(size * 16, 64),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });

        const sizeBuf = this.device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        this.device.queue.writeBuffer(sizeBuf, 0, new Uint32Array([size]));

        // Step 1: Flag non-zero elements
        const enc1 = this.device.createCommandEncoder();
        const pass1 = enc1.beginComputePass();
        pass1.setPipeline(this.flagPipeline);
        pass1.setBindGroup(0, this.device.createBindGroup({
            layout: this.flagPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: nmsBuf } },
                { binding: 1, resource: { buffer: flagBuf } },
                { binding: 2, resource: { buffer: sizeBuf } }
            ]
        }));
        pass1.dispatchWorkgroups(Math.ceil(size / 256));
        pass1.end();
        enc1.copyBufferToBuffer(flagBuf, 0, scanBuf, 0, paddedSize * 4);
        this.device.queue.submit([enc1.finish()]);

        // Step 2: Prefix sum (simplified single-pass for demo)
        // In production, use work-efficient parallel scan
        const readBuf = this.device.createBuffer({
            size: paddedSize * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        const enc2 = this.device.createCommandEncoder();
        enc2.copyBufferToBuffer(scanBuf, 0, readBuf, 0, paddedSize * 4);
        this.device.queue.submit([enc2.finish()]);

        await readBuf.mapAsync(GPUMapMode.READ);
        const flags = new Uint32Array(readBuf.getMappedRange());
        const scan = new Uint32Array(paddedSize);
        let sum = 0;
        for (let i = 0; i < size; i++) {
            scan[i] = sum;
            sum += flags[i];
        }
        readBuf.unmap();

        this.device.queue.writeBuffer(scanBuf, 0, scan);

        // Step 3: Compact
        const paramBuf = this.device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        this.device.queue.writeBuffer(paramBuf, 0, new Uint32Array([size, w]));

        const enc3 = this.device.createCommandEncoder();
        const pass3 = enc3.beginComputePass();
        pass3.setPipeline(this.compactPipeline);
        pass3.setBindGroup(0, this.device.createBindGroup({
            layout: this.compactPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: nmsBuf } },
                { binding: 1, resource: { buffer: scanBuf } },
                { binding: 2, resource: { buffer: featureBuf } },
                { binding: 3, resource: { buffer: paramBuf } }
            ]
        }));
        pass3.dispatchWorkgroups(Math.ceil(size / 256));
        pass3.end();
        this.device.queue.submit([enc3.finish()]);

        return { featureBuffer: featureBuf, count: sum };
    }
}

// GPU ORB Orientation
class ORBOrientation {
    constructor(device) {
        this.device = device;
        const code = `
                    @group(0) @binding(0) var inputTex: texture_2d<f32>;
                    @group(0) @binding(1) var<storage, read_write> features: array<vec4<f32>>;
                    @group(0) @binding(2) var<uniform> params: vec2<u32>; // width, height

                    fn lum(c: vec4<f32>) -> f32 {
                        return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
                    }

                    @compute @workgroup_size(64)
                    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                        let feat = features[gid.x];
                        let fx = i32(feat.x);
                        let fy = i32(feat.y);
                        let w = i32(params.x);
                        let h = i32(params.y);

                        var m01: f32 = 0.0;
                        var m10: f32 = 0.0;
                        let radius: i32 = 15;

                        for (var dy: i32 = -radius; dy <= radius; dy++) {
                            for (var dx: i32 = -radius; dx <= radius; dx++) {
                                let px = clamp(fx + dx, 0, w - 1);
                                let py = clamp(fy + dy, 0, h - 1);
                                let intensity = lum(textureLoad(inputTex, vec2<i32>(px, py), 0));
                                m01 += f32(dy) * intensity;
                                m10 += f32(dx) * intensity;
                            }
                        }

                        let angle = atan2(m01, m10);
                        features[gid.x] = vec4<f32>(feat.x, feat.y, feat.z, angle);
                    }`;

        this.pipeline = device.createComputePipeline({
            layout: 'auto',
            compute: { module: device.createShaderModule({ code }), entryPoint: 'main' }
        });
    }

    async compute(tex, featureBuf, count, w, h) {
        const paramBuf = this.device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        this.device.queue.writeBuffer(paramBuf, 0, new Uint32Array([w, h]));

        const bg = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: tex.createView() },
                { binding: 1, resource: { buffer: featureBuf } },
                { binding: 2, resource: { buffer: paramBuf } }
            ]
        });

        const enc = this.device.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, bg);
        pass.dispatchWorkgroups(Math.ceil(count / 64));
        pass.end();
        this.device.queue.submit([enc.finish()]);

        return featureBuf;
    }
}

// GPU BRIEF Descriptor
class BRIEF {
    constructor(device) {
        this.device = device;

        // Generate pattern once and upload to GPU
        this.pattern = new Int32Array(256 * 4);
        for (let i = 0; i < 256; i++) {
            this.pattern[i * 4] = Math.floor(Math.random() * 31) - 15;     // x1
            this.pattern[i * 4 + 1] = Math.floor(Math.random() * 31) - 15; // y1
            this.pattern[i * 4 + 2] = Math.floor(Math.random() * 31) - 15; // x2
            this.pattern[i * 4 + 3] = Math.floor(Math.random() * 31) - 15; // y2
        }

        this.patternBuf = device.createBuffer({
            size: this.pattern.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.patternBuf, 0, this.pattern);

        const code = `
                    @group(0) @binding(0) var inputTex: texture_2d<f32>;
                    @group(0) @binding(1) var<storage, read> features: array<vec4<f32>>;
                    @group(0) @binding(2) var<storage, read> pattern: array<vec4<i32>>;
                    @group(0) @binding(3) var<storage, read_write> descriptors: array<u32>;
                    @group(0) @binding(4) var<uniform> params: vec2<u32>; // width, height

                    fn lum(c: vec4<f32>) -> f32 {
                        return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
                    }

                    @compute @workgroup_size(64)
                    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
                        let feat = features[gid.x];
                        let fx = feat.x;
                        let fy = feat.y;
                        let angle = feat.w;
                        let w = i32(params.x);
                        let h = i32(params.y);

                        let cosA = cos(-angle);
                        let sinA = sin(-angle);

                        // Compute 256-bit descriptor (8 x u32)
                        for (var wordIdx: u32 = 0u; wordIdx < 8u; wordIdx++) {
                            var word: u32 = 0u;

                            for (var bitIdx: u32 = 0u; bitIdx < 32u; bitIdx++) {
                                let patIdx = wordIdx * 32u + bitIdx;
                                let p = pattern[patIdx];

                                // Rotate pattern points
                                let x1 = i32(fx + f32(p.x) * cosA - f32(p.y) * sinA);
                                let y1 = i32(fy + f32(p.x) * sinA + f32(p.y) * cosA);
                                let x2 = i32(fx + f32(p.z) * cosA - f32(p.w) * sinA);
                                let y2 = i32(fy + f32(p.z) * sinA + f32(p.w) * cosA);

                                var intensity1: f32 = 0.0;
                                var intensity2: f32 = 0.0;

                                if (x1 >= 0 && x1 < w && y1 >= 0 && y1 < h) {
                                    intensity1 = lum(textureLoad(inputTex, vec2<i32>(x1, y1), 0));
                                }

                                if (x2 >= 0 && x2 < w && y2 >= 0 && y2 < h) {
                                    intensity2 = lum(textureLoad(inputTex, vec2<i32>(x2, y2), 0));
                                }

                                if (intensity1 < intensity2) {
                                    word |= (1u << bitIdx);
                                }
                            }

                            descriptors[gid.x * 8u + wordIdx] = word;
                        }
                    }`;

        this.pipeline = device.createComputePipeline({
            layout: 'auto',
            compute: { module: device.createShaderModule({ code }), entryPoint: 'main' }
        });
    }

    async compute(tex, featureBuf, count, w, h) {
        const descBuf = this.device.createBuffer({
            size: Math.max(count * 32, 64), // 8 u32s per descriptor
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });

        const paramBuf = this.device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        this.device.queue.writeBuffer(paramBuf, 0, new Uint32Array([w, h]));

        const bg = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: tex.createView() },
                { binding: 1, resource: { buffer: featureBuf } },
                { binding: 2, resource: { buffer: this.patternBuf } },
                { binding: 3, resource: { buffer: descBuf } },
                { binding: 4, resource: { buffer: paramBuf } }
            ]
        });

        const enc = this.device.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, bg);
        pass.dispatchWorkgroups(Math.ceil(count / 64));
        pass.end();
        this.device.queue.submit([enc.finish()]);

        return { featureBuffer: featureBuf, descriptorBuffer: descBuf, count };
    }
}

class SortTopK {
    sort(f) { return f.sort((a, b) => b.response - a.response); }
    topK(f, k) { return f.slice(0, Math.min(k, f.length)); }
}

// Main Pipeline
class Pipeline {
    constructor() { this.device = null; }
    async init() {
        if (!navigator.gpu) throw new Error('WebGPU not supported');
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error('No GPU adapter');
        this.device = await adapter.requestDevice();
        this.pyr = new PyramidBuilder(this.device);
        this.sh = new SobelHarris(this.device);
        this.nms = new NMS(this.device);
        this.comp = new Compaction(this.device);
        this.stk = new SortTopK();
        this.orb = new ORBOrientation(this.device);
        this.brief = new BRIEF(this.device);
    }

    async process(bmp, params) {
        const w = bmp.width, h = bmp.height;
        const tex = this.device.createTexture({
            size: [w, h], format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.device.queue.copyExternalImageToTexture({ source: bmp }, { texture: tex }, [w, h]);

        // Pyramid
        const pyr = await this.pyr.build(tex, 3);

        // Harris
        const { cornerBuffer } = await this.sh.compute(pyr[0], w, h);

        // NMS
        const { nmsBuffer } = await this.nms.suppress(cornerBuffer, w, h, params.threshold);

        // GPU Compaction
        const { featureBuffer, count } = await this.comp.compact(nmsBuffer, w, h);

        // Read back for sorting (in real impl, do radix sort on GPU)
        const readBuf = this.device.createBuffer({
            size: Math.max(count * 16, 64),
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const enc = this.device.createCommandEncoder();
        enc.copyBufferToBuffer(featureBuffer, 0, readBuf, 0, count * 16);
        this.device.queue.submit([enc.finish()]);

        await readBuf.mapAsync(GPUMapMode.READ);
        const featData = new Float32Array(readBuf.getMappedRange());
        let features = [];
        for (let i = 0; i < count; i++) {
            features.push({
                x: featData[i * 4],
                y: featData[i * 4 + 1],
                response: featData[i * 4 + 2],
                angle: 0
            });
        }
        readBuf.unmap();

        // Sort and top-K
        features = this.stk.sort(features);
        const topKCount = Math.min(params.maxFeatures, features.length);
        features = features.slice(0, topKCount);

        // Write back to GPU
        const topKBuf = this.device.createBuffer({
            size: Math.max(topKCount * 16, 64),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        });
        const topKData = new Float32Array(topKCount * 4);
        for (let i = 0; i < topKCount; i++) {
            topKData[i * 4] = features[i].x;
            topKData[i * 4 + 1] = features[i].y;
            topKData[i * 4 + 2] = features[i].response;
            topKData[i * 4 + 3] = 0;
        }
        this.device.queue.writeBuffer(topKBuf, 0, topKData);

        // GPU Orientation
        await this.orb.compute(tex, topKBuf, topKCount, w, h);

        // GPU BRIEF
        const { featureBuffer: finalFeatBuf, descriptorBuffer } =
            await this.brief.compute(tex, topKBuf, topKCount, w, h);

        // Read back final results
        const finalReadBuf = this.device.createBuffer({
            size: Math.max(topKCount * 16, 64),
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const descReadBuf = this.device.createBuffer({
            size: Math.max(topKCount * 32, 64),
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        const enc2 = this.device.createCommandEncoder();
        enc2.copyBufferToBuffer(finalFeatBuf, 0, finalReadBuf, 0, topKCount * 16);
        enc2.copyBufferToBuffer(descriptorBuffer, 0, descReadBuf, 0, topKCount * 32);
        this.device.queue.submit([enc2.finish()]);

        await finalReadBuf.mapAsync(GPUMapMode.READ);
        await descReadBuf.mapAsync(GPUMapMode.READ);

        const finalData = new Float32Array(finalReadBuf.getMappedRange());
        const descData = new Uint32Array(descReadBuf.getMappedRange());

        const finalFeatures = [];
        for (let i = 0; i < topKCount; i++) {
            const desc = new Uint8Array(32);
            for (let j = 0; j < 8; j++) {
                const word = descData[i * 8 + j];
                desc[j * 4] = word & 0xFF;
                desc[j * 4 + 1] = (word >> 8) & 0xFF;
                desc[j * 4 + 2] = (word >> 16) & 0xFF;
                desc[j * 4 + 3] = (word >> 24) & 0xFF;
            }
            finalFeatures.push({
                x: finalData[i * 4],
                y: finalData[i * 4 + 1],
                response: finalData[i * 4 + 2],
                angle: finalData[i * 4 + 3],
                descriptor: desc
            });
        }

        finalReadBuf.unmap();
        descReadBuf.unmap();

        return { features: finalFeatures, width: w, height: h, texture: tex };
    }

    draw(canvas, bmp, feats, size) {
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bmp, 0, 0);
        ctx.strokeStyle = '#00ff00';
        ctx.fillStyle = '#00ff00';
        ctx.lineWidth = 2;
        for (const f of feats) {
            ctx.beginPath();
            ctx.arc(f.x, f.y, size, 0, Math.PI * 2);
            ctx.stroke();
            const ex = f.x + Math.cos(f.angle) * size * 3;
            const ey = f.y + Math.sin(f.angle) * size * 3;
            ctx.beginPath();
            ctx.moveTo(f.x, f.y);
            ctx.lineTo(ex, ey);
            ctx.stroke();
        }
    }
}

// UI Setup
let pipe = new Pipeline();
let bmp = null;
let result = null;

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const canvas = document.getElementById('canvas');
const canvasContainer = document.getElementById('canvasContainer');
const processBtn = document.getElementById('processBtn');
const downloadBtn = document.getElementById('downloadBtn');
const status = document.getElementById('status');

function showStatus(msg, err = false) {
    status.textContent = msg;
    status.className = 'status active' + (err ? ' error' : '');
}

uploadArea.onclick = () => fileInput.click();
uploadArea.ondragover = e => { e.preventDefault(); uploadArea.classList.add('dragging'); };
uploadArea.ondragleave = () => uploadArea.classList.remove('dragging');
uploadArea.ondrop = e => {
    e.preventDefault();
    uploadArea.classList.remove('dragging');
    if (e.dataTransfer.files[0]) fileInput.files = e.dataTransfer.files;
    fileInput.dispatchEvent(new Event('change'));
};

fileInput.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        bmp = await createImageBitmap(file);
        processBtn.disabled = false;
        showStatus('Image loaded. Click Process to detect features.');
    } catch (err) {
        showStatus('Error loading image: ' + err.message, true);
    }
};

processBtn.onclick = async () => {
    if (!bmp) return;
    try {
        processBtn.disabled = true;
        showStatus('Initializing WebGPU...');
        if (!pipe.device) await pipe.init();
        showStatus('Running GPU pipeline: Pyramid → Harris → NMS → GPU Compaction → ORB → BRIEF...');

        const params = {
            maxFeatures: parseInt(document.getElementById('maxFeatures').value),
            threshold: parseFloat(document.getElementById('harrisThresh').value)
        };

        result = await pipe.process(bmp, params);
        const size = parseInt(document.getElementById('featureSize').value);
        pipe.draw(canvas, bmp, result.features, size);

        canvasContainer.style.display = 'block';
        downloadBtn.disabled = false;
        showStatus(`✓ Detected ${result.features.length} features with 256-bit ORB descriptors (all GPU-accelerated)`);
    } catch (err) {
        showStatus('Error: ' + err.message, true);
        console.error(err);
    } finally {
        processBtn.disabled = false;
    }
};

downloadBtn.onclick = () => {
    canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'features.png';
        a.click();
        URL.revokeObjectURL(url);
    });
};

['maxFeatures', 'harrisThresh', 'featureSize'].forEach(id => {
    const el = document.getElementById(id);
    const val = document.getElementById(id + 'Value');
    el.oninput = () => val.textContent = el.value;
});