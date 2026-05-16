/**
 * preprocessing/grayscale.js – RGBA → luminance (r×0.299+g×0.587+b×0.114).
 */
export const GRAYSCALE_WGSL = /* wgsl */`
@group(0) @binding(0) var inputTex  : texture_2d<f32>;
@group(0) @binding(1) var outputTex : texture_storage_2d<r8unorm, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let dims = textureDimensions(inputTex);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let rgba = textureLoad(inputTex, vec2<i32>(gid.xy), 0);
  let lum  = dot(rgba.rgb, vec3<f32>(0.299, 0.587, 0.114));
  textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(lum, 0.0, 0.0, 1.0));
}
`;

import { dispatchSize2D } from '../core/dispatch.js';

export class GrayscalePass {
  #ctx;
  constructor(ctx) { this.#ctx = ctx; }

  async run(inputTex, width, height) {
    const { device, pipelineFactory, textureManager } = this.#ctx;
    const outTex = textureManager.create(width, height, 'r8unorm');
    const pipeline = await pipelineFactory.computePipeline(GRAYSCALE_WGSL);
    const bg = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inputTex.createView() },
        { binding: 1, resource: outTex.createView() },
      ],
    });
    const enc  = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bg);
    const d = dispatchSize2D(width, height);
    pass.dispatchWorkgroups(d.x, d.y);
    pass.end();
    await this.#ctx.submitAndWait(enc);
    return outTex;
  }
}
