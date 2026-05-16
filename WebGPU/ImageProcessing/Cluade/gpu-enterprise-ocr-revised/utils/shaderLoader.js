
const _cache = new Map();
export async function loadShader(url) {
  const key = url.href ?? url.toString();
  if (_cache.has(key)) return _cache.get(key);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load shader: ${key} (${res.status})`);
  const text = await res.text();
  _cache.set(key, text);
  return text;
}
