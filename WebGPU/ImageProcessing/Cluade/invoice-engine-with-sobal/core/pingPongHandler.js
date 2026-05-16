// core/pingPongHandler.js – Double-buffer management for iterative compute passes

export class PingPongHandler {
  /**
   * @param {GPUTexture[]} textures - [A, B] pair created by TextureManager.createPingPong()
   */
  constructor(textures) {
    this._textures = textures;
    this._idx      = 0;         // 0 = A is src, 1 = B is src
  }

  /** Current read (source) texture */
  get src() { return this._textures[this._idx]; }

  /** Current write (destination) texture */
  get dst() { return this._textures[1 - this._idx]; }

  /** View of source texture */
  get srcView() {
    return this.src.createView({ label: 'pp_src_view' });
  }

  /** View of destination texture */
  get dstView() {
    return this.dst.createView({ label: 'pp_dst_view' });
  }

  /** Swap src/dst for next iteration */
  swap() {
    this._idx = 1 - this._idx;
  }

  /** Reset back to A-as-src */
  reset() { this._idx = 0; }

  /** Destroy both textures */
  destroy() {
    this._textures.forEach(t => t.destroy());
  }
}
