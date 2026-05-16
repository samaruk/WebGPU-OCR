
import { Dictionary } from './dictionary.js';

export class SpellCorrector {
  constructor() { this.dict = new Dictionary(); }

  async init(dictUrl) { await this.dict.load(dictUrl); }

  /** Correct a recognized string token by token */
  correct(text) {
    return text.split(' ').map(w => {
      if (this.dict.has(w)) return w;
      return this.dict.nearest(w) ?? w;
    }).join(' ');
  }
}
