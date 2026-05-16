
// Simple dictionary for OCR post-correction

export class Dictionary {
  constructor() { this.words = new Set(); }

  async load(url) {
    try {
      const text = await (await fetch(url)).text();
      for (const w of text.split('\n')) this.words.add(w.trim().toLowerCase());
    } catch (_) {
      console.warn('[Dictionary] Could not load word list.');
    }
  }

  has(word) { return this.words.has(word.toLowerCase()); }

  /** Levenshtein distance */
  static editDistance(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m+1 }, (_, i) => Array.from({ length: n+1 }, (_, j) => i || j));
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
                 : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
  }

  /** Find closest word within maxDist edits */
  nearest(word, maxDist = 2) {
    let best = word, bestD = Infinity;
    for (const w of this.words) {
      const d = Dictionary.editDistance(word.toLowerCase(), w);
      if (d < bestD) { bestD = d; best = w; }
      if (bestD === 0) break;
    }
    return bestD <= maxDist ? best : word;
  }
}
