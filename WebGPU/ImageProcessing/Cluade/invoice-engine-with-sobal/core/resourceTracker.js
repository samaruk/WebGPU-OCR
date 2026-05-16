// core/resourceTracker.js – Track and auto-destroy GPU resources to prevent leaks

export class ResourceTracker {
  constructor() {
    this._textures = new Set();
    this._buffers  = new Set();
    this._others   = new Set();
  }

  /** Track a GPU texture */
  trackTexture(tex) {
    if (tex) this._textures.add(tex);
    return tex;
  }

  /** Track a GPU buffer */
  trackBuffer(buf) {
    if (buf) this._buffers.add(buf);
    return buf;
  }

  /** Track any other destroyable GPU resource */
  track(res) {
    if (res) this._others.add(res);
    return res;
  }

  /** Release a specific texture */
  releaseTexture(tex) {
    if (tex && this._textures.has(tex)) {
      tex.destroy();
      this._textures.delete(tex);
    }
  }

  /** Release a specific buffer */
  releaseBuffer(buf) {
    if (buf && this._buffers.has(buf)) {
      buf.destroy();
      this._buffers.delete(buf);
    }
  }

  /** Replace an old texture with a new one (destroy old) */
  replaceTexture(old, next) {
    this.releaseTexture(old);
    return this.trackTexture(next);
  }

  /** Destroy all tracked resources */
  destroyAll() {
    for (const t of this._textures)  { try { t.destroy(); } catch (_) {} }
    for (const b of this._buffers)   { try { b.destroy(); } catch (_) {} }
    for (const r of this._others)    { try { r.destroy?.(); } catch (_) {} }
    this._textures.clear();
    this._buffers.clear();
    this._others.clear();
  }

  /** Summary count */
  summary() {
    return {
      textures: this._textures.size,
      buffers:  this._buffers.size,
      others:   this._others.size,
    };
  }
}
