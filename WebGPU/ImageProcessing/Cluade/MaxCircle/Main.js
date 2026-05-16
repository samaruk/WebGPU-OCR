
// ╔══════════════════════════════════════════════════════════════════════╗
// ║  ALL-GPU Max Inscribed Circle  ·  WebGPU  ·  Image-input edition    ║
// ║  Upload any image → threshold → GPU pipeline → circle + dist field  ║
// ╚══════════════════════════════════════════════════════════════════════╝

// Canvas size — resized to match uploaded image (capped)
const MAX_DIM = 2000;
let CW = 380, CH = 380;

// ── DOM ───────────────────────────────────────────────────────────────────
const drawCanvas = document.getElementById('drawCanvas');
const overlayCanvas = document.getElementById('overlayCanvas');
const distCanvas = document.getElementById('distCanvas');
const dctx = drawCanvas.getContext('2d', { willReadFrequently: true });
const octx = overlayCanvas.getContext('2d');
const fctx = distCanvas.getContext('2d');
const logEl = document.getElementById('logArea');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');

function log(msg, cls = '') {
    const sp = document.createElement('span');
    sp.className = cls; sp.textContent = msg + '\n';
    logEl.appendChild(sp); logEl.scrollTop = logEl.scrollHeight;
}

// ════════════════════════════════════════════════════════════════════════
//  WGSL SHADERS
// ════════════════════════════════════════════════════════════════════════

const WGSL_SEED = /* wgsl */`
@group(0) @binding(0) var binaryTex : texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> seedBuf : array<vec2u>;
@group(0) @binding(2) var<uniform> dims : vec2u;
const INV : u32 = 0xFFFFFFFFu;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) g : vec3u) {
  if (g.x >= dims.x || g.y >= dims.y) { return; }
  let idx = g.y * dims.x + g.x;
  let v   = textureLoad(binaryTex, vec2i(g.xy), 0).r;
  // white(>=0.5)=foreground(needs seed) · black(<0.5)=background(IS seed)
  seedBuf[idx] = select(vec2u(INV, INV), vec2u(g.x, g.y), v < 0.5);
}`;

const WGSL_JFA = /* wgsl */`
struct JFA { step:u32, w:u32, h:u32, pad:u32 }
@group(0) @binding(0) var<storage, read>       inBuf : array<vec2u>;
@group(0) @binding(1) var<storage, read_write> outBuf: array<vec2u>;
@group(0) @binding(2) var<uniform> p : JFA;
const INV : u32 = 0xFFFFFFFFu;
fn sq(ax:u32,ay:u32,bx:u32,by:u32)->f32{
  let dx=f32(i32(ax)-i32(bx)); let dy=f32(i32(ay)-i32(by)); return dx*dx+dy*dy;
}
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) g : vec3u) {
  if (g.x >= p.w || g.y >= p.h) { return; }
  let idx=g.y*p.w+g.x;
  var best=inBuf[idx];
  var bestD=select(1e20, sq(g.x,g.y,best.x,best.y), best.x!=INV);
  let s=i32(p.step);
  for(var dy=-1;dy<=1;dy++){for(var dx=-1;dx<=1;dx++){
    if(dx==0&&dy==0){continue;}
    let nx=i32(g.x)+dx*s; let ny=i32(g.y)+dy*s;
    if(nx<0||ny<0||u32(nx)>=p.w||u32(ny)>=p.h){continue;}
    let ns=inBuf[u32(ny)*p.w+u32(nx)];
    if(ns.x==INV){continue;}
    let nd=sq(g.x,g.y,ns.x,ns.y);
    if(nd<bestD){bestD=nd;best=ns;}
  }}
  outBuf[idx]=best;
}`;

function wgslDist(fp16) {
    const T = fp16 ? 'f16' : 'f32';
    return `${fp16 ? 'enable f16;\n' : ''}
@group(0) @binding(0) var<storage, read>       seedBuf : array<vec2u>;
@group(0) @binding(1) var<storage, read_write> distBuf : array<${T}>;
@group(0) @binding(2) var<uniform> dims : vec2u;
const INV:u32=0xFFFFFFFFu;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) g:vec3u){
  let idx=g.x; if(idx>=dims.x*dims.y){return;}
  let seed=seedBuf[idx];
  if(seed.x==INV){distBuf[idx]=${T}(0.0);return;}
  let px=f32(idx%dims.x); let py=f32(idx/dims.x);
  let dx=px-f32(seed.x); let dy=py-f32(seed.y);
  distBuf[idx]=${T}(sqrt(dx*dx+dy*dy));
}`;
}

