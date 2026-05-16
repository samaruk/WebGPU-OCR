/**
 * pyramid/downsample.js – 2× nearest downsample of a texture.
 */
const WGSL = /* wgsl */`
@group(0) @binding(0) var src : texture_2d<f32>;
@group(0) @binding(1) var dst : texture_storage_2d<r8unorm, write>;
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let dims = textureDimensions(dst);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let v = textureLoad(src, vec2<i32>(i32(gid.x) * 2, i32(gid.y) * 2), 0).r;
  textureStore(dst, vec2<i32>(gid.xy), vec4<f32>(v, 0.0, 0.0, 1.0));
}
`;

import { dispatchSize2D } from '../core/dispatch.js';

export class DownsamplePass {
  #ctx;
  constructor(ctx) { this.#ctx = ctx; }

  async run(inputTex, outW, outH) {
    const { device, pipelineFactory, textureManager } = this.#ctx;
    const outTex = textureManager.create(outW, outH, 'r8unorm');
    const pipe   = await pipelineFactory.computePipeline(WGSL);
    const bg     = device.createBindGroup({
      layout: pipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inputTex.createView() },
        { binding: 1, resource: outTex.createView() },
      ],
    });
    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(pipe); pass.setBindGroup(0, bg);
    const d = dispatchSize2D(outW, outH);
    pass.dispatchWorkgroups(d.x, d.y); pass.end();
    await this.#ctx.submitAndWait(enc);
    return outTex;
  }
}
