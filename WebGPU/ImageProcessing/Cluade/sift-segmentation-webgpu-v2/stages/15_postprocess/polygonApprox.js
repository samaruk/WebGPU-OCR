export async function makePolygonApproxPipeline(device,loadShader){
  const wgsl=await loadShader('15_postprocess/polygonApprox.wgsl');
  return device.createComputePipelineAsync({label:'polyApprox',layout:'auto',
    compute:{module:device.createShaderModule({label:'polyApprox',code:wgsl}),entryPoint:'main'}});
}
