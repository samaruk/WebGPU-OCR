// stages/03_boundingBoxes/bboxPasses.js

import { createUniformBuffer } from '../../core/dispatchUtils.js';
import { loadShader } from '../../utils/shaderLoader.js';

const STRIDE = 8; // u32s per component

/**
 * Compute bounding boxes for all components using atomic GPU operations.
 * Returns array of { id, minX, minY, maxX, maxY, width, height, area }
 */
export async function runBoundingBoxes(ctx, pipeFactory, labelsBuf, numComponents, imgWidth, imgHeight, minArea, maxArea) {
  const { device, queue } = ctx;

  if (numComponents === 0) return [];

  const BBOX_INIT_WGSL   = await loadShader('shaders/bbox_init.wgsl');

  const bboxBuf = device.createBuffer({
    label: 'bbox-data',
    size: numComponents * STRIDE * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  // ── Init bounding boxes ──────────────────────────────────────
  const initPipeline = await pipeFactory.getComputePipeline('bbox_init', BBOX_INIT_WGSL);
  const initUniforms = createUniformBuffer(device, [numComponents, 0, 0, 0], 'bbox-init-uni');
  const initBG = pipeFactory.createBindGroup(initPipeline, [
    { binding: 0, resource: { buffer: initUniforms } },
    { binding: 1, resource: { buffer: bboxBuf } },
  ]);
  {
    const enc = device.createCommandEncoder({ label: 'bbox-init' });
    const pass = enc.beginComputePass();
    pass.setPipeline(initPipeline);
    pass.setBindGroup(0, initBG);
    pass.dispatchWorkgroups(Math.ceil(numComponents / 64));
    pass.end();
    queue.submit([enc.finish()]);
    await queue.onSubmittedWorkDone();
  }
  initUniforms.destroy();

  // ── Atomic accumulation ───────────────────────────────────────
  const atomicPipeline = await pipeFactory.getComputePipeline('bbox_atomic', BBOX_ATOMIC_WGSL);
  const atomicUniforms = createUniformBuffer(device,
    [imgWidth, imgHeight, numComponents, 0], 'bbox-atomic-uni');
  const atomicBG = pipeFactory.createBindGroup(atomicPipeline, [
    { binding: 0, resource: { buffer: atomicUniforms } },
    { binding: 1, resource: { buffer: labelsBuf } },
    { binding: 2, resource: { buffer: bboxBuf } },
  ]);
  {
    const enc = device.createCommandEncoder({ label: 'bbox-atomic' });
    const pass = enc.beginComputePass();
    pass.setPipeline(atomicPipeline);
    pass.setBindGroup(0, atomicBG);
    pass.dispatchWorkgroups(Math.ceil(imgWidth / 8), Math.ceil(imgHeight / 8));
    pass.end();
    queue.submit([enc.finish()]);
    await queue.onSubmittedWorkDone();
  }
  atomicUniforms.destroy();

  // ── Readback ─────────────────────────────────────────────────
  const stagingBuf = device.createBuffer({
    size: numComponents * STRIDE * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  {
    const enc = device.createCommandEncoder();
    enc.copyBufferToBuffer(bboxBuf, 0, stagingBuf, 0, numComponents * STRIDE * 4);
    queue.submit([enc.finish()]);
    await stagingBuf.mapAsync(GPUMapMode.READ);
  }
  const raw = new Uint32Array(stagingBuf.getMappedRange().slice(0));
  stagingBuf.unmap();
  stagingBuf.destroy();
  bboxBuf.destroy();

  // ── Parse results ─────────────────────────────────────────────
  const boxes = [];
  const U32_MAX = 0xFFFFFFFF;

  for (let i = 0; i < numComponents; i++) {
    const base = i * STRIDE;
    const minX = raw[base + 0];
    const minY = raw[base + 1];
    const maxX = raw[base + 2];
    const maxY = raw[base + 3];
    const area = raw[base + 4];

    if (minX === U32_MAX || area === 0) continue;
    if (area < minArea || area > maxArea) continue;

    boxes.push({
      id: i + 1,
      minX, minY, maxX, maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      area,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
    });
  }

  // Sort left-to-right, top-to-bottom (reading order)
  boxes.sort((a, b) => {
    const rowA = Math.floor(a.cy / 20);
    const rowB = Math.floor(b.cy / 20);
    return rowA !== rowB ? rowA - rowB : a.cx - b.cx;
  });

  return boxes;
}
