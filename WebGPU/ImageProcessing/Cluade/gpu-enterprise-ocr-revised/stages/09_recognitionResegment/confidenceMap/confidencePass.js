
import { dispatch2D } from '../../../core/dispatchUtils.js';
export function encodeConfidencePass(device,encoder,pipeline,swtTex,binaryTex,outputTex,width,height,threshold=0.35){
  const uni=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(uni,0,new Uint32Array([width,height,0,0]));
  const unif=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(unif,0,new Float32Array([threshold,0,0,0]));
  const bg=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
    {binding:0,resource:swtTex.createView()},
    {binding:1,resource:binaryTex.createView()},
    {binding:2,resource:outputTex.createView()},
    {binding:3,resource:{buffer:uni}},
    {binding:4,resource:{buffer:unif}},
  ]});
  const p=encoder.beginComputePass({label:'confPass'});
  p.setPipeline(pipeline);p.setBindGroup(0,bg);
  p.dispatchWorkgroups(...dispatch2D(width,height));p.end();
}
