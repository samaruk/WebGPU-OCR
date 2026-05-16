/**
 * preprocessing/gammaCorrection.js – per-pixel pow(v, 1/gamma) on r8unorm.
 */
export const GAMMA_WGSL = /* wgsl */`
struct Uniforms { gamma : f32 }
@group(0) @binding(0) var<uniform> u   : Uniforms;
@group(0) @binding(1) var inputTex  : texture_2d<f32>;
@group(0) @binding(2) var outputTex : texture_storage_2d<r8unorm, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let dims = textureDimensions(inputTex);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let v   = textureLoad(inputTex, vec2<i32>(gid.xy), 0).r;
  let out = pow(v, 1.0 / u.gamma);
  textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(out, 0.0, 0.0, 1.0));
}
`;

import { dispatchSize2D } from '../core/dispatch.js';

export class GammaCorrectionPass {
  #ctx;
  constructor(ctx) { this.#ctx = ctx; }

  async run(inputTex, width, height, gamma = 1.0) {
    const { device, pipelineFactory, textureManager, bufferManager } = this.#ctx;
    if (Math.abs(gamma - 1.0) < 1e-4) return inputTex; // identity
    const outTex   = textureManager.create(width, height, 'r8unorm');
    const ubuf     = bufferManager.uniform(16, 'gamma-uniform');
    const f32data  = new Float32Array([gamma]);
    bufferManager.write(ubuf, f32data);
    const pipeline = await pipelineFactory.computePipeline(GAMMA_WGSL);
    const bg = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: ubuf } },
        { binding: 1, resource: inputTex.createView() },
        { binding: 2, resource: outTex.createView() },
      ],
    });
    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(pipeline); pass.setBindGroup(0, bg);
    const d = dispatchSize2D(width, height);
    pass.dispatchWorkgroups(d.x, d.y); pass.end();
    await this.#ctx.submitAndWait(enc);
    bufferManager.free(ubuf);
    return outTex;
  }
}
