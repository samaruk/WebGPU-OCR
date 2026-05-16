export async function makeSplitScorePipeline(device,loadShader){
  const wgsl=await loadShader('14_graph/splitScore.wgsl');
  return device.createComputePipelineAsync({label:'splitScore',layout:'auto',
    compute:{module:device.createShaderModule({label:'splitScore',code:wgsl}),entryPoint:'main'}});
}
