// core/bufferManager.js — Central registry for GPU textures & buffers

export class BufferManager {
  constructor(ctx) {
    this.ctx = ctx;
    this.textures = new Map();
    this.buffers  = new Map();
  }

  /** Store a GPUTexture by name */
  setTexture(name, tex) { this.textures.set(name, tex); }
  getTexture(name) {
    const t = this.textures.get(name);
    if (!t) throw new Error(`Texture "${name}" not found in BufferManager`);
    return t;
  }

  /** Store a GPUBuffer by name */
  setBuffer(name, buf) { this.buffers.set(name, buf); }
  getBuffer(name) {
    const b = this.buffers.get(name);
    if (!b) throw new Error(`Buffer "${name}" not found in BufferManager`);
    return b;
  }

  /** Create and register a 2D RGBA texture */
  createTexture(name, width, height, format = 'rgba8unorm', usage) {
    const defaultUsage =
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT;
    const tex = this.ctx.device.createTexture({
      label: name,
      size: [width, height, 1],
      format,
      usage: usage ?? defaultUsage,
    });
    this.setTexture(name, tex);
    return tex;
  }

  /** Destroy all managed resources */
  destroy() {
    for (const t of this.textures.values()) t.destroy();
    for (const b of this.buffers.values()) b.destroy();
    this.textures.clear();
    this.buffers.clear();
  }
}
