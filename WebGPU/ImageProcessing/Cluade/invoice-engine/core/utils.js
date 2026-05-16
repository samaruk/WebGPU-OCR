// core/utils.js

/** ceil-divide a by b */
export const cdiv = (a, b) => Math.ceil(a / b);

/** Return next power-of-two ≥ n */
export const nextPow2 = n => {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
};

/** Load image from File → HTMLImageElement */
export function loadImage(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

/** Draw an HTMLImageElement into an OffscreenCanvas, return ImageData */
export function imageToImageData(img, maxDim = 2048) {
  let w = img.naturalWidth, h = img.naturalHeight;
  if (Math.max(w, h) > maxDim) {
    const s = maxDim / Math.max(w, h);
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** Upload ImageData to a GPUTexture */
export function imageDataToTexture(device, imageData) {
  const { width: w, height: h, data } = imageData;
  const tex = device.createTexture({
    label: 'source_rgba',
    size: [w, h, 1],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.writeTexture(
    { texture: tex },
    data,
    { bytesPerRow: w * 4, rowsPerImage: h },
    [w, h, 1]
  );
  return tex;
}

/** Read a GPU texture to Uint8Array on CPU */
export async function readTexture(device, texture, width, height, bytesPerPixel = 4) {
  const bpr = align256(width * bytesPerPixel);
  const staging = device.createBuffer({
    size: bpr * height,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const enc = device.createCommandEncoder();
  enc.copyTextureToBuffer(
    { texture },
    { buffer: staging, bytesPerRow: bpr, rowsPerImage: height },
    [width, height, 1]
  );
  device.queue.submit([enc.finish()]);
  await staging.mapAsync(GPUMapMode.READ);
  const raw = new Uint8Array(staging.getMappedRange());
  // De-stride
  const out = new Uint8Array(width * height * bytesPerPixel);
  for (let row = 0; row < height; row++) {
    out.set(raw.subarray(row * bpr, row * bpr + width * bytesPerPixel), row * width * bytesPerPixel);
  }
  staging.unmap();
  staging.destroy();
  return out;
}

export const align256 = n => Math.ceil(n / 256) * 256;

/** Millisecond timestamp string */
export const ts = () => performance.now().toFixed(1) + 'ms';


export async function loadShader(path) {
    const response = await fetch(path);
    return await response.text();
}

