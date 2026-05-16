/**
 * pyramid/pyramidConfig.js – sigma schedule for the Gaussian scale-space.
 */
export function buildSigmaSchedule(octaves, scalesPerOctave, initialSigma = 1.6) {
  const k = Math.pow(2, 1 / scalesPerOctave);
  const schedule = [];
  for (let o = 0; o < octaves; o++) {
    const row = [];
    for (let s = 0; s <= scalesPerOctave + 2; s++) {
      row.push(initialSigma * Math.pow(k, s) * Math.pow(2, o));
    }
    schedule.push(row);
  }
  return schedule;
}

export function sigmaForBlur(sigmaCurrent, sigmaPrev) {
  // Incremental blur sigma: sqrt(target² - prev²)
  const sq = sigmaCurrent * sigmaCurrent - sigmaPrev * sigmaPrev;
  return sq > 0 ? Math.sqrt(sq) : 0;
}
