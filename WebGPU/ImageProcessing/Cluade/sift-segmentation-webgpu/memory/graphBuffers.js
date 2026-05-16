// memory/graphBuffers.js — Graph merge/split buffers
import { Config } from '../config.js';

const U = GPUBufferUsage;

export class GraphBuffers {
  edges       = null;
  edgeCtr     = null;
  mergeScores = null;
  splitScores = null;
  labelMap    = null;
  sharedBound = null;

  constructor(device) {
    const ME = Config.GRAPH_MAX_EDGES;
    const NL = Config.SEG_MAX_LABELS;

    this.edges       = device.createBuffer({ label:'edges',       size: ME*8,   usage: U.STORAGE | U.COPY_DST });
    this.edgeCtr     = device.createBuffer({ label:'edgeCtr',     size: 4,      usage: U.STORAGE | U.COPY_DST | U.COPY_SRC });
    this.mergeScores = device.createBuffer({ label:'mergeScores', size: ME*4,   usage: U.STORAGE });
    this.splitScores = device.createBuffer({ label:'splitScores', size: NL*4,   usage: U.STORAGE });
    this.labelMap    = device.createBuffer({ label:'labelMap',    size: NL*4,   usage: U.STORAGE | U.COPY_DST });
    this.sharedBound = device.createBuffer({ label:'sharedBound', size: ME*4,   usage: U.STORAGE | U.COPY_DST });
  }

  resetCounters(queue) {
    queue.writeBuffer(this.edgeCtr, 0, new Uint32Array([0]));
  }

  destroy() {
    for (const v of Object.values(this)) if (v?.destroy) v.destroy();
  }
}
