// dogPass.js
import { getPipeline, makeBindGroup } from "../../core/pipelineFactory.js";
import { dispatch2D } from "../../core/dispatch.js";

let _src = null;
async function loadShader() {
  if (_src) return;
  _src = await fetch(new URL("./dog.wgsl", import.meta.url).href).then(r => r.text());
}

export async function buildDogOctave(device, bufMgr, octaveIdx) {
  await loadShader();
  const gaussArr = bufMgr.gaussTextures[octaveIdx];
  const dogArr   = bufMgr.dogTextures[octaveIdx];
  const {width, height} = bufMgr.layout[octaveIdx];
  const pd = new Uint32Array([width, height, 0, 0]);
  const paramsBuf = device.createBuffer({size: pd.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST});
  device.queue.writeBuffer(paramsBuf, 0, pd);
  const pipeline = getPipeline(device, _src, "main", "dog");
  const enc = device.createCommandEncoder({label: "dog-o"+octaveIdx});
  const pass = enc.beginComputePass({label: "dog"});
  for (let d = 0; d < dogArr.length; d++) {
    const bg = makeBindGroup(device, pipeline, 0, [
      {buffer: paramsBuf},
      {textureView: gaussArr[d].createView()},
      {textureView: gaussArr[d+1].createView()},
      {textureView: dogArr[d].createView()},
    ]);
    dispatch2D(pass, pipeline, [bg], width, height);
  }
  pass.end();
  device.queue.submit([enc.finish()]);
  paramsBuf.destroy();
}
