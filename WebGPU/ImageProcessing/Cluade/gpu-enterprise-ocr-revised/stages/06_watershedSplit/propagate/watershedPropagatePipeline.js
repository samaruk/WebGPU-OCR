
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createWatershedPropagatePipeline(device){
  const code=await loadShader(new URL('./watershed_propagate.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'ws-propagate',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:ws-propagate] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'watershedPropagatePipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
