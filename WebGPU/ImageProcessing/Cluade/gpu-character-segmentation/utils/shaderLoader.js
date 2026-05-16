// utils/shaderLoader.js — Centralized WGSL shader loader with caching and error reporting

const _cache = new Map();

/**
 * Load a WGSL shader by path, with in-memory caching.
 * All paths are resolved relative to the project root.
 *
 * Usage:
 *   const src = await loadShader('shaders/sobel.wgsl');
 *
 * @param {string} path - Path to the .wgsl file (relative to project root)
 * @returns {Promise<string>} WGSL source code
 */
export async function loadShader(path) {

    path = './../' + path;
  if (_cache.has(path)) return _cache.get(path);

  const url = new URL(path, import.meta.url).href;

  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`[ShaderLoader] Network error loading "${path}": ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`[ShaderLoader] Failed to load "${path}" — HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error(`[ShaderLoader] "${path}" returned HTML — check that the file exists and the server is running.`);
  }

  const source = await response.text();

  if (!source.trim()) {
    throw new Error(`[ShaderLoader] Shader "${path}" is empty.`);
  }

  _cache.set(path, source);
  return source;
}

/**
 * Preload multiple shaders in parallel.
 * Returns a map of { path → source }.
 *
 * Usage:
 *   const shaders = await preloadShaders([
 *     'shaders/sobel.wgsl',
 *     'shaders/threshold.wgsl',
 *   ]);
 *   const sobelSrc = shaders['shaders/sobel.wgsl'];
 *
 * @param {string[]} paths
 * @returns {Promise<Record<string, string>>}
 */
export async function preloadShaders(paths) {
  const entries = await Promise.all(
    paths.map(async (path) => [path, await loadShader(path)])
  );
  return Object.fromEntries(entries);
}

/**
 * Clear the shader source cache (useful for hot-reload in dev).
 */
export function clearShaderCache() {
  _cache.clear();
}
