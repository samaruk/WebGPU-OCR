export async function makeGaussBlurVPipeline(device,loadShader){
  const wgsl=await loadShader('02_preprocess/gaussianBlurV.wgsl');
  return device.createComputePipelineAsync({label:'blurV',layout:'auto',
    compute:{module:device.createShaderModule({label:'blurV',code:wgsl}),entryPoint:'main'}});
}
