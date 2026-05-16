export async function makeAdjacencyBuildPipeline(device,loadShader){
  const wgsl=await loadShader('14_graph/adjacencyBuild.wgsl');
  return device.createComputePipelineAsync({label:'adjBuild',layout:'auto',
    compute:{module:device.createShaderModule({label:'adjBuild',code:wgsl}),entryPoint:'main'}});
}
