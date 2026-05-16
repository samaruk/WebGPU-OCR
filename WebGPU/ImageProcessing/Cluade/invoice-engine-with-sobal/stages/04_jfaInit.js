// stages/04_jfaInit.js – Seed JFA with foreground pixel positions

import { loadShader } from '../shaders/_loader.js';

export async function jfaInit(ctx) {
  const { gpu, texMgr, pipelineCache, bufMgr, width, height, binaryTex, tracker } = ctx;
  const device = gpu.device;

  // ── JFA texture: rg32uint stores (seedX, seedY) per pixel ───────────────
  const jfaTex = texMgr.create({
    width, height, format: 'rg32uint', label: 'jfa_a',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
  });
  tracker.trackTexture(jfaTex);

  // ── Uniform ──────────────────────────────────────────────────────────────
  const uBuf = bufMgr.uniform(16, 'jfa_init_u');
  bufMgr.write(uBuf, new Uint32Array([width, height, 0, 0]));

  // ── Pipeline ─────────────────────────────────────────────────────────────
  const wgsl = await loadShader('./shaders/jfa_init.wgsl');
  const { pipeline } = await pipelineCache.get('jfa_init', wgsl, 'main');

  const bindGroup = device.createBindGroup({
    label: 'jfa_init_bg',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uBuf } },
      { binding: 1, resource: binaryTex.createView() },
      { binding: 2, resource: jfaTex.createView() },
    ],
  });

  const enc  = gpu.encoder('jfa_init_enc');
  const pass = enc.beginComputePass({ label: 'jfa_init' });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 16));
  pass.end();
  await gpu.submit(enc.finish());

  bufMgr.destroy(uBuf);
  return { jfaTex };
}
