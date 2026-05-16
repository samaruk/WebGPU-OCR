
export function encodeCCLFlattenPass(device,encoder,pipeline,labelsBuffer,pixelCount){
  const uni=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(uni,0,new Uint32Array([pixelCount,0,0,0]));
  const bg=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
    {binding:0,resource:{buffer:labelsBuffer}},
    {binding:1,resource:{buffer:uni}},
  ]});
  const p=encoder.beginComputePass({label:'cclFlattenPass'});
  p.setPipeline(pipeline);p.setBindGroup(0,bg);
  p.dispatchWorkgroups(Math.ceil(pixelCount/256));p.end();
}
