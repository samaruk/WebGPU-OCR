export async function makeDetermMergePipeline(device,loadShader){
  const wgsl=await loadShader('14_graph/deterministicMerge.wgsl');
  return device.createComputePipelineAsync({label:'determMerge',layout:'auto',
    compute:{module:device.createShaderModule({label:'determMerge',code:wgsl}),entryPoint:'main'}});
}
