// main.js — central orchestrator
import { GPUContext }       from './core/gpuContext.js';
import { MemoryLayout }     from './core/memoryLayout.js';
import { Config }           from './config.js';

import { UploadStage }      from './stages/01_upload/uploadStage.js';
import { PreprocessStage }  from './stages/02_preprocess/preprocessStage.js';
import { PyramidStage }     from './stages/03_pyramid/pyramidStage.js';
import { DogStage }         from './stages/04_sift_dog/dogStage.js';
import { ExtremaStage }     from './stages/05_sift_extrema/extremaStage.js';
import { RefineStage }      from './stages/06_sift_refine/refineStage.js';
import { OrientationStage } from './stages/07_sift_orientation/orientationStage.js';
import { DescriptorStage }  from './stages/08_sift_descriptor/descriptorStage.js';
import { ClusteringStage }  from './stages/09_clustering/clusteringStage.js';
import { StrokeStage }      from './stages/10_stroke/strokeStage.js';
import { FusionStage }      from './stages/11_fusion/fusionStage.js';
import { SegmentationStage }from './stages/12_segmentation/segmentationStage.js';
import { SkeletonStage }    from './stages/13_skeleton/skeletonStage.js';
import { GraphStage }       from './stages/14_graph/graphStage.js';
import { PostprocessStage } from './stages/15_postprocess/postprocessStage.js';

// ── Shader loader ────────────────────────────────────────────────────────────
async function loadShader(path) {
  const res = await fetch(`stages/${path}`);
  if (!res.ok) throw new Error(`Shader load failed: stages/${path}`);
  return res.text();
}

// ── App ──────────────────────────────────────────────────────────────────────
class SiftSegApp {
  gpu    = new GPUContext();
  mem    = null;
  stages = {};

  async init() {
    await this.gpu.init();
    const d = this.gpu.device;
    const q = this.gpu.queue;

    const make = Stage => new Stage(d, q);
    this.stages = {
      upload      : make(UploadStage),
      preprocess  : make(PreprocessStage),
      pyramid     : make(PyramidStage),
      dog         : make(DogStage),
      extrema     : make(ExtremaStage),
      refine      : make(RefineStage),
      orientation : make(OrientationStage),
      descriptor  : make(DescriptorStage),
      clustering  : make(ClusteringStage),
      stroke      : make(StrokeStage),
      fusion      : make(FusionStage),
      segmentation: make(SegmentationStage),
      skeleton    : make(SkeletonStage),
      graph       : make(GraphStage),
      postprocess : make(PostprocessStage),
    };

    await Promise.all(Object.values(this.stages).map(s => s.init(loadShader)));
    console.info('[App] All stages compiled. Ready.');
  }

