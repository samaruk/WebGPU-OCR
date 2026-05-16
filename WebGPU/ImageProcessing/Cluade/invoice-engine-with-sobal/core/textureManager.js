// core/textureManager.js – GPU texture creation, upload and readback
// Ensures bytesPerRow is always a multiple of 256 (WebGPU requirement).

export class TextureManager {
  /** @param {import('./gpuContext.js').GPUContext} ctx */
  constructor(ctx) {
    this.ctx     = ctx;
    this.device  = ctx.device;
    this._pool   = new Map();   // label → GPUTexture (for recycling)
  }

  // ── Alignment helpers ────────────────────────────────────────────────────

  /** Round x up to the nearest multiple of alignment */
  static alignUp(x, alignment = 256) {
    return Math.ceil(x / alignment) * alignment;
  }

  /**
   * Compute the aligned bytesPerRow for a texture of given width.
   * @param {number} width  - texture width in texels
   * @param {number} bpp    - bytes per texel (e.g. 4 for rgba8, 16 for rgba32float)
   */
  static bytesPerRow(width, bpp = 4) {
    return TextureManager.alignUp(width * bpp, 256);
  }

  // ── Texture creation ─────────────────────────────────────────────────────

  /**
   * Create a 2-D GPU texture.
   * @param {object} opts
   * @param {number}  opts.width
   * @param {number}  opts.height
   * @param {string}  opts.format    - e.g. 'rgba8unorm', 'r32float', 'rg32uint'
   * @param {number}  [opts.usage]   - GPUTextureUsage flags
   * @param {string}  [opts.label]
   */
  create({ width, height, format = 'rgba8unorm', usage, label = 'tex' }) {
    const defaultUsage =
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC        |
      GPUTextureUsage.COPY_DST        |
      GPUTextureUsage.RENDER_ATTACHMENT;

    const tex = this.device.createTexture({
      label,
      size:   { width, height, depthOrArrayLayers: 1 },
      format,
      usage:  usage ?? defaultUsage,
      mipLevelCount: 1,
      sampleCount:   1,
    });

    return tex;
  }

  /**
   * Create a pair of textures (ping-pong) with identical specs.
   */
  createPingPong(opts) {
    return [
      this.create({ ...opts, label: opts.label + '_A' }),
      this.create({ ...opts, label: opts.label + '_B' }),
    ];
  }

  // ── Upload ───────────────────────────────────────────────────────────────

  /**
   * Upload an ImageBitmap (or HTMLImageElement) to a GPU rgba8unorm texture.
   * Returns the GPUTexture.
   */
  async uploadImage(imageBitmap, label = 'upload') {
    const { width, height } = imageBitmap;
    const tex = this.create({ width, height, format: 'rgba8unorm', label });
    this.device.queue.copyExternalImageToTexture(
      { source: imageBitmap, flipY: false },
      { texture: tex },
      { width, height },
    );
    return tex;
  }

  /**
   * Upload a Float32Array as an r32float texture.
   */
  uploadF32(data, width, height, label = 'f32tex') {
    const tex = this.create({ width, height, format: 'r32float', label });
    const bpr = TextureManager.bytesPerRow(width, 4); // 4 bytes per float
    const padded = new Uint8Array(bpr * height);
    const srcBytes = new Uint8Array(data.buffer);
    for (let y = 0; y < height; y++) {
      padded.set(srcBytes.subarray(y * width * 4, (y + 1) * width * 4), y * bpr);
    }
    this.device.queue.writeTexture(
      { texture: tex },
      padded,
      { bytesPerRow: bpr, rowsPerImage: height },
      { width, height },
    );
    return tex;
  }

  // ── Readback ─────────────────────────────────────────────────────────────

