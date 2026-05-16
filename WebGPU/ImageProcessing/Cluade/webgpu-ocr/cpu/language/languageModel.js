
// Trigram language model (stub with uniform scores)

export class LanguageModel {
  constructor() {
    this.ngrams = new Map();
    this.ready  = false;
  }

  /** Load a frequency table (simple JSON format) */
  async load(url) {
    try {
      const resp = await fetch(url);
      this.ngrams = new Map(Object.entries(await resp.json()));
      this.ready  = true;
    } catch (_) {
      console.warn('[LM] Could not load language model, using uniform priors.');
    }
  }

  /** Score a sequence of tokens */
  score(tokens) {
    if (!this.ready) return 0;
    let logProb = 0;
    for (let i = 2; i < tokens.length; i++) {
      const tri = `${tokens[i-2]}|${tokens[i-1]}|${tokens[i]}`;
      const cnt = this.ngrams.get(tri) ?? 1;
      logProb  += Math.log(cnt / 1e6);
    }
    return logProb;
  }
}
