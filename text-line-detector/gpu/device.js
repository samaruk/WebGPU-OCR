/**
 * gpu/device.js — WebGPU device init, BindGroupLayout registry, pipeline compilation.
 *
 * WHY CENTRALISED:
 *   gDev, gPipes, gBGLs are singletons used by every GPU module. ES-module live bindings
 *   mean all importers see the updated values after gpuInit() completes — no dependency
 *   injection needed.
 *
 * NEW PIPELINES (shaders/pca.js):
 *   projClear  — initialise i32 atomic min/max sentinels
 *   projAccum  — scatter pixel projections into per-component min/max accumulators
 *   obbBuild   — convert accumulators to final OBB float parameters
 *
 * NOTE ON projBuf BINDING TYPE:
 *   projBuf is declared as array<atomic<i32>> in projClear and projAccum, but as
 *   array<i32> (non-atomic) in obbBuild. Both WGSL declarations use
 *   var<storage, read_write> and map to the same WebGPU 'storage' binding type.
 *   The same GPUBuffer can be bound under both declarations in different passes. ✓
 */

import { SHADER_GRAY, SHADER_SAT, SHADER_SAUVOLA } from '../shaders/binarize.js';
import { SHADER_DILATE, SHADER_ZS }                from '../shaders/morphology.js';
import { SHADER_CCA_INIT, SHADER_CCA_MERGE, SHADER_CCA_COMPRESS } from '../shaders/cca.js';
import { SHADER_STATS_CLEAR, SHADER_STATS_ACCUM }  from '../shaders/stats.js';
import { SHADER_RENDER }                            from '../shaders/render.js';
import { SHADER_PROJ_CLEAR, SHADER_PROJ_ACCUM, SHADER_OBB_BUILD } from '../shaders/pca.js';

export let gDev   = null;
export let gPipes = null;
export let gBGLs  = null;

export async function gpuInit() {
  if (!navigator.gpu) throw new Error('WebGPU not supported.');
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('No WebGPU adapter found.');
  gDev = await adapter.requestDevice();

  const ro = b => ({ binding:b, visibility:GPUShaderStage.COMPUTE, buffer:{type:'read-only-storage'} });
  const rw = b => ({ binding:b, visibility:GPUShaderStage.COMPUTE, buffer:{type:'storage'} });
  const un = b => ({ binding:b, visibility:GPUShaderStage.COMPUTE, buffer:{type:'uniform'} });
  const mkBGL = (...es) => gDev.createBindGroupLayout({ entries: es });

  gBGLs = {
    // ── Existing stages ─────────────────────────────────────────────────────
    gray:       mkBGL(ro(0), rw(1), rw(2), un(3)),
    sat:        mkBGL(ro(0), rw(1), un(2)),
    sauvola:    mkBGL(ro(0), ro(1), ro(2), rw(3), un(4)),
    dilate:     mkBGL(ro(0), rw(1), un(2)),
    zs:         mkBGL(ro(0), rw(1), un(2)),
    ccaInit:    mkBGL(rw(0), ro(1), un(2)),
    ccaOp:      mkBGL(rw(0), un(1)),
    statsClear: mkBGL(rw(0), un(1)),
    statsAccum: mkBGL(ro(0), rw(1), un(2)),
    render:     mkBGL(ro(0), ro(1), rw(2), un(3)),

    // ── NEW: GPU OBB projection pipeline ────────────────────────────────────
    // projClear: 1-D pass — clear K×4 i32 atomic slots
    projClear:  mkBGL(rw(0), un(1)),

    // projAccum: 2-D pass — per-pixel projection scatter into atomicMin/Max
    //   bindings: label(ro), cent(ro), axis(ro), proj(rw atomic i32), uniform
    projAccum:  mkBGL(ro(0), ro(1), ro(2), rw(3), un(4)),

    // obbBuild: 1-D pass — one thread per component, reads proj as plain i32
    //   bindings: cent(ro), axis(ro), proj(rw non-atomic i32), obb(rw f32), uniform
    //   WHY proj is rw (not ro) here: the WGSL declaration uses var<storage, read_write>
    //   for proj because the same BGL is shared with proj_accum. Binding it as 'storage'
    //   rather than 'read-only-storage' avoids creating a second BGL for this buffer.
    obbBuild:   mkBGL(ro(0), ro(1), rw(2), rw(3), un(4)),
  };

  const mkPipe = (code, bgl) => {
    const mod = gDev.createShaderModule({ code });
    return gDev.createComputePipeline({
      layout: gDev.createPipelineLayout({ bindGroupLayouts: [bgl] }),
      compute: { module: mod, entryPoint: 'main' },
    });
  };

  gPipes = {
    gray:        mkPipe(SHADER_GRAY,         gBGLs.gray),
    sat:         mkPipe(SHADER_SAT,          gBGLs.sat),
    sauvola:     mkPipe(SHADER_SAUVOLA,      gBGLs.sauvola),
    dilate:      mkPipe(SHADER_DILATE,       gBGLs.dilate),
    zs:          mkPipe(SHADER_ZS,           gBGLs.zs),
    ccaInit:     mkPipe(SHADER_CCA_INIT,     gBGLs.ccaInit),
    ccaMerge:    mkPipe(SHADER_CCA_MERGE,    gBGLs.ccaOp),
    ccaCompress: mkPipe(SHADER_CCA_COMPRESS, gBGLs.ccaOp),
    statsClear:  mkPipe(SHADER_STATS_CLEAR,  gBGLs.statsClear),
    statsAccum:  mkPipe(SHADER_STATS_ACCUM,  gBGLs.statsAccum),
    render:      mkPipe(SHADER_RENDER,       gBGLs.render),
    // NEW
    projClear:   mkPipe(SHADER_PROJ_CLEAR,   gBGLs.projClear),
    projAccum:   mkPipe(SHADER_PROJ_ACCUM,   gBGLs.projAccum),
    obbBuild:    mkPipe(SHADER_OBB_BUILD,    gBGLs.obbBuild),
  };
}
