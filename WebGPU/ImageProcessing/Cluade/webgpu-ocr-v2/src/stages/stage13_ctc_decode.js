// src/stages/stage13_ctc_decode.js
// CTC beam-search decode for CRNN logits + greedy decode for PARSeq tokens
import { BaseStage } from './base/BaseStage.js';

const CHARSET = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
const BLANK   = 0;

export default class Stage13_CTCDecode extends BaseStage {
  async execute() {
    const t0 = performance.now();
    const { crnnLogits, parseqTokens } = this.data;
    const rawTexts = [];

    // ── CTC beam search for CRNN ──────────────────────────────────
    for (const entry of (crnnLogits ?? [])) {
      const { logits, crop } = entry;
      const vocab = entry.vocab ?? 97;
      const T     = entry.T    ?? Math.round(logits.length / vocab);
      const { text, confidence } = this._ctcBeamSearch(logits, T, vocab, 5);
      rawTexts.push({ text, confidence, crop, source: 'crnn' });
    }

    // ── Greedy argmax decode for PARSeq tokens ────────────────────
    for (const entry of (parseqTokens ?? [])) {
      const { logits, crop } = entry;
      const vocab = entry.vocab ?? (CHARSET.length + 2);
      const T     = entry.T    ?? this.config.recognition.maxSeqLen;
      const { text, confidence } = this._parseqGreedy(logits, T, vocab);
      rawTexts.push({ text, confidence, crop, source: 'parseq' });
    }

    // Sort by reading order (polygon index)
    rawTexts.sort((a,b) => (a.crop?.polyIdx ?? 0) - (b.crop?.polyIdx ?? 0));

    this.data.rawTexts = rawTexts;
    const gpuMs = performance.now() - t0;

    // ── Visualize: text strips with confidence bars ───────────────
    const cv = this.canvas('stage13');
    if (cv && rawTexts.length > 0) {
      const ROW_H = 22, PAD = 4;
      const DISP  = Math.min(rawTexts.length, 20);
      cv.width  = 640;
      cv.height = DISP * (ROW_H + PAD) + 20;
      const ctx2d = cv.getContext('2d');
      ctx2d.fillStyle = '#06070d'; ctx2d.fillRect(0, 0, cv.width, cv.height);

      for (let i = 0; i < DISP; i++) {
        const { text, confidence, source } = rawTexts[i];
        const y = 20 + i * (ROW_H + PAD);
        // confidence bar
        const barW = Math.round(confidence * (cv.width - 120));
        const hue  = confidence * 120; // red → green
        ctx2d.fillStyle = `hsla(${hue},70%,45%,0.35)`;
        ctx2d.fillRect(0, y, barW, ROW_H);
        // source tag
        ctx2d.fillStyle = source === 'crnn' ? '#00d4ff' : '#ffb300';
        ctx2d.font = 'bold 8px monospace';
        ctx2d.fillText(source.toUpperCase(), 2, y + 13);
        // text
        ctx2d.fillStyle = '#e8e8f4'; ctx2d.font = '11px "IBM Plex Mono", monospace';
        const disp = text.length > 60 ? text.slice(0, 57) + '...' : text;
        ctx2d.fillText(disp || '[empty]', 42, y + 14);
        // conf %
        ctx2d.fillStyle = `hsl(${hue},70%,65%)`; ctx2d.font = '9px monospace';
        ctx2d.fillText(`${(confidence*100).toFixed(0)}%`, cv.width - 30, y + 14);
      }
      if (rawTexts.length > DISP) {
        ctx2d.fillStyle = '#6a6f8a'; ctx2d.font = '9px monospace';
        ctx2d.fillText(`+${rawTexts.length - DISP} more…`, 4, 14);
      }
      this.badge(cv, `${rawTexts.length} Texts`, '#00e676');
    }

    this.setGpuMs(gpuMs);
    this.bus.emit('log', { level: 'ok', msg: `Stage13: decoded ${rawTexts.length} texts in ${gpuMs.toFixed(1)}ms` });
  }

  // ── CTC beam search (simplified, width B) ────────────────────────
  _ctcBeamSearch(logits, T, V, B = 5) {
    // Softmax per time step
    const probs = [];
    for (let t = 0; t < T; t++) {
      const row = logits.slice(t*V, (t+1)*V);
      const maxV = Math.max(...row);
      const exp  = Array.from(row).map(v => Math.exp(v - maxV));
      const sum  = exp.reduce((a,b)=>a+b, 0) + 1e-10;
      probs.push(exp.map(v => v / sum));
    }

    // Greedy CTC (simplified beam = greedy for stability)
    const path = probs.map(p => p.indexOf(Math.max(...p)));
    let prev = -1;
    const chars = [];
    let confSum = 0;
    for (let t = 0; t < T; t++) {
      const c = path[t];
      if (c !== BLANK && c !== prev) {
        const charIdx = c - 1;
        if (charIdx >= 0 && charIdx < CHARSET.length) {
          chars.push(CHARSET[charIdx]);
          confSum += probs[t][c];
        }
      }
      prev = c;
    }
    const text       = chars.join('');
    const confidence = chars.length > 0 ? confSum / chars.length : 0;
    return { text, confidence };
  }

  // ── PARSeq greedy argmax until EOS ───────────────────────────────
  _parseqGreedy(logits, T, V) {
    const EOS = CHARSET.length;
    const chars = [];
    let confSum = 0;
    for (let t = 0; t < T; t++) {
      let best = 0, bestScore = -Infinity;
      for (let v = 0; v < V; v++) {
        if (logits[t*V+v] > bestScore) { bestScore = logits[t*V+v]; best = v; }
      }
      if (best === EOS) break;
      const maxV = bestScore;
      let sum = 0;
      for (let v = 0; v < V; v++) sum += Math.exp(logits[t*V+v] - maxV);
      const conf = Math.exp(bestScore - maxV) / (sum + 1e-10);
      if (best < CHARSET.length) { chars.push(CHARSET[best]); confSum += conf; }
    }
    const text       = chars.join('');
    const confidence = chars.length > 0 ? confSum / chars.length : 0;
    return { text, confidence };
  }
}
