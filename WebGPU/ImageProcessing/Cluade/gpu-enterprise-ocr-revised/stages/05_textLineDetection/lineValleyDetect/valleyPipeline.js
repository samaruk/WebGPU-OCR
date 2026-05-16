
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createValleyPipeline(device){
  const code=await loadShader(new URL('./valleyDetect.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'valley',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:valley] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'valleyPipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
