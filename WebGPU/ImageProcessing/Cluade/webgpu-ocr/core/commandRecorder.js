// Thin wrapper around GPUCommandEncoder

export class CommandRecorder {
  constructor(device, label = '') {
    this.device  = device;
    this._enc    = device.createCommandEncoder({ label });
    this._passes = [];
  }

  /** Begin a compute pass (auto-ended on submit) */
  beginComputePass(label = '') {
    const pass = this._enc.beginComputePass({ label });
    this._passes.push(pass);
    return pass;
  }

  endLastPass() {
    const p = this._passes[this._passes.length - 1];
    if (p) { p.end(); }
  }

  copyBufToBuf(src, srcOff, dst, dstOff, size) {
    this._enc.copyBufferToBuffer(src, srcOff, dst, dstOff, size);
  }

  /** Submit and return command buffer */
  finish() {
    // End any unclosed passes
    for (const p of this._passes) { try { p.end(); } catch(_) {} }
    return this._enc.finish();
  }

  submit() {
    this.device.queue.submit([this.finish()]);
  }
}
