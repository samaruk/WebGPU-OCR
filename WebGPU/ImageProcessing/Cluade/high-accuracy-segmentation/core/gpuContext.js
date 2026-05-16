/**
 * core/gpuContext.js - WebGPU adapter + device initialization
 */
export class GPUContext {
  constructor(adapter, device) {
    this.adapter = adapter;
    this.device = device;
    this.adapterInfo = null;
  }

  static async create() {
    if (!navigator.gpu) throw new Error("WebGPU not supported.");
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) throw new Error("No WebGPU adapter found.");
    const device = await adapter.requestDevice({
      requiredLimits: {
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxComputeWorkgroupStorageSize: adapter.limits.maxComputeWorkgroupStorageSize,
      },
    });
    device.lost.then(info => console.error("GPU lost:", info.message));
    const ctx = new GPUContext(adapter, device);
    try { ctx.adapterInfo = await adapter.requestAdapterInfo(); } catch (_) {}
    return ctx;
  }

  async uploadImageData(imageData, format = "rgba8unorm") {
    const { width, height, data } = imageData;
    const texture = this.device.createTexture({
      size: { width, height }, format,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING |
             GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
    });
    this.device.queue.writeTexture({ texture }, data, { bytesPerRow: width * 4 }, { width, height });
    return texture;
  }

  createTexture(width, height, format = "rgba8unorm", label = "") {
    return this.device.createTexture({
      size: { width, height }, format, label,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING |
             GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
    });
  }

  async downloadToImageData(texture) {
    const { width, height } = texture;
    const bytesPerRow = Math.ceil((width * 4) / 256) * 256;
    const buffer = this.device.createBuffer({
      size: bytesPerRow * height,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const encoder = this.device.createCommandEncoder();
    encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow }, { width, height });
    this.device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(GPUMapMode.READ);
    const src = new Uint8Array(buffer.getMappedRange());
    const dst = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      dst.set(src.subarray(y * bytesPerRow, y * bytesPerRow + width * 4), y * width * 4);
    }
    buffer.unmap();
    buffer.destroy();
    return new ImageData(dst, width, height);
  }

  async submit(encoder) {
    this.device.queue.submit([encoder.finish()]);
    await this.device.queue.onSubmittedWorkDone();
  }
}
