export async function makeSubpixelRefinePipeline(device,loadShader){
  const wgsl=await loadShader('06_sift_refine/subpixelRefine.wgsl');
  return device.createComputePipelineAsync({label:'subpixelRefine',layout:'auto',
    compute:{module:device.createShaderModule({label:'subpixelRefine',code:wgsl}),entryPoint:'main'}});
}
