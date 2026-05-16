export async function makeContrastRejectPipeline(device,loadShader){
  const wgsl=await loadShader('05_sift_extrema/contrastReject.wgsl');
  return device.createComputePipelineAsync({label:'contrastReject',layout:'auto',
    compute:{module:device.createShaderModule({label:'contrastReject',code:wgsl}),entryPoint:'main'}});
}
