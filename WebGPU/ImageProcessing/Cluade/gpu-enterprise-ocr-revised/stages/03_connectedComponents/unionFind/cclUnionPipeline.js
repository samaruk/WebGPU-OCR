
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createCCLUnionPipeline(device){
  const code=await loadShader(new URL('./ccl_union.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'ccl_union',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:ccl_union] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'cclUnionPipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
