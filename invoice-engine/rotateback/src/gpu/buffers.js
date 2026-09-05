/**
 * Buffer pool + uniform-params writer.
 *
 * A 15-stage pipeline over a 2400x3200 page touches ~12 full-resolution f32
 * buffers. Allocating them per run thrashes the allocator and can trip
 * maxBufferSize on integrated GPUs, so buffers are pooled by (size, usage) and
 * recycled between stages. Stages acquire/release; the pool never frees during
 * a run so the driver is not asked to re-map anything mid-pipeline.
 */

const STORAGE =
  0x0080 /* STORAGE */ | 0x0008 /* COPY_DST */ | 0x0004; /* COPY_SRC */

export class BufferPool {
  constructor(device) {
    this.device = device;
    this.free = new Map(); // key -> GPUBuffer[]
    this.live = new Set();
    this.bytesAllocated = 0;
  }

  static key(size, usage) {
    return `${size}:${usage}`;
  }

  /** @returns {GPUBuffer} */
  acquire(size, usage = STORAGE, label = 'scratch') {
    // Round up to 256B so that similar-sized requests share slots.
    const aligned = Math.max(256, Math.ceil(size / 256) * 256);
    const k = BufferPool.key(aligned, usage);
    const bucket = this.free.get(k);
    let buf = bucket && bucket.pop();
    if (!buf) {
      buf = this.device.createBuffer({ label, size: aligned, usage });
      this.bytesAllocated += aligned;
      buf._poolKey = k;
    }
    this.live.add(buf);
    return buf;
  }

  release(...buffers) {
    for (const buf of buffers) {
      if (!buf || !this.live.has(buf)) continue;
      this.live.delete(buf);
      const bucket = this.free.get(buf._poolKey) ?? [];
      bucket.push(buf);
      this.free.set(buf._poolKey, bucket);
    }
  }

  /** Release everything currently checked out (end-of-run reset). */
  reset() {
    this.release(...this.live);
  }

  destroy() {
    this.reset();
    for (const bucket of this.free.values()) for (const b of bucket) b.destroy();
    this.free.clear();
    this.bytesAllocated = 0;
  }
}

/**
 * Every GRIDLIFT kernel binds the same 48-byte uniform block at @binding(0):
 *   w, h, i0, i1, i2, i3 : u32
 *   f0, f1, f2, f3       : f32
 * Keeping one layout for all shaders means one bind-group shape and no
 * per-stage uniform plumbing.
 */
export const PARAMS_BYTES = 48;

export class ParamsRing {
  /**
   * A ring of uniform buffers so a single command encoder can issue many
   * dispatches with different params without a GPU->CPU sync between them.
   */
  constructor(device, capacity = 64) {
    this.device = device;
    // Soft hint only. The ring GROWS rather than wrapping: every dispatch in a
    // submit holds a reference to its uniform buffer, so reusing one mid-run
    // would silently rewrite the parameters of an already-recorded pass.
    this.capacity = capacity;
    this.buffers = [];
    this.cursor = 0;
    this.scratch = new ArrayBuffer(PARAMS_BYTES);
    this.u32 = new Uint32Array(this.scratch);
    this.f32 = new Float32Array(this.scratch);
  }

  /**
   * @param {{w:number,h:number,i0?:number,i1?:number,i2?:number,i3?:number,
   *          f0?:number,f1?:number,f2?:number,f3?:number}} p
   * @returns {GPUBuffer}
   */
  write(p) {
    if (this.cursor >= this.buffers.length) {
      this.buffers.push(
        this.device.createBuffer({
          label: `params[${this.cursor}]`,
          size: PARAMS_BYTES,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        }),
      );
    }
    const buf = this.buffers[this.cursor];
    this.cursor++;

    this.u32[0] = p.w >>> 0;
    this.u32[1] = p.h >>> 0;
    this.u32[2] = (p.i0 ?? 0) >>> 0;
    this.u32[3] = (p.i1 ?? 0) >>> 0;
    this.u32[4] = (p.i2 ?? 0) >>> 0;
    this.u32[5] = (p.i3 ?? 0) >>> 0;
    this.f32[6] = p.f0 ?? 0;
    this.f32[7] = p.f1 ?? 0;
    this.f32[8] = p.f2 ?? 0;
    this.f32[9] = p.f3 ?? 0;
    this.u32[10] = 0;
    this.u32[11] = 0;

    this.device.queue.writeBuffer(buf, 0, this.scratch);
    return buf;
  }

  rewind() {
    this.cursor = 0;
  }
}

/** Read a storage buffer back to the CPU. Only used for small/compacted data. */
export async function readback(device, src, byteLength) {
  const staging = device.createBuffer({
    label: 'readback',
    size: Math.ceil(byteLength / 4) * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const enc = device.createCommandEncoder({ label: 'readback' });
  enc.copyBufferToBuffer(src, 0, staging, 0, staging.size);
  device.queue.submit([enc.finish()]);
  await staging.mapAsync(GPUMapMode.READ);
  const copy = staging.getMappedRange().slice(0);
  staging.unmap();
  staging.destroy();
  return copy;
}

export { STORAGE as STORAGE_USAGE };
