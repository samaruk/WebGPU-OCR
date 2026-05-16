
export async function readbackTexture(device, texture, width, height) {
  const bytesPerRow = Math.ceil(width*4/256)*256;
  const staging = device.createBuffer({
    size: bytesPerRow*height, usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ,
  });
  const enc = device.createCommandEncoder();
  enc.copyTextureToBuffer({ texture }, { buffer:staging, bytesPerRow, rowsPerImage:height }, [width,height]);
  device.queue.submit([enc.finish()]);
  await staging.mapAsync(GPUMapMode.READ);
  const raw = new Uint8Array(staging.getMappedRange());
  const out = new Uint8ClampedArray(width*height*4);
  for (let row=0;row<height;row++) {
    out.set(raw.subarray(row*bytesPerRow, row*bytesPerRow+width*4), row*width*4);
  }
  staging.unmap(); staging.destroy();
  return out;
}

export async function readbackBuffer(device, buffer, count) {
  const staging = device.createBuffer({
    size:count*4, usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ,
  });
  const enc = device.createCommandEncoder();
  enc.copyBufferToBuffer(buffer, 0, staging, 0, count*4);
  device.queue.submit([enc.finish()]);
  await staging.mapAsync(GPUMapMode.READ);
  const data = new Uint32Array(staging.getMappedRange().slice(0));
  staging.unmap(); staging.destroy();
  return data;
}

export async function readbackBufferU32(device, buffer, byteOffset, count) {
  const staging = device.createBuffer({
    size:count*4, usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ,
  });
  const enc = device.createCommandEncoder();
  enc.copyBufferToBuffer(buffer, byteOffset, staging, 0, count*4);
  device.queue.submit([enc.finish()]);
  await staging.mapAsync(GPUMapMode.READ);
  const val = new Uint32Array(staging.getMappedRange().slice(0));
  staging.unmap(); staging.destroy();
  return val;
}
