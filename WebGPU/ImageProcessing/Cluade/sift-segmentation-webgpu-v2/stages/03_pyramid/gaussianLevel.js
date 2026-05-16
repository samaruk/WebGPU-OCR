// gaussianLevel.js — compile the 4-binding Gaussian level shader
export async function makeGaussianLevelPipeline(device, loadShader) {
  const wgsl = await loadShader('03_pyramid/gaussianLevel.wgsl');
  const mod  = device.createShaderModule({ label: 'gaussianLevel', code: wgsl });
  return device.createComputePipelineAsync({
    label: 'gaussianLevel',
    layout: 'auto',
    compute: { module: mod, entryPoint: 'main' },
  });
}
