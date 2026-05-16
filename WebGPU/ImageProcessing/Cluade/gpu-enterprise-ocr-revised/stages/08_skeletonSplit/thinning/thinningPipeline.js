
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createThinningPipeline(device){
  const code=await loadShader(new URL('./thinning.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'thinning',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:thinning] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'thinningPipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
