/**
 * ui/overlay.js
 * Renders the maximum inscribed circle result onto the overlay canvas.
 *
 * Draws:
 *   • Translucent filled circle (interior hint)
 *   • Glowing amber stroke ring
 *   • Center dot
 *   • Dashed crosshairs
 *   • Radius dimension line with label
 */

/**
 * Draw the max-circle overlay onto a 2D canvas context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx       — circle centre X (pixels)
 * @param {number} cy       — circle centre Y (pixels)
 * @param {number} radius   — circle radius  (pixels)
 * @param {number} W        — canvas width
 * @param {number} H        — canvas height
 */
export function drawCircleOverlay(ctx, cx, cy, radius, W, H) {
  ctx.clearRect(0, 0, W, H);
  if (radius <= 0) return;

  // ── Filled interior (very subtle) ──────────────────────────────────────
  ctx.fillStyle = 'rgba(255, 176, 32, 0.06)';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // ── Glowing ring ───────────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = '#ffb020';
  ctx.lineWidth   = 2;
  ctx.shadowColor = '#ffb020';
  ctx.shadowBlur  = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // ── Center dot ─────────────────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle   = '#ffb020';
  ctx.shadowColor = '#ffb020';
  ctx.shadowBlur  = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── Dashed crosshairs ──────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 176, 32, 0.3)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(cx, 0);  ctx.lineTo(cx, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, cy);  ctx.lineTo(W, cy); ctx.stroke();
  ctx.restore();

  // ── Radius dimension line ──────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 176, 32, 0.65)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.stroke();
  ctx.restore();

  // ── Label ──────────────────────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle   = '#ffb020';
  ctx.font        = 'bold 10px "Space Mono", monospace';
  ctx.shadowColor = '#000';
  ctx.shadowBlur  = 5;
  const labelX = cx + radius + 6;
  const labelY = cy - 5;
  // Clamp label inside canvas
  const measured = ctx.measureText(`r=${radius.toFixed(1)}`).width;
  ctx.fillText(
    `r=${radius.toFixed(1)}`,
    Math.min(labelX, W - measured - 4),
    Math.max(labelY, 14),
  );
  ctx.restore();
}

/**
 * Clear the overlay canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W
 * @param {number} H
 */
export function clearOverlay(ctx, W, H) {
  ctx.clearRect(0, 0, W, H);
}
