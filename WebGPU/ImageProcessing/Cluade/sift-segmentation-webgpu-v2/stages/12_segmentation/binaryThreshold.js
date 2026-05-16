export async function makeBinaryThresholdPipeline(device,loadShader){
  const wgsl=await loadShader('12_segmentation/binaryThreshold.wgsl');
  return device.createComputePipelineAsync({label:'binThresh',layout:'auto',
    compute:{module:device.createShaderModule({label:'binThresh',code:wgsl}),entryPoint:'main'}});
}
