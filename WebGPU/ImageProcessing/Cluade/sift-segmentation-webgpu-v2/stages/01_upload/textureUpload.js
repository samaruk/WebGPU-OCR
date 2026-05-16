// textureUpload.js — compile upload shader
import { ceilDiv } from '../00_common/math.js';
export async function makeTextureUploadPipeline(device, loadShader) {
  const wgsl = await loadShader('01_upload/textureUpload.wgsl');
  const mod  = device.createShaderModule({label:'texUpload',code:wgsl});
  return device.createComputePipelineAsync({label:'texUpload',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
