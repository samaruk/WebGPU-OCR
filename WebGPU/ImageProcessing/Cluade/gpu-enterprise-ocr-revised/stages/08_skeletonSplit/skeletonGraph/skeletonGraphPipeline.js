
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createSkeletonGraphPipeline(device){
  const code=await loadShader(new URL('./skeletonGraph.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'skelGraph',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:skelGraph] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'skeletonGraphPipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
