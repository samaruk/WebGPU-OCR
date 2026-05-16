
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createAdaptiveThresholdPipeline(device){
  const code=await loadShader(new URL('./adaptiveThreshold.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'adaptiveThreshold',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:adaptiveThreshold] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'adaptiveThresholdPipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
