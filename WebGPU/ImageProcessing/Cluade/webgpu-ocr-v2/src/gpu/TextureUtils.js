// GPU texture creation and upload helpers
export class TextureUtils {
  constructor(device) { this.device = device; }

  fromImageBitmap(bitmap, label = 'tex') {
    const tex = this.device.createTexture({
      label, size: [bitmap.width, bitmap.height, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.device.queue.copyExternalImageToTexture({ source: bitmap }, { texture: tex }, [bitmap.width, bitmap.height]);
    return tex;
  }

  createF32(width, height, label = 'f32tex') {
    return this.device.createTexture({
      label, size: [width, height, 1], format: 'r32float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
    });
  }

  createRGBA(width, height, label = 'rgbatex') {
    return this.device.createTexture({
      label, size: [width, height, 1], format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });
  }
}