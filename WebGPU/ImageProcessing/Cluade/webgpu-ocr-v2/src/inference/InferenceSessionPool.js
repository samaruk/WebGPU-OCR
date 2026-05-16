// Pool of pre-warmed ONNX sessions to avoid cold-start latency
export class InferenceSessionPool {
  constructor() { this._sessions = new Map(); }

  async warmup(entries) {
    await Promise.all(entries.map(async e => {
      try { await this.get(e.path, e.eps); } catch { /* ignore warmup failures */ }
    }));
  }

  async get(path, eps = ["webgpu","wasm"]) {
    if (this._sessions.has(path)) return this._sessions.get(path);
    const ort = await import("onnxruntime-web");
    const session = await ort.InferenceSession.create(path, { executionProviders: eps });
    this._sessions.set(path, session);
    return session;
  }
}