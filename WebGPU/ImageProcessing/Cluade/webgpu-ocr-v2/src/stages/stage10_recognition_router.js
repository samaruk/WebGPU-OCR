// src/stages/stage10_recognition_router.js
// Routes each crop to CRNN (fast) or PARSeq (accurate) based on
// aspect ratio, estimated stroke width, and polygon confidence
import { BaseStage } from './base/BaseStage.js';

export default class Stage10_RecognitionRouter extends BaseStage {
  async execute() {
    const t0 = performance.now();
    const { cropBatch } = this.data;
    const router = this.ctx.router;

    const crnnCrops   = [];
    const parseqCrops = [];

    for (const crop of cropBatch) {
      const usePARSeq = router.shouldUsePARSeq({
        width:      crop.width,
        height:     crop.height,
        confidence: crop.polygon?.confidence ?? 0.8,
        strokeWidth: this._estimateStrokeWidth(crop.data, crop.width, crop.height),
      });

      if (usePARSeq) parseqCrops.push(crop);
      else           crnnCrops.push(crop);
    }

    this.data.crnnCrops   = crnnCrops;
    this.data.parseqCrops = parseqCrops;

    this.bus.emit('log', { level: 'ok',
      msg: `Stage10: routed ${crnnCrops.length} CRNN / ${parseqCrops.length} PARSeq in ${(performance.now()-t0).toFixed(1)}ms` });

    // ── Visualize routing decision map ────────────────────────────
    const cv = this.canvas('stage10');
    if (cv) {
      const COLS = Math.min(cropBatch.length, 8);
      const ROWS = Math.ceil(Math.min(cropBatch.length, 32) / COLS);
      const CW = 80, CH = 32;
      cv.width  = COLS * CW; cv.height = ROWS * (CH + 14);
      const ctx2d = cv.getContext('2d');
      ctx2d.fillStyle = '#06070d'; ctx2d.fillRect(0, 0, cv.width, cv.height);

      for (let i = 0; i < Math.min(cropBatch.length, COLS*ROWS); i++) {
        const crop = cropBatch[i];
        const isCRNN = crnnCrops.includes(crop);
        const col = i % COLS, row = Math.floor(i / COLS);
        const cx = col * CW, cy = row * (CH + 14);

        // Draw crop thumbnail
        const img2 = ctx2d.createImageData(Math.min(crop.width, CW), CH);
        const scaleX = crop.width / CW;
        for (let py = 0; py < CH; py++) {
          for (let px = 0; px < Math.min(crop.width, CW); px++) {
            const srcPx = Math.floor(px * scaleX);
            const v = Math.round((crop.data[py * crop.width + srcPx] ?? 0) * 255);
            const idx = (py * Math.min(crop.width,CW) + px) * 4;
            img2.data[idx]=v; img2.data[idx+1]=v; img2.data[idx+2]=v; img2.data[idx+3]=255;
          }
        }
        ctx2d.putImageData(img2, cx, cy);

        // Route label
        const routeColor = isCRNN ? '#00d4ff' : '#ffb300';
        ctx2d.fillStyle = routeColor + 'cc';
        ctx2d.fillRect(cx, cy + CH, CW, 14);
        ctx2d.fillStyle = '#000'; ctx2d.font = 'bold 8px monospace';
        ctx2d.fillText(isCRNN ? 'CRNN' : 'PARSeq', cx + 2, cy + CH + 10);
      }

      // Legend
      ctx2d.fillStyle = '#00d4ff'; ctx2d.fillRect(4, cv.height-12, 8, 8);
      ctx2d.fillStyle = '#fff'; ctx2d.font = '8px monospace';
      ctx2d.fillText(`CRNN(${crnnCrops.length})`, 14, cv.height-5);
      ctx2d.fillStyle = '#ffb300'; ctx2d.fillRect(80, cv.height-12, 8, 8);
      ctx2d.fillText(`PARSeq(${parseqCrops.length})`, 90, cv.height-5);
      this.badge(cv, 'Router', '#7c4dff');
    }
    this.setGpuMs(0);
  }

  _estimateStrokeWidth(data, W, H) {
    // Fast approximation: sample a grid of pixels, compute local contrast
    let sumContrast = 0, n = 0;
    const step = Math.max(1, Math.floor(W / 16));
    for (let y = 1; y < H-1; y += step) {
      for (let x = 1; x < W-1; x += step) {
        const c   = data[y*W+x];
        const diff = Math.abs(c - data[y*W+x+1]) + Math.abs(c - data[(y+1)*W+x]);
        sumContrast += diff;
        n++;
      }
    }
    // Low contrast / smooth edges → thin strokes (handwriting)
    return n > 0 ? (sumContrast / n) * 10 : 5;
  }
}