function wgslDistReduce(fp16) {
    const T = fp16 ? 'f16' : 'f32';
    return `${fp16 ? 'enable f16;\n' : ''}
@group(0) @binding(0) var<storage, read>       distBuf:array<${T}>;
@group(0) @binding(1) var<storage, read_write> outBuf :array<vec2u>;
@group(0) @binding(2) var<uniform> cnt:vec4u;
var<workgroup> sd:array<f32,256>; var<workgroup> si:array<u32,256>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) g:vec3u,
        @builtin(local_invocation_id) l:vec3u,
        @builtin(workgroup_id) w:vec3u){
  let li=l.x;
  if(g.x<cnt.x){sd[li]=f32(distBuf[g.x]);si[li]=g.x;}
  else{sd[li]=-1.0;si[li]=0u;}
  workgroupBarrier();
  for(var stride=128u;stride>0u;stride>>=1u){
    if(li<stride&&sd[li+stride]>sd[li]){sd[li]=sd[li+stride];si[li]=si[li+stride];}
    workgroupBarrier();
  }
  if(li==0u){outBuf[w.x]=vec2u(bitcast<u32>(sd[0]),si[0]);}
}`;
}

const WGSL_REDUCE = /* wgsl */`
@group(0) @binding(0) var<storage, read>       inBuf :array<vec2u>;
@group(0) @binding(1) var<storage, read_write> outBuf:array<vec2u>;
@group(0) @binding(2) var<uniform> cnt:vec4u;
var<workgroup> sd:array<f32,256>; var<workgroup> si:array<u32,256>;
@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) g:vec3u,
        @builtin(local_invocation_id) l:vec3u,
        @builtin(workgroup_id) w:vec3u){
  let li=l.x;
  if(g.x<cnt.x){let e=inBuf[g.x];sd[li]=bitcast<f32>(e.x);si[li]=e.y;}
  else{sd[li]=-1.0;si[li]=0u;}
  workgroupBarrier();
  for(var stride=128u;stride>0u;stride>>=1u){
    if(li<stride&&sd[li+stride]>sd[li]){sd[li]=sd[li+stride];si[li]=si[li+stride];}
    workgroupBarrier();
  }
  if(li==0u){outBuf[w.x]=vec2u(bitcast<u32>(sd[0]),si[0]);}
}`;

const WGSL_EXTRACT = /* wgsl */`
struct EP{count:u32,width:u32,pad0:u32,pad1:u32}
@group(0) @binding(0) var<storage, read>       inBuf :array<vec2u>;
@group(0) @binding(1) var<storage, read_write> resBuf:array<f32>;
@group(0) @binding(2) var<uniform> ep:EP;
var<workgroup> sd:array<f32,256>; var<workgroup> si:array<u32,256>;
@compute @workgroup_size(256)
fn main(@builtin(local_invocation_id) l:vec3u){
  let li=l.x;
  if(li<ep.count){let e=inBuf[li];sd[li]=bitcast<f32>(e.x);si[li]=e.y;}
  else{sd[li]=-1.0;si[li]=0u;}
  workgroupBarrier();
  for(var stride=128u;stride>0u;stride>>=1u){
    if(li<stride&&sd[li+stride]>sd[li]){sd[li]=sd[li+stride];si[li]=si[li+stride];}
    workgroupBarrier();
  }
  if(li==0u){
    let bi=si[0];
    resBuf[0]=f32(bi%ep.width); resBuf[1]=f32(bi/ep.width);
    resBuf[2]=sd[0]; resBuf[3]=0.0;
  }
}`;

// ════════════════════════════════════════════════════════════════════════
//  GPU INIT
// ════════════════════════════════════════════════════════════════════════
let device = null, fp16 = false;

