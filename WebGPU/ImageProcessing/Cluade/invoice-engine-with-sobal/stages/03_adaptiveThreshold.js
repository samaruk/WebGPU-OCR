// stages/03_adaptiveThreshold.js – Sauvola adaptive binarisation on GPU

import { loadShader } from '../shaders/_loader.js';

export async function adaptiveThreshold(ctx) {
  const { gpu, texMgr, pipelineCache, bufMgr, width, height, grayTex, tracker, config } = ctx;
  const device = gpu.device;

  // ── Output binary texture ────────────────────────────────────────────────
  const binaryTex = texMgr.create({
    width, height, format: 'r32float', label: 'binary_tex',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
  });
  tracker.trackTexture(binaryTex);

  // ── Uniform buffer ───────────────────────────────────────────────────────
  // struct Params { width, height, window, k, R, invert, _pad0, _pad1 }
  const halfWin = Math.floor(config.THRESH_WINDOW / 2);
  const uData   = new ArrayBuffer(32);
  const uView   = new DataView(uData);
  uView.setUint32(0,  width,              true);
  uView.setUint32(4,  height,             true);
  uView.setUint32(8,  halfWin,            true);
  uView.setFloat32(12, config.THRESH_BIAS, true);
  uView.setFloat32(16, config.THRESH_R,   true);
  uView.setUint32(20, 0,                  true);   // invert = 0 (dark text on white)
  uView.setUint32(24, 0,                  true);
  uView.setUint32(28, 0,                  true);

  const uBuf = bufMgr.uniform(32, 'thresh_uniform');
  bufMgr.write(uBuf, new Uint8Array(uData));

  // ── Pipeline ─────────────────────────────────────────────────────────────
  const wgsl = await loadShader('./shaders/threshold_adaptive.wgsl');
  const { pipeline } = await pipelineCache.get('adaptive_thresh', wgsl, 'main');

  const bindGroup = device.createBindGroup({
    label: 'thresh_bg',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uBuf } },
      { binding: 1, resource: grayTex.createView() },
      { binding: 2, resource: binaryTex.createView() },
    ],
  });

  // ── Dispatch ─────────────────────────────────────────────────────────────
  const enc  = gpu.encoder('thresh_enc');
  const pass = enc.beginComputePass({ label: 'adaptive_thresh' });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 16));
  pass.end();
  await gpu.submit(enc.finish());

  bufMgr.destroy(uBuf);
  return { binaryTex };
}
