import { dispatch2D } from '../../../core/dispatchUtils.js';

/**
 * Buffer-based JFA distance transform.
 * All intermediate data in storage buffers — no float textures, no format issues.
 * jfa_final writes directly to distBuf (array<f32>), eliminating the blit pass.
 */
export function encodeDistanceTransformPass(device, encoder, pipelines,
    binaryTex, seedXA, seedXB, seedYA, seedYB, distBuf, width, height) {

  const makeUni = (step=0) => {
    const buf = device.createBuffer({ size:16, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(buf, 0, new Uint32Array([width, height, step, 0]));
    return buf;
  };

  // Init: binaryTex (rgba8unorm, filterable) → seedXA, seedYA
  {
    const uni = makeUni();
    const bg = device.createBindGroup({
      layout: pipelines.init.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: binaryTex.createView() },
        { binding: 1, resource: { buffer: seedXA }     },
        { binding: 2, resource: { buffer: seedYA }     },
        { binding: 3, resource: { buffer: uni }         },
      ],
    });
    const p = encoder.beginComputePass({ label: 'jfa-init' });
    p.setPipeline(pipelines.init); p.setBindGroup(0, bg);
    p.dispatchWorkgroups(...dispatch2D(width, height)); p.end();
  }

  // JFA steps: ping-pong buffer pairs
  const numPasses = Math.ceil(Math.log2(Math.max(width, height)));
  let srcX=seedXA, srcY=seedYA, dstX=seedXB, dstY=seedYB;

  for (let i = numPasses; i >= 0; i--) {
    const step = Math.max(1, 1 << i);
    const uni  = makeUni(step);
    const bg = device.createBindGroup({
      layout: pipelines.step.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: srcX } },
        { binding: 1, resource: { buffer: srcY } },
        { binding: 2, resource: { buffer: dstX } },
        { binding: 3, resource: { buffer: dstY } },
        { binding: 4, resource: { buffer: uni }  },
      ],
    });
    const p = encoder.beginComputePass({ label: `jfa-step-${step}` });
    p.setPipeline(pipelines.step); p.setBindGroup(0, bg);
    p.dispatchWorkgroups(...dispatch2D(width, height)); p.end();
    [srcX, dstX] = [dstX, srcX]; [srcY, dstY] = [dstY, srcY];
  }

  // Final: seedX/Y → distBuf (array<f32>, no r32float texture needed)
  {
    const uni = makeUni();
    const bg = device.createBindGroup({
      layout: pipelines.final.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: srcX }   },
        { binding: 1, resource: { buffer: srcY }   },
        { binding: 2, resource: { buffer: distBuf }},
        { binding: 3, resource: { buffer: uni }     },
      ],
    });
    const p = encoder.beginComputePass({ label: 'jfa-final' });
    p.setPipeline(pipelines.final); p.setBindGroup(0, bg);
    p.dispatchWorkgroups(...dispatch2D(width, height)); p.end();
  }
}
