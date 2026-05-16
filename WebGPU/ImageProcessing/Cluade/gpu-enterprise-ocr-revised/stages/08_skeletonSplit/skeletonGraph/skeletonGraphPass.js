
import { dispatch2D } from '../../../core/dispatchUtils.js';
export function encodeSkeletonGraphPass(device,encoder,pipeline,skelBuf,outputTex,width,height){
  const uni=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(uni,0,new Uint32Array([width,height,0,0]));
  const bg=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
    {binding:0,resource:{buffer:skelBuf}},
    {binding:1,resource:outputTex.createView()},
    {binding:2,resource:{buffer:uni}},
  ]});
  const p=encoder.beginComputePass({label:'skelGraphPass'});
  p.setPipeline(pipeline);p.setBindGroup(0,bg);
  p.dispatchWorkgroups(...dispatch2D(width,height));p.end();
}
