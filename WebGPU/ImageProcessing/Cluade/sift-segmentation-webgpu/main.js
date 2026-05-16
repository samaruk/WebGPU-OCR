// main.js — Orchestrator

import { GPUContext }           from './core/gpuContext.js';
import { PipelineCache }        from './core/pipelineCache.js';
import { DispatchGraph }        from './core/dispatchGraph.js';
import { BufferPool }           from './core/bufferPool.js';
import { TexturePool }          from './core/texturePool.js';

import { PreprocessPipeline }   from './pipelines/preprocessPipeline.js';
import { PyramidPipeline }      from './pipelines/pyramidPipeline.js';
import { SiftPipeline }         from './pipelines/siftPipeline.js';
import { ClusteringPipeline }   from './pipelines/clusteringPipeline.js';
import { StrokePipeline }       from './pipelines/strokePipeline.js';
import { FusionPipeline }       from './pipelines/fusionPipeline.js';
import { SegmentationPipeline } from './pipelines/segmentationPipeline.js';
import { SkeletonPipeline }     from './pipelines/skeletonPipeline.js';
import { GraphPipeline }        from './pipelines/graphPipeline.js';
import { PostprocessPipeline }  from './pipelines/postprocessPipeline.js';

import { PyramidBuffers }       from './memory/pyramidBuffers.js';
import { SiftBuffers }          from './memory/siftBuffers.js';
import { SegmentationBuffers }  from './memory/segmentationBuffers.js';
import { GraphBuffers }         from './memory/graphBuffers.js';

import { Config }               from './config.js';

// ── Shader loader ─────────────────────────────────────────────────────────
async function loadShader(path) {
  const res = await fetch(`shaders/${path}`);
  if (!res.ok) throw new Error(`Failed to load shader: shaders/${path}`);
  return res.text();
}

// ── Main orchestrator class ───────────────────────────────────────────────
class SiftSegmentation {
  gpu          = new GPUContext();
  cache        = null;
  bufPool      = null;
  texPool      = null;
  pipelines    = {};
  pyramidBufs  = null;
  siftBufs     = null;
  segBufs      = null;
  graphBufs    = null;

  async init() {
    await this.gpu.init();
    const d       = this.gpu.device;
    this.cache    = new PipelineCache(d);
    this.bufPool  = new BufferPool(d);
    this.texPool  = new TexturePool(d);

    // Instantiate all pipelines
    const args = [this.gpu, this.cache];
    this.pipelines = {
      preprocess   : new PreprocessPipeline(...args),
      pyramid      : new PyramidPipeline(...args),
      sift         : new SiftPipeline(...args),
      clustering   : new ClusteringPipeline(...args),
      stroke       : new StrokePipeline(...args),
      fusion       : new FusionPipeline(...args),
      segmentation : new SegmentationPipeline(...args),
      skeleton     : new SkeletonPipeline(...args),
      graph        : new GraphPipeline(...args),
      postprocess  : new PostprocessPipeline(...args),
    };

    // Load & compile shaders in parallel per pipeline
    await Promise.all(
      Object.values(this.pipelines).map(p => p.loadShaders(loadShader))
    );
    await Promise.all(
      Object.values(this.pipelines).map(p => p.init())
    );

    console.info('[SiftSeg] All pipelines ready. Cache size:', this.cache.size);
  }

