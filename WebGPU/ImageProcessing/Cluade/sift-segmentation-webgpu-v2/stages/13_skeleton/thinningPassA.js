export async function makeThinningPassAPipeline(device,loadShader){
  const wgsl=await loadShader('13_skeleton/thinningPassA.wgsl');
  return device.createComputePipelineAsync({label:'thinA',layout:'auto',
    compute:{module:device.createShaderModule({label:'thinA',code:wgsl}),entryPoint:'main'}});
}
