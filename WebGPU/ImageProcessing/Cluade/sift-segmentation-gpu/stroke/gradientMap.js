/**
 * stroke/gradientMap.js – computes gradient magnitude + direction from a grayscale texture.
 */
import { dispatchSize2D } from '../core/dispatch.js';

const WGSL = /* wgsl */`
@group(0) @binding(0) var srcTex   : texture_2d<f32>;
@group(0) @binding(1) var magTex   : texture_storage_2d<r32float, write>;
@group(0) @binding(2) var dirTex   : texture_storage_2d<r32float, write>;

@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = textureDimensions(srcTex);
  if (gid.x < 1u || gid.y < 1u || gid.x >= dims.x - 1u || gid.y >= dims.y - 1u) {
    textureStore(magTex, vec2<i32>(gid.xy), vec4<f32>(0.0)); 
    textureStore(dirTex, vec2<i32>(gid.xy), vec4<f32>(0.0)); 
    return;
  }
  let p  = vec2<i32>(gid.xy);
  let gx = textureLoad(srcTex, p + vec2<i32>(1,0), 0).r - textureLoad(srcTex, p - vec2<i32>(1,0), 0).r;
  let gy = textureLoad(srcTex, p + vec2<i32>(0,1), 0).r - textureLoad(srcTex, p - vec2<i32>(0,1), 0).r;
  textureStore(magTex, p, vec4<f32>(sqrt(gx*gx + gy*gy)));
  textureStore(dirTex, p, vec4<f32>(atan2(gy, gx)));
}
`;

export class GradientMap {
  #ctx;
  constructor(ctx) { this.#ctx = ctx; }

  async run(grayTex, W, H) {
    const { device, pipelineFactory, textureManager } = this.#ctx;
    const magTex = textureManager.create(W, H, 'r32float');
    const dirTex = textureManager.create(W, H, 'r32float');
    const pipe   = await pipelineFactory.computePipeline(WGSL);
    const bg = device.createBindGroup({
      layout: pipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: grayTex.createView() },
        { binding: 1, resource: magTex.createView() },
        { binding: 2, resource: dirTex.createView() },
      ],
    });
    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(pipe); pass.setBindGroup(0, bg);
    const d = dispatchSize2D(W, H);
    pass.dispatchWorkgroups(d.x, d.y); pass.end();
    await this.#ctx.submitAndWait(enc);
    return { magTex, dirTex };
  }
}
