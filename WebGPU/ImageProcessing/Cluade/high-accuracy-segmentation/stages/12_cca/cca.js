/**
 * stages/12_cca/cca.js
 * Two-pass GPU Connected Component Analysis using label equivalence.
 * Returns componentCount and a label texture.
 */
import { PipelineBuilder } from "../../core/pipelineBuilder.js";
import { dispatch2D } from "../../core/dispatch.js";
import { loadShader } from "../../core/loadShader.js";
const WGSL = await loadShader('./stages/12_cca/cca.wgsl');

export async function runCCA(gpuCtx, labelTex, registry) {
  const { device } = gpuCtx;
  const W = labelTex.width, H = labelTex.height;

  // Use union-find on GPU: each pixel stores its root label
  const rootBuf = device.createBuffer({
    size: W * H * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  const builder = new PipelineBuilder(device);
  const pipelineInit  = await builder.build("cca_init",  WGSL, "init");
  const pipelineUnion = await builder.build("cca_union", WGSL, "union_pass");
  const pipelineFlat  = await builder.build("cca_flat",  WGSL, "flatten");

  const uData = new Float32Array([W, H, 0, 0]);
  const uBuf  = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uBuf, 0, uData);

  const outTex = registry.createTexture(W, H, "r32uint", "cca_out");

  const bgInit = builder.buildBindGroup(pipelineInit, [labelTex.createView(), { buffer: rootBuf }, { buffer: uBuf }]);
  const enc1 = device.createCommandEncoder();
  dispatch2D(enc1, pipelineInit, bgInit, W, H);
  await gpuCtx.submit(enc1);

  const bgUnion = builder.buildBindGroup(pipelineUnion, [labelTex.createView(), { buffer: rootBuf }, { buffer: uBuf }]);
  for (let i = 0; i < 20; i++) {
    const enc = device.createCommandEncoder();
    dispatch2D(enc, pipelineUnion, bgUnion, W, H);
    await gpuCtx.submit(enc);
  }

  const bgFlat = builder.buildBindGroup(pipelineFlat, [{ buffer: rootBuf }, outTex.createView(), { buffer: uBuf }]);
  const enc3 = device.createCommandEncoder();
  dispatch2D(enc3, pipelineFlat, bgFlat, W, H);
  await gpuCtx.submit(enc3);

  // Count unique labels via readback
  const bufManager = { readback: async (buf, size) => {
    const s = device.createBuffer({ size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const e = device.createCommandEncoder();
    e.copyBufferToBuffer(buf, 0, s, 0, size);
    device.queue.submit([e.finish()]);
    await s.mapAsync(GPUMapMode.READ);
    const d = new Uint32Array(s.getMappedRange().slice(0));
    s.unmap(); s.destroy(); return d;
  }};
  const roots = await bufManager.readback(rootBuf, W * H * 4);
  const uniqueLabels = new Set(roots.filter(v => v > 0));
  const componentCount = uniqueLabels.size;

  rootBuf.destroy(); uBuf.destroy();
  return { labelTex: outTex, componentCount };
}
