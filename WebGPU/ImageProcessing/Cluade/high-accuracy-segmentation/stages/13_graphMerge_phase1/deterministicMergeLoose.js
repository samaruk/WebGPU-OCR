/**
 * stages/13_graphMerge_phase1/deterministicMergeLoose.js
 *
 * Phase 1 deterministic merge — loose thresholds.
 *
 * Goal: consolidate noise fragments and broken-stroke splinters produced by
 * the watershed so that the Stage-14 Split Detector only has to reason about
 * plausible character-sized components.
 *
 * Merge criterion (both must hold):
 *   1. Normalised gap  <  mergeLooseGapFactor  (default 1.5 × meanStrokeWidth)
 *   2. Centre-to-centre angle  <  mergeAngleLooseDeg  (default 35°)
 *
 * All threshold values come from params (built by adaptiveParams.js /
 * adaptiveHeuristics.js) — no pixel-absolute constants here.
 *
 * The GPU shader (adjacencyGraph.wgsl) is used to build the raw adjacency
 * distances; the union-find merge and label remap run on the CPU because the
 * component count after CCA is typically small enough (< 10 000) that the
 * CPU round-trip cost is negligible compared to a full GPU sort.
 */

import { loadShader }          from '../../core/loadShader.js';
import { PipelineBuilder }     from '../../core/pipelineBuilder.js';
import { adaptiveHeuristics }  from '../../adaptive/adaptiveHeuristics.js';

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * @param {GPUContext}       gpuCtx
 * @param {object}           ccaResult      - { labelTex, componentCount }
 * @param {StrokeWidthStore} sws
 * @param {object}           params         - adaptive parameter object
 * @param {ResourceRegistry} registry
 * @returns {Promise<{ labelTex: GPUTexture, componentCount: number, mergeMap: Uint32Array }>}
 */
