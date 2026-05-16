import { loadShader } from '../../../utils/shaderLoader.js';
export async function createMorphOpenPipeline(device) {
  const code = await loadShader(new URL('./morphOpen.wgsl', import.meta.url));
  const mod  = device.createShaderModule({ label: 'morphOpen', code });
  (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=='info').forEach(m=>console.error(`[shader:morphOpen] ${m.type} line ${m.lineNum}: ${m.message}`));})();
  return device.createComputePipeline({
    label: 'morphOpen_pl', layout: 'auto',
    compute: { module: mod, entryPoint: 'main' },
  });
}
