export async function makeDescNormPipeline(device,loadShader){
  const wgsl=await loadShader('08_sift_descriptor/descriptorNormalize.wgsl');
  return device.createComputePipelineAsync({label:'descNorm',layout:'auto',
    compute:{module:device.createShaderModule({label:'descNorm',code:wgsl}),entryPoint:'main'}});
}
