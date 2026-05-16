/**
 * core/textureManager.js – GPU texture allocation + readback.
 */
export class TextureManager {
  #device; #tracked = new Set();
  constructor(device) { this.#device = device; }

  create(width, height, format = 'rgba8unorm', usage = null, label = '') {
    const u = usage ?? (GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT);
    const t = this.#device.createTexture({ size: { width, height, depthOrArrayLayers: 1 }, format, usage: u, label });
    this.#tracked.add(t);
    return t;
  }

  fromBitmap(bitmap, format = 'rgba8unorm') {
    const t = this.create(bitmap.width, bitmap.height, format);
    this.#device.queue.copyExternalImageToTexture({ source: bitmap }, { texture: t }, { width: bitmap.width, height: bitmap.height });
    return t;
  }

  createSampler(opts = {}) {
    return this.#device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear',
      addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', ...opts });
  }

  async readback(texture, width, height) {
    const bpr  = Math.ceil(width * 4 / 256) * 256;
    const buf  = this.#device.createBuffer({ size: bpr * height, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const enc  = this.#device.createCommandEncoder();
    enc.copyTextureToBuffer({ texture }, { buffer: buf, bytesPerRow: bpr, rowsPerImage: height }, { width, height });
    this.#device.queue.submit([enc.finish()]);
    await buf.mapAsync(GPUMapMode.READ);
    const raw = new Uint8Array(buf.getMappedRange().slice(0));
    buf.unmap(); buf.destroy();
    const out = new Uint8Array(width * height * 4);
    for (let r = 0; r < height; r++) out.set(raw.subarray(r * bpr, r * bpr + width * 4), r * width * 4);
    return out;
  }

  free(t)     { t.destroy(); this.#tracked.delete(t); }
  destroy()   { this.#tracked.forEach(t => t.destroy()); this.#tracked.clear(); }
}
