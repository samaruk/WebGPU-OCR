// shaders/_loader.js – Fetch and cache WGSL shader source files at runtime.
// No bundler required – uses native fetch() in the browser.

const _cache = new Map();

/**
 * Load a WGSL shader by path, with caching.
 * @param {string} path - relative path to .wgsl file (e.g. './shaders/grayscale.wgsl')
 * @returns {Promise<string>}
 */
export async function loadShader(path) {
  if (_cache.has(path)) return _cache.get(path);
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load shader: ${path} (${res.status})`);
  const src = await res.text();
  _cache.set(path, src);
  return src;
}

/**
 * Preload multiple shaders in parallel.
 * @param {string[]} paths
 * @returns {Promise<Map<string, string>>}
 */
export async function preloadShaders(paths) {
  await Promise.all(paths.map(p => loadShader(p)));
  return _cache;
}
