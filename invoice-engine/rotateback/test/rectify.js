/**
 * Rectification tests.
 *
 * A known homography is applied to a synthetic page's components, the estimator
 * is asked to recover the page plane from those components alone, and the check
 * is whether the correction actually straightens the page:
 *
 *   - text lines end up parallel     (angle spread -> 0)
 *   - text lines end up horizontal   (mean |angle| -> 0)
 *   - row pitch becomes uniform      (the perspective signature)
 *
 * Comparing the recovered matrix to the ground truth directly would be the
 * wrong test: rectification is only defined up to a similarity, so two very
 * different-looking matrices can be equally correct.
 *
 *   node test/rectify.js
 */

import assert from 'node:assert/strict';
import { borderedInvoice, borderlessInvoice } from './synthetic.js';
import {
  M, V, fitLine, symmetricEigen, estimateVanishingPoint, neighbourAngleSkew,
  estimateOrientation, polarityScore, estimateRectification, needsRectification,
  quarterTurnMatrix, horizontalFamily,
} from '../src/gridlift/rectify/index.js';
import { clusterLines } from '../src/gridlift/geometry.js';

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const DEG = 180 / Math.PI;

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

/** Ground-truth distortion: quarter turn, then keystone, then a small rotation. */
function makeDistortion({ turns = 0, keystoneX = 0, keystoneY = 0, rotateDeg = 0, width, height }) {
  const Q = quarterTurnMatrix(turns, width, height);
  const w = turns % 2 ? height : width;
  const h = turns % 2 ? width : height;
  const cx = w / 2, cy = h / 2;
  const K = Float64Array.from([1, 0, 0, 0, 1, 0, keystoneX / w, keystoneY / h, 1]);
  const centred = M.mul(M.translate(cx, cy), M.mul(K, M.translate(-cx, -cy)));
  const R = M.mul(M.translate(cx, cy), M.mul(M.rotate((rotateDeg * Math.PI) / 180), M.translate(-cx, -cy)));
  return M.mul(R, M.mul(centred, Q));
}

/** Project component boxes and re-derive axis-aligned boxes, as CCA would. */
function distortComponents(components, H) {
  const out = components.map((c) => {
    const pts = [[c.x, c.y], [c.x1 + 1, c.y], [c.x1 + 1, c.y1 + 1], [c.x, c.y1 + 1]]
      .map((p) => M.apply(H, p[0], p[1]));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    return { ...c, x, y, w, h, x1: x + w - 1, y1: y + h - 1, cx: x + w / 2, cy: y + h / 2 };
  });
  const minX = Math.min(...out.map((c) => c.x));
  const minY = Math.min(...out.map((c) => c.y));
  const shifted = out.map((c) => ({
    ...c,
    x: c.x - minX, y: c.y - minY,
    x1: c.x1 - minX, y1: c.y1 - minY,
    cx: c.cx - minX, cy: c.cy - minY,
  }));
  return {
    components: shifted,
    width: Math.ceil(Math.max(...shifted.map((c) => c.x1))) + 8,
    height: Math.ceil(Math.max(...shifted.map((c) => c.y1))) + 8,
    shift: M.translate(-minX, -minY),
  };
}

const fakeRaw = (components, width, height) => ({
  width, height, scale: 1,
  sourceWidth: width, sourceHeight: height,
  imageWidth: width, imageHeight: height,
  components,
  packed: new Uint32Array(0),
  angleHistogram: new Uint32Array(180),
});

