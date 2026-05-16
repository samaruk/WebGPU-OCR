// WebGPU device/adapter initialisation

let _device  = null;
let _adapter = null;

export async function initGPU() {
  if (_device) return { device: _device, adapter: _adapter };

  if (!navigator.gpu) throw new Error('WebGPU not supported in this browser.');

  _adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!_adapter) throw new Error('No suitable GPU adapter found.');

  const features = [];
  if (_adapter.features.has('timestamp-query')) features.push('timestamp-query');

  _device = await _adapter.requestDevice({
    requiredFeatures: features,
    requiredLimits: {
      maxStorageBufferBindingSize:    _adapter.limits.maxStorageBufferBindingSize,
      maxBufferSize:                  _adapter.limits.maxBufferSize,
      maxComputeWorkgroupStorageSize: _adapter.limits.maxComputeWorkgroupStorageSize,
      maxComputeInvocationsPerWorkgroup: _adapter.limits.maxComputeInvocationsPerWorkgroup,
    },
  });

  _device.lost.then((info) => {
    console.error('[GPU] Device lost:', info.message);
    _device  = null;
    _adapter = null;
  });

  return { device: _device, adapter: _adapter };
}

export function getDevice()  { return _device;  }
export function getAdapter() { return _adapter; }

export function adapterInfo() {
  if (!_adapter) return 'Not initialised';
  return _adapter.info?.description ?? _adapter.info?.device ?? 'Unknown GPU';
}
