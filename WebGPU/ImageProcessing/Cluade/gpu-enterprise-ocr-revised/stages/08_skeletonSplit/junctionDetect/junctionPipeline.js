
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createJunctionPipeline(device){
  const code=await loadShader(new URL('./junctionDetect.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'junction',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:junction] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'junctionPipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
