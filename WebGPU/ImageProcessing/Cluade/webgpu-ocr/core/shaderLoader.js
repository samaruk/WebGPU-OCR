// Shader loader — fetches WGSL source from URL

const _cache = new Map();

/**
 * Load a WGSL shader by URL (or relative path string).
 * Results are cached so repeat calls are free.
 * @param {string|URL} url
 * @returns {Promise<string>}
 */
export async function loadShader(url) {
  const key = url.toString();
  if (_cache.has(key)) return _cache.get(key);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`[ShaderLoader] Failed to load: ${key} (${resp.status})`);
  const src = await resp.text();
  _cache.set(key, src);
  return src;
}

/**
 * Load multiple shaders in parallel.
 * @param {Array<string|URL>} urls
 * @returns {Promise<string[]>}
 */
export async function loadShaders(...urls) {
  return Promise.all(urls.map(loadShader));
}

export function clearShaderCache() { _cache.clear(); }
