import { createDistanceTransformPipelines } from './distanceTransform/distanceTransformPipeline.js';
import { encodeDistanceTransformPass }       from './distanceTransform/distanceTransformPass.js';
import { createWatershedSeedPipeline }       from './seedDetect/watershedSeedPipeline.js';
import { encodeWatershedSeedPass }           from './seedDetect/watershedSeedPass.js';
import { createWatershedPropagatePipeline }  from './propagate/watershedPropagatePipeline.js';
import { encodeWatershedPropagatePass }      from './propagate/watershedPropagatePass.js';
import { CONFIG } from '../../config.js';

export class WatershedStage {
  constructor(device, texMgr, bufMgr) {
    this.device=device; this.texMgr=texMgr; this.bufMgr=bufMgr;
    this.pipelines={}; this.buffers={}; this.textures={};
  }
  async init() {
    this.pipelines.dist      = await createDistanceTransformPipelines(this.device);
    this.pipelines.seed      = await createWatershedSeedPipeline(this.device);
    this.pipelines.propagate = await createWatershedPropagatePipeline(this.device);
  }

  // NOTE: run() is synchronous and fully self-contained.
  // It submits its own command encoders immediately so ordering is correct:
  //   enc_jfa  → JFA distance transform  (submitted first)
  //   enc_seed → seed detection + copy   (submitted second)
  //   enc_prop batches → BFS propagation (submitted in order)
  // The `encoder` parameter from main.js is NOT used (avoid ordering hazard).
  run(_encoder, binaryTex, width, height) {
    const N = width * height;
    const d = this.device;

    if (!this.buffers.seedXA) {
      this.buffers.seedXA = this.bufMgr.storage(N*4, false, 'jfa-xA');
      this.buffers.seedXB = this.bufMgr.storage(N*4, false, 'jfa-xB');
      this.buffers.seedYA = this.bufMgr.storage(N*4, false, 'jfa-yA');
      this.buffers.seedYB = this.bufMgr.storage(N*4, false, 'jfa-yB');
      this.buffers.dist   = this.bufMgr.storage(N*4, false, 'ws-dist');
      this.buffers.seeds  = this.bufMgr.storage(N*4, true,  'ws-seeds');
      this.buffers.A      = this.bufMgr.storage(N*4, true,  'ws-propA');
      this.buffers.B      = this.bufMgr.storage(N*4, true,  'ws-propB');
      this.textures.output = this.texMgr.rgba(width, height, 'ws-out');
    }

    // ── Step 1: JFA distance transform ──────────────────────────────────
    {
      const enc = d.createCommandEncoder({ label:'ws-jfa' });
      encodeDistanceTransformPass(d, enc, this.pipelines.dist,
          binaryTex,
          this.buffers.seedXA, this.buffers.seedXB,
          this.buffers.seedYA, this.buffers.seedYB,
          this.buffers.dist, width, height);
      d.queue.submit([enc.finish()]);
    }

    // ── Step 2: seed detection + copy seeds→A ───────────────────────────
    {
      const enc = d.createCommandEncoder({ label:'ws-seed' });
      encodeWatershedSeedPass(d, enc, this.pipelines.seed,
          this.buffers.dist, this.buffers.seeds,
          width, height, CONFIG.watershed.seedMinDist);
      enc.copyBufferToBuffer(this.buffers.seeds, 0, this.buffers.A, 0, N*4);
      d.queue.submit([enc.finish()]);
    }

    // ── Step 3: BFS propagation in batches of 64 ────────────────────────
    const propIter = Math.ceil(Math.sqrt(width*width + height*height) / 2);
    const BATCH    = 64;
    let done = 0;
    while (done < propIter) {
      const enc = d.createCommandEncoder({ label:`ws-prop-${done}` });
      for (let b = 0; b < BATCH && done < propIter; b++, done++) {
        const [src, dst] = done%2===0
          ? [this.buffers.A, this.buffers.B]
          : [this.buffers.B, this.buffers.A];
        encodeWatershedPropagatePass(d, enc, this.pipelines.propagate,
            src, dst, binaryTex, width, height);
      }
      d.queue.submit([enc.finish()]);
    }

    this._finalBuf = done%2===0 ? this.buffers.A : this.buffers.B;
    this._width = width; this._height = height;
    return { labelsBuf: this._finalBuf, visualTex: this.textures.output };
  }

  async colorize(visualizer) {
    if (!this._finalBuf) return;
    const ct = await visualizer.labelsToRGBA(
        this._finalBuf, this._width, this._height, 2048);
    const enc = this.device.createCommandEncoder();
    enc.copyTextureToTexture({ texture:ct }, { texture:this.textures.output },
        [this._width, this._height]);
    this.device.queue.submit([enc.finish()]);
  }
}
