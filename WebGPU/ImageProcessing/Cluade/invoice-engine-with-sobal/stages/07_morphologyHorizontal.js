// stages/07_morphologyHorizontal.js – Horizontal separable dilation on binary texture

import { loadShader } from '../shaders/_loader.js';

export async function morphologyHorizontal(ctx) {
  const { gpu, texMgr, pipelineCache, bufMgr, width, height, binaryTex, tracker, config } = ctx;
  const device = gpu.device;

  const morphHTex = texMgr.create({
    width, height, format: 'r32float', label: 'morph_h_tex',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
  });
  tracker.trackTexture(morphHTex);

  const uBuf = bufMgr.uniform(16, 'morph_h_u');
  bufMgr.write(uBuf, new Uint32Array([width, height, config.MORPH_KERNEL, 0])); // op=0 dilate

  const wgsl = await loadShader('./shaders/morphology_horizontal.wgsl');
  const { pipeline } = await pipelineCache.get('morph_h', wgsl, 'main');

  const bg = device.createBindGroup({
    label: 'morph_h_bg', layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uBuf } },
      { binding: 1, resource: binaryTex.createView() },
      { binding: 2, resource: morphHTex.createView() },
    ],
  });

  const enc  = gpu.encoder('morph_h_enc');
  const pass = enc.beginComputePass({ label: 'morph_h' });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(Math.ceil(width / 256), height);
  pass.end();
  await gpu.submit(enc.finish());

  bufMgr.destroy(uBuf);
  return { morphHTex };
}
