export async function makeSpatialGridPipeline(device,loadShader){
  const wgsl=await loadShader('09_clustering/spatialGridBuild.wgsl');
  return device.createComputePipelineAsync({label:'spatGrid',layout:'auto',
    compute:{module:device.createShaderModule({label:'spatGrid',code:wgsl}),entryPoint:'main'}});
}
