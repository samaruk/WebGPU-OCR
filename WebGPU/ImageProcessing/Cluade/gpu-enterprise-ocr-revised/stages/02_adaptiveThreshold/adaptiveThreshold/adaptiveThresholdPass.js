import { dispatch2D } from '../../../core/dispatchUtils.js';

export function encodeAdaptiveThresholdPass(device, encoder, pipeline,
    grayTex, integralBuf, outputTex, width, height, blockRadius=15, C=0.05) {
  const uInt = device.createBuffer({ size:16, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uInt, 0, new Uint32Array([width, height, blockRadius, 0]));
  const uFloat = device.createBuffer({ size:16, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uFloat, 0, new Float32Array([C, 0, 0, 0]));

  const bg = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: grayTex.createView()     },
      { binding: 1, resource: { buffer: integralBuf }  },
      { binding: 2, resource: outputTex.createView()   },
      { binding: 3, resource: { buffer: uInt }          },
      { binding: 4, resource: { buffer: uFloat }        },
    ],
  });
  const p = encoder.beginComputePass({ label: 'adaptiveThresholdPass' });
  p.setPipeline(pipeline);
  p.setBindGroup(0, bg);
  p.dispatchWorkgroups(...dispatch2D(width, height));
  p.end();
}
