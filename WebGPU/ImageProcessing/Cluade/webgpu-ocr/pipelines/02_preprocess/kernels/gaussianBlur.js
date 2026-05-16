
import { loadShader }         from '../../../core/shaderLoader.js';
import { getComputePipeline } from '../../../core/pipelineCache.js';
import { makeUniform, dispatch2D } from '../../../core/dispatch.js';

export class GaussianBlurKernel {
  constructor(device) { this.device = device; }

  async init() {
    const code = await loadShader(new URL('./gaussianBlur.wgsl', import.meta.url).href);
    this.pipeline = await getComputePipeline(this.device, 'gaussianBlur', code);
  }

  /** Two-pass separable Gaussian blur. Returns output buffer. */
  async run(enc, inBuf, tmpBuf, outBuf, W, H, ks = 5, sigma = 1.4) {
    const run1 = (src, dst, pass_) => {
      const params = makeUniform(this.device, new ArrayBuffer(20));
      const v = new DataView(params.getMappedRange ? params.getMappedRange() : new ArrayBuffer(20));
      // Use writeBuffer approach
      const arr = new ArrayBuffer(20);
      new Uint32Array(arr, 0, 3).set([W, H, ks]);
      new Float32Array(arr, 12, 1).set([sigma]);
      new Uint32Array(arr, 16, 1).set([pass_]);
      this.device.queue.writeBuffer(params, 0, arr);

      const bg = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: src    } },
          { binding: 1, resource: { buffer: dst    } },
          { binding: 2, resource: { buffer: params } },
        ],
      });
      const pass = enc.beginComputePass({ label: `gaussianBlur_p${pass_}` });
      dispatch2D(pass, this.pipeline, bg, W, H);
      pass.end();
    };
    const makeUniformRaw = (device, ab) => {
      const buf = device.createBuffer({ size: ab.byteLength || 20, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(buf, 0, ab);
      return buf;
    };
    const buildParams = (pass_) => {
      const ab = new ArrayBuffer(20);
      new Uint32Array(ab).set([W, H, ks]);
      new Float32Array(ab, 12)[0] = sigma;
      new Uint32Array(ab, 16)[0]  = pass_;
      return makeUniformRaw(this.device, ab);
    };
    const runPass = (src, dst, pass_) => {
      const params = buildParams(pass_);
      const bg = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: src    } },
          { binding: 1, resource: { buffer: dst    } },
          { binding: 2, resource: { buffer: params } },
        ],
      });
      const pass = enc.beginComputePass({ label: `gaussianBlur${pass_}` });
      dispatch2D(pass, this.pipeline, bg, W, H);
      pass.end();
    };
    runPass(inBuf, tmpBuf, 0);  // horizontal
    runPass(tmpBuf, outBuf, 1); // vertical
  }
}
