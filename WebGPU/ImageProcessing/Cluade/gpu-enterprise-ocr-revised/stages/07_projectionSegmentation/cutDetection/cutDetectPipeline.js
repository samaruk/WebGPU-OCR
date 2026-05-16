
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createCutDetectPipeline(device){
  const code=await loadShader(new URL('./cutDetect.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'cutDetect',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:cutDetect] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'cutDetectPipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
