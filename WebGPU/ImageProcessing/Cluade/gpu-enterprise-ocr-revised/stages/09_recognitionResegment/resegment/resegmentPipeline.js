
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createResegmentPipeline(device){
  const code=await loadShader(new URL('./resegment.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'resegment',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:resegment] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'resegmentPipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