function mkUniform(dev, arr) {
    const size = Math.max(16, Math.ceil(arr.byteLength / 16) * 16);
    const buf = dev.createBuffer({ size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    dev.queue.writeBuffer(buf, 0, arr); return buf;
}

function setStage(i) {
    for (let k = 0; k <= 5; k++) {
        const el = document.getElementById(`ps${k}`);
        el.classList.remove('active', 'done');
        if (k < i) el.classList.add('done');
        else if (k === i) el.classList.add('active');
    }
}
function allDone() { for (let k = 0; k <= 5; k++) { const el = document.getElementById(`ps${k}`); el.classList.remove('active'); el.classList.add('done'); } }

async function initGPU() {
    if (!navigator.gpu) {
        log('✗ WebGPU not supported — use Chrome 113+ or Edge 113+', 'err');
        document.getElementById('statDev').textContent = 'NOT SUPPORTED'; return;
    }
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) { log('✗ No GPU adapter', 'err'); return; }
    fp16 = adapter.features.has('shader-f16');
    device = await adapter.requestDevice({ requiredFeatures: fp16 ? ['shader-f16'] : [] });

    let devName = 'WebGPU';
    try {
        const info = adapter.info || (typeof adapter.requestAdapterInfo === 'function' ? await adapter.requestAdapterInfo() : {});
        devName = [info.vendor, info.device, info.description].filter(Boolean).join(' · ') || devName;
    } catch { }

    document.getElementById('statDev').textContent = devName;
    document.getElementById('svFP16').textContent = fp16 ? '2× (f16)' : 'OFF (f32)';
    document.getElementById('svFP16').className = 'sv ' + (fp16 ? 'g' : 'r');
    document.getElementById('subFP').textContent = fp16 ? 'f16 ×2' : 'f32';
    if (fp16) document.getElementById('fp16Tag').classList.add('on');
    log(`✓ ${devName}`, 'ok');
    log(`  FP16: ${fp16 ? 'YES — f16 dist buffer, 2× BW' : 'no, f32 fallback'}`, fp16 ? 'ok' : 'warn');
    document.getElementById('btnRun').disabled = false;
}

// ════════════════════════════════════════════════════════════════════════
//  IMAGE UPLOAD + BINARISATION
// ════════════════════════════════════════════════════════════════════════
let invertMode = false;
let uploadedImage = null;   // HTMLImageElement when an image is loaded

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) loadImageFile(f);
});
fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) loadImageFile(fileInput.files[0]);
});

function loadImageFile(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        URL.revokeObjectURL(url);
        uploadedImage = img;
        // Resize canvases to match image (max MAX_DIM)
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        CW = Math.round(img.width * scale);
        CH = Math.round(img.height * scale);
        resizeCanvases(CW, CH);
        applyBinaryMask();
        document.getElementById('dzName').style.display = 'block';
        document.getElementById('dzName').textContent = `${file.name}  (${img.width}×${img.height})`;
        document.getElementById('srcLabel').textContent = `(${CW}×${CH} after scale)`;
        log(`Image loaded: ${file.name}  ${img.width}×${img.height} → ${CW}×${CH}`, 'ok');
    };
    img.src = url;
}

function resizeCanvases(w, h) {
    for (const id of ['drawCanvas', 'overlayCanvas', 'distCanvas']) {
        const c = document.getElementById(id);
        c.width = w; c.height = h;
        c.style.width = w + 'px';
        c.style.height = h + 'px';
    }
    document.getElementById('svRes').textContent = `${w}×${h}`;
    const jN = Math.ceil(Math.log2(Math.max(w, h)));
    document.getElementById('svJFA').textContent = jN;
    document.getElementById('subJFA').textContent = `×${jN}`;
}

