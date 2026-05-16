// gaussianPass.js
import { getPipeline, makeBindGroup } from "../../core/pipelineFactory.js";
import { dispatch2D } from "../../core/dispatch.js";
import { gaussianKernel1D } from "../../config.js";

let _hSrc = null, _vSrc = null;

async function loadShaders() {
  if (_hSrc) return;
  const base = new URL("./", import.meta.url).href;
  _hSrc = await fetch(base + "gaussianHorizontal.wgsl").then(r => r.text());
  _vSrc = await fetch(base + "gaussianVertical.wgsl").then(r => r.text());
}

export async function gaussianBlurPass(device, encoder, inputTex, tmpTex, outputTex, sigma) {
  await loadShaders();
  const width = inputTex.width, height = inputTex.height;
  const kernel = gaussianKernel1D(sigma);
  const r = (kernel.length - 1) / 2;

  const kernelBuf = device.createBuffer({ size: kernel.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(kernelBuf, 0, kernel);
  const pd = new Uint32Array([width, height, r, 0]);
  const paramsBuf = device.createBuffer({ size: pd.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(paramsBuf, 0, pd);

  const hP = getPipeline(device, _hSrc, "main", "gaussian-h");
  const vP = getPipeline(device, _vSrc, "main", "gaussian-v");
  const hBG = makeBindGroup(device, hP, 0, [
    {buffer: paramsBuf}, {buffer: kernelBuf},
    {textureView: inputTex.createView()}, {textureView: tmpTex.createView()}
  ]);
  const vBG = makeBindGroup(device, vP, 0, [
    {buffer: paramsBuf}, {buffer: kernelBuf},
    {textureView: tmpTex.createView()}, {textureView: outputTex.createView()}
  ]);
  const pass = encoder.beginComputePass({label: "gaussian"});
  dispatch2D(pass, hP, [hBG], width, height);
  dispatch2D(pass, vP, [vBG], width, height);
  pass.end();
  kernelBuf.destroy();
  paramsBuf.destroy();
}

export async function buildGaussianOctave(device, bufMgr, octaveIdx, incrementalSigmas, seedTex) {
  const gaussArr = bufMgr.gaussTextures[octaveIdx];
  const tmpTex = bufMgr.tmpTextures[octaveIdx];
  const {width, height} = bufMgr.layout[octaveIdx];
  const enc0 = device.createCommandEncoder();
  enc0.copyTextureToTexture({texture: seedTex}, {texture: gaussArr[0]}, {width, height, depthOrArrayLayers: 1});
  device.queue.submit([enc0.finish()]);
  for (let s = 1; s < gaussArr.length; s++) {
    const enc = device.createCommandEncoder({label: "gauss-o" + octaveIdx + "-s" + s});
    await gaussianBlurPass(device, enc, gaussArr[s-1], tmpTex, gaussArr[s], incrementalSigmas[s]);
    device.queue.submit([enc.finish()]);
  }
}
