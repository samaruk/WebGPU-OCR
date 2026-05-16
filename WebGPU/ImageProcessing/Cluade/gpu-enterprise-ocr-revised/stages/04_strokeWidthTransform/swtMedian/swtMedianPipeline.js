
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createSWTMedianPipeline(device){
  const code=await loadShader(new URL('./swt_median.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'swt-median',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:swt-median] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'swtMedianPipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
