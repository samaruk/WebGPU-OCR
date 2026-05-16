
import { loadShader } from '../../../utils/shaderLoader.js';
export async function createWatershedSeedPipeline(device){
  const code=await loadShader(new URL('./watershed_seed.wgsl',import.meta.url));
  const mod=device.createShaderModule({label:'ws-seed',code});
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=="info").forEach(m=>console.error(`[shader:ws-seed] ${m.type} line ${m.lineNum}: ${m.message}`));})();;
  return device.createComputePipeline({label:'watershedSeedPipeline',layout:'auto',compute:{module:mod,entryPoint:'main'}});
}
