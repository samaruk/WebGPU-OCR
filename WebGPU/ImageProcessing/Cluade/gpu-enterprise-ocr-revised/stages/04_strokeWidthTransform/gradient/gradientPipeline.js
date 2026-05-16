
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createGradientPipeline(device){
  const code=await loadShader(new URL('./gradient.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'swt-gradient',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:swt-gradient] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'gradientPipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
