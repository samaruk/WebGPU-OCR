export async function makeGaussBlurHPipeline(device,loadShader){
  const wgsl=await loadShader('02_preprocess/gaussianBlurH.wgsl');
  return device.createComputePipelineAsync({label:'blurH',layout:'auto',
    compute:{module:device.createShaderModule({label:'blurH',code:wgsl}),entryPoint:'main'}});
}
