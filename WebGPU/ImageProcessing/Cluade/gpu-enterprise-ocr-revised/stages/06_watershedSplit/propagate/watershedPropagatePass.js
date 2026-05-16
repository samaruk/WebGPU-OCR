
import { dispatch2D } from '../../../core/dispatchUtils.js';
export function encodeWatershedPropagatePass(device,encoder,pipeline,lblA,lblB,binaryTex,width,height){
  const uni=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(uni,0,new Uint32Array([width,height,0,0]));
  const bg=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
    {binding:0,resource:{buffer:lblA}},
    {binding:1,resource:{buffer:lblB}},
    {binding:2,resource:binaryTex.createView()},
    {binding:3,resource:{buffer:uni}},
  ]});
  const p=encoder.beginComputePass({label:'watershedPropagatePass'});
  p.setPipeline(pipeline);p.setBindGroup(0,bg);
  p.dispatchWorkgroups(...dispatch2D(width,height));p.end();
}
