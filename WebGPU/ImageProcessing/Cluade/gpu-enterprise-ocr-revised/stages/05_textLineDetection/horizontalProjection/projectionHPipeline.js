
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createProjectionHPipeline(device){
  const code=await loadShader(new URL('./projectionH.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'projH',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:projH] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'projectionHPipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
