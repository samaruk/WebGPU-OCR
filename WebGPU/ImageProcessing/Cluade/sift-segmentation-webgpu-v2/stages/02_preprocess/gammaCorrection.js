export async function makeGammaPipeline(device,loadShader){
  const wgsl=await loadShader('02_preprocess/gammaCorrection.wgsl');
  return device.createComputePipelineAsync({label:'gamma',layout:'auto',
    compute:{module:device.createShaderModule({label:'gamma',code:wgsl}),entryPoint:'main'}});
}
