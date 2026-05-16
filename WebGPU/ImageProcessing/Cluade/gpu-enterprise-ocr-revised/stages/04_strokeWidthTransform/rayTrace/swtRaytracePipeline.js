import { loadShader } from '../../../utils/shaderLoader.js';
export async function createSWTRaytracePipeline(device) {
  const [clearCode, rayCode] = await Promise.all([
    loadShader(new URL('./swt_clear.wgsl',   import.meta.url)),
    loadShader(new URL('./swt_raytrace.wgsl', import.meta.url)),
  ]);
  const make = (code, label) => {
    const mod = device.createShaderModule({ label, code });
    (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=='info').forEach(m=>console.error(`[shader:${label}] ${m.type} line ${m.lineNum}: ${m.message}`));})();
    return device.createComputePipeline({ label: label+'_pl', layout:'auto', compute:{ module:mod, entryPoint:'main' } });
  };
  return { clear: make(clearCode, 'swt_clear'), raytrace: make(rayCode, 'swt_raytrace') };
}
