// stages/01_preprocess/sobelPass.js

import { createUniformBuffer } from '../../core/dispatchUtils.js';
import { loadShader } from '../../utils/shaderLoader.js';


export async function runSobelPass(ctx, texManager, pipeFactory, width, height, threshold) {
  const { device } = ctx;

  const SOBEL_WGSL = await loadShader('shaders/sobel.wgsl');
  const pipeline = await pipeFactory.getComputePipeline('sobel', SOBEL_WGSL);

  const uniforms = createUniformBuffer(device, [width, height, threshold, 0], 'sobel-uniforms');

  // Ensure output texture exists
  const outputTex = texManager.create('edges', width, height, 'rgba8unorm',
    GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
  );

  const bindGroup = pipeFactory.createBindGroup(pipeline, [
    { binding: 0, resource: { buffer: uniforms } },
    { binding: 1, resource: texManager.view('source') },
    { binding: 2, resource: texManager.view('edges', { format: 'rgba8unorm' }) },
  ]);

  const encoder = device.createCommandEncoder({ label: 'sobel-pass' });
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
  pass.end();
  device.queue.submit([encoder.finish()]);
  await device.queue.onSubmittedWorkDone();

  uniforms.destroy();
  return outputTex;
}
