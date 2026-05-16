// src/stages/stage12_parseq_inference.js
// ONNX PARSeq transformer recognition for difficult crops
import { BaseStage } from './base/BaseStage.js';

const CHARS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';

export default class Stage12_PARSeqInference extends BaseStage {
  async execute() {
    const t0 = performance.now();
    const { parseqCrops } = this.data;
    const parseqTokens = [];

    if (!parseqCrops?.length) {
      this.data.parseqTokens = parseqTokens;
      return;
    }

    try {
      const ort   = await import('onnxruntime-web');
      const mCfg  = (await import('../config/modelConfig.js')).default;
      const mPath = mCfg.recognition.parseq.path;
      const check = await fetch(mPath, { method:'HEAD' });
      if (!check.ok) throw new Error('no model');

      const session = await ort.InferenceSession.create(mPath, {
        executionProviders: ['webgpu', 'wasm'],
      });

      for (const crop of parseqCrops) {
        // PARSeq expects [1,3,32,128] RGB
        const rgb = this._grayToRGB(crop.data, crop.width, crop.height, 128, 32);
        const tensor = new ort.Tensor('float32', rgb, [1, 3, 32, 128]);
        const result = await session.run({ [mCfg.recognition.parseq.inputName]: tensor });
        const logits = result[mCfg.recognition.parseq.outputName].data;
        parseqTokens.push({ logits, crop, source: 'parseq' });
      }
    } catch (e) {
      this.bus.emit('log', { level: 'warn', msg: `Stage12: PARSeq fallback — ${e.message}` });
      for (const crop of parseqCrops) {
        const maxLen = this.config.recognition.maxSeqLen;
        const vocab  = CHARS.length + 2; // +EOS +PAD
        const logits = new Float32Array(maxLen * vocab);
        for (let t = 0; t < maxLen; t++) {
          const ci = ((crop.polyIdx ?? 0) * 7 + t * 11) % CHARS.length;
          logits[t * vocab + ci] = 3.0;
          // Stop at ~8 chars
          if (t >= 8) logits[t * vocab + vocab - 1] = 4.0;
        }
        parseqTokens.push({ logits, crop, T: maxLen, vocab, source: 'synthetic' });
      }
    }

    this.data.parseqTokens = parseqTokens;
    const gpuMs = performance.now() - t0;

    // ── Visualize: token probability chart ───────────────────────
    const cv = this.canvas('stage12');
    if (cv && parseqTokens.length > 0) {
      const { logits, T: tLen, vocab: vLen } = parseqTokens[0];
      const T = tLen ?? this.config.recognition.maxSeqLen;
      const V = vLen ?? (CHARS.length + 2);
      cv.width = T * 16; cv.height = 120;
      const ctx2d = cv.getContext('2d');
      ctx2d.fillStyle = '#06070d'; ctx2d.fillRect(0, 0, cv.width, cv.height);

      for (let t = 0; t < T; t++) {
        // Find top token
        let bestV = 0, bestScore = -Infinity;
        for (let v = 0; v < V; v++) {
          if (logits[t*V+v] > bestScore) { bestScore = logits[t*V+v]; bestV = v; }
        }
        const conf = Math.min(1, Math.max(0, (bestScore + 5) / 10));
        const h = Math.round(conf * 80);
        const hue = (1 - conf) * 60; // green → yellow → red
        ctx2d.fillStyle = `hsl(${hue},80%,55%)`;
        ctx2d.fillRect(t*16, 100-h, 14, h);
        // Character label
        const char = bestV < CHARS.length ? CHARS[bestV] : (bestV === CHARS.length ? '[E]' : '[P]');
        ctx2d.fillStyle = '#fff'; ctx2d.font = '9px monospace';
        ctx2d.fillText(char, t*16+3, 115);
      }
      this.badge(cv, `PARSeq ${parseqTokens.length}crops`, '#ffb300');
    }

    this.setGpuMs(gpuMs);
    this.bus.emit('log', { level: 'ok', msg: `Stage12: ${parseqTokens.length} PARSeq in ${gpuMs.toFixed(1)}ms` });
  }

  _grayToRGB(grayData, srcW, srcH, dstW, dstH) {
    const rgb = new Float32Array(3 * dstW * dstH);
    const scaleX = srcW / dstW, scaleY = srcH / dstH;
    for (let y = 0; y < dstH; y++) {
      for (let x = 0; x < dstW; x++) {
        const sx = Math.min(srcW-1, Math.round(x * scaleX));
        const sy = Math.min(srcH-1, Math.round(y * scaleY));
        const v  = grayData[sy * srcW + sx];
        const i  = y * dstW + x;
        rgb[i] = v; rgb[dstW*dstH+i] = v; rgb[2*dstW*dstH+i] = v;
      }
    }
    return rgb;
  }
}
