// core/barrierUtils.js
// In WebGPU, ending a compute pass implicitly inserts a full storage barrier.
export function insertBarrier(encoder,label='barrier'){ void encoder; void label; }
export function runDispatches(encoder,dispatches){
  for(const d of dispatches){
    const pass=encoder.beginComputePass({label:d.label??''});
    pass.setPipeline(d.pipeline);
    if(Array.isArray(d.bindGroups)){ d.bindGroups.forEach((bg,i)=>pass.setBindGroup(i,bg)); }
    else pass.setBindGroup(0,d.bindGroup);
    pass.dispatchWorkgroups(d.x??1,d.y??1,d.z??1);
    pass.end();
  }
}
export const ceilDiv=(n,d)=>Math.ceil(n/d);
