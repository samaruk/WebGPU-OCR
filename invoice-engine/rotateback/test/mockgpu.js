/**
 * A validating WebGPU stand-in.
 *
 * There is no GPU in CI, but almost every mistake this pipeline can make is
 * structural rather than numerical: a bind group whose bindings do not match
 * the shader's, a buffer bound as storage that was never created with STORAGE
 * usage, the same buffer bound as both source and writable destination, a
 * dispatch of zero workgroups.
 *
 * The most treacherous of these is subtle: `layout: 'auto'` derives the layout
 * from the resources *reachable from the entry point*, so a binding declared
 * but only touched by an uncalled helper silently vanishes from the layout and
 * the bind group fails validation at runtime. This mock reproduces exactly that
 * rule - it walks the WGSL call graph from `main` and rejects any bind group
 * whose binding set differs from the reachable one.
 */

/* ------------------------------------------------------------------ *
 * WGSL reflection
 * ------------------------------------------------------------------ */

const DECL_RE =
  /@group\((\d+)\)\s*@binding\((\d+)\)\s*var(?:<\s*([^>]*)\s*>)?\s+(\w+)\s*:/g;

export function reflect(code) {
  const decls = [];
  for (const m of code.matchAll(DECL_RE)) {
    const [, group, binding, space, name] = m;
    const spaceStr = (space ?? '').trim();
    decls.push({
      group: +group,
      binding: +binding,
      name,
      space: spaceStr.split(',')[0].trim() || 'handle',
      access: spaceStr.includes('read_write') ? 'read_write'
        : spaceStr.includes('read') ? 'read'
        : spaceStr ? 'uniform' : 'handle',
    });
  }

  const fns = new Map();
  const fnRe = /fn\s+(\w+)\s*\(/g;
  for (const m of code.matchAll(fnRe)) {
    const name = m[1];
    const open = code.indexOf('{', m.index);
    if (open < 0) continue;
    let depth = 0, i = open;
    for (; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (!depth) break; }
    }
    fns.set(name, code.slice(open, i + 1));
  }

  const entries = [...code.matchAll(/@compute[\s\S]*?fn\s+(\w+)/g)].map((m) => m[1]);

  const reachableFor = (entry) => {
    const seen = new Set();
    const stack = [entry];
    const used = new Set();
    while (stack.length) {
      const fn = stack.pop();
      if (seen.has(fn)) continue;
      seen.add(fn);
      const body = fns.get(fn);
      if (!body) continue;
      for (const id of body.matchAll(/\b(\w+)\b/g)) {
        const name = id[1];
        if (fns.has(name) && !seen.has(name)) stack.push(name);
        used.add(name);
      }
    }
    return decls.filter((d) => used.has(d.name));
  };

  return { decls, entries, reachableFor };
}

/* ------------------------------------------------------------------ *
 * Mock objects
 * ------------------------------------------------------------------ */

export class MockBuffer {
  constructor(desc, id) {
    this.label = desc.label ?? `buffer${id}`;
    this.size = desc.size;
    this.usage = desc.usage;
    this.id = id;
    this.destroyed = false;
    this._data = null;
  }
  async mapAsync() { this._data = new ArrayBuffer(this.size); }
  getMappedRange() { return this._data ?? (this._data = new ArrayBuffer(this.size)); }
  unmap() {}
  destroy() { this.destroyed = true; }
}

class MockTextureView { constructor(tex) { this.texture = tex; } }

class MockTexture {
  constructor(desc, id) {
    this.label = desc.label ?? `texture${id}`;
    this.size = desc.size;
    this.usage = desc.usage;
    this.destroyed = false;
  }
  createView() { return new MockTextureView(this); }
  destroy() { this.destroyed = true; }
}

class MockComputePass {
  constructor(recorder, label) { this.rec = recorder; this.label = label; this.pipeline = null; }
  setPipeline(p) { this.pipeline = p; }
  setBindGroup(index, group) {
    if (!this.pipeline) throw new Error('setBindGroup before setPipeline');
    if (group.pipeline !== this.pipeline) {
      throw new Error(`bind group built for "${group.pipeline.label}" used with "${this.pipeline.label}"`);
    }
    this.group = group;
  }
  dispatchWorkgroups(x, y = 1, z = 1) {
    if (!this.pipeline) throw new Error('dispatch before setPipeline');
    if (!this.group) throw new Error(`dispatch without a bind group (${this.pipeline.label})`);
    if (!(x > 0 && y > 0 && z > 0)) {
      throw new Error(`${this.pipeline.label}: dispatch of ${x}x${y}x${z} workgroups`);
    }
    const max = 65535;
    if (x > max || y > max || z > max) {
      throw new Error(`${this.pipeline.label}: dispatch ${x}x${y}x${z} exceeds ${max} per dimension`);
    }
    this.rec.dispatches.push({ label: this.pipeline.label, x, y, z });
  }
  end() { this.ended = true; }
}

