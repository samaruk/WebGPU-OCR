// memory/siftBuffers.js — SIFT keypoint & descriptor buffers
import { Config } from '../config.js';

const U = GPUBufferUsage;

export class SiftBuffers {
  kpXY       = null;  // raw candidate pixel coords (packed u32)
  kpRefined  = null;  // vec4<f32> x,y,sigma,angle after subpixel + orientation
  kpFinal    = null;  // KP structs after compaction
  descriptors= null;  // [maxKP * 128] f32
  kpCounter  = null;  // atomic<u32>
  mag        = null;  // gradient magnitude
  ori        = null;  // gradient orientation

  constructor(device, W, H) {
    const maxKP = Config.SIFT_MAX_KEYPOINTS;
    const pixels = W * H;

    this.kpXY        = device.createBuffer({ label:'kpXY',       size: maxKP * 4,         usage: U.STORAGE | U.COPY_DST });
    this.kpRefined   = device.createBuffer({ label:'kpRefined',  size: maxKP * 16,        usage: U.STORAGE | U.COPY_DST });
    this.kpFinal     = device.createBuffer({ label:'kpFinal',    size: maxKP * 32,        usage: U.STORAGE | U.COPY_SRC });
    this.descriptors = device.createBuffer({ label:'descs',      size: maxKP * 128 * 4,   usage: U.STORAGE });
    this.kpCounter   = device.createBuffer({ label:'kpCounter',  size: 4,                 usage: U.STORAGE | U.COPY_DST | U.COPY_SRC });
    this.mag         = device.createBuffer({ label:'gradMag',    size: pixels * 4,        usage: U.STORAGE });
    this.ori         = device.createBuffer({ label:'gradOri',    size: pixels * 4,        usage: U.STORAGE });
  }

  resetCounter(queue) {
    queue.writeBuffer(this.kpCounter, 0, new Uint32Array([0]));
  }

  destroy() {
    for (const v of Object.values(this)) if (v?.destroy) v.destroy();
  }
}
