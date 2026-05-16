// src/stages/stage08_table_detection.js
import { BaseStage } from './base/BaseStage.js';

export default class Stage08_TableDetection extends BaseStage {
  async execute() {
    const t0 = performance.now();
    const { layoutBlocks, rawImage, imageMeta } = this.data;
    const tableBlocks = layoutBlocks.filter(b => b.blockClass === 'table');

    let tableStructures = [];

    for (const tb of tableBlocks) {
      // Try Table Transformer ONNX, fallback to heuristic grid
      try {
        const mPath = './models/table/table_transformer.onnx';
        const check = await fetch(mPath, { method:'HEAD' });
        if (!check.ok) throw new Error('no model');
        // Full inference would go here
        throw new Error('no model');
      } catch {
        // Heuristic: estimate rows/cols by aspect ratio
        const cols = Math.max(2, Math.round(tb.w / 80));
        const rows = Math.max(2, Math.round(tb.h / 25));
        const cells = [];
        const cw = tb.w / cols, ch = tb.h / rows;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            cells.push({ row:r, col:c, x:tb.x+c*cw, y:tb.y+r*ch, w:cw, h:ch, text:'' });
          }
        }
        tableStructures.push({ block: tb, rows, cols, cells });
      }
    }

    this.data.tableStructures = tableStructures;
    this.bus.emit('log', { level: 'ok', msg: `Stage08: ${tableStructures.length} tables in ${(performance.now()-t0).toFixed(1)}ms` });

    const cv = this.canvas('stage08');
    if (cv) {
      const { bitmap } = rawImage;
      const { width:W, height:H } = imageMeta;
      const scale = Math.min(1, 640/Math.max(W,H));
      cv.width = Math.round(W*scale); cv.height = Math.round(H*scale);
      const ctx2d = cv.getContext('2d');
      ctx2d.drawImage(bitmap, 0, 0, cv.width, cv.height);
      const sx = cv.width/W, sy = cv.height/H;

      for (const ts of tableStructures) {
        ctx2d.strokeStyle = '#7c4dff'; ctx2d.lineWidth = 2;
        ctx2d.strokeRect(ts.block.x*sx, ts.block.y*sy, ts.block.w*sx, ts.block.h*sy);
        for (const cell of ts.cells) {
          ctx2d.strokeStyle = 'rgba(124,77,255,0.5)'; ctx2d.lineWidth = 0.8;
          ctx2d.strokeRect(cell.x*sx, cell.y*sy, cell.w*sx, cell.h*sy);
        }
      }

      // show non-table layout in faded blue
      for (const b of layoutBlocks.filter(b => b.blockClass !== 'table')) {
        ctx2d.strokeStyle = 'rgba(0,212,255,0.25)'; ctx2d.lineWidth = 0.8;
        ctx2d.strokeRect(b.x*sx, b.y*sy, b.w*sx, b.h*sy);
      }
      this.badge(cv, `${tableStructures.length} Tables`, '#7c4dff');
    }
    this.setGpuMs(0);
  }
}