class MockEncoder {
  constructor(recorder, label) { this.rec = recorder; this.label = label; this.passes = []; }
  beginComputePass(desc = {}) {
    const p = new MockComputePass(this.rec, desc.label);
    this.passes.push(p);
    return p;
  }
  copyBufferToBuffer(src, so, dst, do_, size) {
    if (!(src.usage & GPUBufferUsage.COPY_SRC)) throw new Error(`${src.label} missing COPY_SRC`);
    if (!(dst.usage & GPUBufferUsage.COPY_DST)) throw new Error(`${dst.label} missing COPY_DST`);
    if (so + size > src.size) throw new Error(`copy overruns ${src.label}`);
    if (do_ + size > dst.size) throw new Error(`copy overruns ${dst.label}`);
    this.rec.copies.push({ src: src.label, dst: dst.label, size });
  }
  finish() {
    for (const p of this.passes) if (!p.ended) throw new Error('compute pass not ended before finish()');
    return { encoder: this };
  }
}

class MockDevice {
  constructor(recorder, limits) {
    this.rec = recorder;
    this.limits = limits;
    this.features = new Set();
    this.lost = new Promise(() => {});
    this._id = 0;
    this.queue = {
      writeBuffer: (buf, offset, data) => {
        if (!(buf.usage & GPUBufferUsage.COPY_DST)) throw new Error(`${buf.label} missing COPY_DST for writeBuffer`);
        const len = data.byteLength ?? data.length;
        if (offset + len > buf.size) throw new Error(`writeBuffer overruns ${buf.label}`);
        recorder.writes.push(buf.label);
      },
      copyExternalImageToTexture: (src, dst, size) => {
        if (!(dst.texture.usage & GPUTextureUsage.COPY_DST)) throw new Error('texture missing COPY_DST');
        recorder.uploads.push(size);
      },
      submit: (buffers) => { recorder.submits += buffers.length; },
    };
  }

  createBuffer(desc) {
    if (!desc.size || desc.size <= 0) throw new Error(`createBuffer(${desc.label}) with size ${desc.size}`);
    if (desc.size > this.limits.maxBufferSize) {
      throw new Error(`${desc.label}: ${desc.size} bytes exceeds maxBufferSize ${this.limits.maxBufferSize}`);
    }
    const b = new MockBuffer(desc, this._id++);
    this.rec.buffers.push(b);
    return b;
  }

  createTexture(desc) { return new MockTexture(desc, this._id++); }

  createShaderModule(desc) {
    const info = reflect(desc.code);
    return { label: desc.label, code: desc.code, info };
  }

  createComputePipeline(desc) {
    const entry = desc.compute.entryPoint ?? 'main';
    const mod = desc.compute.module;
    if (!mod.info.entries.includes(entry)) {
      throw new Error(`${desc.label}: no @compute fn named "${entry}"`);
    }
    const reachable = mod.info.reachableFor(entry);
    const declared = mod.info.decls;
    const dropped = declared.filter((d) => !reachable.some((r) => r.binding === d.binding));
    const pipeline = {
      label: desc.label ?? mod.label,
      reachable,
      dropped,
    };
    pipeline.getBindGroupLayout = (i) => ({ group: i, pipeline });
    return pipeline;
  }

