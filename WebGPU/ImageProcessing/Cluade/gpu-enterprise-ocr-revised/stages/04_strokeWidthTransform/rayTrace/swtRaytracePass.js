import { dispatch2D } from '../../../core/dispatchUtils.js';

export function encodeSWTRaytracePass(device, encoder, pipelines,
    edgeTex, gradBuf, swtBuf, width, height, maxSW=40) {
  const N = width * height;

  // Pass 0: clear swtBuf to 0xFFFFFFFF so atomicMin can overwrite.
  // atomicMin(0, X)=0 always — zero-init makes no stroke ever visible.
  {
    const uni = device.createBuffer({ size:16, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(uni, 0, new Uint32Array([N, 0, 0, 0]));
    const bg = device.createBindGroup({ layout: pipelines.clear.getBindGroupLayout(0), entries: [
      { binding:0, resource:{ buffer: swtBuf } },
      { binding:1, resource:{ buffer: uni }    },
    ]});
    const p = encoder.beginComputePass({ label:'swt-clear' });
    p.setPipeline(pipelines.clear); p.setBindGroup(0,bg);
    p.dispatchWorkgroups(Math.ceil(N/256)); p.end();
  }

  // Pass 1: raytrace — atomicMin writes float stroke widths as bitcast<u32>
  {
    const uni = device.createBuffer({ size:16, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(uni, 0, new Uint32Array([width, height, maxSW, 0]));
    const bg = device.createBindGroup({ layout: pipelines.raytrace.getBindGroupLayout(0), entries: [
      { binding:0, resource: edgeTex.createView() },
      { binding:1, resource:{ buffer: gradBuf }   },
      { binding:2, resource:{ buffer: swtBuf }    },
      { binding:3, resource:{ buffer: uni }        },
    ]});
    const p = encoder.beginComputePass({ label:'swt-raytrace' });
    p.setPipeline(pipelines.raytrace); p.setBindGroup(0,bg);
    p.dispatchWorkgroups(...dispatch2D(width,height)); p.end();
  }
}
