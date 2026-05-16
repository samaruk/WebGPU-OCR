
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createSobelPipeline(device){
  const code=await loadShader(new URL('./sobel.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'sobel',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:sobel] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'sobelPipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
