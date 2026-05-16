// ===============================
// Distance Transform + Skeletonization (WebGPU)
// ===============================

const WIDTH = 1024;
const HEIGHT = 1024;

// -------------------------------
// WGSL: Exact 1D EDT helper
// -------------------------------
const edtWGSL = `
const INF : f32 = 1e20;
const MAX_N : i32 = ${HEIGHT};

fn edt_1d(f : ptr<function, array<f32, MAX_N>>,
          d : ptr<function, array<f32, MAX_N>>,
          n : i32) {

    var v : array<i32, MAX_N>;
    var z : array<f32, MAX_N + 1>;

    var k : i32 = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] =  INF;

    for (var q = 1; q < n; q++) {
        var s : f32;
        loop {
            let vk = v[k];
            s = ((f[q] + f32(q*q)) - (f[vk] + f32(vk*vk))) / (2.0 * f32(q - vk));
            if (s > z[k]) { break; }
            k--;
        }
        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = INF;
    }

    k = 0;
    for (var q = 0; q < n; q++) {
        while (z[k + 1] < f32(q)) {
            k++;
        }
        let dx = f32(q - v[k]);
        (*d)[q] = dx*dx + f[v[k]];
    }
}
`;

// -------------------------------
// Vertical EDT Pass
// -------------------------------
const edtVerticalWGSL = `
${edtWGSL}

@group(0) @binding(0) var inputTex : texture_2d<u32>;
@group(0) @binding(1) var outTex : texture_storage_2d<r32float, write>;

@compute @workgroup_size(1, 1)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    let x = i32(gid.x);
    if (x >= ${WIDTH}) { return; }

    var f : array<f32, MAX_N>;
    var d : array<f32, MAX_N>;

    for (var y = 0; y < ${HEIGHT}; y++) {
        let v = textureLoad(inputTex, vec2<i32>(x, y), 0).r;
        f[y] = select(INF, 0.0, v > 0u);
    }

    edt_1d(&f, &d, ${HEIGHT});

    for (var y = 0; y < ${HEIGHT}; y++) {
        textureStore(outTex, vec2<i32>(x, y), vec4<f32>(d[y],0,0,0));
    }
}
`;

// -------------------------------
// Horizontal EDT Pass
// -------------------------------
const edtHorizontalWGSL = `
${edtWGSL}

@group(0) @binding(0) var inputTex : texture_2d<f32>;
@group(0) @binding(1) var outTex : texture_storage_2d<r32float, write>;

@compute @workgroup_size(1, 1)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    let y = i32(gid.y);
    if (y >= ${HEIGHT}) { return; }

    var f : array<f32, MAX_N>;
    var d : array<f32, MAX_N>;

    for (var x = 0; x < ${WIDTH}; x++) {
        f[x] = textureLoad(inputTex, vec2<i32>(x, y), 0).r;
    }

    edt_1d(&f, &d, ${WIDTH});

    for (var x = 0; x < ${WIDTH}; x++) {
        textureStore(outTex, vec2<i32>(x, y), vec4<f32>(sqrt(d[x]),0,0,0));
    }
}
`;

// -------------------------------
// DT Gradient Pass
// -------------------------------
const gradientWGSL = `
@group(0) @binding(0) var dtTex : texture_2d<f32>;
@group(0) @binding(1) var gradTex : texture_storage_2d<rg32float, write>;

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    let p = vec2<i32>(gid.xy);
    if (p.x <= 0 || p.y <= 0 || p.x >= ${WIDTH - 1} || p.y >= ${HEIGHT - 1}) {
        return;
    }

    let dx = textureLoad(dtTex, p + vec2<i32>(1,0), 0).r -
             textureLoad(dtTex, p - vec2<i32>(1,0), 0).r;

    let dy = textureLoad(dtTex, p + vec2<i32>(0,1), 0).r -
             textureLoad(dtTex, p - vec2<i32>(0,1), 0).r;

    textureStore(gradTex, p, vec4<f32>(dx, dy, 0, 0));
}
`;

