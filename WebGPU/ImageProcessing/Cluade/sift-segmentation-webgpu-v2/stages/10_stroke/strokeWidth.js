export async function makeStrokeWidthPipeline(device,loadShader){
  const wgsl=await loadShader('10_stroke/strokeWidth.wgsl');
  return device.createComputePipelineAsync({label:'strokeWidth',layout:'auto',
    compute:{module:device.createShaderModule({label:'strokeWidth',code:wgsl}),entryPoint:'main'}});
}
