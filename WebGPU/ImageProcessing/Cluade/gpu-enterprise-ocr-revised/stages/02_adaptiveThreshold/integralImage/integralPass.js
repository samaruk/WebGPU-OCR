// Two-pass 2D integral image using storage BUFFERS (not textures).
// Avoids the r32float texture_2d<f32> unfilterable-float mismatch.

export function encodeIntegralPass(device, encoder, pipelines,
                                   inputTex, rowBuf, colBuf, width, height) {
  const makeUni = () => {
    const buf = device.createBuffer({
      size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buf, 0, new Uint32Array([width, height, 0, 0]));
    return buf;
  };

  // Pass 1: rgba8unorm texture → rowBuf  (texture_2d<f32> on rgba8unorm = valid)
  {
    const uni = makeUni();
    const bg = device.createBindGroup({
      layout: pipelines.row.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inputTex.createView() },
        { binding: 1, resource: { buffer: rowBuf }    },
        { binding: 2, resource: { buffer: uni }        },
      ],
    });
    const p = encoder.beginComputePass({ label: 'integral-row' });
    p.setPipeline(pipelines.row);
    p.setBindGroup(0, bg);
    p.dispatchWorkgroups(1, Math.ceil(height / 256));
    p.end();
  }

  // Pass 2: rowBuf → colBuf  (buffer-to-buffer, no texture involved)
  {
    const uni = makeUni();
    const bg = device.createBindGroup({
      layout: pipelines.col.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: rowBuf } },
        { binding: 1, resource: { buffer: colBuf } },
        { binding: 2, resource: { buffer: uni }    },
      ],
    });
    const p = encoder.beginComputePass({ label: 'integral-col' });
    p.setPipeline(pipelines.col);
    p.setBindGroup(0, bg);
    p.dispatchWorkgroups(Math.ceil(width / 256), 1);
    p.end();
  }
}
