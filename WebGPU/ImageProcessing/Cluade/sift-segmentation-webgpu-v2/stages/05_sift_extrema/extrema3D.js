export async function makeExtrema3DPipeline(device,loadShader){
  const wgsl=await loadShader('05_sift_extrema/extrema3D.wgsl');
  return device.createComputePipelineAsync({label:'extrema3D',layout:'auto',
    compute:{module:device.createShaderModule({label:'extrema3D',code:wgsl}),entryPoint:'main'}});
}
