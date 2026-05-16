// ============================================================
// SIFT-GPU  –  GPU Context Initialisation
// ============================================================

/** @type {GPUDevice | null} */
let _device = null;

/**
 * Request a WebGPU device with the features needed for SIFT.
 * @returns {Promise<{device: GPUDevice, adapter: GPUAdapter}>}
 */
export async function initGPU() {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this browser.');
  }
    const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
  });
  if (!adapter) {
    throw new Error('No suitable GPU adapter found.');
  }

  // Log adapter info if available
    if (adapter.info) {
        try {
            const info = await adapter.requestAdapterInfo();
            console.log(`[SIFT-GPU] Adapter: ${info.vendor} – ${info.device}`);
        } catch {
            //this.adapterInfo = { vendor: 'unknown', device: 'unknown' };
        }
  }

  const requiredFeatures = [];
  // timestamp-query for profiling (optional)
  if (adapter.features.has('timestamp-query')) {
    requiredFeatures.push('timestamp-query');
  }

  const device = await adapter.requestDevice({
    requiredFeatures,
    requiredLimits: {
      // Request large enough storage-buffer size for keypoint + descriptor arrays
      maxStorageBufferBindingSize: Math.min(
        adapter.limits.maxStorageBufferBindingSize,
        256 * 1024 * 1024, // 256 MB cap
      ),
      maxComputeWorkgroupsPerDimension: adapter.limits.maxComputeWorkgroupsPerDimension,
    },
  });

  device.lost.then((info) => {
    console.error('[SIFT-GPU] Device lost:', info.message, info.reason);
  });

  _device = device;
  return { device, adapter };
}

/** Return the cached device (must call initGPU() first). */
export function getDevice() {
  if (!_device) throw new Error('GPU not initialised. Call initGPU() first.');
  return _device;
}

/** Upload a CPU Float32Array to a GPU storage buffer (mapped write). */
export function uploadBuffer(device, data, label = '') {
  const buf = device.createBuffer({
    label,
    size:  Math.max(4, data.byteLength),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(buf, 0, data);
  return buf;
}

/** Read back a storage buffer to a CPU ArrayBuffer. */
export async function readbackBuffer(device, gpuBuf, byteLength) {
  const staging = device.createBuffer({
    size:  byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });
  const enc = device.createCommandEncoder();
  enc.copyBufferToBuffer(gpuBuf, 0, staging, 0, byteLength);
  device.queue.submit([enc.finish()]);
  await staging.mapAsync(GPUMapMode.READ);
  const result = staging.getMappedRange().slice(0);
  staging.unmap();
  staging.destroy();
  return result;
}

/** Create a GPUTexture suitable for a single Gaussian/DoG image. */
export function createFloat32Texture(device, width, height, label = '') {
  return device.createTexture({
    label,
    size:   { width, height, depthOrArrayLayers: 1 },
    format: 'r32float',
    usage:  GPUTextureUsage.STORAGE_BINDING |
            GPUTextureUsage.TEXTURE_BINDING  |
            GPUTextureUsage.COPY_SRC         |
            GPUTextureUsage.COPY_DST,
  });
}

/** Upload a grayscale Float32Array image to a GPU texture. */
export function uploadGrayscaleTexture(device, data, width, height) {
  const tex = createFloat32Texture(device, width, height, 'input-image');
  device.queue.writeTexture(
    { texture: tex },
    data,
    { bytesPerRow: width * 4 },
    { width, height },
  );
  return tex;
}
