// utils/debugReadback.js — Utilities to read GPU data back to CPU for debugging

/**
 * Read a GPU texture back as RGBA Uint8Array.
 * Texture must have GPUTextureUsage.COPY_SRC.
 */
export async function readTextureRGBA(device, texture, width, height) {
  const bytesPerRow = Math.ceil(width * 4 / 256) * 256;
  const bufferSize = bytesPerRow * height;

  const stagingBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const encoder = device.createCommandEncoder();
  encoder.copyTextureToBuffer(
    { texture, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
    { buffer: stagingBuffer, bytesPerRow, rowsPerImage: height },
    { width, height, depthOrArrayLayers: 1 }
  );
  device.queue.submit([encoder.finish()]);

  await stagingBuffer.mapAsync(GPUMapMode.READ);
  const rawData = new Uint8Array(stagingBuffer.getMappedRange()).slice(0);
  stagingBuffer.unmap();
  stagingBuffer.destroy();

  // Remove row padding
  const packed = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    packed.set(
      rawData.subarray(y * bytesPerRow, y * bytesPerRow + width * 4),
      y * width * 4
    );
  }
  return packed;
}

/**
 * Draw RGBA data to a 2D canvas context.
 */
export function drawRGBAToCanvas(canvas, rgbaData, width, height) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = new ImageData(new Uint8ClampedArray(rgbaData), width, height);
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Colorize a label buffer into RGBA for visualization.
 * label 0 = transparent, labels 1..N get hue-cycled colors.
 */
export function colorizeLabels(labelsU32, width, height, palette) {
  const rgba = new Uint8Array(width * height * 4);
  const N = width * height;

  for (let i = 0; i < N; i++) {
    const label = labelsU32[i];
    if (label === 0) {
      rgba[i * 4 + 3] = 0; // transparent background
      continue;
    }
    const color = palette[(label - 1) % palette.length];
    rgba[i * 4 + 0] = color[0];
    rgba[i * 4 + 1] = color[1];
    rgba[i * 4 + 2] = color[2];
    rgba[i * 4 + 3] = 180; // semi-transparent overlay
  }
  return rgba;
}

/**
 * Log stats about a buffer to console.
 */
export function logBufferStats(name, data) {
  if (data instanceof Uint32Array) {
    const nonZero = data.filter(v => v > 0).length;
    const max = Math.max(...data);
    console.debug(`[DEBUG] ${name}: nonZero=${nonZero}/${data.length}, max=${max}`);
  } else if (data instanceof Float32Array) {
    const nonZero = data.filter(v => v > 0 && v < 1e8).length;
    const max = Math.max(...data.filter(v => v < 1e8));
    console.debug(`[DEBUG] ${name}: nonZero=${nonZero}/${data.length}, max=${max.toFixed(2)}`);
  }
}
