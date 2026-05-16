export async function makeDensityMapPipeline(device,loadShader){
  const wgsl=await loadShader('09_clustering/densityMap.wgsl');
  return device.createComputePipelineAsync({label:'densityMap',layout:'auto',
    compute:{module:device.createShaderModule({label:'densityMap',code:wgsl}),entryPoint:'main'}});
}
