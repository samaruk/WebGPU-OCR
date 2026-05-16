/**
 * tensor.js
 * GPU-resident tensor abstraction backed by GPUBuffer.
 * Supports f32, i32, u32 dtypes and arbitrary shapes.
 * Provides helpers for binding, slicing, reshaping, and CPU round-trips.
 */

import { gpuContext } from './gpuContext.js';

const DTYPE_INFO = {
  f32: { ArrayType: Float32Array, bytesPerElement: 4, wgslType: 'f32' },
  i32: { ArrayType: Int32Array, bytesPerElement: 4, wgslType: 'i32' },
  u32: { ArrayType: Uint32Array, bytesPerElement: 4, wgslType: 'u32' },
  u8: { ArrayType: Uint8Array, bytesPerElement: 1, wgslType: 'u32' }, // stored as u32-aligned
};

export class Tensor {
  /**
   * @param {number[]} shape - tensor dimensions, outermost first
   * @param {string} dtype - 'f32' | 'i32' | 'u32'
   * @param {GPUBufferUsageFlags} usage - additional usage flags
   * @param {string} label
   */
  constructor(shape, dtype = 'f32', usage = 0, label = '') {
    this.shape = shape;
    this.dtype = dtype;
    this.label = label;

    const info = DTYPE_INFO[dtype];
    if (!info) throw new Error(`[Tensor] Unknown dtype: ${dtype}`);
    this._info = info;

    this.numel = shape.reduce((a, b) => a * b, 1);
    this.byteSize = this.numel * info.bytesPerElement;

    const alignedSize = align(this.byteSize, 4);

    this.buffer = gpuContext.createBuffer(
      alignedSize,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | usage,
      label
    );
  }

  /** Create tensor and immediately upload CPU data */
  static fromData(data, shape, dtype = 'f32', label = '') {
    const t = new Tensor(shape, dtype, 0, label);
    t.upload(data);
    return t;
  }

  /** Create a tensor filled with zeros */
  static zeros(shape, dtype = 'f32', label = '') {
    const t = new Tensor(shape, dtype, 0, label);
    const info = DTYPE_INFO[dtype];
    const arr = new info.ArrayType(t.numel);
    t.upload(arr);
    return t;
  }

  /** Create a tensor filled with a scalar value */
  static filled(shape, value, dtype = 'f32', label = '') {
    const t = new Tensor(shape, dtype, 0, label);
    const info = DTYPE_INFO[dtype];
    const arr = new info.ArrayType(t.numel).fill(value);
    t.upload(arr);
    return t;
  }

  /** Upload a TypedArray to the GPU buffer */
  upload(data) {
    const info = DTYPE_INFO[this.dtype];
    let typed;
    if (data instanceof info.ArrayType) {
      typed = data;
    } else {
      typed = new info.ArrayType(
        data.buffer ?? data,
        data.byteOffset ?? 0,
        this.numel
      );
    }
    gpuContext.queue.writeBuffer(this.buffer, 0, typed);
  }

  /** Download GPU buffer to CPU as a TypedArray */
  async download() {
    const info = DTYPE_INFO[this.dtype];
    const raw = await gpuContext.readBuffer(this.buffer, this.byteSize);
    return new info.ArrayType(raw);
  }

  /**
   * Create a GPUBindGroupEntry for this tensor as a storage buffer.
   * @param {number} binding
   * @param {boolean} readOnly
   */
  bindingEntry(binding, readOnly = false) {
    return {
      binding,
      resource: {
        buffer: this.buffer,
        offset: 0,
        size: align(this.byteSize, 4),
      },
    };
  }

  /**
   * Return a new Tensor that is a view with a different shape.
   * Shares the underlying GPUBuffer (no copy).
   */
  reshape(newShape) {
    const newNumel = newShape.reduce((a, b) => a * b, 1);
    if (newNumel !== this.numel) {
      throw new Error(
        `[Tensor] reshape: element count mismatch ${this.numel} → ${newNumel}`
      );
    }
    const view = Object.create(Tensor.prototype);
    Object.assign(view, this);
    view.shape = newShape;
    return view;
  }

  /**
   * Copy contents of this tensor into another tensor of same size.
   * @param {Tensor} target
   */
  copyTo(target) {
    if (target.byteSize < this.byteSize) {
      throw new Error('[Tensor] copyTo: target too small');
    }
    const enc = gpuContext.device.createCommandEncoder();
    enc.copyBufferToBuffer(this.buffer, 0, target.buffer, 0, this.byteSize);
    gpuContext.queue.submit([enc.finish()]);
  }

  /** Get human-readable shape string */
  get shapeStr() {
    return `[${this.shape.join(', ')}]`;
  }

  /** Free GPU memory */
  destroy() {
    if (this.buffer) {
      this.buffer.destroy();
      this.buffer = null;
    }
  }

  toString() {
    return `Tensor(shape=${this.shapeStr}, dtype=${this.dtype}, bytes=${this.byteSize})`;
  }
}

/**
 * Utility: create a uniform buffer from a plain JS object describing uniforms.
 * Fields are written in declaration order as f32 or u32.
 * @param {Object} fields - { name: { value, type } }
 * @returns {{ buffer: GPUBuffer, update: (fields) => void }}
 */
export function createUniformBuffer(fields) {
  const entries = Object.values(fields);
  const size = align(entries.length * 4, 16);

  const buffer = gpuContext.device.createBuffer({
    size,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: false,
  });

  const write = (vals) => {
    const arr = new Float32Array(size / 4);
    Object.values(vals).forEach((v, i) => {
      arr[i] = v.value ?? v;
    });
    gpuContext.queue.writeBuffer(buffer, 0, arr);
  };

  write(fields);

  return {
    buffer,
    update: write,
    bindingEntry: (binding) => ({ binding, resource: { buffer } }),
  };
}

function align(value, alignment) {
  return Math.ceil(value / alignment) * alignment;
}
