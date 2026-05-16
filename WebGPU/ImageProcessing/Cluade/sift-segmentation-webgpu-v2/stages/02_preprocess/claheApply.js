export async function makeClaheApplyPipeline(device,loadShader){
  const wgsl=await loadShader('02_preprocess/claheApply.wgsl');
  return device.createComputePipelineAsync({label:'claheApply',layout:'auto',
    compute:{module:device.createShaderModule({label:'claheApply',code:wgsl}),entryPoint:'main'}});
}
