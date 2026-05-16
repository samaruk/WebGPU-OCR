export async function makeLabelResolvePipeline(device,loadShader){
  const wgsl=await loadShader('12_segmentation/labelResolve.wgsl');
  return device.createComputePipelineAsync({label:'lblResolve',layout:'auto',
    compute:{module:device.createShaderModule({label:'lblResolve',code:wgsl}),entryPoint:'main'}});
}