/** Angles and pitch regularity of the text lines a component set implies. */
function lineStats(components) {
  const lines = clusterLines(components).filter((L) => L.items.length >= 6);
  const angles = [];
  const centres = [];
  for (const L of lines) {
    const f = fitLine(L.items.map((c) => [c.cx, c.cy]));
    if (!f) continue;
    let a = Math.atan2(f.dir[1], f.dir[0]) * DEG;
    if (a > 90) a -= 180;
    if (a < -90) a += 180;
    angles.push(a);
    centres.push(L.cy);
  }
  const mean = angles.reduce((s, v) => s + v, 0) / Math.max(1, angles.length);
  const spread = Math.sqrt(
    angles.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, angles.length),
  );
  // Keystone shows up as row pitch *drifting* down the page, not as pitch
  // variance - the fixture's own paragraph gaps dominate the variance and say
  // nothing about perspective. Comparing the median pitch of the top half with
  // the bottom half isolates the drift.
  centres.sort((a, b) => a - b);
  const pitches = [];
  for (let i = 1; i < centres.length; i++) {
    const d = centres[i] - centres[i - 1];
    if (d > 4) pitches.push({ d, y: (centres[i] + centres[i - 1]) / 2 });
  }
  const med = (a) => {
    if (!a.length) return 0;
    const s2 = [...a].sort((x, y) => x - y);
    return s2[s2.length >> 1];
  };
  const mid = centres.length ? (centres[0] + centres[centres.length - 1]) / 2 : 0;
  const top = med(pitches.filter((p) => p.y < mid).map((p) => p.d));
  const bot = med(pitches.filter((p) => p.y >= mid).map((p) => p.d));
  const pitchDrift = top > 0 && bot > 0 ? Math.abs(Math.log(bot / top)) : 0;
  return { lines: angles.length, meanAngle: mean, angleSpread: spread, pitchDrift };
}

/** Apply an estimate to a component set so it can be re-measured. */
const applyEstimate = (components, est) =>
  components.map((c) => {
    const pts = [[c.x, c.y], [c.x1, c.y], [c.x1, c.y1], [c.x, c.y1]]
      .map((p) => M.apply(est.H, p[0], p[1]));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    return { ...c, x, y, w, h, x1: x + w, y1: y + h, cx: x + w / 2, cy: y + h / 2 };
  });

/* ------------------------------------------------------------------ *
 * linear algebra
 * ------------------------------------------------------------------ */

test('matrix inverse round-trips a point', () => {
  const H = makeDistortion({ turns: 1, keystoneX: 0.22, rotateDeg: 3.5, width: 900, height: 1180 });
  const Hi = M.inverse(H);
  const [x, y] = M.apply(H, 321, 654);
  const [bx, by] = M.apply(Hi, x, y);
  assert.ok(Math.abs(bx - 321) < 1e-6, `x round-trip ${bx}`);
  assert.ok(Math.abs(by - 654) < 1e-6, `y round-trip ${by}`);
});

test('symmetric eigensolver finds the null direction', () => {
  // Three lines through (5, 7): their common point is the null space.
  const p = [5, 7, 1];
  const lines = [[1, 0, -5], [0, 1, -7], [1, 1, -12]].map(V.unitLine);
  const S = new Float64Array(9);
  for (const l of lines) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r * 3 + c] += l[r] * l[c];
  const v = symmetricEigen(S)[0].vector;
  const e = V.euclid(v);
  assert.ok(Math.abs(e[0] - p[0]) < 1e-6 && Math.abs(e[1] - p[1]) < 1e-6, `got ${e}`);
});

test('vanishing point recovers where converging lines meet', () => {
  const vpx = 4200, vpy = 300;
  const fits = [];
  for (let y = 100; y <= 900; y += 80) {
    const dir = [vpx - 100, vpy - y];
    const n = Math.hypot(dir[0], dir[1]);
    fits.push({
      mid: [500, y + ((500 - 100) * (vpy - y)) / (vpx - 100)],
      dir: [dir[0] / n, dir[1] / n],
      weight: 1,
    });
  }
  const vp = estimateVanishingPoint(fits, { norm: null });
  assert.ok(vp, 'no vanishing point');
  assert.ok(Math.abs(vp.euclidean[0] - vpx) < 40, `x ${vp.euclidean[0]}`);
  assert.ok(Math.abs(vp.euclidean[1] - vpy) < 40, `y ${vp.euclidean[1]}`);
});

