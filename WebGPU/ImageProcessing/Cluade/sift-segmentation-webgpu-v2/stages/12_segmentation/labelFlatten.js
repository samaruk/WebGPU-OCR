export async function makeLabelFlattenPipeline(device,loadShader){
  const wgsl=await loadShader('12_segmentation/labelFlatten.wgsl');
  return device.createComputePipelineAsync({label:'lblFlatten',layout:'auto',
    compute:{module:device.createShaderModule({label:'lblFlatten',code:wgsl}),entryPoint:'main'}});
}
