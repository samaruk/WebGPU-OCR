// stages/01_preprocess/thresholdPass.js

import { createUniformBuffer } from '../../core/dispatchUtils.js';
import { loadShader } from '../../utils/shaderLoader.js';


export async function runThresholdPass(ctx, texManager, pipeFactory, width, height, threshold, invert = false) {
  const { device } = ctx;

  const THRESHOLD_WGSL = await loadShader('shaders/threshold.wgsl');
  const pipeline = await pipeFactory.getComputePipeline('threshold', THRESHOLD_WGSL);

  const uniforms = createUniformBuffer(device,
    [width, height, threshold, invert ? 1 : 0], 'threshold-uniforms');

  texManager.create('binary', width, height, 'rgba8unorm',
    GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
  );

  const bindGroup = pipeFactory.createBindGroup(pipeline, [
    { binding: 0, resource: { buffer: uniforms } },
    { binding: 1, resource: texManager.view('source') },
    { binding: 2, resource: texManager.view('binary', { format: 'rgba8unorm' }) },
  ]);

  const encoder = device.createCommandEncoder({ label: 'threshold-pass' });
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
  pass.end();
  device.queue.submit([encoder.finish()]);
  await device.queue.onSubmittedWorkDone();

  uniforms.destroy();
}
