export async function makeBBoxReducePipeline(device,loadShader){
  const wgsl=await loadShader('15_postprocess/boundingBoxReduce.wgsl');
  return device.createComputePipelineAsync({label:'bboxReduce',layout:'auto',
    compute:{module:device.createShaderModule({label:'bboxReduce',code:wgsl}),entryPoint:'main'}});
}
