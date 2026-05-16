/**
 * ui/presets.js
 * Built-in binary mask preset shapes.
 * Each preset fills the draw canvas with a known geometry for quick testing.
 *
 * Exports:
 *   PRESETS  — map of { name → drawFn(ctx, W, H) }
 *   drawPreset(name, ctx, W, H)
 */

export const PRESETS = {

  /** Concentric ring + inner ring */
  ring(ctx, W, H) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 50;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 140, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth   = 20;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 60,  0, Math.PI * 2); ctx.stroke();
  },

  /** Room floor-plan with pillars and obstacle */
  room(ctx, W, H) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.fillRect(30, 30, W - 60, H - 60);
    ctx.fillStyle = '#000'; ctx.fillRect(50, 50, W - 100, H - 100);
    ctx.fillStyle = '#fff';
    ctx.fillRect(150, 50, 20, 120);           // column left
    ctx.fillRect(W - 170, H - 170, 80, 80);  // obstacle bottom-right
    ctx.fillRect(80, 200, 60, 40);            // small block
  },

  /** Dense maze of corridors */
  maze(ctx, W, H) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    const walls = [
      [55, 55, 270, 18], [55, 55, 18, 190], [325, 55, 18, 155],
      [55, 190, 155, 18], [270, 135, 55, 18], [55, 245, 18, 170],
      [175, 245, 155, 18], [325, 210, 18, 115], [55, 325, 215, 18],
      [270, 265, 75, 18], [55, 395, 270, 18], [325, 325, 18, 90],
    ];
    walls.forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));
  },

  /** Thick 'O' letterform */
  letter(ctx, W, H) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 42;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 145, 0, Math.PI * 2); ctx.stroke();
  },

  /** Irregular polygon free-space */
  poly(ctx, W, H) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(80, 60); ctx.lineTo(W - 60, 80); ctx.lineTo(W - 40, H - 70);
    ctx.lineTo(W / 2, H - 40); ctx.lineTo(50, H - 90);
    ctx.closePath(); ctx.fill();
    // Interior obstacle
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(W * 0.6, H * 0.4, 55, 0, Math.PI * 2); ctx.fill();
  },
};

/**
 * Draw a preset onto the given canvas 2D context.
 * @param {string}            name — key in PRESETS
 * @param {CanvasRenderingContext2D} ctx
 * @param {number}            W
 * @param {number}            H
 */
export function drawPreset(name, ctx, W, H) {
  const fn = PRESETS[name];
  if (!fn) { console.warn(`Unknown preset: ${name}`); return; }
  fn(ctx, W, H);
}
