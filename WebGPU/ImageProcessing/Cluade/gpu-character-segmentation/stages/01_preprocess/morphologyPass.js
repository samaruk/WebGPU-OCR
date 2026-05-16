// stages/01_preprocess/morphologyPass.js
// Close = dilate then erode

import { createUniformBuffer } from '../../core/dispatchUtils.js';
import { loadShader } from '../../utils/shaderLoader.js';


async function runMorphPass(ctx, texManager, pipeFactory, width, height, kernelRadius, operation, srcName, dstName) {
  const { device } = ctx;

  const MORPH_WGSL = await loadShader('shaders/morphology.wgsl');
  const pipeline = await pipeFactory.getComputePipeline('morphology', MORPH_WGSL);

  texManager.create(dstName, width, height, 'rgba8unorm',
    GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
  );

  const uniforms = createUniformBuffer(device,
    [width, height, kernelRadius, operation], `morph-uniforms-${dstName}`);

  const bindGroup = pipeFactory.createBindGroup(pipeline, [
    { binding: 0, resource: { buffer: uniforms } },
    { binding: 1, resource: texManager.view(srcName) },
    { binding: 2, resource: texManager.view(dstName, { format: 'rgba8unorm' }) },
  ]);

  const encoder = device.createCommandEncoder({ label: `morph-${dstName}` });
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
  pass.end();
  device.queue.submit([encoder.finish()]);
  await device.queue.onSubmittedWorkDone();
  uniforms.destroy();
}

/**
 * Morphological close = dilate then erode.
 * Closes small gaps in foreground.
 */
export async function runMorphologyClose(ctx, texManager, pipeFactory, width, height, kernelSize) {
  const radius = Math.floor(kernelSize / 2);

  // Dilate binary → binary_dilated
  await runMorphPass(ctx, texManager, pipeFactory, width, height, radius, 0, 'binary', 'binary_dilated');

  // Erode binary_dilated → binary_closed
  await runMorphPass(ctx, texManager, pipeFactory, width, height, radius, 1, 'binary_dilated', 'binary_closed');

  // Copy binary_closed over binary by recreating view
  // (We'll just use 'binary_closed' as input to CCL stage)
}
