export async function makeOrientationAssignPipeline(device,loadShader){
  const wgsl=await loadShader('07_sift_orientation/orientationAssign.wgsl');
  return device.createComputePipelineAsync({label:'oriAssign',layout:'auto',
    compute:{module:device.createShaderModule({label:'oriAssign',code:wgsl}),entryPoint:'main'}});
}
