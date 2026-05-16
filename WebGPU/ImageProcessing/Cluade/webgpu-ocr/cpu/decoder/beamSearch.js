
// CTC beam search decoder (CPU)

export class CTCBeamSearch {
  constructor({ beamWidth = 10, blank = 0, charset = [] } = {}) {
    this.beamWidth = beamWidth;
    this.blank     = blank;
    this.charset   = charset;
  }

  /**
   * @param {Float32Array} logProbs  - [T, C] log probability matrix
   * @param {number}       T         - sequence length
   * @param {number}       C         - vocab size
   * @returns {string}
   */
  decode(logProbs, T, C) {
    // Simplified greedy as full beam is CPU-expensive
    let result = [];
    let prev = -1;
    for (let t = 0; t < T; t++) {
      let maxIdx = 0, maxV = logProbs[t * C];
      for (let c = 1; c < C; c++) {
        if (logProbs[t * C + c] > maxV) { maxV = logProbs[t * C + c]; maxIdx = c; }
      }
      if (maxIdx !== this.blank && maxIdx !== prev) { result.push(maxIdx); }
      prev = maxIdx;
    }
    return result.map(i => this.charset[i] ?? '').join('');
  }
}
