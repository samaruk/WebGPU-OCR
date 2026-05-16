// ui/tableMarker.js — Draw overlays on the canvas: circles, text lines, table bounding box

import { CONFIG } from '../config.js';

/**
 * @param {HTMLCanvasElement} overlay  — transparent canvas on top of main
 * @param {number} iw, ih              — original image dimensions
 * @param {number} cw, ch             — display canvas dimensions
 * @param {Array}  circles
 * @param {Array}  textLines
 * @param {Object|null} table
 * @param {string} view               — active view mode
 */
export function drawOverlay(overlay, iw, ih, cw, ch, circles, textLines, table, view) {
  overlay.width  = cw;
  overlay.height = ch;
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, cw, ch);

  const sx = cw / iw;
  const sy = ch / ih;

  const { render: R } = CONFIG;

  if (view === 'circles' || view === 'original') {
    drawCircles(ctx, circles, sx, sy, R);
  }

  if (view === 'lines' || view === 'original' || view === 'circles') {
    drawTextLines(ctx, textLines, sx, sy, R, iw);
  }

  if (view === 'table' || view === 'original') {
    if (table) drawTable(ctx, table, sx, sy, R);
  }
}

function drawCircles(ctx, circles, sx, sy, R) {
  // Draw circles sorted by radius (small first)
  const sorted = [...circles].sort((a, b) => a.r - b.r);

  for (const c of sorted) {
    const cx = c.x * sx;
    const cy = c.y * sy;
    const cr = c.r * Math.min(sx, sy);

    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);

    if (c.r > 20) {
      ctx.strokeStyle = R.circleStrokeLarge;
      ctx.lineWidth = 1.5;
    } else {
      ctx.strokeStyle = R.circleStrokeColor;
      ctx.lineWidth = 0.8;
    }
    ctx.stroke();

    // Draw center dot for large circles
    if (c.r > 15) {
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fillStyle = c.r > 20 ? 'rgba(123,92,255,0.7)' : 'rgba(0,229,160,0.6)';
      ctx.fill();
    }
  }
}

function drawTextLines(ctx, lines, sx, sy, R, imgW) {
  ctx.strokeStyle = R.lineStrokeColor;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);

  for (const line of lines) {
    const y = (line.y + line.h / 2) * sy;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(imgW * sx, y);
    ctx.stroke();

    // Draw bounding box
    ctx.strokeStyle = 'rgba(255,209,102,0.4)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(line.x * sx, line.y * sy, line.w * sx, line.h * sy);
    ctx.strokeStyle = R.lineStrokeColor;
    ctx.lineWidth = 1.5;
  }
  ctx.setLineDash([]);
}

function drawTable(ctx, table, sx, sy, R) {
  const tx = table.x * sx;
  const ty = table.y * sy;
  const tw = table.w * sx;
  const th = table.h * sy;

  // Fill
  ctx.fillStyle = R.tableFillColor;
  ctx.fillRect(tx, ty, tw, th);

  // Border
  ctx.strokeStyle = R.tableStrokeColor;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(tx, ty, tw, th);

  // Draw row grid lines
  ctx.strokeStyle = 'rgba(255,77,109,0.3)';
  ctx.lineWidth = 1;
  if (table.rowBands) {
    for (const rb of table.rowBands) {
      const ry = rb.end * sy;
      ctx.beginPath();
      ctx.moveTo(tx, ry);
      ctx.lineTo(tx + tw, ry);
      ctx.stroke();
    }
  }

  // Draw column grid lines
  if (table.colBands) {
    for (const cb of table.colBands) {
      const cx = cb.end * sx;
      ctx.beginPath();
      ctx.moveTo(cx, ty);
      ctx.lineTo(cx, ty + th);
      ctx.stroke();
    }
  }

  // Label
  ctx.font = 'bold 12px "Space Mono", monospace';
  ctx.fillStyle = 'rgba(255,77,109,0.9)';
  ctx.fillText(`TABLE  ${table.cols}×${table.rows}`, tx + 6, ty - 8);
}
