export async function makeRelabelCompactPipeline(device,loadShader){
  const wgsl=await loadShader('12_segmentation/relabelCompact.wgsl');
  return device.createComputePipelineAsync({label:'relabelCompact',layout:'auto',
    compute:{module:device.createShaderModule({label:'relabelCompact',code:wgsl}),entryPoint:'main'}});
}
