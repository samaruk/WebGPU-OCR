// src/stages/base/BaseStage.js
import { loadShaders } from '../../gpu/ShaderLoader.js';

export class BaseStage {
  constructor(ctx) {
    this.ctx      = ctx;
    this.device   = ctx.gpuCtx.device;
    this.queue    = ctx.gpuCtx.queue;
    this.config   = ctx.config;
    this.data     = ctx.data;
    this.bus      = ctx.bus;
    this.canvases = ctx.canvases;
    this.bufMgr   = ctx.bufMgr;
    this.stageId  = ctx.stageId;
  }

  /** Load one or more WGSL shaders via URL. Always call before dispatch. */
  async loadShaders(urls) {
    return loadShaders(urls);
  }

  /** Get the canvas assigned to this stage (or null). */
  canvas(id) { return this.canvases?.[id ?? this.stageId] ?? null; }

  /** Create a storage buffer with optional initial Float32 data. */
  makeBuffer(size, data = null) {
    const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
    return this.ctx.gpuCtx.createBuffer(size, usage, data);
  }

  /** Create a uniform buffer from u32/f32 data. */
  makeUniform(data) { return this.ctx.gpuCtx.createUniform(data); }

  /** Render a Float32Array [H×W] grayscale to a canvas using a colormap. */
  renderGraymap(canvas, data, W, H, colormap = 'gray') {
    if (!canvas) return;
    canvas.width = W; canvas.height = H;
    const ctx2d = canvas.getContext('2d');
    const img = ctx2d.createImageData(W, H);
    const N = W * H;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < N; i++) { if (data[i] < min) min = data[i]; if (data[i] > max) max = data[i]; }
    const range = Math.max(1e-7, max - min);
    for (let i = 0; i < N; i++) {
      const v = (data[i] - min) / range;
      const [r, g, b] = this._colormap(v, colormap);
      img.data[i*4]=r; img.data[i*4+1]=g; img.data[i*4+2]=b; img.data[i*4+3]=255;
    }
    ctx2d.putImageData(img, 0, 0);
  }

  /** Render an NCHW RGB float tensor [3,H,W] to canvas. */
  renderRGB(canvas, data, W, H) {
    if (!canvas) return;
    canvas.width = W; canvas.height = H;
    const ctx2d = canvas.getContext('2d');
    const img = ctx2d.createImageData(W, H);
    const N = W * H;
    for (let i = 0; i < N; i++) {
      let r = data[i],         g = data[N+i],       b = data[2*N+i];
      // Denormalize from ImageNet if needed (values <0 → was normalized)
      if (r < 0 || g < 0 || b < 0) {
        r = (r * 0.229 + 0.485) * 255;
        g = (g * 0.224 + 0.456) * 255;
        b = (b * 0.225 + 0.406) * 255;
      } else { r *= 255; g *= 255; b *= 255; }
      img.data[i*4]=clamp(r); img.data[i*4+1]=clamp(g); img.data[i*4+2]=clamp(b); img.data[i*4+3]=255;
    }
    ctx2d.putImageData(img, 0, 0);
    function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }
  }

  /** Overlay colored bounding boxes on canvas. */
  overlayBoxes(canvas, boxes, color = '#00e676', lineW = 1.5) {
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    const sx = canvas.width  / (boxes._imgW ?? canvas.width);
    const sy = canvas.height / (boxes._imgH ?? canvas.height);
    ctx2d.strokeStyle = color; ctx2d.lineWidth = lineW;
    for (const b of boxes) ctx2d.strokeRect(b.x*sx, b.y*sy, b.w*sx, b.h*sy);
  }

  /** Draw a label badge on a canvas. */
  badge(canvas, text, color = '#00d4ff') {
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    ctx2d.fillStyle = color + 'dd';
    ctx2d.fillRect(4, 4, 6 + text.length * 7, 20);
    ctx2d.fillStyle = '#000';
    ctx2d.font = 'bold 10px "IBM Plex Mono", monospace';
    ctx2d.fillText(text, 7, 17);
  }

  _colormap(v, name) {
    v = Math.max(0, Math.min(1, v));
    if (name === 'amber') return [Math.round(255*v), Math.round(179*v), 0];
    if (name === 'cyan')  return [0, Math.round(212*v), Math.round(255*v)];
    if (name === 'heat')  return [Math.round(255*v), Math.round(64*(1-v)), 0];
    if (name === 'viridis') {
      const r = Math.round(68 + v*(253-68)), g = Math.round(1 + v*(231-1)), b = Math.round(84 + v*(37-84));
      return [r, g, b];
    }
    // gray
    const c = Math.round(255 * v); return [c, c, c];
  }

  /** Store a timing value in the shared data store. */
  setGpuMs(ms) { this.data[`${this.stageId}_gpuMs`] = ms; }
}
