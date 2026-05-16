/**
 * utils/webgpu-utils.js
 * Shared WebGPU helpers for the OCR pipeline.
 */

/** Initialize WebGPU and return {device, adapter} */
export async function initWebGPU() {
  if (!navigator.gpu) throw new Error('WebGPU not supported. Use Chrome 113+ or Edge 113+.');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('No WebGPU adapter found.');
  const device = await adapter.requestDevice();
  device.addEventListener('uncapturederror', e => console.error('[WebGPU]', e.error.message));
  return { device, adapter };
}

/** Fetch and compile a WGSL shader module */
export async function loadShader(device, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Shader load failed: ${url} (${res.status})`);
  const code = await res.text();
  const module = device.createShaderModule({ code, label: url });
  // Surface compilation errors early
  const info = await module.getCompilationInfo();
  info.messages.forEach(m => {
    if (m.type === 'error') console.error(`[WGSL] ${url}:${m.lineNum} — ${m.message}`);
    else console.warn(`[WGSL] ${url}:${m.lineNum} — ${m.message}`);
  });
  return module;
}

/** Create a storage buffer, optionally pre-filled with Float32Array data */
export function createStorageBuffer(device, sizeInFloats, data = null) {
  const size = sizeInFloats * 4;
  const buffer = device.createBuffer({
    size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    mappedAtCreation: data !== null,
  });
  if (data !== null) {
    new Float32Array(buffer.getMappedRange()).set(data);
    buffer.unmap();
  }
  return buffer;
}

/**
 * Build a uniform Uint8Array from an ordered list of typed values.
 * Fields auto-pad to 16-byte total alignment (WebGPU requirement).
 *   fields: [{type:'u32'|'f32', value}]
 */
export function buildUniforms(...fields) {
  const count = Math.ceil(fields.length / 4) * 4; // pad to vec4 boundary
  const buf   = new ArrayBuffer(count * 4);
  const view  = new DataView(buf);
  fields.forEach((f, i) => {
    if (f.type === 'u32') view.setUint32(i * 4, f.value >>> 0, true);
    else                  view.setFloat32(i * 4, f.value, true);
  });
  return new Uint8Array(buf);
}

/** Create a uniform buffer from buildUniforms() output */
export function createUniformBuffer(device, uniformBytes) {
  const buffer = device.createBuffer({
    size: uniformBytes.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint8Array(buffer.getMappedRange()).set(uniformBytes);
  buffer.unmap();
  return buffer;
}

/** Update an existing uniform buffer */
export function updateUniformBuffer(device, buffer, uniformBytes) {
  device.queue.writeBuffer(buffer, 0, uniformBytes);
}

/** Read back a GPU storage buffer to a Float32Array (async, blocks until done) */
export async function readbackBuffer(device, gpuBuffer, sizeInFloats) {
  const staging = device.createBuffer({
    size: sizeInFloats * 4,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });
  const enc = device.createCommandEncoder();
  enc.copyBufferToBuffer(gpuBuffer, 0, staging, 0, sizeInFloats * 4);
  device.queue.submit([enc.finish()]);
  await staging.mapAsync(GPUMapMode.READ);
  const copy = new Float32Array(staging.getMappedRange()).slice();
  staging.unmap();
  staging.destroy();
  return copy;
}

/** Submit a single compute dispatch */
export function dispatchCompute(device, pipeline, bindGroup, wx, wy = 1, wz = 1) {
  const enc  = device.createCommandEncoder();
  const pass = enc.beginComputePass({ label: pipeline.label });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(wx, wy, wz);
  pass.end();
  device.queue.submit([enc.finish()]);
}

/**
 * Extract raw image pixels from an HTMLImageElement into a Float32Array [RGBA, 0-1].
 * Uses full natural resolution, but scales down proportionally if the image
 * would exceed the GPU's maxStorageBufferBindingSize limit.
 * Pass the GPUDevice so the actual hardware limit can be queried.
 */
export function imageToFloat32(img, device = null) {
  let w = img.naturalWidth;
  let h = img.naturalHeight;

  // Respect the GPU's maxStorageBufferBindingSize.
  // The RGBA input buffer is N * 4 floats * 4 bytes = N * 16 bytes.
  // The grayscale buffers are N * 4 bytes — so RGBA is the bottleneck.
  const maxBytes = device
    ? device.limits.maxStorageBufferBindingSize
    : 128 * 1024 * 1024;          // fallback: 128 MB
  const maxPixels = Math.floor(maxBytes / 16);  // 16 bytes per RGBA pixel (f32×4)

  if (w * h > maxPixels) {
    const scale = Math.sqrt(maxPixels / (w * h));
    w = Math.floor(w * scale);
    h = Math.floor(h * scale);
    console.warn(`[WebGPU] Image downscaled to ${w}×${h} to fit maxStorageBufferBindingSize (${(maxBytes/1024/1024).toFixed(0)} MB limit).`);
  }

  const oc  = new OffscreenCanvas(w, h);
  const ctx = oc.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const id   = ctx.getImageData(0, 0, w, h);
  const out  = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h * 4; i++) out[i] = id.data[i] / 255;
  return { pixels: out, width: w, height: h };
}

// ─── Canvas renderers ─────────────────────────────────────────────────────────

/** Render Float32 grayscale data (values in [0,1]) to a canvas */
export function renderGray(canvas, data, w, h) {
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const id  = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = clamp01(data[i]) * 255 | 0;
    id.data[i*4]=v; id.data[i*4+1]=v; id.data[i*4+2]=v; id.data[i*4+3]=255;
  }
  ctx.putImageData(id, 0, 0);
}

/** Render Float32 data with turbo colormap to a canvas (auto-normalizes) */
export function renderColormap(canvas, data, w, h) {
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const id  = ctx.createImageData(w, h);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < data.length; i++) { if (data[i] < lo) lo = data[i]; if (data[i] > hi) hi = data[i]; }
  const rng = hi - lo || 1;
  for (let i = 0; i < w * h; i++) {
    const t = (data[i] - lo) / rng;
    const [r,g,b] = turbo(t);
    id.data[i*4]=r; id.data[i*4+1]=g; id.data[i*4+2]=b; id.data[i*4+3]=255;
  }
  ctx.putImageData(id, 0, 0);
}

/**
 * Render a 4×2 grid of feature maps onto one canvas.
 * maps: array of {data: Float32Array, w, h, label}
 */
export function renderFeatureGrid(canvas, maps, cols = 4) {
  const rows  = Math.ceil(maps.length / cols);
  const cellW = maps[0].w;
  const cellH = maps[0].h;
  const gap   = 2;
  const labelH = 14;

  canvas.width  = cols * (cellW + gap) - gap;
  canvas.height = rows * (cellH + labelH + gap) - gap;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#060810';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  maps.forEach(({ data, w, h, label }, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const ox  = col * (cellW + gap);
    const oy  = row * (cellH + labelH + gap);

    // Draw label
    ctx.fillStyle = '#64748b';
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillText(label, ox + 2, oy + 10);

    // Draw feature map with colormap
    const tmp = new OffscreenCanvas(w, h);
    const tc  = tmp.getContext('2d');
    const id  = tc.createImageData(w, h);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < data.length; i++) { if (data[i]<lo) lo=data[i]; if (data[i]>hi) hi=data[i]; }
    const rng = hi - lo || 1;
    for (let i = 0; i < w * h; i++) {
      const t = (data[i] - lo) / rng;
      const [r,g,b] = turbo(t);
      id.data[i*4]=r; id.data[i*4+1]=g; id.data[i*4+2]=b; id.data[i*4+3]=255;
    }
    tc.putImageData(id, 0, 0);
    ctx.drawImage(tmp, ox, oy + labelH);
  });
}

/** Compute Otsu threshold from a Float32 grayscale array */
export function computeOtsu(grayData) {
  const hist = new Float64Array(256);
  for (const v of grayData) hist[Math.min(255, (clamp01(v) * 255) | 0)]++;
  const total = grayData.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thresh = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const bv = wB * wF * (mB - mF) ** 2;
    if (bv > best) { best = bv; thresh = t; }
  }
  return thresh / 255;
}

/**
 * Simple connected-component bounding box finder.
 * Returns [{x, y, w, h, score}] for regions above `thresh`.
 */
export function findBoundingBoxes(data, width, height, thresh = 0.5, minAreaRatio = 0.0005) {
  const labels = new Int32Array(width * height).fill(-1);
  const parent = [];
  let nextLabel = 0;

  function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  function union(a, b) { a = find(a); b = find(b); if (a !== b) parent[b] = a; }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (data[i] < thresh) continue;
      const L = x > 0 && data[i-1] >= thresh ? labels[i-1] : -1;
      const U = y > 0 && data[i-width] >= thresh ? labels[i-width] : -1;
      if (L < 0 && U < 0) { labels[i] = nextLabel; parent.push(nextLabel++); }
      else if (L >= 0 && U < 0) { labels[i] = find(L); }
      else if (L < 0 && U >= 0) { labels[i] = find(U); }
      else { labels[i] = find(L); union(L, U); }
    }
  }

  const boxes = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (labels[i] < 0) continue;
      const r = find(labels[i]);
      if (!boxes.has(r)) boxes.set(r, { x1: x, y1: y, x2: x, y2: y, n: 0 });
      const b = boxes.get(r);
      if (x < b.x1) b.x1 = x; if (y < b.y1) b.y1 = y;
      if (x > b.x2) b.x2 = x; if (y > b.y2) b.y2 = y;
      b.n++;
    }
  }

  const minArea = width * height * minAreaRatio;
  return [...boxes.values()]
    .filter(b => b.n > minArea && (b.x2-b.x1) > 3 && (b.y2-b.y1) > 3)
    .map(b => ({ x: b.x1, y: b.y1, w: b.x2-b.x1, h: b.y2-b.y1, score: Math.min(1, b.n / ((b.x2-b.x1+1)*(b.y2-b.y1+1))) }))
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .slice(0, 60);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

function turbo(t) {
  t = clamp01(t);
  const stops = [[0,0,128],[0,150,255],[0,220,130],[255,210,0],[255,30,0]];
  const n = stops.length - 1;
  const i = Math.min(Math.floor(t * n), n - 1);
  const f = t * n - i;
  const a = stops[i], b = stops[i+1];
  return [
    (a[0] + (b[0]-a[0]) * f) | 0,
    (a[1] + (b[1]-a[1]) * f) | 0,
    (a[2] + (b[2]-a[2]) * f) | 0,
  ];
}

// ─── Letter Boundary Renderer ─────────────────────────────────────────────────

/**
 * Detect individual letter/character blobs in a binary map and draw each one in
 * a distinct color with a 2-pixel bright boundary on a black background.
 *
 * Algorithm:
 *   1. Two-pass connected-component labelling (4-connectivity, union-find)
 *   2. Filter to plausible letter sizes (removes noise + large non-letter blobs)
 *   3. Assign unique colors via golden-angle HSL distribution
 *   4. Boundary pixels (2-px inward) → full color
 *      Interior pixels                → 20% brightness (shape visible, boundary pops)
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Float32Array}  binaryData  — output of binarizePass (1 = text pixel)
 * @param {number}        width
 * @param {number}        height
 * @returns {number}  number of letter components drawn
 */
export function drawLetterBoundaries(canvas, binaryData, width, height) {
  canvas.width  = width;
  canvas.height = height;
  const N = width * height;

  // ── 1. Connected components (union-find, 4-connectivity) ─────────────────
  const lbl   = new Int32Array(N).fill(-1);
  const par   = [];
  let   nextL = 0;

  function ufFind(x) {
    while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; }
    return x;
  }
  function ufUnion(a, b) {
    a = ufFind(a); b = ufFind(b);
    if (a !== b) par[b] = a;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (binaryData[i] < 0.5) continue;

      // 8-connectivity: check all 4 previously-visited neighbours
      // (top-left, top, top-right, left) so diagonal strokes in letters
      // like X, W, V, A are fully connected instead of fragmenting.
      const TL = (x > 0 && y > 0 && binaryData[i - width - 1] >= 0.5) ? lbl[i - width - 1] : -1;
      const T  = (          y > 0 && binaryData[i - width    ] >= 0.5) ? lbl[i - width    ] : -1;
      const TR = (x < width - 1 && y > 0 && binaryData[i - width + 1] >= 0.5) ? lbl[i - width + 1] : -1;
      const L  = (x > 0          && binaryData[i - 1         ] >= 0.5) ? lbl[i - 1         ] : -1;

      // Collect unique valid labels from the 4 neighbours
      const nbrs = [TL, T, TR, L].filter(v => v >= 0);
      if (nbrs.length === 0) {
        lbl[i] = nextL; par.push(nextL++);
      } else {
        // Assign minimum label, union all neighbours
        let root = ufFind(nbrs[0]);
        for (let k = 1; k < nbrs.length; k++) {
          const r2 = ufFind(nbrs[k]);
          if (r2 !== root) { ufUnion(root, r2); root = ufFind(root); }
        }
        lbl[i] = root;
      }
    }
  }

  // Resolve roots and count component sizes
  const sz = new Map();
  for (let i = 0; i < N; i++) {
    if (lbl[i] < 0) continue;
    const r = ufFind(lbl[i]);
    lbl[i] = r;
    sz.set(r, (sz.get(r) || 0) + 1);
  }

  // ── 2. Size filter — keep plausible letter blobs ─────────────────────────
  // minPx: absolute floor of 5 pixels — avoids filtering small-font letters
  // on large images (the old area-proportional formula was 10× too aggressive).
  // maxPx: 6 % of image — allows large display text while rejecting merged
  // paragraph-level blobs or whole-page background components.
  const minPx = 5;
  const maxPx = Math.round(N * 0.06);
  const valid = new Set();
  for (const [id, s] of sz) if (s >= minPx && s <= maxPx) valid.add(id);

  // ── 3. Assign distinct colors — golden-angle hue distribution ────────────
  const pal = [];
  for (let k = 0; k < Math.min(valid.size, 512); k++)
    pal.push(hslToRgb255((k * 137.508) % 360, 0.88, 0.58));

  const colorMap = new Map();
  let ci = 0;
  for (const id of valid) colorMap.set(id, pal[ci++ % pal.length]);

  // ── 4. 2-pixel inward boundary ────────────────────────────────────────────
  // Pass A: pixels that touch background or a different component
  const b1 = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const id = lbl[i];
    if (id < 0 || !colorMap.has(id)) continue;
    const x = i % width, y = (i / width) | 0;
    if (x === 0 || x === width-1 || y === 0 || y === height-1 ||
        lbl[i-1] !== id || lbl[i+1] !== id ||
        lbl[i-width] !== id || lbl[i+width] !== id) b1[i] = 1;
  }
  // Pass B: dilate that ring one pixel deeper inward
  const bound = b1.slice();
  for (let i = 0; i < N; i++) {
    if (!b1[i]) continue;
    const id = lbl[i], x = i % width, y = (i / width) | 0;
    if (x > 0          && lbl[i-1]     === id) bound[i-1]     = 1;
    if (x < width-1    && lbl[i+1]     === id) bound[i+1]     = 1;
    if (y > 0          && lbl[i-width] === id) bound[i-width] = 1;
    if (y < height-1   && lbl[i+width] === id) bound[i+width] = 1;
  }

  // ── 5. Paint ──────────────────────────────────────────────────────────────
  const px = new Uint8ClampedArray(N * 4);
  for (let i = 0; i < N; i++) px[i*4+3] = 255; // opaque black background

  for (let i = 0; i < N; i++) {
    const id = lbl[i];
    if (id < 0 || !colorMap.has(id)) continue;
    const [r, g, b] = colorMap.get(id);
    if (bound[i]) {
      px[i*4] = r;  px[i*4+1] = g;  px[i*4+2] = b;
    } else {
      px[i*4] = (r*0.18)|0;  px[i*4+1] = (g*0.18)|0;  px[i*4+2] = (b*0.18)|0;
    }
  }

  const ctx = canvas.getContext('2d');
  ctx.putImageData(new ImageData(px, width, height), 0, 0);

  // Letter count badge
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(4, height-18, 165, 16);
  ctx.fillStyle = '#00d4ff';
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.fillText(`${valid.size} letter component${valid.size !== 1 ? 's' : ''} detected`, 8, height-6);

  return valid.size;
}

/** Convert HSL (h=0-360, s/l=0-1) → [R, G, B] 0-255 */
function hslToRgb255(h, s, l) {
  const c = (1 - Math.abs(2*l - 1)) * s;
  const x = c * (1 - Math.abs(((h/60) % 2) - 1));
  const m = l - c/2;
  let r=0, g=0, b=0;
  if      (h <  60) { r=c; g=x; }
  else if (h < 120) { r=x; g=c; }
  else if (h < 180) {      g=c; b=x; }
  else if (h < 240) {      g=x; b=c; }
  else if (h < 300) { r=x;      b=c; }
  else              { r=c;      b=x; }
  return [ Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255) ];
}
