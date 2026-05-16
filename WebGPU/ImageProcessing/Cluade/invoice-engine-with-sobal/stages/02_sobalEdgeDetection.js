// stages/02_sobelEdgeDetection.js
// Convert RGBA → grayscale r32float using GPU compute shader.
// (Sobel edge detection is applied optionally; here we primarily produce grayscale
//  which feeds downstream stages.  Edge magnitude is stored separately for
//  future use, e.g. as soft-weighting in the threshold stage.)

// Convert RGBA → r32float grayscale using a BT.709 compute shader.
import { loadShader } from '../shaders/_loader.js';

export async function sobelEdgeDetection(ctx) {
  const { gpu, texMgr, pipelineCache, width, height, rgbaTex, tracker } = ctx;
  const device = gpu.device;

  const grayTex = texMgr.create({
    width, height, format: 'r32float', label: 'gray_tex',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
  });
  tracker.trackTexture(grayTex);

  const wgsl = await loadShader('./shaders/grayscale.wgsl');
  const { pipeline } = await pipelineCache.get('grayscale', wgsl, 'main');

  const bindGroup = device.createBindGroup({
    label: 'grayscale_bg',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: rgbaTex.createView() },
      { binding: 1, resource: grayTex.createView() },
    ],
  });

  const enc  = gpu.encoder('gray_enc');
  const pass = enc.beginComputePass({ label: 'grayscale' });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 16));
  pass.end();
  await gpu.submit(enc.finish());

  return { grayTex };
}
