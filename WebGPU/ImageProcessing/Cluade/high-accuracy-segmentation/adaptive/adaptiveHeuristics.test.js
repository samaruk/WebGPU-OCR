/**
 * adaptive/adaptiveHeuristics.test.js
 * Unit tests for every formula in adaptiveHeuristics.
 * Run with: node --experimental-vm-modules adaptiveHeuristics.test.js
 */
import { adaptiveHeuristics as AH } from "./adaptiveHeuristics.js";
import assert from "assert";

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}: ${e.message}`); failed++; }
}

// sauvolaWindowFromDPI
test("sauvolaWindowFromDPI(150) returns odd number", () => {
  const w = AH.sauvolaWindowFromDPI(150);
  assert.strictEqual(w % 2, 1, "Window must be odd");
});
test("sauvolaWindowFromDPI(72) >= SAUVOLA_WINDOW_MIN", () => {
  assert.ok(AH.sauvolaWindowFromDPI(72) >= 11);
});
test("sauvolaWindowFromDPI(1200) <= SAUVOLA_WINDOW_MAX", () => {
  assert.ok(AH.sauvolaWindowFromDPI(1200) <= 127);
});

// sauvolaWindowFromStroke
test("sauvolaWindowFromStroke(8) returns odd number", () => {
  const w = AH.sauvolaWindowFromStroke(8);
  assert.strictEqual(w % 2, 1, "Window must be odd");
});

// hValue
test("hValue(8) is within bounds", () => {
  const h = AH.hValue(8);
  assert.ok(h >= 1.0 && h <= 20.0, `h=${h} out of bounds`);
});
test("hValue(8) = 0.30 * 8 = 2.4", () => {
  assert.ok(Math.abs(AH.hValue(8) - 2.4) < 0.01);
});

// hMinimaFactor
test("hMinimaFactor(0) returns base factor", () => {
  assert.ok(Math.abs(AH.hMinimaFactor(0) - 0.3) < 0.001);
});
test("hMinimaFactor(0.15) > hMinimaFactor(0)", () => {
  assert.ok(AH.hMinimaFactor(0.15) > AH.hMinimaFactor(0));
});

// bilateralSigmaSpace
test("bilateralSigmaSpace scales with noise", () => {
  assert.ok(AH.bilateralSigmaSpace(0.1) > AH.bilateralSigmaSpace(0.0));
});

// claheClipLimit
test("claheClipLimit in [1, 8]", () => {
  const c = AH.claheClipLimit(0.5, 0.1);
  assert.ok(c >= 1 && c <= 8);
});

// houghThreshold
test("houghThreshold(150) = Config base", () => {
  assert.strictEqual(AH.houghThreshold(150), 80);
});
test("houghThreshold(300) > houghThreshold(150)", () => {
  assert.ok(AH.houghThreshold(300) > AH.houghThreshold(150));
});

// normalizedDistance
test("normalizedDistance(16, 8) = 2.0", () => {
  assert.ok(Math.abs(AH.normalizedDistance(16, 8) - 2.0) < 0.001);
});
test("normalizedDistance guards zero stroke width", () => {
  assert.ok(isFinite(AH.normalizedDistance(10, 0)));
});

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
