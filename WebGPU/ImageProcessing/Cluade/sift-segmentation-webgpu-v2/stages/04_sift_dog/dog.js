export async function makeDogPipeline(device,loadShader){
  const wgsl=await loadShader('04_sift_dog/dog.wgsl');
  return device.createComputePipelineAsync({label:'dog',layout:'auto',
    compute:{module:device.createShaderModule({label:'dog',code:wgsl}),entryPoint:'main'}});
}
