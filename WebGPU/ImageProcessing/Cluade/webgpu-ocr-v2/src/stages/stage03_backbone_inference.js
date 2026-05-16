// src/stages/stage03_backbone_inference.js
// ONNX inference: DBNet MobileNetV3/ResNet50 backbone
// Produces probability_map and threshold_map tensors
// Falls back to Sobel-based synthetic maps when model unavailable
import { BaseStage } from './base/BaseStage.js';

export default class Stage03_BackboneInference extends BaseStage {
  async execute() {
    const t0 = performance.now();
    const { normTensor, imageMeta } = this.data;
    const { width: W, height: H } = normTensor;

    let probMap, threshMap;

    try {
      // ── Try ONNX Runtime ──────────────────────────────────────────
      const ort   = await import('onnxruntime-web');
      const cfg   = this.config.detection;
      const mCfg  = (await import('../config/modelConfig.js')).default;
      const mPath = mCfg.detection[cfg.backbone].path;

      // Check if model exists (skip in dev if no model files)
      const check = await fetch(mPath, { method: 'HEAD' });
      if (!check.ok) throw new Error(`Model not found: ${mPath}`);

      const session = await ort.InferenceSession.create(mPath, {
        executionProviders: ['webgpu', 'wasm'],
        graphOptimizationLevel: 'all',
      });

      const inputData = normTensor.data ?? new Float32Array(3*W*H);
      const tensor = new ort.Tensor('float32', inputData, [1, 3, H, W]);
      const feeds  = { [mCfg.detection[cfg.backbone].inputName]: tensor };
      const result = await session.run(feeds);

      probMap   = result['probability_map'].data;
      threshMap = result['threshold_map'].data;
      this.bus.emit('log', { level: 'ok', msg: 'Stage03: ONNX DBNet inference OK' });

    } catch (e) {
      // ── CPU fallback: Sobel-based probability map ──────────────────
      this.bus.emit('log', { level: 'warn', msg: `Stage03: ONNX fallback (${e.message}) — using Sobel` });
      const gray = this.data.grayTensor.data;
      probMap   = this._sobelProbMap(gray, W, H);
      threshMap = this._syntheticThresh(W, H, 0.3);
    }

    this.data.probMap   = { data: probMap,   width: W, height: H };
    this.data.threshMap = { data: threshMap, width: W, height: H };

    // ── Visualize side-by-side (prob left | thresh right) ─────────
    const cv = this.canvas('stage03');
    if (cv) {
      cv.width  = W * 2; cv.height = H;
      const ctx2d = cv.getContext('2d');
      this._drawHeatmap(ctx2d, probMap,   W, H, 0,   'amber');
      this._drawHeatmap(ctx2d, threshMap, W, H, W, 'cyan');
      ctx2d.fillStyle = 'rgba(0,0,0,0.65)';
      ctx2d.fillRect(0, 0, 80, 18);
      ctx2d.fillRect(W, 0, 100, 18);
      ctx2d.fillStyle = '#ffb300'; ctx2d.font = 'bold 10px monospace';
      ctx2d.fillText('PROB MAP', 3, 12);
      ctx2d.fillStyle = '#00d4ff';
      ctx2d.fillText('THRESH MAP', W+3, 12);
      this.badge(cv, `DBNet ${(performance.now()-t0).toFixed(0)}ms`);
    }

    this.setGpuMs(performance.now() - t0);
    this.bus.emit('log', { level: 'ok', msg: `Stage03: backbone in ${(performance.now()-t0).toFixed(1)}ms` });
  }

  _sobelProbMap(gray, W, H) {
    const out = new Float32Array(W * H);
    for (let y = 1; y < H-1; y++) {
      for (let x = 1; x < W-1; x++) {
        const g = (r,c) => gray[r*W+c];
        const gx = -g(y-1,x-1) + g(y-1,x+1) - 2*g(y,x-1) + 2*g(y,x+1) - g(y+1,x-1) + g(y+1,x+1);
        const gy = -g(y-1,x-1) - 2*g(y-1,x) - g(y-1,x+1) + g(y+1,x-1) + 2*g(y+1,x) + g(y+1,x+1);
        out[y*W+x] = Math.min(1, Math.sqrt(gx*gx + gy*gy) * 2);
      }
    }
    return out;
  }

  _syntheticThresh(W, H, val = 0.3) {
    const out = new Float32Array(W * H);
    out.fill(val);
    return out;
  }

  _drawHeatmap(ctx2d, data, W, H, offsetX, colormap) {
    const img = ctx2d.createImageData(W, H);
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < data.length; i++) { if(data[i]<min)min=data[i]; if(data[i]>max)max=data[i]; }
    const rng = Math.max(1e-7, max - min);
    for (let i = 0; i < W*H; i++) {
      const v = (data[i]-min)/rng;
      let r,g,b;
      if (colormap === 'amber') { r=Math.round(255*v); g=Math.round(179*v); b=0; }
      else                      { r=0; g=Math.round(212*v); b=Math.round(255*v); }
      img.data[i*4]=r; img.data[i*4+1]=g; img.data[i*4+2]=b; img.data[i*4+3]=255;
    }
    ctx2d.putImageData(img, offsetX, 0);
  }
}
