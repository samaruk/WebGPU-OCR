export async function makeHessianRejectPipeline(device,loadShader){
  const wgsl=await loadShader('05_sift_extrema/hessianReject.wgsl');
  return device.createComputePipelineAsync({label:'hessReject',layout:'auto',
    compute:{module:device.createShaderModule({label:'hessReject',code:wgsl}),entryPoint:'main'}});
}
