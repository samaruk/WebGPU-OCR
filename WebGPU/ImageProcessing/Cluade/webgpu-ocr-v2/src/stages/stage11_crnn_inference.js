// src/stages/stage11_crnn_inference.js
// ONNX CRNN-CTC inference for fast text recognition
// Each crop [1,1,32,W] → logits [T, 1, vocab_size]
import { BaseStage } from './base/BaseStage.js';

export default class Stage11_CRNNInference extends BaseStage {
  async execute() {
    const t0 = performance.now();
    const { crnnCrops } = this.data;

    const crnnLogits = [];

    if (crnnCrops.length === 0) {
      this.data.crnnLogits = crnnLogits;
      return;
    }

    try {
      const ort    = await import('onnxruntime-web');
      const mCfg   = (await import('../config/modelConfig.js')).default;
      const mPath  = mCfg.recognition.crnn.path;
      const check  = await fetch(mPath, { method:'HEAD' });
      if (!check.ok) throw new Error('no model');

      const session = await ort.InferenceSession.create(mPath, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      for (const crop of crnnCrops) {
        const { data, width: W, height: H } = crop;
        const inputTensor = new ort.Tensor('float32', data, [1, 1, H, W]);
        const result = await session.run({ [mCfg.recognition.crnn.inputName]: inputTensor });
        const logits = result[mCfg.recognition.crnn.outputName].data;
        crnnLogits.push({ logits, crop, source: 'crnn' });
      }
    } catch (e) {
      this.bus.emit('log', { level: 'warn', msg: `Stage11: CRNN fallback — ${e.message}` });
      // Synthetic logits for visualization/testing
      for (const crop of crnnCrops) {
        const T = Math.max(4, Math.ceil(crop.width / 4));
        const vocab = 97; // a-z + digits + symbols
        const logits = new Float32Array(T * vocab);
        for (let t = 0; t < T; t++) {
          // Bias towards a pseudo-random char based on crop position
          const charIdx = ((crop.polyIdx ?? 0) * 13 + t * 7) % vocab;
          logits[t * vocab + charIdx] = 2.5;
          logits[t * vocab + 0]       = -1.0; // blank idx
        }
        crnnLogits.push({ logits, crop, T, vocab, source: 'synthetic' });
      }
    }

    this.data.crnnLogits = crnnLogits;
    const gpuMs = performance.now() - t0;

    // ── Visualize: logit heatmap for first crop ───────────────────
    const cv = this.canvas('stage11');
    if (cv && crnnLogits.length > 0) {
      const { logits, T, vocab: V } = crnnLogits[0];
      const tv = T ?? Math.round(logits.length / 97);
      const vv = V ?? 97;
      const SCALE = Math.max(1, Math.floor(240 / tv));
      cv.width  = tv * SCALE; cv.height = Math.min(vv, 64) * SCALE;
      const ctx2d = cv.getContext('2d');
      ctx2d.fillStyle = '#06070d'; ctx2d.fillRect(0, 0, cv.width, cv.height);

      let gMin = Infinity, gMax = -Infinity;
      for (let i = 0; i < logits.length; i++) { if(logits[i]<gMin)gMin=logits[i]; if(logits[i]>gMax)gMax=logits[i]; }
      const gRange = Math.max(1e-7, gMax - gMin);

      for (let t = 0; t < tv; t++) {
        for (let v = 0; v < Math.min(vv, 64); v++) {
          const val = (logits[t*vv+v] - gMin) / gRange;
          const r = Math.round(val * 255);
          const g2 = Math.round(val * 179);
          ctx2d.fillStyle = `rgb(${r},${g2},0)`;
          ctx2d.fillRect(t*SCALE, v*SCALE, SCALE, SCALE);
        }
      }
      this.badge(cv, `CRNN ${crnnLogits.length}crops`, '#00d4ff');
    }

    this.setGpuMs(gpuMs);
    this.bus.emit('log', { level: 'ok', msg: `Stage11: ${crnnLogits.length} CRNN in ${gpuMs.toFixed(1)}ms` });
  }
}
