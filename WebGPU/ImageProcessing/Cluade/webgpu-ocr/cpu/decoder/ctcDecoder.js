
// CTC greedy decoder (CPU fallback)

/**
 * @param {Int32Array} tokens  - sequence of token indices
 * @param {number}     blank   - blank token index
 * @returns {number[]} collapsed sequence
 */
export function ctcGreedyDecode(tokens, blank = 0) {
  const out = [];
  let prev = -1;
  for (const t of tokens) {
    if (t === blank || t === prev) { prev = t; continue; }
    out.push(t);
    prev = t;
  }
  return out;
}

/** Convert token indices to string using charset */
export function tokensToString(tokens, charset) {
  return tokens.map(t => charset[t] ?? '?').join('');
}
