export async function makeAdaptiveMaskFusionPipeline(device,loadShader){
  const wgsl=await loadShader('11_fusion/adaptiveMaskFusion.wgsl');
  return device.createComputePipelineAsync({label:'maskFusion',layout:'auto',
    compute:{module:device.createShaderModule({label:'maskFusion',code:wgsl}),entryPoint:'main'}});
}
