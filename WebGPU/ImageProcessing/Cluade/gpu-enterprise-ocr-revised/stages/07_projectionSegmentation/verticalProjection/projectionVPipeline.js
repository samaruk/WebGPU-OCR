
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createProjectionVPipeline(device){
  const code=await loadShader(new URL('./projectionV.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'projV',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:projV] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'projVPipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
