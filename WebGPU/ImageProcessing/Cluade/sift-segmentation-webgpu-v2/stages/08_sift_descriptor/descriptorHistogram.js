export async function makeDescHistPipeline(device,loadShader){
  const wgsl=await loadShader('08_sift_descriptor/descriptorHistogram.wgsl');
  return device.createComputePipelineAsync({label:'descHist',layout:'auto',
    compute:{module:device.createShaderModule({label:'descHist',code:wgsl}),entryPoint:'main'}});
}
