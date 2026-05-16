/**
 * pipeline/stage4-reduce.js
 * Stage 4 — Parallel Max Reduction cascade.
 *
 * Finds the pixel with the maximum distance value (= circle center) using
 * a multi-level GPU reduction.  Each reduction level collapses 256 values
 * into 1 using shared-memory tree reduction inside each workgroup.
 *
 * Cascade layout (for W×H = 400×400 = 160 000 px):
 *   Level 1:  distBuf (160 000 f32|f16)   →  r1Buf (625 vec2u)
 *   Level 2:  r1Buf   (625 vec2u)         →  r2Buf (3 vec2u)
 *   [Level 3 only needed if r2Count > 256, i.e. TOTAL > ~16 M pixels]
 *
 * Each vec2u element carries:
 *   .x = bitcast<u32>(maxDistance)   — sortable because dist ≥ 0
 *   .y = pixelIndex                  — to recover (cx, cy) later
 *
 * @param {GPUComputePassEncoder} cp
 * @param {GPUComputePipeline}    pDistReduce  — first-level pipeline (reads f32|f16)
 * @param {GPUComputePipeline}    pReduce      — generic pipeline (reads vec2u)
 * @param {GPUDevice}             device
 * @param {ReduceBuffers}         bufs         — { distBuf, r1Buf, r2Buf, r3Buf|null }
 * @param {ReduceUniforms}        unis         — { uR1, uR2, uR3|null }
 * @param {ReduceCounts}          counts       — { r1Count, r2Count, r3Count, needR3 }
 * @param {number}                TOTAL        — W * H
 * @param {boolean}               fp16
 */
import { log } from '../ui/log.js';

export function stage4Reduce(
  cp,
  pDistReduce,
  pReduce,
  device,
  { distBuf, r1Buf, r2Buf, r3Buf },
  { uR1, uR2, uR3 },
  { r1Count, r2Count, r3Count, needR3 },
  TOTAL,
  fp16,
) {
  // ── Level 1: dist (f32|f16 per px) → r1 (vec2u per 256 px) ──────────
  cp.setPipeline(pDistReduce);
  cp.setBindGroup(0, device.createBindGroup({
    label  : 'reduce-L1',
    layout : pDistReduce.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: distBuf } },
      { binding: 1, resource: { buffer: r1Buf   } },
      { binding: 2, resource: { buffer: uR1     } },
    ],
  }));
  cp.dispatchWorkgroups(r1Count);

  // ── Level 2: r1 → r2 ─────────────────────────────────────────────────
  cp.setPipeline(pReduce);
  cp.setBindGroup(0, device.createBindGroup({
    label  : 'reduce-L2',
    layout : pReduce.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: r1Buf } },
      { binding: 1, resource: { buffer: r2Buf } },
      { binding: 2, resource: { buffer: uR2   } },
    ],
  }));
  cp.dispatchWorkgroups(Math.max(1, r2Count));

  // ── Level 3 (only for very large images > ~16 Mpx) ───────────────────
  if (needR3) {
    cp.setBindGroup(0, device.createBindGroup({
      label  : 'reduce-L3',
      layout : pReduce.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: r2Buf } },
        { binding: 1, resource: { buffer: r3Buf } },
        { binding: 2, resource: { buffer: uR3   } },
      ],
    }));
    cp.dispatchWorkgroups(Math.max(1, r3Count));
  }

  log(
    `[4] MaxReduce  ${TOTAL.toLocaleString()}px → r1(${r1Count}) → r2(${r2Count})` +
    (needR3 ? ` → r3(${r3Count})` : ''),
    'info',
  );
}

/**
 * Compute cascade counts for the given pixel total.
 * @param {number} TOTAL — W * H
 * @returns {{ r1Count, r2Count, r3Count, needR3 }}
 */
export function reduceCounts(TOTAL) {
  const r1Count = Math.ceil(TOTAL   / 256);
  const r2Count = Math.ceil(r1Count / 256);
  const r3Count = Math.ceil(r2Count / 256);
  const needR3  = r2Count > 256;
  return { r1Count, r2Count, r3Count, needR3 };
}

/**
 * Return the buffer that holds the final (smallest) reduction output.
 * @param {{ r2Buf, r3Buf }}  bufs
 * @param {boolean}           needR3
 * @returns {GPUBuffer}
 */
export function finalReduceBuffer({ r2Buf, r3Buf }, needR3) {
  return needR3 ? r3Buf : r2Buf;
}
