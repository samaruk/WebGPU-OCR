// src/stages/stage07_layout_analysis.js
// ONNX LayoutLMv3 block classification + spatial reading order graph
// Fallback: heuristic classification by aspect ratio + position
import { BaseStage } from './base/BaseStage.js';

const CLASS_COLORS = {
  text:    '#00d4ff',
  title:   '#ffb300',
  list:    '#00e676',
  table:   '#7c4dff',
  figure:  '#ff3d57',
  caption: '#ff80ab',
};

export default class Stage07_LayoutAnalysis extends BaseStage {
  async execute() {
    const t0 = performance.now();
    const { polygons, rawImage, imageMeta } = this.data;
    const { width: W, height: H } = imageMeta;
    const classLabels = this.config.layout.classLabels;

    let layoutBlocks;

    try {
      // ── Try LayoutLMv3 ONNX ──────────────────────────────────────
      const mCfg  = (await import('../config/modelConfig.js')).default;
      const mPath = mCfg.layout.layoutlmv3.path;
      const check = await fetch(mPath, { method:'HEAD' });
      if (!check.ok) throw new Error('no model');
      // (Full LayoutLMv3 inference would go here)
      throw new Error('LayoutLM inference not yet wired — using heuristic');
    } catch {
      // ── Heuristic layout classification ─────────────────────────
      layoutBlocks = polygons.map((p, i) => {
        const ar = p.w / Math.max(1, p.h);
        const relY = p.y / H;
        let blockClass;
        if      (relY < 0.12 && ar > 3)  blockClass = 'title';
        else if (ar > 8)                  blockClass = 'list';
        else if (p.w > W * 0.7)          blockClass = 'text';
        else if (p.w / W < 0.15 && ar > 2) blockClass = 'caption';
        else                              blockClass = 'text';
        return { ...p, blockClass, blockIdx: i, readingOrder: i };
      });

      // Reading order: group into rows, sort rows top→bottom, cols left→right
      const rowTol = this.config.layout.readingOrderRowTolerance;
      const rows   = [];
      for (const b of layoutBlocks) {
        const row = rows.find(r => Math.abs(r.refY - b.y) < rowTol);
        if (row) row.blocks.push(b);
        else rows.push({ refY: b.y, blocks: [b] });
      }
      rows.sort((a,b) => a.refY - b.refY);
      let order = 0;
      for (const row of rows) {
        row.blocks.sort((a,b) => a.x - b.x);
        for (const b of row.blocks) b.readingOrder = order++;
      }
    }

    this.data.layoutBlocks = layoutBlocks;
    this.bus.emit('log', { level: 'ok', msg: `Stage07: ${layoutBlocks.length} blocks classified in ${(performance.now()-t0).toFixed(1)}ms` });

    // ── Visualize ─────────────────────────────────────────────────
    const cv = this.canvas('stage07');
    if (cv) {
      const { bitmap } = rawImage;
      const scale = Math.min(1, 640 / Math.max(W, H));
      cv.width  = Math.round(W * scale); cv.height = Math.round(H * scale);
      const ctx2d = cv.getContext('2d');
      ctx2d.drawImage(bitmap, 0, 0, cv.width, cv.height);
      const sx = cv.width/W, sy = cv.height/H;

      for (const b of layoutBlocks) {
        const col = CLASS_COLORS[b.blockClass] ?? '#888';
        ctx2d.fillStyle   = col + '22';
        ctx2d.strokeStyle = col;
        ctx2d.lineWidth   = 1.5;
        ctx2d.fillRect  (b.x*sx, b.y*sy, b.w*sx, b.h*sy);
        ctx2d.strokeRect(b.x*sx, b.y*sy, b.w*sx, b.h*sy);
        // class label
        if (b.w*sx > 24) {
          ctx2d.fillStyle = col + 'dd';
          ctx2d.fillRect(b.x*sx, b.y*sy, b.blockClass.length*6+4, 13);
          ctx2d.fillStyle = '#000'; ctx2d.font = 'bold 8px monospace';
          ctx2d.fillText(b.blockClass, b.x*sx+2, b.y*sy+10);
        }
        // reading order number
        ctx2d.fillStyle = '#fff'; ctx2d.font = '7px monospace';
        ctx2d.fillText(b.readingOrder+1, b.x*sx + b.w*sx - 12, b.y*sy + 11);
      }
      // Legend
      let lx = 4; const ly = cv.height - 14;
      for (const [cls, col] of Object.entries(CLASS_COLORS)) {
        ctx2d.fillStyle = col; ctx2d.fillRect(lx, ly, 8, 8);
        ctx2d.fillStyle = '#fff'; ctx2d.font = '7px monospace';
        ctx2d.fillText(cls, lx+10, ly+7);
        lx += cls.length*5 + 20;
      }
      this.badge(cv, `Layout ${layoutBlocks.length}blk`, '#7c4dff');
    }
    this.setGpuMs(0);
  }
}
