/**
 * clustering/descriptorSimilarity.js – L2 distance + NNDR matching between two descriptor sets.
 */
export class DescriptorSimilarity {
  /**
   * Nearest-neighbour ratio matching.
   * @param {object[]} setA – keypoints with .descriptor
   * @param {object[]} setB
   * @param {number}   ratio – Lowe ratio threshold (default 0.75)
   * @returns {{ a: number, b: number, distance: number }[]}
   */
  static match(setA, setB, ratio = 0.75) {
    const matches = [];
    for (let i = 0; i < setA.length; i++) {
      const da = setA[i].descriptor;
      if (!da) continue;
      let d1 = Infinity, d2 = Infinity, best = -1;
      for (let j = 0; j < setB.length; j++) {
        const db = setB[j].descriptor;
        if (!db) continue;
        const d = l2sq(da, db);
        if (d < d1) { d2 = d1; d1 = d; best = j; }
        else if (d < d2) { d2 = d; }
      }
      if (d1 / (d2 + 1e-10) < ratio * ratio) {
        matches.push({ a: i, b: best, distance: Math.sqrt(d1) });
      }
    }
    return matches;
  }

  /** Cosine similarity between two descriptors. */
  static cosine(da, db) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < da.length; i++) { dot += da[i] * db[i]; na += da[i] * da[i]; nb += db[i] * db[i]; }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
  }
}

function l2sq(a, b) { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i]-b[i]; s += d*d; } return s; }
