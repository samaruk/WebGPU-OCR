
import { loadShader } from '../../../utils/shaderLoader.js';

export async function createDistanceTransformPipelines(device) {
  const [initCode, stepCode, finalCode] = await Promise.all([
    loadShader(new URL('./jfa_init.wgsl',  import.meta.url)),
    loadShader(new URL('./jfa_step.wgsl',  import.meta.url)),
    loadShader(new URL('./jfa_final.wgsl', import.meta.url)),
  ]);
  const make = (code, label) => {
    const mod = device.createShaderModule({ label, code });
    (async()=>{const info=await mod.getCompilationInfo();info.messages.filter(m=>m.type!=='info').forEach(m=>console.error(`[shader:${label}] ${m.type} line ${m.lineNum}: ${m.message}`));})();
    return device.createComputePipeline({
      label: `${label}_pl`, layout: 'auto',
      compute: { module: mod, entryPoint: 'main' },
    });
  };
  return {
    init:  make(initCode,  'jfa_init'),
    step:  make(stepCode,  'jfa_step'),
    final: make(finalCode, 'jfa_final'),
  };
}
