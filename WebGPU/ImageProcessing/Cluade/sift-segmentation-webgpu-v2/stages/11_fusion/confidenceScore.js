export async function makeConfidenceScorePipeline(device,loadShader){
  const wgsl=await loadShader('11_fusion/confidenceScore.wgsl');
  return device.createComputePipelineAsync({label:'confScore',layout:'auto',
    compute:{module:device.createShaderModule({label:'confScore',code:wgsl}),entryPoint:'main'}});
}
