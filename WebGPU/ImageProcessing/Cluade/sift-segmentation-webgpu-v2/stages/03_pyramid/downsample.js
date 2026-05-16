export async function makeDownsamplePipeline(device,loadShader){
  const wgsl=await loadShader('03_pyramid/downsample.wgsl');
  return device.createComputePipelineAsync({label:'downsample',layout:'auto',
    compute:{module:device.createShaderModule({label:'downsample',code:wgsl}),entryPoint:'main'}});
}
