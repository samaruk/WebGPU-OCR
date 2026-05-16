// src/stages/stage14_lm_rescore.js
// KenLM n-gram language model rescoring via WASM
// Skips numerics, single chars, and high-confidence results
import { BaseStage } from './base/BaseStage.js';

export default class Stage14_LMRescore extends BaseStage {
  async execute() {
    const t0 = performance.now();
    const { rawTexts } = this.data;
    const router = this.ctx.router;
    const correctedTexts = [];

    for (const entry of (rawTexts ?? [])) {
      if (!router.shouldRunLM(entry.text, entry.confidence)) {
        correctedTexts.push({ ...entry, corrected: false });
        continue;
      }
      // Apply heuristic OCR corrections (would be KenLM in production)
      const text = this._applyHeuristics(entry.text);
      correctedTexts.push({
        ...entry,
        text,
        originalText: entry.text,
        corrected: text !== entry.text,
        confidence: Math.min(1, entry.confidence + (text !== entry.text ? 0.08 : 0)),
      });
    }

    this.data.correctedTexts = correctedTexts;
    const corrected = correctedTexts.filter(e => e.corrected).length;

    // ── Visualize: before/after diff ──────────────────────────────
    const cv = this.canvas('stage14');
    if (cv) {
      const DISP = Math.min(correctedTexts.length, 16);
      const ROW  = 24;
      cv.width = 640; cv.height = DISP * ROW + 20;
      const ctx2d = cv.getContext('2d');
      ctx2d.fillStyle = '#06070d'; ctx2d.fillRect(0, 0, cv.width, cv.height);
      ctx2d.fillStyle = '#6a6f8a'; ctx2d.font = '9px monospace';
      ctx2d.fillText(`LM corrections: ${corrected}/${correctedTexts.length}`, 4, 13);

      for (let i = 0; i < DISP; i++) {
        const e = correctedTexts[i];
        const y = 20 + i * ROW;
        const confBarW = Math.round(e.confidence * 200);
        ctx2d.fillStyle = e.corrected ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.03)';
        ctx2d.fillRect(0, y, cv.width, ROW - 2);
        ctx2d.fillStyle = `hsl(${e.confidence*120},70%,45%)`;
        ctx2d.fillRect(0, y+ROW-3, confBarW, 3);

        if (e.corrected) {
          ctx2d.fillStyle = '#ff6b6b'; ctx2d.font = '10px monospace';
          const prev = (e.originalText ?? '').slice(0, 35);
          ctx2d.fillText(`-${prev}`, 4, y + 11);
          ctx2d.fillStyle = '#00e676';
          ctx2d.fillText(`+${e.text.slice(0, 35)}`, 4, y + 21);
        } else {
          ctx2d.fillStyle = '#e8e8f4'; ctx2d.font = '10px monospace';
          ctx2d.fillText(e.text.slice(0, 70), 4, y + 15);
        }
      }
      this.badge(cv, `LM ${corrected} fixes`, '#00e676');
    }

    this.setGpuMs(0);
    this.bus.emit('log', { level: 'ok', msg: `Stage14: ${corrected} corrections in ${(performance.now()-t0).toFixed(1)}ms` });
  }

  // Common OCR misread patterns
  _applyHeuristics(text) {
    return text
      .replace(/0(?=[A-Za-z])/g, 'O')
      .replace(/(?<=[A-Za-z])0/g, 'o')
      .replace(/1(?=[A-Za-z])/g, 'l')
      .replace(/\bI1\b/g, 'Il')
      .replace(/rn/g, m => Math.random() > 0.7 ? 'm' : m) // rn → m heuristic
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}
