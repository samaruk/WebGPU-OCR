/**
 * gpu-wrapper.js — WebGPU device management and low-level helpers.
 *
 * WHY THIS FILE EXISTS:
 *   Raw WebGPU API is verbose — creating a buffer takes 5 lines, creating a
 *   bind group requires mapping indices manually, reading back data needs a
 *   staging buffer and an async map. This class wraps those patterns into
 *   single-method calls so pipeline.js stays readable and focused on the
 *   algorithm rather than the GPU API.
 *
 * DESIGN DECISIONS:
 *   - Pipeline objects are cached by shader source string. Recompiling the
 *     same WGSL on every run() call would waste 50–200 ms per shader.
 *   - Uniform buffers always use {width, height, p0, p1} (16 bytes).
 *     All shaders share the same layout, so bind group layouts are compatible.
 *   - dispatch() creates a fresh bind group every call. Bind groups are cheap
 *     to create and this avoids tracking which buffers have changed.
 */

export class GPU {

  constructor(device) {
    this.dev = device;
    // WHY CACHE: createComputePipeline triggers shader compilation. On first
    // run this takes 100-500ms per shader. Caching by source string means
    // subsequent run() calls reuse compiled pipelines instantly.
    this._cache = {};
  }

  /** Request a WebGPU device. Throws if WebGPU is unavailable. */
  static async init() {
    if (!navigator.gpu) throw new Error('WebGPU not supported in this browser');
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No WebGPU adapter found (try chrome://flags/#enable-unsafe-webgpu)');
    const device = await adapter.requestDevice();
    device.lost.then(info => console.error('WebGPU device lost:', info.reason));
    return new GPU(device);
  }

  // ── Buffer creation ───────────────────────────────────────────────────────

  /**
   * Low-level buffer allocation with optional initial data.
   * Size is rounded up to 4 bytes (WebGPU alignment requirement).
   */
  _buf(bytes, usage, data = null) {
    const size = Math.max(4, (bytes + 3) & ~3);
    const b = this.dev.createBuffer({ size, usage, mappedAtCreation: !!data });
    if (data) {
      new Uint8Array(b.getMappedRange()).set(new Uint8Array(data.buffer ?? data));
      b.unmap();
    }
    return b;
  }

  /**
   * Float32 storage buffer readable and writable by compute shaders.
   * WHY COPY_SRC | COPY_DST: needed for copyBufferToBuffer (GPU→staging readback)
   * and for seeding buffers from other buffers (e.g. ZS skeleton init).
   */
  fbuf(n) {
    return this._buf(n * 4,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
  }

  /**
   * Upload a Uint32Array as a read-only storage buffer (RGBA pixel data).
   * WHY SEPARATE FROM fbuf: RGBA input is uploaded once and never written by GPU.
   */
  u32buf(arr) {
    return this._buf(arr.byteLength,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, arr);
  }

  /**
   * 16-byte uniform buffer: {width(u32), height(u32), p0(f32), p1(f32)}.
   * WHY THIS LAYOUT: Every shader uses the same struct so bind group layouts
   * are interchangeable and we never need to query layout from a pipeline.
   */
  uni(w, h, p0 = 0, p1 = 0) {
    const ab = new ArrayBuffer(16), dv = new DataView(ab);
    dv.setUint32(0, w, true); dv.setUint32(4, h, true);
    dv.setFloat32(8, p0, true); dv.setFloat32(12, p1, true);
    return this._buf(16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, new Uint8Array(ab));
  }

  // ── Pipeline compilation ──────────────────────────────────────────────────

  /**
   * Compile (and cache) a compute pipeline from WGSL source.
   * WHY layout:'auto': lets WebGPU derive the bind group layout from the shader
   * reflection, saving us from maintaining a separate layout description.
   */
  pl(wgsl) {
    if (this._cache[wgsl]) return this._cache[wgsl];
    const pl = this.dev.createComputePipeline({
      layout: 'auto',
      compute: {
        module: this.dev.createShaderModule({ code: wgsl }),
        entryPoint: 'main'
      }
    });
    this._cache[wgsl] = pl;
    return pl;
  }

  // ── Dispatch helpers ──────────────────────────────────────────────────────

  /**
   * Encode one 2D compute dispatch (16×16 workgroups) into an existing encoder.
   * bufs: ordered GPUBuffer array → bound to @binding(0), @binding(1), …
   *
   * WHY FRESH BIND GROUP EACH CALL: Bind groups are cheap (~microseconds).
   * Reusing requires tracking which buffers haven't changed — extra complexity
   * for negligible gain at this level of dispatch frequency.
   */
  dispatch(enc, pl, bufs, W, H) {
    const bg = this.dev.createBindGroup({
      layout: pl.getBindGroupLayout(0),
      entries: bufs.map((b, i) => ({ binding: i, resource: { buffer: b } }))
    });
    const pass = enc.beginComputePass();
    pass.setPipeline(pl);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(W / 16), Math.ceil(H / 16));
    pass.end();
  }

  /**
   * Encode a 1D dispatch (64-wide workgroups, one thread per row or column).
   * Used for SAT row/column scans where one thread processes an entire row
   * or column sequentially — the only correct approach for prefix sums.
   */
  dispatch1D(enc, pl, bufs, count) {
    const bg = this.dev.createBindGroup({
      layout: pl.getBindGroupLayout(0),
      entries: bufs.map((b, i) => ({ binding: i, resource: { buffer: b } }))
    });
    const pass = enc.beginComputePass();
    pass.setPipeline(pl);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(count / 64));
    pass.end();
  }

  // ── Readback ──────────────────────────────────────────────────────────────

  /**
   * Copy GPU buffer → CPU Float32Array asynchronously.
   * WHY STAGING BUFFER: GPUBuffer with STORAGE usage cannot be mapped for
   * reading directly. We copy to a MAP_READ buffer first, then map it.
   * The staging buffer is destroyed after copying to avoid memory leaks.
   */
  async readback(buf, n) {
    const rb = this._buf(n * 4, GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ);
    const enc = this.dev.createCommandEncoder();
    enc.copyBufferToBuffer(buf, 0, rb, 0, n * 4);
    this.dev.queue.submit([enc.finish()]);
    await rb.mapAsync(GPUMapMode.READ);
    const out = new Float32Array(rb.getMappedRange().slice(0));
    rb.unmap();
    rb.destroy();
    return out;
  }
}