export async function runDeterministicMergeLoose(gpuCtx, ccaResult, sws, params, registry) {
    const { labelTex, componentCount } = ccaResult;
    if (componentCount < 2) return ccaResult;

    const { device } = gpuCtx;
    const W   = labelTex.width;
    const H   = labelTex.height;
    const msw = sws.get(8);

    // ── 1. GPU adjacency pass ─────────────────────────────────────────────────
    const maxGapPx    = params.mergeLooseGapFactor * msw;          // pixel search radius
    const MAX_LABELS  = Math.min(componentCount + 1, 4096);        // cap to keep buffer sane
    const listSize    = MAX_LABELS * MAX_LABELS;                    // pairs

    const adjBuf = device.createBuffer({
        label : 'adj_loose',
        size  : listSize * 4,
        usage : GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    // Initialise all distances to 0xFFFFFFFF (= "no adjacency found")
    device.queue.writeBuffer(adjBuf, 0, new Uint32Array(listSize).fill(0xFFFFFFFF));

    const WGSL     = await loadShader('./adjacencyGraph.wgsl');
    const builder  = new PipelineBuilder(device);
    const pipeline = await builder.build('adj_loose', WGSL);

    const uniformData = new Uint32Array([W, H, 0, MAX_LABELS]);
    // pack max_gap as f32 into slot [2]
    new Float32Array(uniformData.buffer)[2] = maxGapPx;

    const uBuf = device.createBuffer({
        size  : uniformData.byteLength,
        usage : GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uBuf, 0, uniformData);

    const bindGroup = builder.buildBindGroup(pipeline, [
        labelTex.createView(),
        { buffer: adjBuf },
        { buffer: uBuf  },
    ]);

    const enc = device.createCommandEncoder({ label: 'adj_loose_enc' });
    const pass = enc.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(W / 8), Math.ceil(H / 8));
    pass.end();
    device.queue.submit([enc.finish()]);
    await device.queue.onSubmittedWorkDone();

    // ── 2. Read adjacency buffer back to CPU ──────────────────────────────────
    const stagingBuf = device.createBuffer({
        size  : listSize * 4,
        usage : GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const copyEnc = device.createCommandEncoder();
    copyEnc.copyBufferToBuffer(adjBuf, 0, stagingBuf, 0, listSize * 4);
    device.queue.submit([copyEnc.finish()]);
    await stagingBuf.mapAsync(GPUMapMode.READ);
    const adjData = new Uint32Array(stagingBuf.getMappedRange().slice(0));
    stagingBuf.unmap();
    stagingBuf.destroy();
    adjBuf.destroy();
    uBuf.destroy();

    // ── 3. Read label texture to get bounding boxes ───────────────────────────
    const imgData = await gpuCtx.downloadToImageData(labelTex);
    const labels  = new Uint32Array(W * H);
    for (let i = 0; i < W * H; i++) labels[i] = imgData.data[i * 4];

    const boxes = buildBoundingBoxes(labels, W, H);

    // ── 4. Union-Find merge over adjacent pairs ───────────────────────────────
    const mergeMap = new Uint32Array(componentCount + 1);
    for (let i = 0; i <= componentCount; i++) mergeMap[i] = i;

    for (let lo = 0; lo < MAX_LABELS - 1; lo++) {
        for (let hi = lo + 1; hi < MAX_LABELS; hi++) {
            const dist = adjData[lo * MAX_LABELS + hi];
            if (dist === 0xFFFFFFFF) continue;                   // not adjacent

            const a = lo + 1;   // label IDs are 1-based
            const b = hi + 1;

            // Normalised gap check
            const normGap = adaptiveHeuristics.normalizedDistance(dist, msw);
            if (normGap >= params.mergeLooseGapFactor) continue;

            // Angle check
            if (boxes[a] && boxes[b]) {
                const angle = centreAngleDeg(boxes[a], boxes[b]);
                if (angle >= params.mergeAngleLooseDeg) continue;
            }

            union(mergeMap, a, b);
        }
    }

    // ── 5. Remap labels and upload result texture ─────────────────────────────
    const remapped  = remapLabels(labels, mergeMap);
    const newTex    = await uploadLabels(gpuCtx, remapped, W, H);
    const newCount  = new Set(remapped.filter(v => v > 0)).size;

    return { labelTex: newTex, componentCount: newCount, mergeMap };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildBoundingBoxes(labels, W, H) {
    const boxes = [];
    for (let i = 0; i < labels.length; i++) {
        const id = labels[i];
        if (!id) continue;
        const x = i % W, y = Math.floor(i / W);
        if (!boxes[id]) {
            boxes[id] = { x1: x, y1: y, x2: x, y2: y };
        } else {
            if (x < boxes[id].x1) boxes[id].x1 = x;
            if (y < boxes[id].y1) boxes[id].y1 = y;
            if (x > boxes[id].x2) boxes[id].x2 = x;
            if (y > boxes[id].y2) boxes[id].y2 = y;
        }
    }
    return boxes;
}

function centreAngleDeg(a, b) {
    const cx1 = (a.x1 + a.x2) / 2, cy1 = (a.y1 + a.y2) / 2;
    const cx2 = (b.x1 + b.x2) / 2, cy2 = (b.y1 + b.y2) / 2;
    return Math.abs(Math.atan2(cy2 - cy1, cx2 - cx1) * 180 / Math.PI);
}

/** Path-compressed union-find */
function find(map, x) {
    while (map[x] !== x) { map[x] = map[map[x]]; x = map[x]; }
    return x;
}
function union(map, a, b) {
    const ra = find(map, a), rb = find(map, b);
    if (ra !== rb) map[ra] = rb;
}

function remapLabels(labels, map) {
    return labels.map(id => (id > 0 ? find(map, id) : 0));
}

async function uploadLabels(gpuCtx, labels, W, H) {
    const rgba = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < labels.length; i++) {
        rgba[i * 4]     =  labels[i]        & 0xFF;
        rgba[i * 4 + 1] = (labels[i] >>  8) & 0xFF;
        rgba[i * 4 + 2] = (labels[i] >> 16) & 0xFF;
        rgba[i * 4 + 3] = 255;
    }
    return gpuCtx.uploadImageData(new ImageData(rgba, W, H));
}
