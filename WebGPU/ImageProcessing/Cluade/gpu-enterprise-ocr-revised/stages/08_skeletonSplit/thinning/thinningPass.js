
import { dispatch2D } from '../../../core/dispatchUtils.js';
export function encodeThinningPass(device,encoder,pipeline,bufA,bufB,changedBuf,width,height,sub){
  const uni=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(uni,0,new Uint32Array([width,height,sub,0]));
  const bg=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
    {binding:0,resource:{buffer:bufA}},
    {binding:1,resource:{buffer:bufB}},
    {binding:2,resource:{buffer:changedBuf}},
    {binding:3,resource:{buffer:uni}},
  ]});
  const p=encoder.beginComputePass({label:`thinPass${sub}`});
  p.setPipeline(pipeline);p.setBindGroup(0,bg);
  p.dispatchWorkgroups(...dispatch2D(width,height));p.end();
}