function applyBinaryMask() {
    if (!uploadedImage) return;
    const thresh = +document.getElementById('thresh').value;
    const chan = document.getElementById('chanSel').value;

    // Draw original image at canvas size
    const tmpC = document.createElement('canvas');
    tmpC.width = CW; tmpC.height = CH;
    const tmpCtx = tmpC.getContext('2d');
    tmpCtx.drawImage(uploadedImage, 0, 0, CW, CH);
    const imgData = tmpCtx.getImageData(0, 0, CW, CH);
    const src = imgData.data;

    // Build binary canvas: white=foreground, black=background
    const out = dctx.createImageData(CW, CH);
    for (let i = 0; i < CW * CH; i++) {
        const r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2], a = src[i * 4 + 3];
        let val;
        if (chan === 'luma') val = 0.299 * r + 0.587 * g + 0.114 * b;
        else if (chan === 'r') val = r;
        else if (chan === 'g') val = g;
        else if (chan === 'b') val = b;
        else val = a;
        let isWhite = val > thresh;
        if (invertMode) isWhite = !isWhite;
        const c = isWhite ? 255 : 0;
        out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = c; out.data[i * 4 + 3] = 255;
    }
    dctx.putImageData(out, 0, 0);
    octx.clearRect(0, 0, CW, CH);
}

// Live re-binarise on slider / channel / invert changes
document.getElementById('thresh').addEventListener('input', function () {
    document.getElementById('threshLbl').textContent = this.value;
    if (uploadedImage) applyBinaryMask();
});
document.getElementById('chanSel').addEventListener('change', () => { if (uploadedImage) applyBinaryMask(); });
document.getElementById('btnInvert').addEventListener('click', () => {
    invertMode = !invertMode;
    document.getElementById('btnInvert').textContent = invertMode ? 'INVERTED ✓' : 'INVERT';
    document.getElementById('btnInvert').classList.toggle('on', invertMode);
    if (uploadedImage) applyBinaryMask();
    else invertCanvas();
});

function invertCanvas() {
    const id = dctx.getImageData(0, 0, CW, CH);
    for (let i = 0; i < id.data.length; i += 4) {
        id.data[i] = 255 - id.data[i]; id.data[i + 1] = 255 - id.data[i + 1]; id.data[i + 2] = 255 - id.data[i + 2];
    }
    dctx.putImageData(id, 0, 0);
}

// ════════════════════════════════════════════════════════════════════════
//  MANUAL DRAWING (works on top of any mask)
// ════════════════════════════════════════════════════════════════════════
let painting = false, drawMode = 1;
document.getElementById('btnFore').addEventListener('click', () => {
    drawMode = 1;
    document.getElementById('btnFore').classList.add('on');
    document.getElementById('btnBack').classList.remove('on');
});
document.getElementById('btnBack').addEventListener('click', () => {
    drawMode = 0;
    document.getElementById('btnBack').classList.add('on');
    document.getElementById('btnFore').classList.remove('on');
});
document.getElementById('brushSize').addEventListener('input', function () {
    document.getElementById('brushLbl').textContent = this.value;
});

function getPos(e) {
    const r = drawCanvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return [t.clientX - r.left, t.clientY - r.top];
}
function paint(e) {
    if (!painting) return; e.preventDefault();
    const [x, y] = getPos(e);
    const bs = +document.getElementById('brushSize').value;
    dctx.fillStyle = drawMode ? '#fff' : '#000';
    dctx.beginPath(); dctx.arc(x, y, bs, 0, Math.PI * 2); dctx.fill();
}
drawCanvas.addEventListener('mousedown', e => { painting = true; paint(e); });
drawCanvas.addEventListener('mousemove', paint);
drawCanvas.addEventListener('mouseup', () => painting = false);
drawCanvas.addEventListener('touchstart', e => { painting = true; paint(e); }, { passive: false });
drawCanvas.addEventListener('touchmove', paint, { passive: false });
drawCanvas.addEventListener('touchend', () => painting = false);

// ── Presets ────────────────────────────────────────────────────────────
function clearDraw(w = CW, h = CH) { dctx.fillStyle = '#000'; dctx.fillRect(0, 0, w, h); }

