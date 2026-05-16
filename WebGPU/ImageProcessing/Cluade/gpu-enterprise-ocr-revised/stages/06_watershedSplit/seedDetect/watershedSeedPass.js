import { dispatch2D } from '../../../core/dispatchUtils.js';
export function encodeWatershedSeedPass(device, encoder, pipeline,
    distBuf, seedsBuf, width, height, minDist=0.5) {
  const uni = device.createBuffer({ size:16, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST });
  // Store minDist as fixed-point ×10 in u.z so shader can recover with *0.1
  device.queue.writeBuffer(uni, 0, new Uint32Array([width, height, Math.round(minDist*10), 0]));
  const bg = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
    { binding:0, resource:{ buffer: distBuf  } },
    { binding:1, resource:{ buffer: seedsBuf } },
    { binding:2, resource:{ buffer: uni }      },
  ]});
  const p = encoder.beginComputePass({ label:'watershedSeedPass' });
  p.setPipeline(pipeline); p.setBindGroup(0, bg);
  p.dispatchWorkgroups(...dispatch2D(width, height)); p.end();
}
