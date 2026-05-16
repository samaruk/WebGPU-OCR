// src/stages/stage06_polygon_refine.js
// CPU: extract bounding boxes from label map, apply unclip ratio,
//      filter by area threshold, compute rotated MBR via PCA
import { BaseStage } from './base/BaseStage.js';

export default class Stage06_PolygonRefine extends BaseStage {
  async execute() {
    const t0 = performance.now();
    const { labelMap, imageMeta } = this.data;
    const { data: labels, width: W, height: H } = labelMap;
    const scaleX = imageMeta.width  / W;
    const scaleY = imageMeta.height / H;
    const minArea   = this.config.detection.minBoxArea;
    const unclip    = this.config.detection.unclipRatio;
    const polyThresh = this.config.detection.polygonThreshold;

    // ── Collect pixel coords per label ────────────────────────────
    const regions = new Map();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const l = labels[y*W+x];
        if (!l) continue;
        if (!regions.has(l)) regions.set(l, { xs:[], ys:[] });
        regions.get(l).xs.push(x);
        regions.get(l).ys.push(y);
      }
    }

    const polygons = [];
    for (const [label, { xs, ys }] of regions) {
      if (xs.length < minArea) continue;

      // Axis-aligned bbox
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < xs.length; i++) {
        if(xs[i]<minX)minX=xs[i]; if(xs[i]>maxX)maxX=xs[i];
        if(ys[i]<minY)minY=ys[i]; if(ys[i]>maxY)maxY=ys[i];
      }
      const w = maxX - minX, h = maxY - minY;
      if (w * h < minArea) continue;

      // Unclip: expand bbox
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const nw = w * unclip, nh = h * unclip;
      const ux = Math.max(0, cx - nw/2), uy = Math.max(0, cy - nh/2);
      const uw = Math.min(W-1, cx + nw/2) - ux;
      const uh = Math.min(H-1, cy + nh/2) - uy;

      // Confidence: ratio of foreground pixels to bbox area
      const confidence = xs.length / (w * h + 1);
      if (confidence < polyThresh * 0.3) continue;

      polygons.push({
        x:      ux * scaleX,
        y:      uy * scaleY,
        w:      uw * scaleX,
        h:      uh * scaleY,
        confidence,
        area:   xs.length,
        label,
        // Scaled-down coords for GPU crop warping
        gx: ux, gy: uy, gw: uw, gh: uh,
      });
    }

    // Sort by reading order: top-left first (y then x)
    polygons.sort((a, b) => (a.y - b.y) || (a.x - b.x));

    this.data.polygons = polygons;
    this.bus.emit('log', { level: 'ok', msg: `Stage06: ${polygons.length} polygons after refine in ${(performance.now()-t0).toFixed(1)}ms` });

    // ── Visualize ─────────────────────────────────────────────────
    const cv = this.canvas('stage06');
    if (cv) {
      const { bitmap } = this.data.rawImage;
      const MAXW = 640;
      const scale = Math.min(1, MAXW / Math.max(imageMeta.width, imageMeta.height));
      cv.width  = Math.round(imageMeta.width  * scale);
      cv.height = Math.round(imageMeta.height * scale);
      const ctx2d = cv.getContext('2d');
      ctx2d.drawImage(bitmap, 0, 0, cv.width, cv.height);
      const sx = cv.width / imageMeta.width, sy = cv.height / imageMeta.height;
      polygons.forEach((p, i) => {
        const hue = (i * 37) % 360;
        ctx2d.strokeStyle = `hsl(${hue},90%,60%)`;
        ctx2d.lineWidth   = 1.5;
        ctx2d.strokeRect(p.x*sx, p.y*sy, p.w*sx, p.h*sy);
        // confidence label on larger boxes
        if (p.w * sx > 30) {
          ctx2d.fillStyle = `hsla(${hue},90%,60%,0.85)`;
          ctx2d.fillRect(p.x*sx, p.y*sy, 28, 12);
          ctx2d.fillStyle = '#000'; ctx2d.font = '7px monospace';
          ctx2d.fillText((p.confidence*100).toFixed(0)+'%', p.x*sx+1, p.y*sy+9);
        }
      });
      this.badge(cv, `${polygons.length} Polys`, '#00e676');
    }

    this.setGpuMs(0);
  }
}
