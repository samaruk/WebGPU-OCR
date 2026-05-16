// stages/06_sdfLocalMax.js
// Compute SDF from JFA output and find local maxima (= inscribed circle centres).

import { loadShader } from '../shaders/_loader.js';

export async function sdfLocalMax(ctx) {
  const { gpu, texMgr, pipelineCache, bufMgr, width, height, finalJfaTex, tracker, config } = ctx;
  const device = gpu.device;

  // ── Output textures ──────────────────────────────────────────────────────
  const sdfTex = texMgr.create({
    width, height, format: 'r32float', label: 'sdf_tex',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
  });
  tracker.trackTexture(sdfTex);

  const maximaTex = texMgr.create({
    width, height, format: 'r32float', label: 'maxima_tex',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
  });
  tracker.trackTexture(maximaTex);

  // ── Uniform ──────────────────────────────────────────────────────────────
  // struct Params { width, height, lm_radius, min_r, max_r, _p0, _p1, _p2 }
  const uData = new ArrayBuffer(32);
  const u32   = new Uint32Array(uData);
  const f32   = new Float32Array(uData);
  u32[0] = width;
  u32[1] = height;
  u32[2] = config.SDF_LOCAL_RADIUS;
  f32[3] = config.CIRCLE_MIN_R;
  f32[4] = config.CIRCLE_MAX_R;
  u32[5] = 0; u32[6] = 0; u32[7] = 0;

  const uBuf = bufMgr.uniform(32, 'sdf_u');
  bufMgr.write(uBuf, new Uint8Array(uData));

  // ── Pipeline ─────────────────────────────────────────────────────────────
  const wgsl = await loadShader('./shaders/sdf_localmax.wgsl');
  const { pipeline } = await pipelineCache.get('sdf_localmax', wgsl, 'main');

  const bindGroup = device.createBindGroup({
    label: 'sdf_bg',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uBuf } },
      { binding: 1, resource: finalJfaTex.createView() },
      { binding: 2, resource: sdfTex.createView() },
      { binding: 3, resource: maximaTex.createView() },
    ],
  });

  const enc  = gpu.encoder('sdf_enc');
  const pass = enc.beginComputePass({ label: 'sdf_localmax' });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 16));
  pass.end();
  await gpu.submit(enc.finish());

  bufMgr.destroy(uBuf);
  return { sdfTex, maximaTex };
}
