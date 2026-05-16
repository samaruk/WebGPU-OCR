// core/dispatch.js — low-level pass helpers
export const ceilDiv = (n,d) => Math.ceil(n/d);

export function computePass(enc, label, pipeline, bindGroups, x, y=1, z=1) {
  const p = enc.beginComputePass({label});
  p.setPipeline(pipeline);
  (Array.isArray(bindGroups)?bindGroups:[bindGroups])
    .forEach((bg,i)=>p.setBindGroup(i,bg));
  p.dispatchWorkgroups(x,y,z);
  p.end();
}

/** Blit a r32float storage buffer to an rgba8 texture for canvas display. */
export function blitBufferToCanvas(device, queue, src, W, H, canvas) {
  canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext('2d');
  // Async readback
  const n=W*H*4;
  const stage=device.createBuffer({size:n,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  // We'll write a CPU-side RGBA conversion
  const enc=device.createCommandEncoder();
  enc.copyBufferToBuffer(src,0,stage,0,W*H*4);
  queue.submit([enc.finish()]);
  stage.mapAsync(GPUMapMode.READ).then(()=>{
    const f32=new Float32Array(stage.getMappedRange());
    const rgba=new Uint8ClampedArray(W*H*4);
    for(let i=0;i<W*H;i++){
      const v=Math.min(1,Math.max(0,f32[i]));
      rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=v*255|0;
      rgba[i*4+3]=255;
    }
    stage.unmap(); stage.destroy();
    ctx.putImageData(new ImageData(rgba,W,H),0,0);
  });
}

export function blitLabelBufferToCanvas(device, queue, src, W, H, canvas) {
  canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext('2d');
  const stage=device.createBuffer({size:W*H*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  const enc=device.createCommandEncoder();
  enc.copyBufferToBuffer(src,0,stage,0,W*H*4);
  queue.submit([enc.finish()]);
  stage.mapAsync(GPUMapMode.READ).then(()=>{
    const u32=new Uint32Array(stage.getMappedRange());
    const rgba=new Uint8ClampedArray(W*H*4);
    for(let i=0;i<W*H;i++){
      const l=u32[i];
      if(l===0){rgba[i*4+3]=255;continue;}
      rgba[i*4  ]=((l*7 )&0xFF);
      rgba[i*4+1]=((l*13)&0xFF);
      rgba[i*4+2]=((l*31)&0xFF);
      rgba[i*4+3]=255;
    }
    stage.unmap(); stage.destroy();
    ctx.putImageData(new ImageData(rgba,W,H),0,0);
  });
}
