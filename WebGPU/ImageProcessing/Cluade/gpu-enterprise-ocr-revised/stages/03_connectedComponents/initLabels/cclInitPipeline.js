
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createCCLInitPipeline(device){
  const code=await loadShader(new URL('./ccl_init.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'ccl_init',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:ccl_init] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'cclInitPipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
