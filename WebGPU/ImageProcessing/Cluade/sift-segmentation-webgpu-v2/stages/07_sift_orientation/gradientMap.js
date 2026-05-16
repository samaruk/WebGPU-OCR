export async function makeGradientMapPipeline(device,loadShader){
  const wgsl=await loadShader('07_sift_orientation/gradientMap.wgsl');
  return device.createComputePipelineAsync({label:'gradMap',layout:'auto',
    compute:{module:device.createShaderModule({label:'gradMap',code:wgsl}),entryPoint:'main'}});
}
