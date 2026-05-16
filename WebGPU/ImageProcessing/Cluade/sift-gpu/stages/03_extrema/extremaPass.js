// extremaPass.js
import { getPipeline, makeBindGroup } from "../../core/pipelineFactory.js";
import { dispatch2D, dispatch1D } from "../../core/dispatch.js";
import { CONFIG, buildSigmaTable } from "../../config.js";

let _detectSrc = null, _refineSrc = null;
async function loadShaders() {
  if (_detectSrc) return;
  const base = new URL("./", import.meta.url).href;
  _detectSrc = await fetch(base+"extremaDetect.wgsl").then(r=>r.text());
  _refineSrc = await fetch(base+"subpixelRefine.wgsl").then(r=>r.text());
}

export async function extremaPass(device, bufMgr, octaveIdx) {
  await loadShaders();
  const oct = bufMgr.layout[octaveIdx];
  const dogArr = bufMgr.dogTextures[octaveIdx];
  const kpBuf = bufMgr.keypointBufs[octaveIdx];
  const kpCountBuf = bufMgr.keypointCountBufs[octaveIdx];
  const S = CONFIG.scalesPerOctave;

  // Zero counter
  const ze = device.createCommandEncoder();
  ze.clearBuffer(kpCountBuf, 0, 4);
  device.queue.submit([ze.finish()]);

  const detectPipeline = getPipeline(device, _detectSrc, "main", "extrema-detect");
  const refinePipeline = getPipeline(device, _refineSrc, "main", "extrema-refine");

  for (let s = 1; s <= S; s++) {
    const buf = new ArrayBuffer(32);
    const u32 = new Uint32Array(buf);
    const f32 = new Float32Array(buf);
    u32[0]=oct.width; u32[1]=oct.height; u32[2]=oct.octave; u32[3]=s;
    u32[4]=S; u32[5]=0; f32[6]=CONFIG.contrastThreshold; f32[7]=CONFIG.edgeThreshold;
    const pb = device.createBuffer({size:32, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
    device.queue.writeBuffer(pb, 0, buf);
    const bg = makeBindGroup(device, detectPipeline, 0, [
      {buffer:pb},
      {textureView:dogArr[s-1].createView()},
      {textureView:dogArr[s].createView()},
      {textureView:dogArr[s+1].createView()},
      {buffer:kpBuf},
      {buffer:kpCountBuf},
    ]);
    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    dispatch2D(pass, detectPipeline, [bg], oct.width, oct.height);
    pass.end();
    device.queue.submit([enc.finish()]);
    pb.destroy();
  }

  await device.queue.onSubmittedWorkDone();
  const stg = device.createBuffer({size:4, usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
  const ce = device.createCommandEncoder();
  ce.copyBufferToBuffer(kpCountBuf, 0, stg, 0, 4);
  device.queue.submit([ce.finish()]);
  await stg.mapAsync(GPUMapMode.READ);
  const count = new Uint32Array(stg.getMappedRange())[0];
  stg.unmap(); stg.destroy();
  if (count === 0) return 0;

  const rb = new ArrayBuffer(32);
  const ru32 = new Uint32Array(rb); const rf32 = new Float32Array(rb);
  ru32[0]=oct.width; ru32[1]=oct.height; ru32[2]=S; ru32[3]=5;
  rf32[4]=CONFIG.contrastThreshold; rf32[5]=CONFIG.edgeThreshold;
  const rPb = device.createBuffer({size:32, usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(rPb, 0, rb);
  const cntBuf = device.createBuffer({size:4, usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(cntBuf, 0, new Uint32Array([count]));

  const nDog = dogArr.length;
  const rBG = makeBindGroup(device, refinePipeline, 0, [
    {buffer:rPb},
    {textureView:dogArr[0].createView()},
    {textureView:dogArr[Math.min(1,nDog-1)].createView()},
    {textureView:dogArr[Math.min(2,nDog-1)].createView()},
    {textureView:dogArr[Math.min(3,nDog-1)].createView()},
    {textureView:dogArr[Math.min(4,nDog-1)].createView()},
    {textureView:dogArr[Math.min(5,nDog-1)].createView()},
    {textureView:dogArr[Math.min(6,nDog-1)].createView()},
    {buffer:kpBuf},
    {buffer:cntBuf},
  ]);
  const re = device.createCommandEncoder();
  const rp = re.beginComputePass();
  dispatch1D(rp, refinePipeline, [rBG], count, 64);
  rp.end();
  device.queue.submit([re.finish()]);
  rPb.destroy(); cntBuf.destroy();
  return count;
}
