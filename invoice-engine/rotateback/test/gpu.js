/**
 * GPU orchestration tests.
 *
 * Runs stages 01-12 against the validating mock device. This does not compute
 * pixels - it checks the things that actually break: bind groups matching the
 * shaders' reachable bindings, storage/uniform usage flags, read/write
 * aliasing, dispatch coverage of the working resolution, buffer sizes against
 * device limits, and that the pipeline really does perform exactly one
 * full-resolution readback.
 *
 * Shader *semantics* are validated separately by compiling every kernel with
 * naga (see tools/validate-shaders.py).
 *
 *   node test/gpu.js
 */

import assert from 'node:assert/strict';
import { installMockWebGPU, fakeSource, reflect } from './mockgpu.js';

const { recorder } = installMockWebGPU();

// Imported after the mock is installed so module-level globals resolve.
const { GridliftGpu } = await import('../src/gridlift/pipeline.js');
const { Gridlift } = await import('../src/gridlift/index.js');
const shaderModules = await Promise.all([
  import('../src/gridlift/shaders/preprocess.js'),
  import('../src/gridlift/shaders/morphology.js'),
  import('../src/gridlift/shaders/cca.js'),
  import('../src/gridlift/shaders/projections.js'),
]);

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

const reset = () => {
  recorder.dispatches.length = 0;
  recorder.copies.length = 0;
  recorder.buffers.length = 0;
  recorder.writes.length = 0;
  recorder.uploads.length = 0;
  recorder.submits = 0;
};

/* ------------------------------------------------------------------ *
 * Static shader checks
 * ------------------------------------------------------------------ */

test('every shader declares exactly one @compute entry point', () => {
  for (const mod of shaderModules) {
    for (const [name, code] of Object.entries(mod)) {
      if (typeof code !== 'string' || !code.includes('@compute')) continue;
      const info = reflect(code);
      assert.equal(info.entries.length, 1, `${name}: ${info.entries.length} entry points`);
      assert.equal(info.entries[0], 'main', `${name}: entry is "${info.entries[0]}"`);
    }
  }
});

test('no shader declares a binding it never reaches from main', () => {
  const offenders = [];
  for (const mod of shaderModules) {
    for (const [name, code] of Object.entries(mod)) {
      if (typeof code !== 'string' || !code.includes('@compute')) continue;
      const info = reflect(code);
      const reachable = info.reachableFor('main');
      const dropped = info.decls.filter((d) => !reachable.some((r) => r.binding === d.binding));
      if (dropped.length) offenders.push(`${name}: [${dropped.map((d) => `${d.binding}:${d.name}`)}]`);
    }
  }
  assert.deepEqual(offenders, [], `unreachable bindings would be dropped by layout:'auto'`);
});

test('every shader binds the uniform params block at binding 0', () => {
  for (const mod of shaderModules) {
    for (const [name, code] of Object.entries(mod)) {
      if (typeof code !== 'string' || !code.includes('@compute')) continue;
      const info = reflect(code);
      const p = info.decls.find((d) => d.binding === 0);
      assert.ok(p, `${name}: no binding 0`);
      assert.equal(p.space, 'uniform', `${name}: binding 0 is ${p.space}`);
    }
  }
});

/* ------------------------------------------------------------------ *
 * Orchestration
 * ------------------------------------------------------------------ */

test('stages 01-12 run end to end and log 12 GPU stages', async () => {
  reset();
  const gpu = await GridliftGpu.create({ workingMaxDim: 512 });
  const raw = await gpu.runGpuStages(fakeSource(2048, 2896));
  assert.equal(raw.width, 362, `working width ${raw.width}`);
  assert.equal(raw.height, 512, `working height ${raw.height}`);
  assert.ok(raw.scale < 1, 'large page should be downscaled');
  const ids = raw.stages.map((s) => s.id);
  for (const stage of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    assert.ok(ids.includes(stage), `stage ${stage} missing from the log`);
  }
});

test('small pages are not upscaled', async () => {
  reset();
  const gpu = await GridliftGpu.create({ workingMaxDim: 1800 });
  const raw = await gpu.runGpuStages(fakeSource(800, 1000));
  assert.equal(raw.scale, 1);
  assert.equal(raw.width, 800);
  assert.equal(raw.height, 1000);
});

