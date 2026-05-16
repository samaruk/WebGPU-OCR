// stages/04_watershed/watershedPasses.js

import { createUniformBuffer } from '../../core/dispatchUtils.js';
import { loadShader } from '../../utils/shaderLoader.js';


const MAX_PROPAGATIONS = 200;

export async function runWatershed(ctx, texManager, pipeFactory, labelsBuf, width, height, seedThreshold, binaryTexName) {
  const { device, queue } = ctx;
  const N = width * height;

  // ── Distance Transform ───────────────────────────────────────
  const distBuf = device.createBuffer({
    label: 'dist-transform',
    size: N * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  // Init: foreground = INF, background = 0 (done in init pass)
  const initData = new Float32Array(N);
  for (let i = 0; i < N; i++) initData[i] = 1e9;
  queue.writeBuffer(distBuf, 0, initData);

  const distPipeline = await pipeFactory.getComputePipeline('dist_transform', DIST_WGSL);

  // Forward pass
  const forwardUni = createUniformBuffer(device, [width, height, 0, 0], 'dist-fwd-uni');
  const forwardBG = pipeFactory.createBindGroup(distPipeline, [
    { binding: 0, resource: { buffer: forwardUni } },
    { binding: 1, resource: { buffer: distBuf } },
    { binding: 2, resource: texManager.view(binaryTexName) },
  ]);
  {
    const enc = device.createCommandEncoder({ label: 'dist-fwd' });
    const pass = enc.beginComputePass();
    pass.setPipeline(distPipeline);
    pass.setBindGroup(0, forwardBG);
    pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    pass.end();
    queue.submit([enc.finish()]);
    await queue.onSubmittedWorkDone();
  }
  forwardUni.destroy();

  // Backward pass
  const backwardUni = createUniformBuffer(device, [width, height, 1, 0], 'dist-bwd-uni');
  const backwardBG = pipeFactory.createBindGroup(distPipeline, [
    { binding: 0, resource: { buffer: backwardUni } },
    { binding: 1, resource: { buffer: distBuf } },
    { binding: 2, resource: texManager.view(binaryTexName) },
  ]);
  {
    const enc = device.createCommandEncoder({ label: 'dist-bwd' });
    const pass = enc.beginComputePass();
    pass.setPipeline(distPipeline);
    pass.setBindGroup(0, backwardBG);
    pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    pass.end();
    queue.submit([enc.finish()]);
    await queue.onSubmittedWorkDone();
  }
  backwardUni.destroy();

  // ── Seed Detection ────────────────────────────────────────────
  const seedsBuf = device.createBuffer({
    label: 'seeds',
    size: N * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  const seedCountBuf = device.createBuffer({
    label: 'seed-count',
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  const seedPipeline = await pipeFactory.getComputePipeline('watershed_seed', SEED_WGSL);

  // Create float32 uniform for seedThreshold
  const seedUniData = new ArrayBuffer(16);
  const seedUniView = new DataView(seedUniData);
  seedUniView.setUint32(0, width, true);
  seedUniView.setUint32(4, height, true);
  seedUniView.setFloat32(8, seedThreshold, true);
  seedUniView.setUint32(12, 0, true);
  const seedUniBuf = device.createBuffer({
    label: 'seed-uni',
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint8Array(seedUniBuf.getMappedRange()).set(new Uint8Array(seedUniData));
  seedUniBuf.unmap();

  const seedBG = pipeFactory.createBindGroup(seedPipeline, [
    { binding: 0, resource: { buffer: seedUniBuf } },
    { binding: 1, resource: { buffer: distBuf } },
    { binding: 2, resource: { buffer: seedsBuf } },
    { binding: 3, resource: { buffer: seedCountBuf } },
  ]);
  {
    const enc = device.createCommandEncoder({ label: 'ws-seeds' });
    const pass = enc.beginComputePass();
    pass.setPipeline(seedPipeline);
    pass.setBindGroup(0, seedBG);
    pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    pass.end();
    queue.submit([enc.finish()]);
    await queue.onSubmittedWorkDone();
  }
  seedUniBuf.destroy();

  // ── Watershed Labels Buffer ───────────────────────────────────
  const wsLabelsBuf = device.createBuffer({
    label: 'ws-labels',
    size: N * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  // Init WS labels from seeds: copy seeds * seedLabel
  // We do it on CPU: read seeds back, assign sequential labels
  const stagingSeed = device.createBuffer({ size: N * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  {
    const enc = device.createCommandEncoder();
    enc.copyBufferToBuffer(seedsBuf, 0, stagingSeed, 0, N * 4);
    queue.submit([enc.finish()]);
    await stagingSeed.mapAsync(GPUMapMode.READ);
  }
  const seedsRead = new Uint32Array(stagingSeed.getMappedRange().slice(0));
  stagingSeed.unmap();
  stagingSeed.destroy();

  const wsInit = new Uint32Array(N);
  let wsLabelCounter = 1;
  for (let i = 0; i < N; i++) {
    if (seedsRead[i] === 1) wsInit[i] = wsLabelCounter++;
  }
  queue.writeBuffer(wsLabelsBuf, 0, wsInit);

  // ── Propagation ───────────────────────────────────────────────
  const propPipeline = await pipeFactory.getComputePipeline('ws_propagate', PROP_WGSL);
  const propChangedBuf = device.createBuffer({
    label: 'ws-changed',
    size: 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  for (let iter = 0; iter < MAX_PROPAGATIONS; iter++) {
    const propUni = createUniformBuffer(device, [width, height, iter, 0], 'ws-prop-uni');
    queue.writeBuffer(propChangedBuf, 0, new Uint32Array([0, 0, 0, 0]));

    const propBG = pipeFactory.createBindGroup(propPipeline, [
      { binding: 0, resource: { buffer: propUni } },
      { binding: 1, resource: { buffer: labelsBuf } },
      { binding: 2, resource: { buffer: wsLabelsBuf } },
      { binding: 3, resource: { buffer: propChangedBuf } },
    ]);
    {
      const enc = device.createCommandEncoder({ label: `ws-prop-${iter}` });
      const pass = enc.beginComputePass();
      pass.setPipeline(propPipeline);
      pass.setBindGroup(0, propBG);
      pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
      pass.end();
      queue.submit([enc.finish()]);
      await queue.onSubmittedWorkDone();
    }
    propUni.destroy();

    // Check convergence
    const stagingChg = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const enc2 = device.createCommandEncoder();
    enc2.copyBufferToBuffer(propChangedBuf, 0, stagingChg, 0, 16);
    queue.submit([enc2.finish()]);
    await stagingChg.mapAsync(GPUMapMode.READ);
    const changed = new Uint32Array(stagingChg.getMappedRange())[0];
    stagingChg.unmap();
    stagingChg.destroy();
    if (changed === 0) break;
  }

  distBuf.destroy();
  seedsBuf.destroy();
  seedCountBuf.destroy();
  propChangedBuf.destroy();

  return wsLabelsBuf;
}
