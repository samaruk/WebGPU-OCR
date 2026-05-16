export async function makeEndpointDetectPipeline(device,loadShader){
  const wgsl=await loadShader('13_skeleton/endpointDetect.wgsl');
  return device.createComputePipelineAsync({label:'endpointDetect',layout:'auto',
    compute:{module:device.createShaderModule({label:'endpointDetect',code:wgsl}),entryPoint:'main'}});
}