// -------------------------------
// Skeletonization (DT Ridge NMS)
// -------------------------------
const skeletonWGSL = `
@group(0) @binding(0) var dtTex   : texture_2d<f32>;
@group(0) @binding(1) var gradTex : texture_2d<f32>;
@group(0) @binding(2) var outTex  : texture_storage_2d<r8uint, write>;

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    let p = vec2<i32>(gid.xy);
    if (p.x <= 1 || p.y <= 1 || p.x >= ${WIDTH - 2} || p.y >= ${HEIGHT - 2}) {
        return;
    }

    let d = textureLoad(dtTex, p, 0).r;
    if (d < 1.0) {
        textureStore(outTex, p, vec4<u32>(0,0,0,0));
        return;
    }

    let g = textureLoad(gradTex, p, 0).xy;
    let len = length(g);
    if (len < 1e-4) {
        textureStore(outTex, p, vec4<u32>(255,0,0,0));
        return;
    }

    let n = normalize(g);
    let o = vec2<i32>(sign(n.x), sign(n.y));

    let d1 = textureLoad(dtTex, p + o, 0).r;
    let d2 = textureLoad(dtTex, p - o, 0).r;

    let isRidge = d >= d1 && d >= d2;
    textureStore(outTex, p, vec4<u32>(select(0u, 255u, isRidge),0,0,0));
}
`;

// ===============================
// WebGPU setup & execution
// ===============================
async function run(binaryBitmap) {
    if (!navigator.gpu) throw "WebGPU not supported";

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();

    function tex(desc) {
        return device.createTexture(desc);
    }

    const binaryTex = tex({
        size: [WIDTH, HEIGHT],
        format: "r8uint",
        usage: GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST
    });

    device.queue.copyExternalImageToTexture(
        { source: binaryBitmap },
        { texture: binaryTex },
        [WIDTH, HEIGHT]
    );

    const dtTemp = tex({
        size: [WIDTH, HEIGHT],
        format: "r32float",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
    });

    const dtFinal = tex({
        size: [WIDTH, HEIGHT],
        format: "r32float",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
    });

    const gradTex = tex({
        size: [WIDTH, HEIGHT],
        format: "rg32float",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
    });

    const skeletonTex = tex({
        size: [WIDTH, HEIGHT],
        format: "r8uint",
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC
    });

    async function pipeline(code, bindings, dispatch) {
        const module = device.createShaderModule({ code });
        const pipe = device.createComputePipeline({
            layout: "auto",
            compute: { module, entryPoint: "main" }
        });

        const bg = device.createBindGroup({
            layout: pipe.getBindGroupLayout(0),
            entries: bindings
        });

        const enc = device.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(pipe);
        pass.setBindGroup(0, bg);
        pass.dispatchWorkgroups(...dispatch);
        pass.end();
        device.queue.submit([enc.finish()]);
    }

    await pipeline(edtVerticalWGSL, [
        { binding: 0, resource: binaryTex.createView() },
        { binding: 1, resource: dtTemp.createView() }
    ], [WIDTH, 1, 1]);

    await pipeline(edtHorizontalWGSL, [
        { binding: 0, resource: dtTemp.createView() },
        { binding: 1, resource: dtFinal.createView() }
    ], [1, HEIGHT, 1]);

    await pipeline(gradientWGSL, [
        { binding: 0, resource: dtFinal.createView() },
        { binding: 1, resource: gradTex.createView() }
    ], [Math.ceil(WIDTH / 16), Math.ceil(HEIGHT / 16), 1]);

    await pipeline(skeletonWGSL, [
        { binding: 0, resource: dtFinal.createView() },
        { binding: 1, resource: gradTex.createView() },
        { binding: 2, resource: skeletonTex.createView() }
    ], [Math.ceil(WIDTH / 16), Math.ceil(HEIGHT / 16), 1]);

    return skeletonTex;
}