  async run(imgBitmap, canvases) {
    const W = imgBitmap.width; const H = imgBitmap.height;
    this.mem?.destroy();
    this.mem = new MemoryLayout(this.gpu.device, W, H);
    const mem = this.mem; const q = this.gpu.queue; const d = this.gpu.device;

    // Upload image to srcTex
    q.copyExternalImageToTexture({ source: imgBitmap }, { texture: mem.srcTex }, [W, H]);

    // Estimate keypoint count (will be read back after extrema)
    const KP_EST = Math.min(Config.MAX_KP, 4096);

    // ── Encode all stages ────────────────────────────────────────────────────
    const enc = d.createCommandEncoder({ label: 'pipeline' });

      this.stages.upload.encode(enc, mem);
      console.log(['this.stages.upload.encode', this.stages.upload.encode]);
      this.stages.preprocess.encode(enc, mem);
      console.log(['this.stages.preprocess.encode', this.stages.preprocess.encode]);
      this.stages.pyramid.encode(enc, mem);
      console.log(['this.stages.pyramid.encode', this.stages.pyramid.encode]);
      this.stages.dog.encode(enc, mem);
      console.log(['this.stages.dog.encode', this.stages.dog.encode]);
      this.stages.extrema.encode(enc, mem);
      console.log(['this.stages.extrema.encode', this.stages.extrema.encode]);
      this.stages.refine.encode(enc, mem, KP_EST);
      console.log(['this.stages.refine.encode', this.stages.refine.encode]);
      this.stages.orientation.encode(enc, mem, KP_EST);
      console.log(['this.stages.orientation.encode', this.stages.orientation.encode]);
      this.stages.descriptor.encode(enc, mem, KP_EST);
      console.log(['this.stages.descriptor.encode', this.stages.descriptor.encode]);
      this.stages.clustering.encode(enc, mem, KP_EST);
      console.log(['this.stages.clustering.encode', this.stages.clustering.encode]);
      this.stages.stroke.encode(enc, mem);
      //console.log(['this.stages.stroke.encode', this.stages.stroke.encode]);
      //this.stages.fusion.encode(enc, mem);
      //console.log(['this.stages.fusion.encode', this.stages.fusion.encode]);
      //this.stages.segmentation.encode(enc, mem);
      //console.log(['this.stages.segmentation.encode', this.stages.segmentation.encode]);
      //this.stages.skeleton.encode(enc, mem);
      //console.log(['this.stages.skeleton.encode', this.stages.skeleton.encode]);
      //this.stages.graph.encode(enc, mem, 1000);
      //console.log(['this.stages.graph.encode', this.stages.graph.encode]);
      //this.stages.postprocess.encode(enc, mem, 512);
      //console.log(['this.stages.postprocess.encode', this.stages.postprocess.encode]);

    q.submit([enc.finish()]);
      await d.queue.onSubmittedWorkDone();
      console.log(['onSubmittedWorkDone', q,d]);

    // ── Visualise each stage into its canvas ─────────────────────────────────
    this.stages.upload.visualize(mem,       canvases.upload);
    this.stages.preprocess.visualize(mem,   canvases.preprocess);
    this.stages.pyramid.visualize(mem,      canvases.pyramid, 0, 2);
    this.stages.dog.visualize(mem,          canvases.dog, 0, 2);
    this.stages.extrema.visualize(mem,      canvases.extrema);
    this.stages.refine.visualize(mem,       canvases.refine);
    this.stages.orientation.visualize(mem,  canvases.orientation);
    this.stages.descriptor.visualize(mem,   canvases.descriptor, KP_EST);
    this.stages.clustering.visualize(mem,   canvases.clustering);
    this.stages.stroke.visualize(mem,       canvases.stroke);
    //this.stages.fusion.visualize(mem,       canvases.fusion);
    //this.stages.segmentation.visualize(mem, canvases.segmentation);
    //this.stages.skeleton.visualize(mem,     canvases.skeleton);
    //this.stages.graph.visualize(mem,        canvases.graph);
    //this.stages.postprocess.visualize(mem,  canvases.postprocess, 512);
  }

  destroy() { this.mem?.destroy(); this.gpu.destroy(); }
}

// ── DOM ──────────────────────────────────────────────────────────────────────
const app = new SiftSegApp();

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status');
  const runBtn   = document.getElementById('runBtn');
  const fileIn   = document.getElementById('fileInput');

  function setStatus(msg, cls='') {
    statusEl.textContent = msg; statusEl.className = 'status ' + cls;
  }

  setStatus('Initialising WebGPU…');
  try {
    await app.init();
    setStatus('Ready — load an image to begin.', 'ok');
  } catch (e) {
    setStatus('Error: ' + e.message, 'err');
    console.error(e); return;
  }

  let imgBitmap = null;

  fileIn.addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    imgBitmap = await createImageBitmap(file, { resizeWidth: Math.min(1024, file.size), resizeQuality: 'high' });
    // Show preview
    const c = document.getElementById('canvas-upload');
    c.width = imgBitmap.width; c.height = imgBitmap.height;
    c.getContext('2d').drawImage(imgBitmap, 0, 0);
    setStatus(`Loaded ${imgBitmap.width}×${imgBitmap.height}`, 'ok');
  });

  runBtn.addEventListener('click', async () => {
    if (!imgBitmap) { setStatus('Load an image first.', 'warn'); return; }
    setStatus('Processing…');
    runBtn.disabled = true;
    const t0 = performance.now();
    try {
      const canvases = {};
      document.querySelectorAll('[data-stage]').forEach(c => {
        canvases[c.dataset.stage] = c;
      });
      await app.run(imgBitmap, canvases);
      setStatus(`Done in ${(performance.now()-t0).toFixed(1)} ms`, 'ok');
    } catch (e) {
      setStatus('Error: ' + e.message, 'err');
      console.error(e);
    }
    runBtn.disabled = false;
  });
});
