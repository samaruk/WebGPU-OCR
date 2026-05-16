import { loadShader } from '../../../utils/shaderLoader.js';

export async function createIntegralPipelines(device) {
  const [rowCode, colCode] = await Promise.all([
    loadShader(new URL('./integral_row.wgsl', import.meta.url)),
    loadShader(new URL('./integral_col.wgsl', import.meta.url)),
  ]);
  const make = (code, label) => {
    const mod = device.createShaderModule({ label, code });
    (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=='info').forEach(m=>console.error(`[shader:${label}] ${m.type} line ${m.lineNum}: ${m.message}`));})();
    return device.createComputePipeline({
      label: label + '_pl', layout: 'auto',
      compute: { module: mod, entryPoint: 'main' },
    });
  };
  return { row: make(rowCode, 'integral_row'), col: make(colCode, 'integral_col') };
}
