// orientationPass.js
import { getPipeline, makeBindGroup } from "../../core/pipelineFactory.js";
import { CONFIG } from "../../config.js";

let _src = null;
async function loadShader() {
  if (_src) return;
  _src = await fetch(new URL("./orientation.wgsl", import.meta.url).href).then(r=>r.text());
}

export async function orientationPass(device, bufMgr, octaveIdx, kpCount) {
  if (kpCount === 0) return 0;
  await loadShader();
  const pipeline = getPipeline(device, _src, "main", "orientation");
  const gaussArr = bufMgr.gaussTextures[octaveIdx];
  const kpBuf = bufMgr.keypointBufs[octaveIdx];
  const kpCountBuf = bufMgr.keypointCountBufs[octaveIdx];
  const midLevel = Math.floor(gaussArr.length / 2);

  const outCountBuf = device.createBuffer({size:4, usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});

  const pd = new ArrayBuffer(32);
  const pu32 = new Uint32Array(pd); const pf32 = new Float32Array(pd);
  pu32[0]=CONFIG.scalesPerOctave; pu32[1]=CONFIG.maxKeypointsPerOctave;
  pf32[2]=CONFIG.orientationPeakRatio; pf32[3]=CONFIG.orientationSigmaFactor;
  const paramsBuf = device.createBuffer({size:32, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(paramsBuf, 0, pd);

  const bg = makeBindGroup(device, pipeline, 0, [
    {buffer:paramsBuf},
    {textureView:gaussArr[midLevel].createView()},
    {buffer:kpBuf},
    {buffer:kpCountBuf},
    {buffer:outCountBuf},
  ]);
  const enc = device.createCommandEncoder({label:"orient-o"+octaveIdx});
  const pass = enc.beginComputePass();
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bg);
  pass.dispatchWorkgroups(kpCount);
  pass.end();
  device.queue.submit([enc.finish()]);

  const stg = device.createBuffer({size:4, usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
  const enc2 = device.createCommandEncoder();
  enc2.copyBufferToBuffer(outCountBuf, 0, stg, 0, 4);
  device.queue.submit([enc2.finish()]);
  await stg.mapAsync(GPUMapMode.READ);
  const newCount = new Uint32Array(stg.getMappedRange())[0];
  stg.unmap(); stg.destroy(); outCountBuf.destroy(); paramsBuf.destroy();
  return newCount;
}
