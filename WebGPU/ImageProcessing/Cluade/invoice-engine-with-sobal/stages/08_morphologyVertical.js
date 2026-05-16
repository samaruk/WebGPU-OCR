// stages/08_morphologyVertical.js – Vertical separable dilation (second morph pass)

import { loadShader } from '../shaders/_loader.js';

export async function morphologyVertical(ctx) {
  const { gpu, texMgr, pipelineCache, bufMgr, width, height, morphHTex, tracker, config } = ctx;
  const device = gpu.device;

  const morphVTex = texMgr.create({
    width, height, format: 'r32float', label: 'morph_v_tex',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
  });
  tracker.trackTexture(morphVTex);

  const uBuf = bufMgr.uniform(16, 'morph_v_u');
  bufMgr.write(uBuf, new Uint32Array([width, height, config.MORPH_KERNEL, 0])); // op=0 dilate

  const wgsl = await loadShader('./shaders/morphology_vertical.wgsl');
  const { pipeline } = await pipelineCache.get('morph_v', wgsl, 'main');

  const bg = device.createBindGroup({
    label: 'morph_v_bg', layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uBuf } },
      { binding: 1, resource: morphHTex.createView() },
      { binding: 2, resource: morphVTex.createView() },
    ],
  });

  const enc  = gpu.encoder('morph_v_enc');
  const pass = enc.beginComputePass({ label: 'morph_v' });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 16));
  pass.end();
  await gpu.submit(enc.finish());

  bufMgr.destroy(uBuf);
  return { morphVTex };
}