test('dispatch grids cover the working resolution for every 2D pass', async () => {
  reset();
  const gpu = await GridliftGpu.create({ workingMaxDim: 600 });
  const raw = await gpu.runGpuStages(fakeSource(1200, 900));
  const wg8 = { x: Math.ceil(raw.width / 8), y: Math.ceil(raw.height / 8) };
  const wg16 = { x: Math.ceil(raw.width / 16), y: Math.ceil(raw.height / 16) };
  const twoD = recorder.dispatches.filter((d) => d.y > 1);
  assert.ok(twoD.length > 20, `expected many 2D dispatches, got ${twoD.length}`);
  for (const d of twoD) {
    const ok =
      (d.x === wg8.x && d.y === wg8.y) ||
      (d.x === wg16.x && d.y === wg16.y);
    assert.ok(ok, `${d.label}: dispatch ${d.x}x${d.y} covers neither an 8x8 nor a 16x16 grid`);
  }
});

test('exactly one full-resolution buffer is read back', async () => {
  reset();
  const gpu = await GridliftGpu.create({ workingMaxDim: 640 });
  const raw = await gpu.runGpuStages(fakeSource(1280, 960));
  const fullRes = raw.width * raw.height * 4;
  const big = recorder.copies.filter((c) => c.size >= fullRes);
  assert.equal(big.length, 1, `expected 1 full-res readback, got ${big.length}: ${big.map((b) => b.src)}`);
  assert.equal(big[0].src, 'packedMasks');
  // Everything else that crosses the bus must be small.
  const others = recorder.copies.filter((c) => c !== big[0]);
  const otherBytes = others.reduce((s, c) => s + c.size, 0);
  assert.ok(otherBytes < fullRes * 0.3, `compacted readbacks total ${otherBytes} bytes`);
});

test('CCA runs the configured number of link/compress rounds', async () => {
  reset();
  const gpu = await GridliftGpu.create({ workingMaxDim: 256, cca: { iterations: 4 } });
  await gpu.runGpuStages(fakeSource(256, 256));
  const links = recorder.dispatches.filter((d) => d.label.startsWith('ccaLink'));
  const compress = recorder.dispatches.filter((d) => d.label.startsWith('ccaCompress'));
  assert.equal(links.length, 4);
  assert.equal(compress.length, 4);
});

test('buffer pool recycles rather than allocating per stage', async () => {
  reset();
  const gpu = await GridliftGpu.create({ workingMaxDim: 512 });
  await gpu.runGpuStages(fakeSource(1024, 1024));
  const firstRun = recorder.buffers.length;
  const before = gpu.pool.bytesAllocated;
  await gpu.runGpuStages(fakeSource(1024, 1024));
  assert.equal(gpu.pool.bytesAllocated, before, 'second run should allocate nothing new');
  assert.ok(recorder.buffers.length > firstRun - 1, 'sanity');
  // Storage buffers held simultaneously, not counting readback staging.
  const storage = recorder.buffers.filter((b) => b.usage & GPUBufferUsage.STORAGE);
  assert.ok(storage.length <= 20, `${storage.length} storage buffers allocated for one run`);
});

test('working resolution keeps every buffer inside the binding limit', async () => {
  reset();
  const gpu = await GridliftGpu.create({ workingMaxDim: 1800 });
  await gpu.runGpuStages(fakeSource(4000, 3000));
  const limit = gpu.ctx.limits.maxStorageBufferBindingSize;
  for (const b of recorder.buffers) {
    if (b.usage & GPUBufferUsage.STORAGE) {
      assert.ok(b.size <= limit, `${b.label} is ${b.size} bytes, limit ${limit}`);
    }
  }
});

test('the full Gridlift facade produces a geometry graph', async () => {
  reset();
  const g = await Gridlift.create({ workingMaxDim: 384 });
  const { geometry } = await g.analyse(fakeSource(768, 1024));
  assert.equal(geometry.version, 1);
  assert.equal(geometry.image.workingHeight, 384);
  assert.ok(Array.isArray(geometry.lines));
  assert.ok(Array.isArray(geometry.tables));
  assert.ok(geometry.timings.gpu.length >= 12);
  // A blank page has no table - and says so rather than inventing one.
  assert.equal(geometry.tables.length, 0);
  assert.ok(geometry.warnings.includes('no-table-band-found'));
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
