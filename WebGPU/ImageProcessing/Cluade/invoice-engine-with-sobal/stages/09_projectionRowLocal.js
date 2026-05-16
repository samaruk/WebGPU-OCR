// stages/09_projectionRowLocal.js  – horizontal projection (foreground density per row)
// stages/10_projectionRowFinal.js  – normalize row sums → float [0,1]
// stages/11_projectionColLocal.js  – vertical projection (density per column)
// stages/12_projectionColFinal.js  – normalize col sums → float [0,1]
// All four stages are combined in this file for brevity; each is exported separately.

import { loadShader } from '../shaders/_loader.js';

// ── Shared helper ─────────────────────────────────────────────────────────────

async function runProjection(ctx, axis, inputTex, label) {
  const { gpu, pipelineCache, bufMgr, width, height } = ctx;
  const device = gpu.device;

  const length  = (axis === 0) ? height : width;    // row proj → H elements, col → W
  const divisor = (axis === 0) ? width  : height;

  // Raw atomic sum buffer (u32)
  const rawBuf = bufMgr.storage(length * 4, `${label}_raw`);
  // Zero-init
  const zeros  = new Uint32Array(length);
  gpu.device.queue.writeBuffer(rawBuf, 0, zeros);

  // Normalised float buffer
  const normBuf = bufMgr.storage(length * 4, `${label}_norm`);

  // ── Pass 1: accumulate (atomic add) ──────────────────────────────────────
  const localWgsl = await loadShader('./shaders/projection_local.wgsl');
  const { pipeline: localPipeline } = await pipelineCache.get(`proj_local_${axis}`, localWgsl, 'main');

  const localU = bufMgr.uniform(16, `${label}_local_u`);
  bufMgr.write(localU, new Uint32Array([width, height, axis, 0]));

  const localBg = device.createBindGroup({
    label: `${label}_local_bg`, layout: localPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: localU } },
      { binding: 1, resource: inputTex.createView() },
      { binding: 2, resource: { buffer: rawBuf } },
    ],
  });

  const enc1   = gpu.encoder(`${label}_local_enc`);
  const pass1  = enc1.beginComputePass();
  pass1.setPipeline(localPipeline);
  pass1.setBindGroup(0, localBg);
  // Each thread handles one pixel; dispatch enough threads to cover all pixels
  pass1.dispatchWorkgroups(Math.ceil(width / 256), height);
  pass1.end();
  await gpu.submit(enc1.finish());

  // ── Pass 2: normalise ─────────────────────────────────────────────────────
  const finalWgsl = await loadShader('./shaders/projection_final.wgsl');
  const { pipeline: finalPipeline } = await pipelineCache.get('proj_final', finalWgsl, 'main');

  const finalUData = new ArrayBuffer(16);
  const fu32 = new Uint32Array(finalUData);
  const ff32 = new Float32Array(finalUData);
  fu32[0] = length;
  ff32[1] = divisor;
  fu32[2] = 0; fu32[3] = 0;

  const finalU = bufMgr.uniform(16, `${label}_final_u`);
  bufMgr.write(finalU, new Uint8Array(finalUData));

  const finalBg = device.createBindGroup({
    label: `${label}_final_bg`, layout: finalPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: finalU } },
      { binding: 1, resource: { buffer: rawBuf } },
      { binding: 2, resource: { buffer: normBuf } },
    ],
  });

  const enc2  = gpu.encoder(`${label}_final_enc`);
  const pass2 = enc2.beginComputePass();
  pass2.setPipeline(finalPipeline);
  pass2.setBindGroup(0, finalBg);
  pass2.dispatchWorkgroups(Math.ceil(length / 256));
  pass2.end();
  await gpu.submit(enc2.finish());

  // Read back to CPU for analysis
  const normData = await bufMgr.readback32(normBuf, length * 4, Float32Array);

  bufMgr.destroy(rawBuf);
  bufMgr.destroy(normBuf);
  bufMgr.destroy(localU);
  bufMgr.destroy(finalU);

  return normData;
}

// ── Exported stage entry-points ───────────────────────────────────────────────

export async function projectionRowLocal(ctx) {
  // Rows: how much foreground per row (horizontal text density)
  const rowProjection = await runProjection(ctx, 0, ctx.morphVTex, 'row');
  return { rowProjection };
}

export async function projectionRowFinal(ctx) {
  // Already computed in projectionRowLocal; this stage is a no-op passthrough.
  return {};
}

export async function projectionColLocal(ctx) {
  const colProjection = await runProjection(ctx, 1, ctx.morphVTex, 'col');
  return { colProjection };
}

export async function projectionColFinal(ctx) {
  return {};
}
