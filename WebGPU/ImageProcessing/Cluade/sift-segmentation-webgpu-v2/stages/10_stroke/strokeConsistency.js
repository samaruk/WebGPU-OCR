export async function makeStrokeConsistencyPipeline(device,loadShader){
  const wgsl=await loadShader('10_stroke/strokeConsistency.wgsl');
  return device.createComputePipelineAsync({label:'strokeConsist',layout:'auto',
    compute:{module:device.createShaderModule({label:'strokeConsist',code:wgsl}),entryPoint:'main'}});
}
