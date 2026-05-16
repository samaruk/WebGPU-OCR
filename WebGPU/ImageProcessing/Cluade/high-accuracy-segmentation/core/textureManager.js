/**
 * core/textureManager.js - Texture creation and pooled reuse.
 */
export class TextureManager {
  constructor(device) {
    this.device = device;
    this._pool = new Map();
  }

  _key(w, h, fmt) { return `${w}x${h}:${fmt}`; }

  acquire(width, height, format = "rgba8unorm", label = "") {
    const key = this._key(width, height, format);
    const pool = this._pool.get(key) ?? [];
    if (pool.length > 0) { this._pool.set(key, pool); return pool.pop(); }
    return this.device.createTexture({
      size: { width, height }, format, label,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING |
             GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
    });
  }

  release(texture) {
    const key = this._key(texture.width, texture.height, texture.format);
    const pool = this._pool.get(key) ?? [];
    pool.push(texture);
    this._pool.set(key, pool);
  }

  destroyAll() {
    for (const pool of this._pool.values()) pool.forEach(t => t.destroy());
    this._pool.clear();
  }
}
