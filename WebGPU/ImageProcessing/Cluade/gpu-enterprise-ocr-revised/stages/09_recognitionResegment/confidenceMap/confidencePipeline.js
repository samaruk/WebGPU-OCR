
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createConfidencePipeline(device){
  const code=await loadShader(new URL('./confidence.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'confidence',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:confidence] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'confidencePipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
