export async function makeAspectRatioFilterPipeline(device,loadShader){
  const wgsl=await loadShader('15_postprocess/aspectRatioFilter.wgsl');
  return device.createComputePipelineAsync({label:'arFilter',layout:'auto',
    compute:{module:device.createShaderModule({label:'arFilter',code:wgsl}),entryPoint:'main'}});
}
