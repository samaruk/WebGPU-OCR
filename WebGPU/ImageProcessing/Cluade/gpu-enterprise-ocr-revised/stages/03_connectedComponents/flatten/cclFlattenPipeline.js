
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createCCLFlattenPipeline(device){
  const code=await loadShader(new URL('./ccl_flatten.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'ccl_flatten',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:ccl_flatten] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'cclFlattenPipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
