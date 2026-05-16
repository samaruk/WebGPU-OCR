export async function makeKPCompactionPipeline(device,loadShader){
  const wgsl=await loadShader('08_sift_descriptor/keypointCompaction.wgsl');
  return device.createComputePipelineAsync({label:'kpCompact',layout:'auto',
    compute:{module:device.createShaderModule({label:'kpCompact',code:wgsl}),entryPoint:'main'}});
}