  createBindGroup(desc) {
    // The layout object carries its pipeline, exactly as `layout: 'auto'` ties
    // a bind group to the pipeline it was derived from.
    const pipeline = desc.layout?.pipeline;
    if (!pipeline) throw new Error(`createBindGroup(${desc.label}) without a pipeline-derived layout`);

    const want = new Set(pipeline.reachable.map((d) => d.binding));
    const got = new Set(desc.entries.map((e) => e.binding));
    const missing = [...want].filter((b) => !got.has(b));
    const extra = [...got].filter((b) => !want.has(b));
    if (missing.length || extra.length) {
      throw new Error(
        `${pipeline.label}: bind group mismatch - missing [${missing}] extra [${extra}]. ` +
        `Shader uses bindings [${[...want].sort((a, b) => a - b)}]` +
        (pipeline.dropped.length
          ? `; declared-but-unreachable: [${pipeline.dropped.map((d) => `${d.binding}:${d.name}`)}]`
          : ''),
      );
    }

    const writable = new Set();
    for (const e of desc.entries) {
      const decl = pipeline.reachable.find((d) => d.binding === e.binding);
      const res = e.resource;
      if (decl.space === 'uniform' || decl.space === 'storage') {
        if (!res || !res.buffer) throw new Error(`${pipeline.label} binding ${e.binding} (${decl.name}) expects a buffer`);
        const buf = res.buffer;
        const needed = decl.space === 'uniform' ? GPUBufferUsage.UNIFORM : GPUBufferUsage.STORAGE;
        if (!(buf.usage & needed)) {
          throw new Error(`${pipeline.label} binding ${e.binding} (${decl.name}): ${buf.label} lacks ${decl.space.toUpperCase()} usage`);
        }
        if (buf.size > this.limits.maxStorageBufferBindingSize && decl.space === 'storage') {
          throw new Error(`${buf.label} (${buf.size}) exceeds maxStorageBufferBindingSize`);
        }
        if (decl.access === 'read_write') {
          if (writable.has(buf.id)) throw new Error(`${pipeline.label}: ${buf.label} bound twice as writable storage`);
          writable.add(buf.id);
        }
      } else if (res instanceof MockTextureView) {
        if (decl.space !== 'handle') throw new Error(`${pipeline.label} binding ${e.binding}: texture bound to ${decl.space}`);
      } else {
        throw new Error(`${pipeline.label} binding ${e.binding} (${decl.name}): unexpected resource`);
      }
    }
    // Read/write aliasing: the same buffer must not be both a writable and a
    // read binding in one dispatch.
    for (const e of desc.entries) {
      const decl = pipeline.reachable.find((d) => d.binding === e.binding);
      if (decl.access === 'read' && e.resource?.buffer && writable.has(e.resource.buffer.id)) {
        throw new Error(`${pipeline.label}: ${e.resource.buffer.label} is bound as both read and read_write`);
      }
    }

    return { label: desc.label, pipeline };
  }

  createCommandEncoder(desc = {}) { return new MockEncoder(this.rec, desc.label); }
  destroy() {}
}

/* ------------------------------------------------------------------ *
 * Installation
 * ------------------------------------------------------------------ */

export function installMockWebGPU({
  maxBufferSize = 512 * 1024 * 1024,
  maxStorageBufferBindingSize = 512 * 1024 * 1024,
} = {}) {
  const recorder = {
    buffers: [], dispatches: [], copies: [], writes: [], uploads: [],
    submits: 0, pipelinesByLabel: new Map(), lastPipeline: null,
  };

  globalThis.GPUBufferUsage = {
    MAP_READ: 0x0001, MAP_WRITE: 0x0002, COPY_SRC: 0x0004, COPY_DST: 0x0008,
    INDEX: 0x0010, VERTEX: 0x0020, UNIFORM: 0x0040, STORAGE: 0x0080,
    INDIRECT: 0x0100, QUERY_RESOLVE: 0x0200,
  };
  globalThis.GPUTextureUsage = {
    COPY_SRC: 0x01, COPY_DST: 0x02, TEXTURE_BINDING: 0x04,
    STORAGE_BINDING: 0x08, RENDER_ATTACHMENT: 0x10,
  };
  globalThis.GPUMapMode = { READ: 0x0001, WRITE: 0x0002 };
  globalThis.GPUBuffer = MockBuffer;

  const limits = {
    maxBufferSize,
    maxStorageBufferBindingSize,
    maxComputeWorkgroupStorageSize: 16384,
    maxComputeWorkgroupsPerDimension: 65535,
  };

  const device = new MockDevice(recorder, limits);

  // computePipeline caching lives in GpuContext; record the last one created so
  // createBindGroup can resolve which pipeline a bind group belongs to.
  const origCreate = device.createComputePipeline.bind(device);
  device.createComputePipeline = (desc) => {
    const p = origCreate(desc);
    recorder.pipelinesByLabel.set(p.label, p);
    recorder.lastPipeline = p;
    return p;
  };

  if (!globalThis.navigator) {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  }
  Object.defineProperty(globalThis.navigator, 'gpu', {
    configurable: true,
    value: {
      requestAdapter: async () => ({
        limits, features: new Set(),
        requestDevice: async () => device,
      }),
    },
  });

  return { device, recorder, limits };
}

/** A stand-in for an ImageBitmap. */
export const fakeSource = (width, height) => ({ width, height });
