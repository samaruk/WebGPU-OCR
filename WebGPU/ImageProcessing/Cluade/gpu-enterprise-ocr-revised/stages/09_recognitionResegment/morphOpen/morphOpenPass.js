import { dispatch2D } from '../../../core/dispatchUtils.js';

// Noise suppression: removes isolated foreground pixels (dust/specks).
// A pixel is kept only if it has >= minNeighbours foreground pixels
// in its (2*radius+1)² neighbourhood.
//
// For text strokes:   typically 5-15+ neighbours → kept
// For isolated specks: 0-3 neighbours → removed
//
// No erosion/dilation needed – single pass, no text destruction.
export function encodeMorphOpenPass(device, encoder, pipeline,
    srcTex, _tmpTex, dstTex, width, height, radius=2, minNeighbours=4) {
  const uni = device.createBuffer({
    size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(uni, 0, new Uint32Array([width, height, radius, minNeighbours]));

  const bg = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
    { binding: 0, resource: srcTex.createView() },
    { binding: 1, resource: dstTex.createView() },
    { binding: 2, resource: { buffer: uni } },
  ]});
  const p = encoder.beginComputePass({ label: 'speck-suppress' });
  p.setPipeline(pipeline); p.setBindGroup(0, bg);
  p.dispatchWorkgroups(...dispatch2D(width, height)); p.end();
}
