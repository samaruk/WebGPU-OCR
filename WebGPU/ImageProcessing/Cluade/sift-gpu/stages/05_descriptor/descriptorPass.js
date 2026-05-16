// descriptorPass.js
import { getPipeline, makeBindGroup } from "../../core/pipelineFactory.js";
import { CONFIG } from "../../config.js";

let _src = null;
async function loadShader() {
  if (_src) return;
  _src = await fetch(new URL("./descriptor.wgsl", import.meta.url).href).then(r=>r.text());
}

export async function descriptorPass(device, bufMgr, octaveIdx, kpCount, baseOffset=0) {
  if (kpCount === 0) return;
  await loadShader();
  const pipeline = getPipeline(device, _src, "main", "descriptor");
  const gaussArr = bufMgr.gaussTextures[octaveIdx];
  const midLevel = Math.floor(gaussArr.length / 2);
  const kpBuf = bufMgr.keypointBufs[octaveIdx];
  const kpCountBuf = bufMgr.keypointCountBufs[octaveIdx];
  const descBuf = bufMgr.descriptorBuf;

  const pd = new ArrayBuffer(16);
  const pu32 = new Uint32Array(pd); const pf32 = new Float32Array(pd);
  pf32[0]=CONFIG.descriptorMagFactor; pf32[1]=CONFIG.descriptorMaxVal;
  pu32[2]=CONFIG.rootSIFT?1:0; pu32[3]=0;
  const paramsBuf = device.createBuffer({size:16, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(paramsBuf, 0, pd);

  const bg = makeBindGroup(device, pipeline, 0, [
    {buffer:paramsBuf},
    {textureView:gaussArr[midLevel].createView()},
    {buffer:kpBuf},
    {buffer:kpCountBuf},
    {buffer:descBuf, offset:baseOffset*128*4},
  ]);
  const enc = device.createCommandEncoder({label:"desc-o"+octaveIdx});
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(kpCount);
  pass.end();
  device.queue.submit([enc.finish()]);
  paramsBuf.destroy();
}
