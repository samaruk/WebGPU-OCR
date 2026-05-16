// ─────────────────────────────────────────────────────────────
//  src/gpu/ShaderLoader.js
//  Central shader loading + caching via loadShaders()
//  All pipeline stages call loadShaders() before dispatching
// ─────────────────────────────────────────────────────────────

const _sourceCache  = new Map();   // url → WGSL source string
const _moduleCache  = new Map();   // url → GPUShaderModule

/**
 * Load one WGSL shader file.
 * @param {string} url  – path relative to server root, e.g. '/src/shaders/preprocess/resize.wgsl'
 * @returns {Promise<string>} WGSL source
 */
export async function loadShader(url) {
  if (_sourceCache.has(url)) return _sourceCache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[ShaderLoader] ${res.status} loading ${url}`);
  const src = await res.text();
  _sourceCache.set(url, src);
  return src;
}

/**
 * Load multiple shaders in parallel.
 * @param {string[]} urls
 * @returns {Promise<Map<string,string>>}  url → source
 */
export async function loadShaders(urls) {
  const pairs = await Promise.all(
    urls.map(async url => [url, await loadShader(url)])
  );
  return new Map(pairs);
}

/**
 * Compile a WGSL URL into a GPUShaderModule (cached per-device per-url).
 * @param {GPUDevice} device
 * @param {string}    url
 */
export async function compileShader(device, url) {
  const key = `${device.label ?? 'dev'}::${url}`;
  if (_moduleCache.has(key)) return _moduleCache.get(key);
  const code = await loadShader(url);
  const module = device.createShaderModule({ label: url, code });
  // Detect compilation errors
  const info = await module.getCompilationInfo?.();
  if (info) {
    for (const msg of info.messages) {
      if (msg.type === 'error') {
        console.error(`[ShaderLoader] Compile error in ${url}:${msg.lineNum}: ${msg.message}`);
      } else if (msg.type === 'warning') {
        console.warn(`[ShaderLoader] Warning in ${url}: ${msg.message}`);
      }
    }
  }
  _moduleCache.set(key, module);
  return module;
}

/** Evict a URL from both caches (useful for hot-reload). */
export function evictShader(url) {
  _sourceCache.delete(url);
  for (const [key] of _moduleCache) {
    if (key.endsWith(`::${url}`)) _moduleCache.delete(key);
  }
}

/** Clear all caches. */
export function clearShaderCache() {
  _sourceCache.clear();
  _moduleCache.clear();
}