/* ------------------------------------------------------------------ *
 * skew and orientation
 * ------------------------------------------------------------------ */

test('nearest-neighbour histogram measures skew without clustering lines', () => {
  const page = borderedInvoice();
  for (const trueDeg of [-6, -2.4, 0, 1.7, 5]) {
    const H = makeDistortion({ rotateDeg: trueDeg, width: page.width, height: page.height });
    const { components } = distortComponents(page.components, H);
    const est = neighbourAngleSkew(components.filter((c) => c.isText));
    assert.ok(
      Math.abs(est.deg - trueDeg) < 0.35,
      `skew ${trueDeg} measured as ${est.deg} (samples ${est.samples})`,
    );
  }
});

test('skew estimate survives perspective, where a global angle would smear', () => {
  const page = borderedInvoice();
  const H = makeDistortion({ rotateDeg: 3, keystoneX: 0.3, width: page.width, height: page.height });
  const { components } = distortComponents(page.components, H);
  const est = neighbourAngleSkew(components.filter((c) => c.isText));
  assert.ok(est.samples > 200, `only ${est.samples} neighbour samples`);
  assert.ok(Math.abs(est.deg) < 12, `implausible skew ${est.deg}`);
});

test('orientation detects a sideways page from glyph statistics alone', () => {
  const page = borderedInvoice();
  const upright = estimateOrientation(page.components, { width: page.width, height: page.height });
  assert.equal(upright.quarterTurns, 0, JSON.stringify(upright.evidence));
  assert.ok(upright.confidence > 0.3, `weak upright confidence ${upright.confidence}`);

  const H = quarterTurnMatrix(1, page.width, page.height);
  const { components, width, height } = distortComponents(page.components, H);
  const sideways = estimateOrientation(components, { width, height });
  assert.equal(sideways.quarterTurns, 1, JSON.stringify(sideways.evidence));
  assert.ok(sideways.confidence > 0.3, `weak sideways confidence ${sideways.confidence}`);
  assert.deepEqual(sideways.ambiguous, [1, 3], 'the 180-degree twin must be reported as unresolved');
});

test('polarity prefers upright over upside down', () => {
  const page = borderedInvoice();
  const up = polarityScore(clusterLines(page.components));
  const H = quarterTurnMatrix(2, page.width, page.height);
  const { components } = distortComponents(page.components, H);
  const down = polarityScore(clusterLines(components));
  assert.ok(up.score > down.score, `upright ${up.score} vs flipped ${down.score}`);
});

/* ------------------------------------------------------------------ *
 * full rectification
 * ------------------------------------------------------------------ */

function rectifyCase(name, distortion, expect = {}) {
  test(name, () => {
    const page = borderedInvoice();
    const H = makeDistortion({ ...distortion, width: page.width, height: page.height });
    const { components, width, height } = distortComponents(page.components, H);

    const before = lineStats(components);
    const est = estimateRectification(fakeRaw(components, width, height), components, {}, {
      maxDim: Math.max(width, height),
    });
    assert.ok(est.ok, `estimation failed: ${est.reason}`);

    const after = lineStats(applyEstimate(components, est));
    assert.ok(after.lines >= 8, `only ${after.lines} lines survived`);
    assert.ok(
      Math.abs(after.meanAngle) < 0.6,
      `lines not horizontal: ${after.meanAngle.toFixed(3)} deg (was ${before.meanAngle.toFixed(3)})`,
    );
    assert.ok(
      after.angleSpread < 0.5,
      `lines not parallel: spread ${after.angleSpread.toFixed(3)} deg (was ${before.angleSpread.toFixed(3)})`,
    );
    if (expect.quarterTurns !== undefined) {
      assert.equal(est.quarterTurns, expect.quarterTurns);
    }
    if (expect.pitchImproves) {
      assert.ok(
        after.pitchDrift < before.pitchDrift * 0.5,
        `row pitch drift not removed: ${after.pitchDrift.toFixed(4)} vs ${before.pitchDrift.toFixed(4)}`,
      );
    }
  });
}

