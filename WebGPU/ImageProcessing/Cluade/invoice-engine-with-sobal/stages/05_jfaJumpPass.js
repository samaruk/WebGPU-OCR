// stages/05_jfaJumpPass.js – Run N jump-flood passes to propagate seed coordinates

import { loadShader } from '../shaders/_loader.js';
import { PingPongHandler } from '../core/pingPongHandler.js';

export async function jfaJumpPass(ctx) {
  const { gpu, texMgr, pipelineCache, bufMgr, width, height, jfaTex, tracker, config } = ctx;
  const device = gpu.device;

  // ── Determine number of passes ───────────────────────────────────────────
  const nPasses = config.jfaPasses(width, height);

  // ── Ping-pong texture pair (jfaTex is A, create B) ──────────────────────
  const jfaTexB = texMgr.create({
    width, height, format: 'rg32uint', label: 'jfa_b',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
  });
  tracker.trackTexture(jfaTexB);

  const pp = new PingPongHandler([jfaTex, jfaTexB]);

  // ── Pipeline ─────────────────────────────────────────────────────────────
  const wgsl = await loadShader('./shaders/jfa_jump.wgsl');
  const { pipeline } = await pipelineCache.get('jfa_jump', wgsl, 'main');

  const WX = Math.ceil(width  / 16);
  const WY = Math.ceil(height / 16);

  // ── Execute passes ───────────────────────────────────────────────────────
  for (let pass = 0; pass < nPasses; pass++) {
    const step = Math.max(1, Math.floor(Math.max(width, height) / (1 << (pass + 1))));

    const uBuf = bufMgr.uniform(16, `jfa_u_${pass}`);
    bufMgr.write(uBuf, new Uint32Array([width, height, step, 0]));

    const bindGroup = device.createBindGroup({
      label: `jfa_bg_${pass}`,
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uBuf } },
        { binding: 1, resource: pp.src.createView() },   // read
        { binding: 2, resource: pp.dst.createView() },   // write
      ],
    });

    const enc     = gpu.encoder(`jfa_pass_${pass}`);
    const cpPass  = enc.beginComputePass({ label: `jfa_pass_${pass}` });
    cpPass.setPipeline(pipeline);
    cpPass.setBindGroup(0, bindGroup);
    cpPass.dispatchWorkgroups(WX, WY);
    cpPass.end();
    await gpu.submit(enc.finish());

    bufMgr.destroy(uBuf);
    pp.swap();
  }

  // After N passes, src holds the final result
  const finalJfaTex = pp.src;
  return { finalJfaTex };
}
