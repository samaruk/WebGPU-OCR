export async function makeThinningPassBPipeline(device,loadShader){
  const wgsl=await loadShader('13_skeleton/thinningPassB.wgsl');
  return device.createComputePipelineAsync({label:'thinB',layout:'auto',
    compute:{module:device.createShaderModule({label:'thinB',code:wgsl}),entryPoint:'main'}});
}
