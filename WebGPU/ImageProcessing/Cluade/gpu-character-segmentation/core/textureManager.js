// core/textureManager.js — GPU texture creation and management

export class TextureManager {
  constructor(device) {
    this.device = device;
    this._textures = new Map();
  }

  /**
   * Create a 2D texture. Destroys existing if same name.
   */
  create(name, width, height, format, usage, label) {
    if (this._textures.has(name)) {
      const t = this._textures.get(name);
      if (t.width === width && t.height === height && t.format === format) return t;
      t.destroy();
    }
    const texture = this.device.createTexture({
      label: label || name,
      size: { width, height, depthOrArrayLayers: 1 },
      format,
      usage,
    });
    this._textures.set(name, texture);
    return texture;
  }

  get(name) {
    return this._textures.get(name) || null;
  }

  view(name, opts = {}) {
    const t = this._textures.get(name);
    if (!t) throw new Error(`Texture "${name}" not found`);
    return t.createView(opts);
  }

  /**
   * Upload an ImageBitmap or ImageData to a texture.
   */
  uploadImage(name, width, height, imageData) {
    const tex = this.create(name, width, height, 'rgba8unorm',
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT
    );

    if (imageData instanceof ImageBitmap) {
      this.device.queue.copyExternalImageToTexture(
        { source: imageData },
        { texture: tex },
        { width, height }
      );
    } else {
      // Raw Uint8Array RGBA
      this.device.queue.writeTexture(
        { texture: tex },
        imageData,
        { bytesPerRow: width * 4 },
        { width, height }
      );
    }
    return tex;
  }

  /**
   * Read back a texture to CPU as RGBA Uint8Array.
   * This requires the texture to have COPY_SRC usage.
   */
  async readback(name, device) {
    const tex = this._textures.get(name);
    if (!tex) throw new Error(`Texture "${name}" not found`);

    const { width, height } = tex;
    const bytesPerRow = Math.ceil(width * 4 / 256) * 256;
    const bufSize = bytesPerRow * height;

    const staging = device.createBuffer({
      size: bufSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const enc = device.createCommandEncoder();
    enc.copyTextureToBuffer(
      { texture: tex },
      { buffer: staging, bytesPerRow, rowsPerImage: height },
      { width, height }
    );
    device.queue.submit([enc.finish()]);

    await staging.mapAsync(GPUMapMode.READ);
    const raw = new Uint8Array(staging.getMappedRange().slice(0));
    staging.unmap();
    staging.destroy();

    // Remove padding from rows
    const packed = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      packed.set(raw.subarray(y * bytesPerRow, y * bytesPerRow + width * 4), y * width * 4);
    }
    return packed;
  }

  destroy(name) {
    const t = this._textures.get(name);
    if (t) { t.destroy(); this._textures.delete(name); }
  }

  destroyAll() {
    for (const [, t] of this._textures) t.destroy();
    this._textures.clear();
  }
}
