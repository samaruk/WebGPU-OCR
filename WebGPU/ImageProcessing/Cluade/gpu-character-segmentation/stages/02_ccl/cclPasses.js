// stages/02_ccl/cclPasses.js — Full CCL pipeline

import { createUniformBuffer, createZeroedBuffer } from '../../core/dispatchUtils.js';
import { loadShader } from '../../utils/shaderLoader.js';

const MAX_ITER = 512;

/**
 * Full CCL pipeline:
 * 1. Init labels
 * 2. Union-Find iterations until convergence
 * 3. Flatten labels
 * 4. CPU-side remap table build
 * 5. GPU relabel to compact IDs
 *
 * Returns { numComponents, labels: GPUBuffer }
 */
export async function runCCL(ctx, texManager, bufManager, pipeFactory, width, height, binaryTexName) {
  const { device, queue } = ctx;
  const N = width * height;

    const CCL_INIT_WGSL = await loadShader('shaders/ccl_init.wgsl');
    const CCL_FLAT_WGSL = await loadShader('shaders/ccl_flatten.wgsl');
    const CCL_UNION_WGSL = await loadShader('shaders/ccl_union.wgsl');
    const CCL_REMAP_WGSL = await loadShader('shaders/ccl_relabel.wgsl');

  // ── 1. Init ──────────────────────────────────────────────────
  const initPipeline = await pipeFactory.getComputePipeline('ccl_init', CCL_INIT_WGSL);

  const labelsBuf = device.createBuffer({
    label: 'ccl-labels',
    size: N * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  const initUniforms = createUniformBuffer(device, [width, height, 0, 0], 'ccl-init-uni');

  const initBindGroup = pipeFactory.createBindGroup(initPipeline, [
    { binding: 0, resource: { buffer: initUniforms } },
    { binding: 1, resource: texManager.view(binaryTexName) },
    { binding: 2, resource: { buffer: labelsBuf } },
  ]);

  {
    const enc = device.createCommandEncoder({ label: 'ccl-init' });
    const pass = enc.beginComputePass();
    pass.setPipeline(initPipeline);
    pass.setBindGroup(0, initBindGroup);
    pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    pass.end();
    queue.submit([enc.finish()]);
    await queue.onSubmittedWorkDone();
  }
  initUniforms.destroy();

  // ── 2. Union-Find iterations ──────────────────────────────────
  const unionPipeline = await pipeFactory.getComputePipeline('ccl_union', CCL_UNION_WGSL);

  const changedBuf = device.createBuffer({
    label: 'ccl-changed',
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  // Use a simplified struct: just width+height uniform (no atomic in uniform)
  const unionUniforms = device.createBuffer({
    label: 'ccl-union-uni',
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint32Array(unionUniforms.getMappedRange()).set([width, height, 0, 0]);
  unionUniforms.unmap();

  const unionBindGroup = pipeFactory.createBindGroup(unionPipeline, [
    { binding: 0, resource: { buffer: unionUniforms } },
    { binding: 1, resource: { buffer: labelsBuf } },
    { binding: 2, resource: { buffer: changedBuf } },
  ]);

  // Iterate until no changes (with max iteration cap)
  for (let iter = 0; iter < MAX_ITER; iter++) {
    // Clear changed flag
    const zeroData = new Uint32Array([0, 0, 0, 0]);
    queue.writeBuffer(changedBuf, 0, zeroData);

    const enc = device.createCommandEncoder({ label: `ccl-union-${iter}` });
    const pass = enc.beginComputePass();
    pass.setPipeline(unionPipeline);
    pass.setBindGroup(0, unionBindGroup);
    pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    pass.end();
    queue.submit([enc.finish()]);
    await queue.onSubmittedWorkDone();

    // Check if any changes occurred
    const stagingBuf = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const enc2 = device.createCommandEncoder();
    enc2.copyBufferToBuffer(changedBuf, 0, stagingBuf, 0, 16);
    queue.submit([enc2.finish()]);
    await stagingBuf.mapAsync(GPUMapMode.READ);
    const changed = new Uint32Array(stagingBuf.getMappedRange())[0];
    stagingBuf.unmap();
    stagingBuf.destroy();

    if (changed === 0) break;
  }
  changedBuf.destroy();
  unionUniforms.destroy();

  // ── 3. Flatten ───────────────────────────────────────────────
  const flatPipeline = await pipeFactory.getComputePipeline('ccl_flatten', CCL_FLAT_WGSL);
  const flatUniforms = createUniformBuffer(device, [width, height, 0, 0], 'ccl-flat-uni');
  const flatBindGroup = pipeFactory.createBindGroup(flatPipeline, [
    { binding: 0, resource: { buffer: flatUniforms } },
    { binding: 1, resource: { buffer: labelsBuf } },
  ]);
  {
    const enc = device.createCommandEncoder({ label: 'ccl-flatten' });
    const pass = enc.beginComputePass();
    pass.setPipeline(flatPipeline);
    pass.setBindGroup(0, flatBindGroup);
    pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    pass.end();
    queue.submit([enc.finish()]);
    await queue.onSubmittedWorkDone();
  }
  flatUniforms.destroy();

  // ── 4. CPU remap table ────────────────────────────────────────
  // Read labels back
  const stagingFull = device.createBuffer({
    size: N * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  {
    const enc = device.createCommandEncoder();
    enc.copyBufferToBuffer(labelsBuf, 0, stagingFull, 0, N * 4);
    queue.submit([enc.finish()]);
    await stagingFull.mapAsync(GPUMapMode.READ);
  }
  const labelsU32 = new Uint32Array(stagingFull.getMappedRange().slice(0));
  stagingFull.unmap();
  stagingFull.destroy();

  // Build remap: rootIdx → compactLabel
  const remapCPU = new Uint32Array(N);
  let nextLabel = 1;
  for (let i = 0; i < N; i++) {
    const lbl = labelsU32[i];
    if (lbl === 0) continue;
    const rootIdx = lbl - 1;
    if (remapCPU[rootIdx] === 0) {
      remapCPU[rootIdx] = nextLabel++;
    }
  }
  const numComponents = nextLabel - 1;

  // ── 5. GPU relabel ───────────────────────────────────────────
  const remapBuf = device.createBuffer({
    label: 'ccl-remap',
    size: Math.max(16, N * 4),
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  queue.writeBuffer(remapBuf, 0, remapCPU);

  const remapPipeline = await pipeFactory.getComputePipeline('ccl_relabel', CCL_REMAP_WGSL);
  const remapUniforms = createUniformBuffer(device, [width, height, numComponents, 0], 'ccl-remap-uni');
  const remapBindGroup = pipeFactory.createBindGroup(remapPipeline, [
    { binding: 0, resource: { buffer: remapUniforms } },
    { binding: 1, resource: { buffer: labelsBuf } },
    { binding: 2, resource: { buffer: remapBuf } },
  ]);
  {
    const enc = device.createCommandEncoder({ label: 'ccl-relabel' });
    const pass = enc.beginComputePass();
    pass.setPipeline(remapPipeline);
    pass.setBindGroup(0, remapBindGroup);
    pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    pass.end();
    queue.submit([enc.finish()]);
    await queue.onSubmittedWorkDone();
  }
  remapBuf.destroy();
  remapUniforms.destroy();

  return { numComponents, labelsBuf };
}
