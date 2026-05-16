// src/stages/stage15_document_assembly.js
// Final assembly: merge corrected texts with layout blocks + tables
// Produces structured JSON document + full text transcript
import { BaseStage } from './base/BaseStage.js';

export default class Stage15_DocumentAssembly extends BaseStage {
  async execute() {
    const t0 = performance.now();
    const { correctedTexts, layoutBlocks, tableStructures, polygons, imageMeta } = this.data;

    // ── Assign recognized text to layout blocks ───────────────────
    const blocks = (layoutBlocks ?? []).map((b, i) => {
      // Find all text entries whose polygon overlaps this block
      const matches = (correctedTexts ?? []).filter(e => {
        const p = e.crop?.polygon;
        if (!p) return false;
        return this._iou(p, b) > 0.1;
      });
      const text = matches.map(m => m.text).filter(Boolean).join(' ');
      const conf = matches.length ? matches.reduce((s,m) => s + m.confidence, 0) / matches.length : 0;
      return {
        id:           i,
        type:         b.blockClass ?? 'text',
        text,
        confidence:   conf,
        readingOrder: b.readingOrder ?? i,
        bbox:         [b.x, b.y, b.x+b.w, b.y+b.h],
        pageIdx:      0,
      };
    });

    // ── Assign text to table cells ────────────────────────────────
    const tables = (tableStructures ?? []).map((ts, ti) => ({
      id:    ti,
      rows:  ts.rows,
      cols:  ts.cols,
      bbox:  [ts.block.x, ts.block.y, ts.block.x+ts.block.w, ts.block.y+ts.block.h],
      cells: ts.cells.map(cell => {
        const match = (correctedTexts ?? []).find(e => {
          const p = e.crop?.polygon;
          return p && this._iou(p, { x:cell.x, y:cell.y, w:cell.w, h:cell.h }) > 0.3;
        });
        return { ...cell, text: match?.text ?? '' };
      }),
    }));

    // ── Build reading-order full text ─────────────────────────────
    const ordered = [...blocks]
      .sort((a, b) => a.readingOrder - b.readingOrder)
      .filter(b => b.text.trim());
    const fullText = ordered.map(b => b.text).join('\n');

    const document = {
      version:  '2.0',
      timestamp: new Date().toISOString(),
      image:    { width: imageMeta.width, height: imageMeta.height, file: imageMeta.fileName },
      blocks,
      tables,
      fullText,
      stats: {
        blockCount:  blocks.length,
        tableCount:  tables.length,
        charCount:   fullText.length,
        regionCount: (polygons ?? []).length,
      },
    };

    this.data.document = document;
    const gpuMs = performance.now() - t0;

    // ── Visualize: final annotated image ──────────────────────────
    const cv = this.canvas('stage15');
    if (cv) {
      const { bitmap } = this.data.rawImage;
      const { width:W, height:H } = imageMeta;
      const scale = Math.min(1, 640 / Math.max(W, H));
      cv.width  = Math.round(W * scale);
      cv.height = Math.round(H * scale);
      const ctx2d = cv.getContext('2d');
      ctx2d.drawImage(bitmap, 0, 0, cv.width, cv.height);
      const sx = cv.width/W, sy = cv.height/H;

      const typeColors = {
        title:   '#ffb300', text: '#00d4ff', list: '#00e676',
        table:   '#7c4dff', figure: '#ff3d57', caption: '#ff80ab',
      };

      for (const b of blocks) {
        if (!b.text) continue;
        const [x1,y1,x2,y2] = b.bbox;
        const col = typeColors[b.type] ?? '#aaa';
        ctx2d.fillStyle   = col + '18';
        ctx2d.strokeStyle = col;
        ctx2d.lineWidth   = 1.5;
        ctx2d.fillRect  ((x1)*sx, (y1)*sy, (x2-x1)*sx, (y2-y1)*sy);
        ctx2d.strokeRect((x1)*sx, (y1)*sy, (x2-x1)*sx, (y2-y1)*sy);
        if ((x2-x1)*sx > 20 && (y2-y1)*sy > 10) {
          const fs = Math.max(6, Math.min(11, (y2-y1)*sy * 0.55));
          ctx2d.font = `${fs}px "IBM Plex Mono",monospace`;
          ctx2d.fillStyle = col + 'ee';
          ctx2d.save();
          ctx2d.beginPath();
          ctx2d.rect((x1)*sx+1, (y1)*sy+1, (x2-x1)*sx-2, (y2-y1)*sy-2);
          ctx2d.clip();
          ctx2d.fillText(b.text.slice(0, 60), (x1)*sx+2, (y1)*sy+fs+2);
          ctx2d.restore();
        }
      }

      // Full text preview panel
      const PH = Math.min(60, cv.height * 0.22);
      ctx2d.fillStyle = 'rgba(6,7,13,0.88)';
      ctx2d.fillRect(0, cv.height - PH, cv.width, PH);
      ctx2d.fillStyle = '#00e676'; ctx2d.fillRect(0, cv.height-PH, cv.width, 2);
      ctx2d.fillStyle = '#00e676'; ctx2d.font = 'bold 9px monospace';
      ctx2d.fillText('FINAL OCR OUTPUT', 4, cv.height - PH + 12);
      ctx2d.fillStyle = '#e8e8f4'; ctx2d.font = '9px monospace';
      const preview = fullText.replace(/\n/g, ' │ ').slice(0, 180);
      ctx2d.fillText(preview, 4, cv.height - PH + 26);
      ctx2d.fillStyle = '#6a6f8a'; ctx2d.font = '8px monospace';
      ctx2d.fillText(`${document.stats.charCount} chars | ${document.stats.blockCount} blocks | ${document.stats.tableCount} tables`, 4, cv.height - PH + 40);

      this.badge(cv, 'Document', '#00e676');
    }

    this.setGpuMs(gpuMs);
    this.bus.emit('log', { level: 'ok', msg: `Stage15: assembled ${document.stats.charCount} chars in ${gpuMs.toFixed(1)}ms` });
  }

  _iou(a, b) {
    const ax2 = a.x + (a.w ?? 0), ay2 = a.y + (a.h ?? 0);
    const bx2 = b.x + (b.w ?? 0), by2 = b.y + (b.h ?? 0);
    const ix1 = Math.max(a.x, b.x), iy1 = Math.max(a.y, b.y);
    const ix2 = Math.min(ax2, bx2),  iy2 = Math.min(ay2, by2);
    const inter = Math.max(0, ix2-ix1) * Math.max(0, iy2-iy1);
    const aArea = (ax2-a.x) * (ay2-a.y);
    const bArea = (bx2-b.x) * (by2-b.y);
    return inter / (aArea + bArea - inter + 1e-7);
  }
}
