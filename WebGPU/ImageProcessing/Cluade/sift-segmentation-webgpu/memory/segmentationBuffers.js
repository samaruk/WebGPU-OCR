// memory/segmentationBuffers.js — CCL + mask buffers
import { Config } from '../config.js';

const U = GPUBufferUsage;

export class SegmentationBuffers {
  binary   = null;
  labels   = null;
  labels2  = null;  // ping-pong
  relabels = null;
  remap    = null;
  ctr      = null;
  changed  = null;
  metrics  = null;
  swt      = null;
  density  = null;
  consist  = null;
  mask     = null;
  conf     = null;
  keep     = null;
  bboxes   = null;
  polys    = null;
  endpoints= null;
  branches = null;

  constructor(device, W, H) {
    const N  = W * H;
    const NL = Config.SEG_MAX_LABELS;
    const mk = s => device.createBuffer(s);
    const buf = (label, size, usage) => mk({ label, size: Math.max(size, 4), usage });

    this.binary    = buf('binary',   N*4,   U.STORAGE);
    this.labels    = buf('labels',   N*4,   U.STORAGE | U.COPY_DST);
    this.labels2   = buf('labels2',  N*4,   U.STORAGE);
    this.relabels  = buf('relabels', N*4,   U.STORAGE | U.COPY_SRC);
    this.remap     = buf('remap',    NL*4,  U.STORAGE | U.COPY_DST);
    this.ctr       = buf('segCtr',   4,     U.STORAGE | U.COPY_DST | U.COPY_SRC);
    this.changed   = buf('changed',  4,     U.STORAGE | U.COPY_DST | U.COPY_SRC);
    this.metrics   = buf('metrics',  NL*32, U.STORAGE | U.COPY_DST);
    this.swt       = buf('swt',      N*4,   U.STORAGE);
    this.density   = buf('density',  N*4,   U.STORAGE | U.COPY_DST);
    this.consist   = buf('consist',  N*4,   U.STORAGE);
    this.mask      = buf('mask',     N*4,   U.STORAGE);
    this.conf      = buf('conf',     N*4,   U.STORAGE);
    this.keep      = buf('keep',     NL*4,  U.STORAGE | U.COPY_DST);
    this.bboxes    = buf('bboxes',   NL*32, U.STORAGE | U.COPY_DST);
    this.polys     = buf('polys',    NL*4*8,U.STORAGE | U.COPY_SRC);
    this.endpoints = buf('ep',       N*4,   U.STORAGE);
    this.branches  = buf('br',       N*4,   U.STORAGE);
  }

  destroy() {
    for (const v of Object.values(this)) if (v?.destroy) v.destroy();
  }
}
