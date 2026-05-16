// ui/regionOverlay.js
// Renders detected circles, text lines and table cells on an overlay canvas.

import { Config } from '../config.js';

export class RegionOverlay {
  /**
   * @param {HTMLCanvasElement} canvas  - the overlay canvas (positioned absolute over main-canvas)
   * @param {number}            imgW    - original image width
   * @param {number}            imgH    - original image height
   */
  constructor(canvas, imgW, imgH) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.imgW    = imgW;
    this.imgH    = imgH;
    this._view   = 'circles';
    this._data   = {};
  }

  // ── Sizing ────────────────────────────────────────────────────────────────

  /** Sync overlay size with the displayed image size on screen */
  syncSize(displayW, displayH) {
    this.canvas.width  = displayW;
    this.canvas.height = displayH;
    this.scaleX        = displayW / this.imgW;
    this.scaleY        = displayH / this.imgH;
  }

  // ── Data setters ──────────────────────────────────────────────────────────

  setCircles(circles) { this._data.circles = circles; }
  setTextLines(lines) { this._data.lines   = lines; }
  setTables(tables)   { this._data.tables  = tables; }
  setCells(cells)     { this._data.cells   = cells; }
  setLineBlocks(lb)   { this._data.lineBlocks = lb; }

  // ── View switching ────────────────────────────────────────────────────────

  setView(view) {
    this._view = view;
    this.render();
  }

  // ── Main render ───────────────────────────────────────────────────────────

  render() {
    const c  = this.ctx;
    const sx = this.scaleX || 1;
    const sy = this.scaleY || 1;

    c.clearRect(0, 0, this.canvas.width, this.canvas.height);

    switch (this._view) {
      case 'circles':    this._drawCircles(c, sx, sy); break;
      case 'lines':      this._drawLines(c, sx, sy);   break;
      case 'table':      this._drawTables(c, sx, sy);  break;
      default:           break;   // 'original', 'gray', 'thresh', 'sdf' — no overlay
    }
  }

  // ── Circle rendering ──────────────────────────────────────────────────────

  _drawCircles(c, sx, sy) {
    const circles = this._data.circles || [];
    const palette = Config.CIRCLE_PALETTE;

    // Group by approximate line (y / avgRadius)
    const sorted = [...circles].sort((a, b) => a.y - b.y);

    sorted.forEach((circle, i) => {
      const color = palette[i % palette.length];
      const cx    = circle.x * sx;
      const cy    = circle.y * sy;
      const r     = circle.r * Math.min(sx, sy);

      // Circle fill (very faint)
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fillStyle   = color + '0.08)';
      c.fill();

      // Circle stroke
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.strokeStyle = color + '0.7)';
      c.lineWidth   = 1;
      c.stroke();

      // Centre dot
      c.beginPath();
      c.arc(cx, cy, 2, 0, Math.PI * 2);
      c.fillStyle = color + '1.0)';
      c.fill();
    });

    // Label count
    this._drawLabel(c, `${circles.length} circles detected`, 10, 20);
  }

  // ── Text line rendering ───────────────────────────────────────────────────

  _drawLines(c, sx, sy) {
    const lines = this._data.lineBlocks || this._data.lines || [];
    lines.forEach((line, i) => {
      const y0 = line.y * sy;
      const h  = line.h * sy;

      // Line band
      c.fillStyle = `rgba(0, 229, 255, ${0.06 + (i % 2) * 0.04})`;
      c.fillRect(0, y0, this.canvas.width, h);

      // Top border
      c.strokeStyle = 'rgba(0, 229, 255, 0.5)';
      c.lineWidth   = 1;
      c.beginPath();
      c.moveTo(0, y0);
      c.lineTo(this.canvas.width, y0);
      c.stroke();

      // Label
      if (h > 6) {
        c.fillStyle = 'rgba(0,229,255,0.85)';
        c.font      = `${Math.max(9, h * 0.6)}px monospace`;
        c.fillText(`L${i + 1}`, 6, y0 + h * 0.75);
      }
    });

    this._drawLabel(c, `${lines.length} text lines`, 10, 20);
  }

  // ── Table rendering ───────────────────────────────────────────────────────

  _drawTables(c, sx, sy) {
    const tables = this._data.tables || [];
    const cells  = this._data.cells  || [];

    tables.forEach((table, ti) => {
      // Table bounding box
      const tx = table.x * sx;
      const ty = table.y * sy;
      const tw = table.w * sx;
      const th = table.h * sy;

      c.strokeStyle = 'rgba(124, 58, 237, 0.8)';
      c.lineWidth   = 2;
      c.strokeRect(tx, ty, tw, th);
      c.fillStyle   = 'rgba(124, 58, 237, 0.05)';
      c.fillRect(tx, ty, tw, th);

      // Column separators
      (table.colSepX || []).forEach(x => {
        const cx = x * sx;
        c.strokeStyle = 'rgba(124,58,237,0.4)';
        c.lineWidth   = 1;
        c.setLineDash([4, 3]);
        c.beginPath();
        c.moveTo(cx, ty);
        c.lineTo(cx, ty + th);
        c.stroke();
        c.setLineDash([]);
      });

      // Row separators
      (table.rowY || []).forEach(y => {
        const ry = y * sy;
        c.strokeStyle = 'rgba(124,58,237,0.3)';
        c.lineWidth   = 1;
        c.setLineDash([3, 4]);
        c.beginPath();
        c.moveTo(tx, ry);
        c.lineTo(tx + tw, ry);
        c.stroke();
        c.setLineDash([]);
      });

      // Table label
      c.fillStyle = 'rgba(124,58,237,1)';
      c.font      = '11px monospace';
      c.fillText(`Table ${ti + 1}  ${table.cols}×${table.rows}`, tx + 4, ty - 4);
    });

    // Individual cells with OCR text
    cells.slice(0, 200).forEach(cell => {
      if (!cell.text) return;
      const cx = cell.x * sx;
      const cy = cell.y * sy;
      const cw = cell.w * sx;
      const ch = cell.h * sy;
      c.fillStyle = 'rgba(200,180,255,0.9)';
      c.font      = `${Math.max(8, Math.min(12, ch * 0.5))}px monospace`;
      c.fillText(cell.text.slice(0, 30), cx + 3, cy + ch * 0.7);
    });

    this._drawLabel(c, `${tables.length} table${tables.length !== 1 ? 's' : ''} detected`, 10, 20);
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  _drawLabel(c, text, x, y) {
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(x - 4, y - 14, text.length * 7.5 + 8, 20);
    c.fillStyle = '#00e5ff';
    c.font      = '12px monospace';
    c.fillText(text, x, y);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
