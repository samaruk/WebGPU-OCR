/**
 * render/obb.js — GPU-parallel OBB rendering onto the processed image.
 *
 * WHY A DEDICATED RENDER MODULE:
 *   OBB rendering is a self-contained GPU operation with its own buffer lifecycle:
 *   it consumes rgbaBuf (from gpu/pipeline.js) and produces outBuf (destroyed internally).
 *   Isolating it avoids cluttering the main pipeline with render-specific buffer management
 *   and makes it easy to swap rendering strategies (e.g. Canvas 2D fallback) without
 *   touching the detection logic.
 *
 * WHY GPU RENDERING INSTEAD OF CANVAS 2D:
 *   Canvas 2D rotate+fillRect is serialised on the main thread. For 30 lines, each OBB
 *   spanning ~50 000 px², that is ~1.5 M pixel evaluations done sequentially. The GPU
 *   shader (shaders/render.js) evaluates every pixel simultaneously, fully parallelised
 *   across the GPU's thousands of shader units.
 *
 * RENDER RESOLUTION:
 *   Output is at processed image resolution (procW × procH), which may be smaller than
 *   the original image if the 128 MB cap triggered downscaling. The caller (main.js)
 *   draws the Canvas 2D polyline overlay at the same resolution on top of the GPU output,
 *   then presents the combined canvas at its natural size (CSS scaling handles display).
 */

import { gDev, gBGLs, gPipes }           from '../gpu/device.js';
import { mkStorBuf, uU32, uniTemps }       from '../gpu/helpers.js';
import { dispatch, copyBuf, readbackU32 } from '../gpu/dispatch.js';
import { PALETTE_RGB, OBB_STRIDE }         from '../config.js';

/**
 * gpuRenderOBB — Draw all OBBs onto the source image in parallel on the GPU.
 *
 * @param {GPUBuffer} rgbaBuf — packed RGBA u32 source image (from runGPU); caller destroys it.
 * @param {number}    W, H    — image dimensions at processing resolution
 * @param {object[]}  lines   — line objects from runCPU (obb field must be populated)
 * @returns {Promise<Uint32Array>} — rendered RGBA packed u32 array (W×H elements)
 *
 * BUFFER LIFECYCLE:
 *   obbBuf — created here, destroyed here (after dispatch completes)
 *   outBuf — created here, destroyed here (after readback)
 *   rgbaBuf — caller-owned; this function reads but does not destroy it
 */
export async function gpuRenderOBB(rgbaBuf, W, H, lines) {
  const outBuf = mkStorBuf(W * H * 4);

  if (lines.length === 0) {
    // No boxes to draw: copy the source image unchanged to the output buffer.
    copyBuf(rgbaBuf, outBuf, W * H * 4);
    await gDev.queue.onSubmittedWorkDone();
  } else {
    // Build the flat OBB float array consumed by SHADER_RENDER.
    // WHY flat Float32Array (not an array of structs):
    //   WebGPU WGSL struct arrays have implicit alignment padding that varies between
    //   implementations. A plain array<f32> with a manually maintained stride (OBB_STRIDE)
    //   is portable across all conformant WebGPU implementations.
    const nc      = lines.length;
    const obbData = new Float32Array(nc * OBB_STRIDE);
    lines.forEach(({ obb }, idx) => {
      const base = idx * OBB_STRIDE;
      const rgb  = PALETTE_RGB[idx % PALETTE_RGB.length];
      obbData[base+0] = obb.cx; obbData[base+1] = obb.cy;
      obbData[base+2] = obb.vx; obbData[base+3] = obb.vy;
      obbData[base+4] = obb.hw; obbData[base+5] = obb.hh;
      obbData[base+6] = rgb[0]; obbData[base+7] = rgb[1]; obbData[base+8] = rgb[2];
      // obbData[base+9] = 0 (padding, already zeroed by Float32Array constructor)
    });

    const obbBuf = gDev.createBuffer({
      size: Math.max(16, obbData.byteLength),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    gDev.queue.writeBuffer(obbBuf, 0, obbData);

    dispatch(gPipes.render, gBGLs.render, [rgbaBuf, obbBuf, outBuf, uU32(W, H, nc, 0)], W, H);
    await gDev.queue.onSubmittedWorkDone();
    obbBuf.destroy();
  }

  const pixels = await readbackU32(outBuf, W * H);
  outBuf.destroy();
  uniTemps.splice(0).forEach(b => b.destroy());
  return pixels;
}
