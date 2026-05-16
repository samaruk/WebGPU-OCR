export async function makeLocalLabelInitPipeline(device,loadShader){
  const wgsl=await loadShader('12_segmentation/localLabelInit.wgsl');
  return device.createComputePipelineAsync({label:'lblInit',layout:'auto',
    compute:{module:device.createShaderModule({label:'lblInit',code:wgsl}),entryPoint:'main'}});
}
