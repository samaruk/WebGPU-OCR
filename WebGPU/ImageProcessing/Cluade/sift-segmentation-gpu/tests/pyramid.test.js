/**
 * tests/pyramid.test.js – unit tests for Gaussian pyramid construction.
 * Run with: node --experimental-vm-modules node_modules/.bin/jest tests/pyramid.test.js
 */
import { buildSigmaSchedule, sigmaForBlur } from '../pyramid/pyramidConfig.js';

describe('buildSigmaSchedule', () => {
  test('returns correct number of octaves and scales', () => {
    const schedule = buildSigmaSchedule(4, 3, 1.6);
    expect(schedule).toHaveLength(4);
    expect(schedule[0]).toHaveLength(3 + 3); // scalesPerOctave + 3
  });

  test('sigmas increase monotonically within each octave', () => {
    const schedule = buildSigmaSchedule(3, 3, 1.6);
    for (const row of schedule) {
      for (let i = 1; i < row.length; i++) {
        expect(row[i]).toBeGreaterThan(row[i - 1]);
      }
    }
  });
});

describe('sigmaForBlur', () => {
  test('returns 0 when target equals previous', () => {
    expect(sigmaForBlur(2, 2)).toBe(0);
  });

  test('returns correct incremental sigma', () => {
    const result = sigmaForBlur(Math.SQRT2, 1);
    expect(result).toBeCloseTo(1, 5);
  });
});
