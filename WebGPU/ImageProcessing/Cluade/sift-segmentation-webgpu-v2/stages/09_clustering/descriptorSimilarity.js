export async function makeDescSimilarityPipeline(device,loadShader){
  const wgsl=await loadShader('09_clustering/descriptorSimilarity.wgsl');
  return device.createComputePipelineAsync({label:'descSim',layout:'auto',
    compute:{module:device.createShaderModule({label:'descSim',code:wgsl}),entryPoint:'main'}});
}
