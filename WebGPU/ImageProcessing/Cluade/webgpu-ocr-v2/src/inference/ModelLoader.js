// Loads and caches model ArrayBuffers in IndexedDB
export class ModelLoader {
  async load(path) {
    const cached = await this._idbGet(path);
    if (cached) return cached;
    const buf = await fetch(path).then(r => { if(!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
    await this._idbSet(path, buf);
    return buf;
  }

  async _idbGet(key) {
    return new Promise(res => {
      const req = indexedDB.open("webgpu-ocr-models", 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore("models");
      req.onsuccess = e => {
        const tx = e.target.result.transaction("models","readonly");
        const r2 = tx.objectStore("models").get(key);
        r2.onsuccess = () => res(r2.result ?? null);
        r2.onerror   = () => res(null);
      };
      req.onerror = () => res(null);
    });
  }

  async _idbSet(key, value) {
    return new Promise(res => {
      const req = indexedDB.open("webgpu-ocr-models", 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore("models");
      req.onsuccess = e => {
        const tx = e.target.result.transaction("models","readwrite");
        tx.objectStore("models").put(value, key);
        tx.oncomplete = () => res(); tx.onerror = () => res();
      };
      req.onerror = () => res();
    });
  }
}