function drawPreset(name) {
    uploadedImage = null;
    resizeCanvases(380, 380);
    clearDraw(380, 380);
    const W = 380, H = 380;
    if (name === 'ring') {
        dctx.strokeStyle = '#fff'; dctx.lineWidth = 50;
        dctx.beginPath(); dctx.arc(W / 2, H / 2, 140, 0, Math.PI * 2); dctx.stroke();
        dctx.strokeStyle = '#fff'; dctx.lineWidth = 20;
        dctx.beginPath(); dctx.arc(W / 2, H / 2, 60, 0, Math.PI * 2); dctx.stroke();
    } else if (name === 'room') {
        dctx.fillStyle = '#fff'; dctx.fillRect(30, 30, W - 60, H - 60);
        dctx.fillStyle = '#000'; dctx.fillRect(50, 50, W - 100, H - 100);
        dctx.fillStyle = '#fff';
        dctx.fillRect(150, 50, 20, 120); dctx.fillRect(W - 170, H - 170, 80, 80);
        dctx.fillRect(80, 200, 60, 40);
    } else if (name === 'maze') {
        dctx.fillStyle = '#fff';
        [[55, 55, 270, 18], [55, 55, 18, 190], [325, 55, 18, 155], [55, 190, 155, 18],
        [270, 135, 55, 18], [55, 245, 18, 170], [175, 245, 155, 18], [325, 210, 18, 115],
        [55, 325, 215, 18], [270, 265, 75, 18], [55, 395, 270, 18], [325, 325, 18, 90]
        ].forEach(([x, y, w, h]) => dctx.fillRect(x, y, w, h));
    } else if (name === 'letter') {
        dctx.strokeStyle = '#fff'; dctx.lineWidth = 42;
        dctx.beginPath(); dctx.arc(W / 2, H / 2, 145, 0, Math.PI * 2); dctx.stroke();
    }
    document.getElementById('dzName').style.display = 'none';
    document.getElementById('srcLabel').textContent = '(preset shape)';
    octx.clearRect(0, 0, CW, CH);
    document.getElementById('rbox').classList.remove('show');
}

document.querySelectorAll('.preset').forEach(b => {
    b.addEventListener('click', () => drawPreset(b.dataset.p));
});
document.getElementById('btnPreset').addEventListener('click', () => drawPreset('room'));
document.getElementById('btnClear').addEventListener('click', () => {
    uploadedImage = null; clearDraw(); octx.clearRect(0, 0, CW, CH);
    fctx.fillStyle = '#111'; fctx.fillRect(0, 0, CW, CH);
    document.getElementById('rbox').classList.remove('show');
    document.getElementById('dzName').style.display = 'none';
    document.getElementById('srcLabel').textContent = '(draw or upload image)';
});