  /**
   * Process a single HTMLImageElement or ImageBitmap.
   * @param {HTMLImageElement|ImageBitmap} img
   * @returns {Promise<GPUTexture>} — rgba8unorm result texture
   */
  async process(img) {
    const W = img.width  ?? img.naturalWidth;
    const H = img.height ?? img.naturalHeight;

    // ── Upload source image ───────────────────────────────────────────────
    const srcTex = this.texPool.acquire(W, H, 'rgba8unorm',
      GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST);
    this.gpu.queue.copyExternalImageToTexture(
      { source: img },
      { texture: srcTex },
      [W, H]
    );

    // ── Allocate memory ───────────────────────────────────────────────────
    this.pyramidBufs?.destroy();  this.pyramidBufs = new PyramidBuffers(this.gpu.device, W, H);
    this.siftBufs?.destroy();     this.siftBufs    = new SiftBuffers(this.gpu.device, W, H);
    this.segBufs?.destroy();      this.segBufs     = new SegmentationBuffers(this.gpu.device, W, H);
    this.graphBufs?.destroy();    this.graphBufs   = new GraphBuffers(this.gpu.device);

    this.pyramidBufs.uploadKernel(this.gpu.queue, Config.GAUSSIAN_SIGMA);

    // ── Build command buffer ──────────────────────────────────────────────
    const enc = this.gpu.device.createCommandEncoder({ label: 'siftSeg' });

    // Preprocess
    this.pipelines.preprocess.encode(enc, srcTex, {/* bind group refs */ }, W, H);

    // Pyramid
    for (let o = 0; o < Config.PYRAMID_OCTAVES; o++) {
      this.pipelines.pyramid.encodeOctave(enc, this.pyramidBufs, o, W >> o, H >> o);
    }

    // SIFT detection per (octave, layer)
    for (let o = 0; o < Config.PYRAMID_OCTAVES; o++) {
      for (let s = 1; s < Config.PYRAMID_SCALES + 2; s++) {
        this.siftBufs.resetCounter(this.gpu.queue);
        this.pipelines.sift.encodeDetection(enc, {
          dogUniform: this.#uniformBuf({ width:W>>o, height:H>>o }),
          blurUpper : this.pyramidBufs.levels[o][s+1],
          blurLower : this.pyramidBufs.levels[o][s],
          dog       : this.pyramidBufs.dogLevels[o][s],
          dogPrev   : this.pyramidBufs.dogLevels[o][s-1],
          dogNext   : this.pyramidBufs.dogLevels[o][s+1],
          extUniform: this.#uniformBuf({ width:W>>o, height:H>>o,
                        max_kp:Config.SIFT_MAX_KEYPOINTS,
                        thresh:Config.SIFT_CONTRAST_THRESH }),
          kpCounter : this.siftBufs.kpCounter,
          kpXY      : this.siftBufs.kpXY,
        }, W >> o, H >> o);
      }
    }

    // Stroke + Fusion + Segmentation + Skeleton + Graph + Postprocess
    this.pipelines.stroke.encode(enc, {
      gradUniform: this.#uniformBuf({width:W,height:H}),
      gray: this.pyramidBufs.levels[0][0],
      mag : this.segBufs.swt,   // reuse swt buffer temporarily
      ang : this.segBufs.conf,
      rayUniform: this.#uniformBuf({width:W,height:H,
        max_steps:Config.STROKE_RAY_STEPS, max_width:Config.STROKE_MAX_WIDTH,
        min_width:Config.STROKE_MIN_WIDTH}),
      swt: this.segBufs.swt,
    }, W, H);

    this.pipelines.segmentation.encode(enc, {
      threshBG: null, initBG: null, eqvBG: null, flatBG: null, relabelBG: null,
    }, W, H);

    // Output texture
    const outTex = this.texPool.acquire(W, H, 'rgba8unorm',
      GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC);

    this.gpu.submit(enc);
    this.texPool.release(srcTex);
    return outTex;
  }

  /** Create a temporary uniform buffer from a plain object (u32/f32 fields). */
  #uniformBuf(obj) {
    const vals = Object.values(obj);
    const data = new Uint32Array(vals.length);
    vals.forEach((v, i) => {
      if (Number.isInteger(v)) data[i] = v;
      else new Float32Array(data.buffer, i * 4, 1)[0] = v;
    });
    const buf = this.bufPool.acquire(
      Math.max(data.byteLength, Config.UNIFORM_ALIGN),
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    );
    this.gpu.writeBuffer(buf, data);
    return buf;
  }

  destroy() {
    this.pyramidBufs?.destroy(); this.siftBufs?.destroy();
    this.segBufs?.destroy(); this.graphBufs?.destroy();
    this.bufPool.destroy(); this.texPool.destroy();
    this.gpu.destroy();
  }
}

// ── UI wiring ─────────────────────────────────────────────────────────────
const app = new SiftSegmentation();

document.addEventListener('DOMContentLoaded', async () => {
  const status  = document.getElementById('status');
  const canvas  = document.getElementById('output');
  const fileIn  = document.getElementById('fileInput');
  const runBtn  = document.getElementById('runBtn');
  const ctx2d   = canvas.getContext('2d');

  status.textContent = 'Initialising WebGPU…';
  try {
    await app.init();
    status.textContent = 'Ready — load an image to begin.';
  } catch (e) {
    status.textContent = `Error: ${e.message}`;
    console.error(e);
    return;
  }

  let currentImage = null;

  fileIn.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    canvas.width  = bitmap.width;
    canvas.height = bitmap.height;
    ctx2d.drawImage(bitmap, 0, 0);
    currentImage = bitmap;
    status.textContent = `Loaded: ${bitmap.width}×${bitmap.height}`;
  });

  runBtn.addEventListener('click', async () => {
    if (!currentImage) { status.textContent = 'Please load an image first.'; return; }
    status.textContent = 'Processing…';
    runBtn.disabled = true;
    const t0 = performance.now();
    try {
      const outTex = await app.process(currentImage);
      // Readback via imageBitmap
      const d = app.gpu.device;
      const readBuf = d.createBuffer({
        size: currentImage.width * currentImage.height * 4,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });
      const enc = d.createCommandEncoder();
      enc.copyTextureToBuffer(
        { texture: outTex },
        { buffer: readBuf, bytesPerRow: currentImage.width * 4 },
        [currentImage.width, currentImage.height]
      );
      app.gpu.submit(enc);
      await readBuf.mapAsync(GPUMapMode.READ);
      const raw  = new Uint8ClampedArray(readBuf.getMappedRange());
      const imgData = new ImageData(raw.slice(), currentImage.width, currentImage.height);
      readBuf.unmap(); readBuf.destroy();
      ctx2d.putImageData(imgData, 0, 0);
      const dt = (performance.now() - t0).toFixed(1);
      status.textContent = `Done in ${dt} ms`;
    } catch (e) {
      status.textContent = `Error: ${e.message}`;
      console.error(e);
    }
    runBtn.disabled = false;
  });
});
