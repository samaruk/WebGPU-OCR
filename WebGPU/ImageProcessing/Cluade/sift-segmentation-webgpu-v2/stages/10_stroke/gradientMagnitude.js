export async function makeGradMagPipeline(device,loadShader){
  const wgsl=await loadShader('10_stroke/gradientMagnitude.wgsl');
  return device.createComputePipelineAsync({label:'gradMag',layout:'auto',
    compute:{module:device.createShaderModule({label:'gradMag',code:wgsl}),entryPoint:'main'}});
}
