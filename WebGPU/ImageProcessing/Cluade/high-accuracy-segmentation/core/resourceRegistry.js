/**
 * core/resourceRegistry.js
 * Tracks intermediate GPU textures and buffers for lifecycle management.
 * Call releaseAll() at end of pipeline to prevent GPU memory leaks.
 */
export class ResourceRegistry {
  constructor(gpuCtx) {
    this.device = gpuCtx.device;
    this._textures = [];
    this._buffers  = [];
  }

  trackTexture(texture) { this._textures.push(texture); return texture; }
  trackBuffer(buffer)   { this._buffers.push(buffer);   return buffer;  }

  createTexture(width, height, format = "rgba8unorm", label = "") {
    const tex = this.device.createTexture({
      size: { width, height }, format, label,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING |
             GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
    });
    return this.trackTexture(tex);
  }

  createStorageBuffer(byteSize, label = "") {
    const buf = this.device.createBuffer({
      size: byteSize, label,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    return this.trackBuffer(buf);
  }

  releaseAll() {
    this._textures.forEach(t => { try { t.destroy(); } catch (_) {} });
    this._buffers.forEach(b  => { try { b.destroy(); } catch (_) {} });
    this._textures = [];
    this._buffers  = [];
  }
}