// ════════════════════════════════════════════════════════════════════════
//  GPU ALGORITHM
// ════════════════════════════════════════════════════════════════════════
async function runMaxCircle() {
    if (!device) { log('GPU not ready', 'err'); return; }
    const W = CW, H = CH, TOTAL = W * H;
    const btnRun = document.getElementById('btnRun');
    btnRun.disabled = true;
    log('\n══════════ NEW RUN ══════════');

    // ── Stage 0: Upload binary texture ─────────────────────────────────
    setStage(0);
    const imgData = dctx.getImageData(0, 0, W, H);
    const gray = new Uint8Array(TOTAL);
    for (let i = 0; i < TOTAL; i++) gray[i] = imgData.data[i * 4];

    const tex = device.createTexture({
        size: [W, H],
        format: 'r8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    device.queue.writeTexture({ texture: tex }, gray, { bytesPerRow: W }, [W, H]);
    log(`[0] Binary tex → GPU  ${W}×${H}  (${(TOTAL / 1000).toFixed(1)}k px)`, 'info');

    // ── Buffer allocation ───────────────────────────────────────────────
    const dElSz = fp16 ? 2 : 4;
    const distSz = Math.max(TOTAL * dElSz, 16);
    const jN = Math.ceil(Math.log2(Math.max(W, H)));
    const r1Count = Math.ceil(TOTAL / 256);
    const r2Count = Math.ceil(r1Count / 256);
    const r3Count = Math.ceil(r2Count / 256);
    const needR3 = r2Count > 256;

    const BU = GPUBufferUsage;
    const pingBuf = device.createBuffer({ size: TOTAL * 8, usage: BU.STORAGE });
    const pongBuf = device.createBuffer({ size: TOTAL * 8, usage: BU.STORAGE });
    const distBuf = device.createBuffer({ size: distSz, usage: BU.STORAGE | BU.COPY_SRC });
    const r1Buf = device.createBuffer({ size: r1Count * 8, usage: BU.STORAGE });
    const r2Buf = device.createBuffer({ size: Math.max(r2Count * 8, 8), usage: BU.STORAGE });
    const r3Buf = needR3 ? device.createBuffer({ size: Math.max(r3Count * 8, 8), usage: BU.STORAGE }) : null;
    const resBuf = device.createBuffer({ size: 16, usage: BU.STORAGE | BU.COPY_SRC });
    const stgRes = device.createBuffer({ size: 16, usage: BU.MAP_READ | BU.COPY_DST });
    const stgDist = device.createBuffer({ size: distSz, usage: BU.MAP_READ | BU.COPY_DST });

    const uDims = mkUniform(device, new Uint32Array([W, H, 0, 0]));
    const uR1 = mkUniform(device, new Uint32Array([TOTAL, 0, 0, 0]));
    const uR2 = mkUniform(device, new Uint32Array([r1Count, 0, 0, 0]));
    const uR3 = needR3 ? mkUniform(device, new Uint32Array([r2Count, 0, 0, 0])) : null;
    const finalCount = needR3 ? r3Count : r2Count;
    const uExt = mkUniform(device, new Uint32Array([finalCount, W, 0, 0]));

    const jfaU = [];
    let sv = Math.ceil(Math.max(W, H) / 2);
    for (let i = 0; i < jN; i++) {
        jfaU.push(mkUniform(device, new Uint32Array([sv, W, H, 0])));
        sv = Math.max(1, sv >> 1);
    }

    // ── Compile pipelines ───────────────────────────────────────────────
    const mkPipe = (code, lbl) => device.createComputePipeline({
        label: lbl, layout: 'auto',
        compute: { module: device.createShaderModule({ code, label: lbl }), entryPoint: 'main' }
    });
    const pSeed = mkPipe(WGSL_SEED, 'seedInit');
    const pJFA = mkPipe(WGSL_JFA, 'jfa');
    const pDist = mkPipe(wgslDist(fp16), 'distField');
    const pDRed = mkPipe(wgslDistReduce(fp16), 'distReduce');
    const pRed = mkPipe(WGSL_REDUCE, 'reduce');
    const pExt = mkPipe(WGSL_EXTRACT, 'extract');

    // ── Encode everything into ONE command buffer ───────────────────────
    const t0 = performance.now();
    const enc = device.createCommandEncoder({ label: 'maxCircle' });
    const cp = enc.beginComputePass();

    // Stage 1: Seed Init
    setStage(1);
    cp.setPipeline(pSeed);
    cp.setBindGroup(0, device.createBindGroup({
        layout: pSeed.getBindGroupLayout(0), entries: [
            { binding: 0, resource: tex.createView() },
            { binding: 1, resource: { buffer: pingBuf } },
            { binding: 2, resource: { buffer: uDims } },
        ]
    }));
    cp.dispatchWorkgroups(Math.ceil(W / 8), Math.ceil(H / 8));
    log(`[1] SeedInit  ${Math.ceil(W / 8)}×${Math.ceil(H / 8)} wg`, 'info');

    // Stage 2: JFA ping-pong
    setStage(2);
    let rBuf = pingBuf, wBuf = pongBuf;
    for (let i = 0; i < jN; i++) {
        cp.setPipeline(pJFA);
        cp.setBindGroup(0, device.createBindGroup({
            layout: pJFA.getBindGroupLayout(0), entries: [
                { binding: 0, resource: { buffer: rBuf } },
                { binding: 1, resource: { buffer: wBuf } },
                { binding: 2, resource: { buffer: jfaU[i] } },
            ]
        }));
        cp.dispatchWorkgroups(Math.ceil(W / 8), Math.ceil(H / 8));
        [rBuf, wBuf] = [wBuf, rBuf];
    }
    log(`[2] JFA  ${jN} passes`, 'info');

    // Stage 3: Distance field
    setStage(3);
    cp.setPipeline(pDist);
    cp.setBindGroup(0, device.createBindGroup({
        layout: pDist.getBindGroupLayout(0), entries: [
            { binding: 0, resource: { buffer: rBuf } },
            { binding: 1, resource: { buffer: distBuf } },
            { binding: 2, resource: { buffer: uDims } },
        ]
    }));
    cp.dispatchWorkgroups(Math.ceil(TOTAL / 64));
    log(`[3] DistField  ${fp16 ? 'f16 (2× BW)' : 'f32'}`, 'info');

    // Stage 4: Parallel max reduce
    setStage(4);
    cp.setPipeline(pDRed);
    cp.setBindGroup(0, device.createBindGroup({
        layout: pDRed.getBindGroupLayout(0), entries: [
            { binding: 0, resource: { buffer: distBuf } },
            { binding: 1, resource: { buffer: r1Buf } },
            { binding: 2, resource: { buffer: uR1 } },
        ]
    }));
    cp.dispatchWorkgroups(r1Count);

    cp.setPipeline(pRed);
    cp.setBindGroup(0, device.createBindGroup({
        layout: pRed.getBindGroupLayout(0), entries: [
            { binding: 0, resource: { buffer: r1Buf } },
            { binding: 1, resource: { buffer: r2Buf } },
            { binding: 2, resource: { buffer: uR2 } },
        ]
    }));
    cp.dispatchWorkgroups(Math.max(1, r2Count));

    if (needR3) {
        cp.setBindGroup(0, device.createBindGroup({
            layout: pRed.getBindGroupLayout(0), entries: [
                { binding: 0, resource: { buffer: r2Buf } },
                { binding: 1, resource: { buffer: r3Buf } },
                { binding: 2, resource: { buffer: uR3 } },
            ]
        }));
        cp.dispatchWorkgroups(Math.max(1, r3Count));
    }
    log(`[4] MaxReduce  N→r1(${r1Count})→r2(${r2Count})${needR3 ? `→r3(${r3Count})` : ''}`, 'info');

    // Stage 5: Extract
    setStage(5);
    const finalIn = needR3 ? r3Buf : r2Buf;
    cp.setPipeline(pExt);
    cp.setBindGroup(0, device.createBindGroup({
        layout: pExt.getBindGroupLayout(0), entries: [
            { binding: 0, resource: { buffer: finalIn } },
            { binding: 1, resource: { buffer: resBuf } },
            { binding: 2, resource: { buffer: uExt } },
        ]
    }));
    cp.dispatchWorkgroups(1);
    cp.end();

    // Copy result + dist to staging
    enc.copyBufferToBuffer(resBuf, 0, stgRes, 0, 16);
    enc.copyBufferToBuffer(distBuf, 0, stgDist, 0, distSz);

    // ── Single submit ────────────────────────────────────────────────────
    device.queue.submit([enc.finish()]);
    await device.queue.onSubmittedWorkDone();
    const gpuMs = (performance.now() - t0).toFixed(1);

    // ── Read back 16 bytes ───────────────────────────────────────────────
    await stgRes.mapAsync(GPUMapMode.READ);
    const res = new Float32Array(stgRes.getMappedRange().slice(0));
    stgRes.unmap();
    const cx = Math.round(res[0]), cy = Math.round(res[1]), cr = res[2];

    // ── Read dist field for display ──────────────────────────────────────
    await stgDist.mapAsync(GPUMapMode.READ);
    const rawDist = stgDist.getMappedRange().slice(0);
    stgDist.unmap();
    const distF32 = fp16 ? decodeF16(new Uint8Array(rawDist), TOTAL) : new Float32Array(rawDist);

    // ── Display ──────────────────────────────────────────────────────────
    allDone();
    document.getElementById('svTime').textContent = `${gpuMs} ms`;
    document.getElementById('tfill').style.width = Math.min(100, gpuMs / 300 * 100) + '%';
    document.getElementById('distLabel').textContent = `(thermal, r_max=${cr.toFixed(1)}px)`;

    drawDistField(distF32, W, H);
    drawCircleOverlay(cx, cy, cr, W, H);

    const rb = document.getElementById('rbox');
    rb.classList.add('show');
    document.getElementById('rlines').innerHTML =
        `CX = ${cx} px<br>CY = ${cy} px<br>R&nbsp; = ${cr.toFixed(2)} px<br>D&nbsp; = ${(cr * 2).toFixed(2)} px`;

    log(`\n✓ CIRCLE: cx=${cx}  cy=${cy}  r=${cr.toFixed(2)} px`, 'ok');
    log(`  GPU time: ${gpuMs} ms   (${fp16 ? 'f16' : 'f32'})`, 'ok');

    // Cleanup GPU objects
    [pingBuf, pongBuf, distBuf, r1Buf, r2Buf, resBuf, stgRes, stgDist, tex, uDims, uR1, uR2, uExt, ...jfaU]
        .forEach(b => b && b.destroy && b.destroy());
    if (r3Buf) r3Buf.destroy();
    if (uR3) uR3.destroy();

    btnRun.disabled = false;
}

// ── FP16 software decode (for display only — computation was f16 on GPU) ──
function decodeF16(bytes, count) {
    const out = new Float32Array(count);
    const dv = new DataView(bytes.buffer);
    for (let i = 0; i < count; i++) {
        const h = dv.getUint16(i * 2, true);
        const s = (h >> 15) ? -1 : 1, e = (h >> 10) & 0x1F, m = h & 0x3FF;
        if (e === 0) out[i] = s * Math.pow(2, -14) * (m / 1024);
        else if (e === 31) out[i] = m ? NaN : s * Infinity;
        else out[i] = s * Math.pow(2, e - 15) * (1 + m / 1024);
    }
    return out;
}

// ── Thermal colormap ─────────────────────────────────────────────────────
function thermal(t) {
    const stops = [[0, 0, 0], [0, 0, 180], [0, 200, 220], [0, 200, 0], [220, 220, 0], [220, 80, 0], [255, 255, 255]];
    const seg = t * (stops.length - 1); const i = Math.min(Math.floor(seg), stops.length - 2); const f = seg - i;
    return stops[i].map((v, k) => Math.round(v + f * (stops[i + 1][k] - v)));
}

function drawDistField(distF32, W, H) {
    let maxD = 0; for (let i = 0; i < W * H; i++) if (distF32[i] > maxD) maxD = distF32[i];
    const id = fctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
        const [r, g, b] = thermal(maxD > 0 ? distF32[i] / maxD : 0);
        id.data[i * 4] = r; id.data[i * 4 + 1] = g; id.data[i * 4 + 2] = b; id.data[i * 4 + 3] = 255;
    }
    fctx.putImageData(id, 0, 0);
}

function drawCircleOverlay(cx, cy, cr, W, H) {
    octx.clearRect(0, 0, W, H);
    if (cr <= 0) return;
    // Filled area
    octx.fillStyle = 'rgba(255,176,32,0.07)';
    octx.beginPath(); octx.arc(cx, cy, cr, 0, Math.PI * 2); octx.fill();
    // Ring
    octx.strokeStyle = '#ffb020'; octx.lineWidth = 2;
    octx.shadowColor = '#ffb020'; octx.shadowBlur = 12;
    octx.beginPath(); octx.arc(cx, cy, cr, 0, Math.PI * 2); octx.stroke();
    // Center
    octx.fillStyle = '#ffb020'; octx.shadowBlur = 8;
    octx.beginPath(); octx.arc(cx, cy, 4, 0, Math.PI * 2); octx.fill();
    // Crosshairs
    octx.shadowBlur = 0; octx.strokeStyle = 'rgba(255,176,32,.3)';
    octx.lineWidth = 1; octx.setLineDash([4, 5]);
    octx.beginPath(); octx.moveTo(cx, 0); octx.lineTo(cx, H); octx.stroke();
    octx.beginPath(); octx.moveTo(0, cy); octx.lineTo(W, cy); octx.stroke();
    octx.setLineDash([]);
    // Radius line + label
    octx.strokeStyle = 'rgba(255,176,32,.6)'; octx.lineWidth = 1.5;
    octx.beginPath(); octx.moveTo(cx, cy); octx.lineTo(cx + cr, cy); octx.stroke();
    octx.fillStyle = '#ffb020'; octx.font = 'bold 10px Space Mono, monospace';
    octx.shadowColor = '#000'; octx.shadowBlur = 4;
    octx.fillText(`r=${cr.toFixed(1)}`, cx + cr + 5, cy - 4);
    octx.shadowBlur = 0;
}

// ── Run button ────────────────────────────────────────────────────────────
document.getElementById('btnRun').addEventListener('click', runMaxCircle);

// ── Init ──────────────────────────────────────────────────────────────────
(async () => {
    await initGPU();
    drawPreset('room');
    fctx.fillStyle = '#111'; fctx.fillRect(0, 0, CW, CH);
})();