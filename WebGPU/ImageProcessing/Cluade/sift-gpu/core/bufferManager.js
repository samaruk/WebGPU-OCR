// ============================================================
// SIFT-GPU  –  Buffer Manager
// Central registry for all GPU buffers and textures.
// ============================================================
import { CONFIG } from '../config.js';

// Keypoint struct layout (std430, 32 bytes):
//   x:f32  y:f32  scale:f32  response:f32
//   orientation:f32  octave:u32  layer:u32  flags:u32
export const KEYPOINT_STRIDE = 8;      // floats (32 bytes)
export const KEYPOINT_BYTES  = KEYPOINT_STRIDE * 4;
export const DESCRIPTOR_DIM  = 128;   // floats

export class BufferManager {
  constructor(device, pyramidLayout) {
    this.device = device;
    this.layout = pyramidLayout;
    this.gaussTextures = [];  // Float32 r32float textures per level
    this.dogTextures   = [];  // Float32 r32float textures per DoG level
    this.tmpTextures   = [];  // ping-pong temp textures per octave

    // Keypoint buffers (per-octave)
    this.keypointBufs      = [];
    this.keypointCountBufs = [];

    // Global descriptor buffer (filled after all octaves)
    this.descriptorBuf     = null;
    this.descriptorCount   = 0;
  }

  /**
   * Allocate all GPU resources for the pyramid.
   */
  allocate() {
    const dev = this.device;
    const maxKP = CONFIG.maxKeypointsPerOctave;

    for (const oct of this.layout) {
      const { width, height, numLevels, numDog, octave } = oct;

      // Gaussian levels
      const gaussArr = [];
      for (let s = 0; s < numLevels; s++) {
        gaussArr.push(dev.createTexture({
          label:  `gauss_o${octave}_s${s}`,
          size:   { width, height },
          format: 'r32float',
          usage:  GPUTextureUsage.STORAGE_BINDING |
                  GPUTextureUsage.TEXTURE_BINDING  |
                  GPUTextureUsage.COPY_SRC          |
                  GPUTextureUsage.COPY_DST,
        }));
      }
      this.gaussTextures.push(gaussArr);

      // Temp (ping-pong) texture for separable blur
      this.tmpTextures.push(dev.createTexture({
        label:  `tmp_o${octave}`,
        size:   { width, height },
        format: 'r32float',
        usage:  GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
      }));

      // DoG levels
      const dogArr = [];
      for (let d = 0; d < numDog; d++) {
        dogArr.push(dev.createTexture({
          label:  `dog_o${octave}_d${d}`,
          size:   { width, height },
          format: 'r32float',
          usage:  GPUTextureUsage.STORAGE_BINDING |
                  GPUTextureUsage.TEXTURE_BINDING,
        }));
      }
      this.dogTextures.push(dogArr);

      // Keypoint storage buffer (packed struct array)
      this.keypointBufs.push(dev.createBuffer({
        label: `kp_o${octave}`,
        size:  maxKP * KEYPOINT_BYTES,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      }));

      // Atomic counter (u32)
      this.keypointCountBufs.push(dev.createBuffer({
        label: `kpCount_o${octave}`,
        size:  4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      }));
    }

    // Global descriptor buffer allocated on first use
    this._allocateDescriptorBuffer(maxKP * this.layout.length);
  }

  _allocateDescriptorBuffer(maxTotal) {
    this.descriptorBuf = this.device.createBuffer({
      label: 'descriptors',
      size:  maxTotal * DESCRIPTOR_DIM * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
  }

  /** Zero the keypoint counter for an octave before dispatching. */
  zeroKeypointCount(commandEncoder, octaveIdx) {
    const buf = this.keypointCountBufs[octaveIdx];
    commandEncoder.clearBuffer(buf, 0, 4);
  }

  destroy() {
    for (const arr of this.gaussTextures) arr.forEach(t => t.destroy());
    for (const arr of this.dogTextures)   arr.forEach(t => t.destroy());
    this.tmpTextures.forEach(t => t.destroy());
    this.keypointBufs.forEach(b => b.destroy());
    this.keypointCountBufs.forEach(b => b.destroy());
    if (this.descriptorBuf) this.descriptorBuf.destroy();
  }
}