rectifyCase('rectifies pure skew', { rotateDeg: 4.2 }, { quarterTurns: 0 });
rectifyCase('rectifies a sideways page', { turns: 1 }, { quarterTurns: 1 });
rectifyCase('rectifies keystone (horizontal vanishing point)', { keystoneX: 0.28 }, { pitchImproves: false });
rectifyCase('rectifies keystone (vertical vanishing point)', { keystoneY: 0.22 }, { pitchImproves: true });
rectifyCase('rectifies sideways + skew + keystone together', {
  turns: 1, rotateDeg: 3.1, keystoneX: 0.18, keystoneY: 0.14,
}, { quarterTurns: 1, pitchImproves: true });

test('a clean page is left alone', () => {
  const page = borderedInvoice();
  const est = estimateRectification(
    fakeRaw(page.components, page.width, page.height), page.components, {},
    { maxDim: Math.max(page.width, page.height) },
  );
  assert.ok(est.ok);
  assert.equal(est.quarterTurns, 0);
  assert.ok(Math.abs(est.skewDeg) < 0.3, `phantom skew ${est.skewDeg}`);
  assert.equal(needsRectification(est), false, `would needlessly warp: ${JSON.stringify(est.quality)}`);
});

test('borderless pages rectify from text alone', () => {
  const page = borderlessInvoice();
  const H = makeDistortion({ rotateDeg: 2.5, keystoneY: 0.18, width: page.width, height: page.height });
  const { components, width, height } = distortComponents(page.components, H);
  const est = estimateRectification(fakeRaw(components, width, height), components, {}, {
    maxDim: Math.max(width, height),
  });
  assert.ok(est.ok);
  const after = lineStats(applyEstimate(components, est));
  assert.ok(Math.abs(after.meanAngle) < 0.6, `mean angle ${after.meanAngle}`);
  assert.ok(after.angleSpread < 0.5, `spread ${after.angleSpread}`);
});

test('detected rules join the line families when present', () => {
  const page = borderedInvoice();
  const H = makeDistortion({ rotateDeg: 2, keystoneX: 0.2, width: page.width, height: page.height });
  const { components, width, height } = distortComponents(page.components, H);
  const hSegs = [];
  for (let y = 200; y < 900; y += 90) {
    const a = M.apply(H, 60, y), b = M.apply(H, 860, y);
    hSegs.push({
      x0: a[0], y: a[1], x1: b[0], length: Math.hypot(b[0] - a[0], b[1] - a[1]),
      tableness: 0.8, decorative: false,
    });
  }
  const est = estimateRectification(fakeRaw(components, width, height), components, { hSegs }, {
    maxDim: Math.max(width, height),
  });
  assert.ok(est.ok);
  assert.ok(
    est.diagnostics.horizontalFits > lineStats(components).lines,
    'rule fits should add to the horizontal family',
  );
});

test('the estimate reports which evidence it used', () => {
  const page = borderedInvoice();
  const H = makeDistortion({ rotateDeg: 2.2, keystoneX: 0.24, keystoneY: 0.2, width: page.width, height: page.height });
  const { components, width, height } = distortComponents(page.components, H);
  const est = estimateRectification(fakeRaw(components, width, height), components, {}, {
    maxDim: Math.max(width, height),
  });
  assert.ok(est.diagnostics.horizontalFits > 5, 'no horizontal fits');
  assert.ok(est.diagnostics.verticalFits > 2, 'no vertical fits');
  assert.ok(est.quality.lineAngleSpreadAfter < est.quality.lineAngleSpreadBefore,
    'quality report should show the improvement it made');
  assert.ok(typeof est.method === 'string' && est.method.length > 0);
});

/* ------------------------------------------------------------------ */

let passed = 0, failed = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${String(e.message).split('\n').join('\n        ')}`);
  }
}
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
