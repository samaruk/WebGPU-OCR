/**
 * core/loadShader.js
 * Fetches a WGSL shader file at runtime.
 * Use instead of Vite/bundler "?raw" imports for plain ES module environments.
 *
 * Usage:
 *   import { loadShader } from "../../core/loadShader.js";
 *   const WGSL = await loadShader('./myShader.wgsl');
 */

const _cache = new Map();

/**
 * @param {string} url - Path to the .wgsl file (relative to the calling module)
 * @returns {Promise<string>} WGSL source text
 */
export async function loadShader(url) {
  if (_cache.has(url)) return _cache.get(url);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`[loadShader] Failed to fetch "${url}": ${resp.status} ${resp.statusText}`);
  const text = await resp.text();
  _cache.set(url, text);
  return text;
}
