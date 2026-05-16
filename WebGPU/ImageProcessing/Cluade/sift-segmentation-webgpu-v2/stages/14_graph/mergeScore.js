export async function makeMergeScorePipeline(device,loadShader){
  const wgsl=await loadShader('14_graph/mergeScore.wgsl');
  return device.createComputePipelineAsync({label:'mergeScore',layout:'auto',
    compute:{module:device.createShaderModule({label:'mergeScore',code:wgsl}),entryPoint:'main'}});
}
