
/* ===========================
   Utilities
=========================== */
const align = (n, a) => Math.ceil(n / a) * a;

/* ===========================
   WebGPU Init
=========================== */
if (!navigator.gpu) throw "WebGPU not supported";
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const queue = device.queue;

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

/* ===========================
   Image Load
=========================== */
let img;
file.onchange = e => {
    img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        run.disabled = false;
    };
    img.src = URL.createObjectURL(e.target.files[0]);
};

/* ===========================
   WGSL (VALID)
=========================== */
const shader = `
@group(0) @binding(0) var srcTex : texture_2d<f32>;
@group(0) @binding(1) var outTex : texture_storage_2d<r32float, write>;

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let dims = textureDimensions(srcTex);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }

  let x = i32(gid.x);
  let y = i32(gid.y);

  let xm1 = max(x-1, 0);
  let xp1 = min(x+1, i32(dims.x)-1);
  let ym1 = max(y-1, 0);
  let yp1 = min(y+1, i32(dims.y)-1);

  let tl = textureLoad(srcTex, vec2<i32>(xm1,ym1), 0).r;
  let tc = textureLoad(srcTex, vec2<i32>(x,ym1), 0).r;
  let tr = textureLoad(srcTex, vec2<i32>(xp1,ym1), 0).r;
  let ml = textureLoad(srcTex, vec2<i32>(xm1,y), 0).r;
  let mr = textureLoad(srcTex, vec2<i32>(xp1,y), 0).r;
  let bl = textureLoad(srcTex, vec2<i32>(xm1,yp1), 0).r;
  let bc = textureLoad(srcTex, vec2<i32>(x,yp1), 0).r;
  let br = textureLoad(srcTex, vec2<i32>(xp1,yp1), 0).r;

  let gx =
    -tl + tr +
    -2.0*ml + 2.0*mr +
    -bl + br;

  let gy =
    -tl -2.0*tc -tr +
     bl +2.0*bc +br;

  let Ixx = gx * gx;
  let Iyy = gy * gy;
  let Ixy = gx * gy;

  let k = 0.04;
  let R = (Ixx*Iyy - Ixy*Ixy) - k*(Ixx+Iyy)*(Ixx+Iyy);

  textureStore(outTex, vec2<i32>(x,y), vec4<f32>(max(R,0.0),0,0,0));
}
`;

/* ===========================
   Pipeline
=========================== */
const module = device.createShaderModule({ code: shader });
const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module, entryPoint: "main" }
});

/* ===========================
   Run
=========================== */
run.onclick = async () => {
    ctx.drawImage(img, 0, 0);
    const srcTex = device.createTexture({
        size: [img.width, img.height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING |
            GPUTextureUsage.COPY_DST
    });

    const harrisTex = device.createTexture({
        size: [img.width, img.height],
        format: "r32float",
        usage: GPUTextureUsage.STORAGE_BINDING |
            GPUTextureUsage.COPY_SRC
    });

    queue.copyExternalImageToTexture(
        { source: img },
        { texture: srcTex },
        [img.width, img.height]
    );

    const bind = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: srcTex.createView() },
            { binding: 1, resource: harrisTex.createView() }
        ]
    });

    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bind);
    pass.dispatchWorkgroups(
        Math.ceil(img.width / 16),
        Math.ceil(img.height / 16)
    );
    pass.end();
    queue.submit([enc.finish()]);

    /* ===========================
       Readback
    =========================== */
    const bpr = align(img.width * 4, 256);
    const buf = device.createBuffer({
        size: bpr * img.height,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    const enc2 = device.createCommandEncoder();
    enc2.copyTextureToBuffer(
        { texture: harrisTex },
        { buffer: buf, bytesPerRow: bpr },
        [img.width, img.height]
    );
    queue.submit([enc2.finish()]);

    await buf.mapAsync(GPUMapMode.READ);
    const data = new Float32Array(buf.getMappedRange());

    /* ===========================
       Draw points
    =========================== */
    ctx.drawImage(img, 0, 0);
    ctx.fillStyle = "red";


    console.log(['', [...data]]);
    for (let y = 1; y < img.height - 1; y++) {
        const row = y * (bpr / 4);
        for (let x = 1; x < img.width - 1; x++) {
            if (data[row + x] > 1e6) {
                ctx.fillRect(x - 1, y - 1, 3, 3);
            }
        }
    }

    buf.unmap();

};