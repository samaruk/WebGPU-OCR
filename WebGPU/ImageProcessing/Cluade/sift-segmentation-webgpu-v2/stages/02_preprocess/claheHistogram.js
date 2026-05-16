export async function makeClaheHistPipeline(device,loadShader){
  const wgsl=await loadShader('02_preprocess/claheHistogram.wgsl');
  return device.createComputePipelineAsync({label:'claheHist',layout:'auto',
    compute:{module:device.createShaderModule({label:'claheHist',code:wgsl}),entryPoint:'main'}});
}
