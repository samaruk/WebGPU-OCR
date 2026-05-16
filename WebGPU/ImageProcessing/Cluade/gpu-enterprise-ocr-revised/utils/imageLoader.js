
export async function loadImageToTexture(device, source) {
  let bitmap;
  if (source instanceof File) {
    const url = URL.createObjectURL(source);
    const img = new Image();
    await new Promise((res,rej)=>{ img.onload=res; img.onerror=rej; img.src=url; });
    bitmap = await createImageBitmap(img, { colorSpaceConversion:'none' });
    URL.revokeObjectURL(url);
  } else {
    const img = new Image();
    await new Promise((res,rej)=>{ img.onload=res; img.onerror=rej; img.src=source; });
    bitmap = await createImageBitmap(img, { colorSpaceConversion:'none' });
  }
  const { width, height } = bitmap;
  const texture = device.createTexture({
    label:'input-image', size:[width,height,1], format:'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture({ source:bitmap }, { texture }, [width,height]);
  bitmap.close();
  return { texture, width, height };
}
