// Registry of all GPU kernel instances

const _kernels = new Map();

export function registerKernel(name, kernel) {
  _kernels.set(name, kernel);
}

export function getKernel(name) {
  const k = _kernels.get(name);
  if (!k) throw new Error(`[KernelRegistry] Unknown kernel: ${name}`);
  return k;
}

export function listKernels() {
  return [..._kernels.keys()];
}

export function clearKernels() {
  _kernels.clear();
}
