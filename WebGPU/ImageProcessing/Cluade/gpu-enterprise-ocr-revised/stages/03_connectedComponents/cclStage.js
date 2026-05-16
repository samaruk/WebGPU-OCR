
import { createCCLInitPipeline }    from './initLabels/cclInitPipeline.js';
import { encodeCCLInitPass }         from './initLabels/cclInitPass.js';
import { createCCLUnionPipeline }   from './unionFind/cclUnionPipeline.js';
import { encodeCCLUnionPass }        from './unionFind/cclUnionPass.js';
import { createCCLFlattenPipeline } from './flatten/cclFlattenPipeline.js';
import { encodeCCLFlattenPass }      from './flatten/cclFlattenPass.js';
import { CONFIG } from '../../config.js';

export class CCLStage {
  constructor(device, texMgr, bufMgr) {
    this.device = device; this.texMgr = texMgr; this.bufMgr = bufMgr;
    this.pipelines = {}; this.outputTex = null;
  }

  async init() {
    this.pipelines.init    = await createCCLInitPipeline(this.device);
    this.pipelines.union   = await createCCLUnionPipeline(this.device);
    this.pipelines.flatten = await createCCLFlattenPipeline(this.device);
  }

  /**
   * FIX: convergence-detected CCL.
   * Runs iterationsPerBatch union passes per GPU submit, reads back
   * the `changed` atomic counter, and repeats until converged or
   * maxBatches is reached.
   * Returns { labelsBuf, visualTex, batches }
   */
  async run(binaryTex, width, height) {
    const N  = width * height;
    const sz = N * 4;

    const bufA       = this.bufMgr.storage(sz, true,  'ccl-A');
    const bufB       = this.bufMgr.storage(sz, false, 'ccl-B');
    const changedBuf = this.bufMgr.atomicStorage(4,         'ccl-changed');
    this.outputTex   = this.texMgr.rgba(width, height,      'ccl-out');

    const { iterationsPerBatch, maxBatches } = CONFIG.ccl;

    // ── Initialise labels ──────────────────────────────────────────────
    {
      const enc = this.device.createCommandEncoder({ label:'ccl-init' });
      encodeCCLInitPass(this.device, enc, this.pipelines.init, binaryTex, bufA, width, height);
      this.device.queue.submit([enc.finish()]);
    }

    let totalBatches = 0;
    let src = bufA, dst = bufB;

    // ── Convergence loop ───────────────────────────────────────────────
    for (let batch = 0; batch < maxBatches; batch++) {
      totalBatches++;

      // Reset changed counter
      this.device.queue.writeBuffer(changedBuf, 0, new Uint32Array([0]));

      const enc = this.device.createCommandEncoder({ label:`ccl-batch-${batch}` });
      for (let i = 0; i < iterationsPerBatch; i++) {
        encodeCCLUnionPass(this.device, enc, this.pipelines.union,
                           src, dst, changedBuf, width, height);
        // Swap ping-pong
        [src, dst] = [dst, src];
      }
      this.device.queue.submit([enc.finish()]);
      await this.device.queue.onSubmittedWorkDone();

      // Read back changed counter
      const staging = this.device.createBuffer({
        size: 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
      const enc2 = this.device.createCommandEncoder();
      enc2.copyBufferToBuffer(changedBuf, 0, staging, 0, 4);
      this.device.queue.submit([enc2.finish()]);
      await staging.mapAsync(GPUMapMode.READ);
      const changed = new Uint32Array(staging.getMappedRange())[0];
      staging.unmap(); staging.destroy();

      if (changed === 0) break;  // ✅ converged
    }

    // ── Flatten path compression ───────────────────────────────────────
    {
      const enc = this.device.createCommandEncoder({ label:'ccl-flatten' });
      encodeCCLFlattenPass(this.device, enc, this.pipelines.flatten, src, N);
      this.device.queue.submit([enc.finish()]);
    }

    this._finalBuf = src;
    this._width    = width;
    this._height   = height;
    return { labelsBuf: src, visualTex: this.outputTex, batches: totalBatches };
  }

  async colorize(visualizer) {
    if (!this._finalBuf) return;
    const ct = await visualizer.labelsToRGBA(this._finalBuf, this._width, this._height, 4096);
    const enc = this.device.createCommandEncoder();
    enc.copyTextureToTexture({ texture:ct }, { texture:this.outputTex }, [this._width, this._height]);
    this.device.queue.submit([enc.finish()]);
  }
}
