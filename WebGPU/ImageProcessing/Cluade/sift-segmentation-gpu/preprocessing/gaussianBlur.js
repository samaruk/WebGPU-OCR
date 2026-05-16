/**
 * preprocessing/gaussianBlur.js – separable Gaussian blur (horizontal + vertical passes).
 */
export const GAUSSIAN_H_WGSL = /* wgsl */`
struct Uniforms { width: u32, height: u32, sigma: f32, radius: u32 }
@group(0) @binding(0) var<uniform> u  : Uniforms;
@group(0) @binding(1) var inputTex  : texture_2d<f32>;
@group(0) @binding(2) var outputTex : texture_storage_2d<r8unorm, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  var acc = 0.0; var wsum = 0.0;
  let r = i32(u.radius);
  for (var dx = -r; dx <= r; dx++) {
    let sx = clamp(i32(gid.x) + dx, 0, i32(u.width) - 1);
    let w  = exp(-f32(dx * dx) / (2.0 * u.sigma * u.sigma));
    acc += textureLoad(inputTex, vec2<i32>(sx, i32(gid.y)), 0).r * w;
    wsum += w;
  }
  textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(acc / wsum, 0.0, 0.0, 1.0));
}
`;

export const GAUSSIAN_V_WGSL = /* wgsl */`
struct Uniforms { width: u32, height: u32, sigma: f32, radius: u32 }
@group(0) @binding(0) var<uniform> u  : Uniforms;
@group(0) @binding(1) var inputTex  : texture_2d<f32>;
@group(0) @binding(2) var outputTex : texture_storage_2d<r8unorm, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= u.width || gid.y >= u.height) { return; }
  var acc = 0.0; var wsum = 0.0;
  let r = i32(u.radius);
  for (var dy = -r; dy <= r; dy++) {
    let sy = clamp(i32(gid.y) + dy, 0, i32(u.height) - 1);
    let w  = exp(-f32(dy * dy) / (2.0 * u.sigma * u.sigma));
    acc += textureLoad(inputTex, vec2<i32>(i32(gid.x), sy), 0).r * w;
    wsum += w;
  }
  textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(acc / wsum, 0.0, 0.0, 1.0));
}
`;

import { dispatchSize2D } from '../core/dispatch.js';

export class GaussianBlurPass {
  #ctx;
  constructor(ctx) { this.#ctx = ctx; }

  async run(inputTex, width, height, sigma) {
    const { device, pipelineFactory, textureManager, bufferManager } = this.#ctx;
    const radius = Math.ceil(3 * sigma);
    const udata  = new ArrayBuffer(16);
    const u32v   = new Uint32Array(udata);
    const f32v   = new Float32Array(udata);
    u32v[0] = width; u32v[1] = height; f32v[2] = sigma; u32v[3] = radius;

    const ubuf   = bufferManager.uniform(16, 'blur-uniform', udata);
    const tmpTex = textureManager.create(width, height, 'r8unorm');
    const outTex = textureManager.create(width, height, 'r8unorm');

    const pipeH = await pipelineFactory.computePipeline(GAUSSIAN_H_WGSL, 'main');
    const pipeV = await pipelineFactory.computePipeline(GAUSSIAN_V_WGSL, 'main');

    const mkBG = (pipe, src, dst) => device.createBindGroup({
      layout: pipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: ubuf } },
        { binding: 1, resource: src.createView() },
        { binding: 2, resource: dst.createView() },
      ],
    });

    const enc = device.createCommandEncoder();
    const d   = dispatchSize2D(width, height);
    let pass;
    pass = enc.beginComputePass(); pass.setPipeline(pipeH); pass.setBindGroup(0, mkBG(pipeH, inputTex, tmpTex)); pass.dispatchWorkgroups(d.x, d.y); pass.end();
    pass = enc.beginComputePass(); pass.setPipeline(pipeV); pass.setBindGroup(0, mkBG(pipeV, tmpTex, outTex)); pass.dispatchWorkgroups(d.x, d.y); pass.end();
    await this.#ctx.submitAndWait(enc);

    bufferManager.free(ubuf); textureManager.free(tmpTex);
    return outTex;
  }
}
