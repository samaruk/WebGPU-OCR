/**
 * gpu/init.js
 * WebGPU adapter + device initialisation.
 * Detects shader-f16 feature and requests it when available.
 * Exports the live { device, fp16 } state object.
 */

import { log } from '../ui/log.js';
import { updateDeviceUI } from '../ui/pipeline-ui.js';

export const gpuState = {
  device : null,   // GPUDevice
  fp16   : false,  // true when shader-f16 is supported
};

export async function initGPU() {
  if (!navigator.gpu) {
    log('✗ WebGPU not supported — use Chrome 113+ or Edge 113+', 'err');
    updateDeviceUI('NOT SUPPORTED', false);
    return false;
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
  });
  if (!adapter) {
    log('✗ No GPU adapter found', 'err');
    return false;
  }

  const fp16    = adapter.features.has('shader-f16');
  const device  = await adapter.requestDevice({
    requiredFeatures: fp16 ? ['shader-f16'] : [],
  });

  // Best-effort adapter info (varies by browser)
  let devName = 'WebGPU Device';
  try {
    const info = adapter.info
      ?? (typeof adapter.requestAdapterInfo === 'function'
          ? await adapter.requestAdapterInfo()
          : {});
    devName = [info.vendor, info.device, info.description]
      .filter(Boolean).join(' · ') || devName;
  } catch { /* ignore */ }

  gpuState.device = device;
  gpuState.fp16   = fp16;

  updateDeviceUI(devName, fp16);
  log(`✓ Adapter: ${devName}`, 'ok');
  log(`  FP16 shader-f16: ${fp16 ? 'YES — 2× dist-buffer bandwidth' : 'no (f32 fallback)'}`,
      fp16 ? 'ok' : 'warn');
  return true;
}
