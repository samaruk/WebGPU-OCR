export async function makeRgbToGrayPipeline(device,loadShader){
  const wgsl=await loadShader('02_preprocess/rgbToGray.wgsl');
  return device.createComputePipelineAsync({label:'rgbGray',layout:'auto',
    compute:{module:device.createShaderModule({label:'rgbGray',code:wgsl}),entryPoint:'main'}});
}
