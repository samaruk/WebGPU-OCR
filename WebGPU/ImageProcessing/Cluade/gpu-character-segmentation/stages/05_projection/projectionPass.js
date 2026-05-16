// stages/05_projection/projectionPass.js

import { createUniformBuffer } from '../../core/dispatchUtils.js';
import { loadShader } from '../../utils/shaderLoader.js';


/**
 * Compute row and column projections of the binary image.
 * Returns { rowProj: Uint32Array, colProj: Uint32Array }
 */
export async function runProjection(ctx, texManager, pipeFactory, width, height, binaryTexName) {
  const { device, queue } = ctx;

  const rowBuf = device.createBuffer({
    label: 'row-proj',
    size: Math.max(16, height * 4),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  const colBuf = device.createBuffer({
    label: 'col-proj',
    size: Math.max(16, width * 4),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  // Zero init
  queue.writeBuffer(rowBuf, 0, new Uint32Array(height));
  queue.writeBuffer(colBuf, 0, new Uint32Array(width));

  const PROJECTION_WGSL = await loadShader('shaders/projection.wgsl');
  const pipeline = await pipeFactory.getComputePipeline('projection', PROJECTION_WGSL);
  const uniforms = createUniformBuffer(device, [width, height, 0, 0], 'proj-uni');

  const bindGroup = pipeFactory.createBindGroup(pipeline, [
    { binding: 0, resource: { buffer: uniforms } },
    { binding: 1, resource: texManager.view(binaryTexName) },
    { binding: 2, resource: { buffer: rowBuf } },
    { binding: 3, resource: { buffer: colBuf } },
  ]);

  const enc = device.createCommandEncoder({ label: 'projection' });
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
  pass.end();
  queue.submit([enc.finish()]);
  await queue.onSubmittedWorkDone();
  uniforms.destroy();

  // Readback
  const stagingRow = device.createBuffer({ size: height * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const stagingCol = device.createBuffer({ size: width * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  {
    const enc2 = device.createCommandEncoder();
    enc2.copyBufferToBuffer(rowBuf, 0, stagingRow, 0, height * 4);
    enc2.copyBufferToBuffer(colBuf, 0, stagingCol, 0, width * 4);
    queue.submit([enc2.finish()]);
    await Promise.all([stagingRow.mapAsync(GPUMapMode.READ), stagingCol.mapAsync(GPUMapMode.READ)]);
  }
  const rowProj = new Uint32Array(stagingRow.getMappedRange().slice(0));
  const colProj = new Uint32Array(stagingCol.getMappedRange().slice(0));
  stagingRow.unmap();
  stagingCol.unmap();
  stagingRow.destroy();
  stagingCol.destroy();
  rowBuf.destroy();
  colBuf.destroy();

  return { rowProj, colProj };
}
