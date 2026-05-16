
export function encodeProjectionHPass(device,encoder,pipeline,binaryTex,projBuf,width,height){
  const uni=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(uni,0,new Uint32Array([width,height,0,0]));
  const bg=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
    {binding:0,resource:binaryTex.createView()},
    {binding:1,resource:{buffer:projBuf}},
    {binding:2,resource:{buffer:uni}},
  ]});
  const p=encoder.beginComputePass({label:'projHPass'});
  p.setPipeline(pipeline);p.setBindGroup(0,bg);
  p.dispatchWorkgroups(1,Math.ceil(height/256));p.end();
}
