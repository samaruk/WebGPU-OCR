export class TextureManager {
  constructor(device) { this.device = device; this._texs = []; }

  create(w, h, fmt, usage, label='') {
    const tex = this.device.createTexture({ label, size:[w,h,1], format:fmt, usage });
    this._texs.push(tex);
    return tex;
  }

  // rgba8unorm — the ONLY format used as texture_2d<f32> input.
  // rgba8unorm is filterable, so texture_2d<f32> auto-layout is valid.
  rgba(w, h, label='') {
    return this.create(w, h, 'rgba8unorm',
      GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST, label);
  }

  // r32float — used ONLY as texture_storage_2d<r32float, write> output (jfa_final no longer).
  // Keep for potential future use, but nothing reads it as texture_2d<f32> anymore.
  r32f(w, h, label='') {
    return this.create(w, h, 'r32float',
      GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST, label);
  }

  reset() { this._texs.forEach(t => t.destroy()); this._texs = []; }
}