  /**
   * Read back a GPU texture to a CPU Float32Array.
   * Works for r32float textures.
   */
  async readbackF32(texture, width, height) {
    const bpr   = TextureManager.bytesPerRow(width, 4);
    const total = bpr * height;
    const buf   = this.device.createBuffer({
      size:  total,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const enc = this.ctx.encoder('readback');
    enc.copyTextureToBuffer(
      { texture, mipLevel: 0, origin: { x: 0, y: 0 } },
      { buffer: buf, bytesPerRow: bpr, rowsPerImage: height },
      { width, height },
    );
    await this.ctx.submit(enc.finish());
    await buf.mapAsync(GPUMapMode.READ);
    const raw  = new Float32Array(buf.getMappedRange());
    const out  = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      const srcOff = (y * bpr) / 4;
      out.set(raw.subarray(srcOff, srcOff + width), y * width);
    }
    buf.unmap();
    buf.destroy();
    return out;
  }

  /**
   * Read back a GPU rg32uint texture to a CPU Uint32Array (interleaved r,g channels).
   */
  async readbackRG32U(texture, width, height) {
    const bpr   = TextureManager.bytesPerRow(width, 8); // 2 × u32 = 8 bytes/texel
    const total = bpr * height;
    const buf   = this.device.createBuffer({
      size:  total,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const enc = this.ctx.encoder('readback-rg32u');
    enc.copyTextureToBuffer(
      { texture, mipLevel: 0, origin: { x: 0, y: 0 } },
      { buffer: buf, bytesPerRow: bpr, rowsPerImage: height },
      { width, height },
    );
    await this.ctx.submit(enc.finish());
    await buf.mapAsync(GPUMapMode.READ);
    const raw   = new Uint32Array(buf.getMappedRange());
    const rowU  = bpr / 4;              // u32 elements per padded row
    const out   = new Uint32Array(width * height * 2);
    for (let y = 0; y < height; y++) {
      const srcOff = y * rowU;
      const dstOff = y * width * 2;
      for (let x = 0; x < width; x++) {
        out[dstOff + x * 2]     = raw[srcOff + x * 2];
        out[dstOff + x * 2 + 1] = raw[srcOff + x * 2 + 1];
      }
    }
    buf.unmap();
    buf.destroy();
    return out;
  }

  /**
   * Read back an rgba8unorm texture to Uint8ClampedArray (RGBA).
   */
  async readbackRGBA8(texture, width, height) {
    const bpr   = TextureManager.bytesPerRow(width, 4);
    const total = bpr * height;
    const buf   = this.device.createBuffer({
      size:  total,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const enc = this.ctx.encoder('readback-rgba8');
    enc.copyTextureToBuffer(
      { texture, mipLevel: 0, origin: { x: 0, y: 0 } },
      { buffer: buf, bytesPerRow: bpr, rowsPerImage: height },
      { width, height },
    );
    await this.ctx.submit(enc.finish());
    await buf.mapAsync(GPUMapMode.READ);
    const raw = new Uint8Array(buf.getMappedRange());
    const out = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      out.set(raw.subarray(y * bpr, y * bpr + width * 4), y * width * 4);
    }
    buf.unmap();
    buf.destroy();
    return out;
  }

  /**
   * Blit a GPU texture to a 2-D canvas (for previewing intermediate stages).
   * Uses a temporary ImageBitmap.
   */
  async previewOnCanvas(texture, width, height, canvas, format = 'rgba8unorm') {
    let rgba;
    if (format === 'rgba8unorm') {
      rgba = await this.readbackRGBA8(texture, width, height);
    } else if (format === 'r32float') {
      const f32 = await this.readbackF32(texture, width, height);
      rgba = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < width * height; i++) {
        const v = Math.min(1, Math.max(0, f32[i])) * 255;
        rgba[i * 4]     = v;
        rgba[i * 4 + 1] = v;
        rgba[i * 4 + 2] = v;
        rgba[i * 4 + 3] = 255;
      }
    }
    canvas.width  = width;
    canvas.height = height;
    const ctx2d   = canvas.getContext('2d');
    const imageData = new ImageData(rgba, width, height);
    ctx2d.putImageData(imageData, 0, 0);
  }
}
