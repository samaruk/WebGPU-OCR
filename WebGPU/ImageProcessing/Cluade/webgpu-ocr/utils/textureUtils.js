// GPU Texture utilities

/**
 * Create a GPUTexture from an HTMLImageElement or ImageBitmap.
 */
export async function imageToGPUTexture(device, img) {
  const bitmap = img instanceof ImageBitmap ? img
               : await createImageBitmap(img);
  const texture = device.createTexture({
    size:   [bitmap.width, bitmap.height, 1],
    format: 'rgba8unorm',
    usage:  GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
            | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture },
    [bitmap.width, bitmap.height],
  );
  return texture;
}

/**
 * Create storage texture.
 */
export function createStorageTexture(device, W, H, format = 'rgba8unorm') {
  return device.createTexture({
    size:   [W, H, 1],
    format,
    usage:  GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC
            | GPUTextureUsage.TEXTURE_BINDING,
  });
}
