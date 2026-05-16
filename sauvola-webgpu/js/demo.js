/**
 * @file demo.js
 * @description Synthetic document image generator for offline/demo usage.
 *
 * Purpose
 * ───────
 * The three themes provide realistic test cases without requiring a user to
 * upload a real document scan.  Each theme is designed to exercise different
 * aspects of the Sauvola binariser:
 *
 *  Theme 1 — docTheme     Academic document with body text, headings, and a
 *                          formula.  Moderate vignette + noise.
 *
 *  Theme 2 — invoiceTheme Monospaced invoice with a ruled table.  Tests
 *                          character/line discrimination (thin table rules).
 *
 *  Theme 3 — degradedTheme Aged book page with strong noise, uneven background
 *                          gradient, and ink bleed at edges.  High-difficulty
 *                          binarisation target.
 *
 * Both addNoise and addVignette are applied as post-processing so the
 * underlying text is always legible but the images are non-trivial to segment.
 *
 * Public API
 * ──────────
 *  generateDemo()   → ImageData   (cycles through the three themes)
 *  addNoise(ctx, W, H, amp)
 *  addVignette(ctx, W, H, opacity)
 *  docTheme(ctx, W, H)
 *  invoiceTheme(ctx, W, H)
 *  degradedTheme(ctx, W, H)
 */

// ── MODULE STATE ──────────────────────────────────────────────────────────────

/** @type {number} Monotonically increasing counter — selects which theme to render. */
let _demoN = 0;

// ── PUBLIC API ─────────────────────────────────────────────────────────────────

/**
 * Generate a synthetic 640×480 document image.
 *
 * Cycles through [docTheme, invoiceTheme, degradedTheme] on successive calls.
 * The returned ImageData is safe to pass directly to `setCurrentImage` or
 * `canvas.getContext('2d').putImageData(...)`.
 *
 * @returns {ImageData} 640×480 RGBA pixel data.
 */
export function generateDemo() {
  _demoN++;
  const W = 640, H = 480;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  const themes = [docTheme, invoiceTheme, degradedTheme];
  themes[(_demoN - 1) % themes.length](ctx, W, H);

  return ctx.getImageData(0, 0, W, H);
}

// ── POST-PROCESSING EFFECTS ────────────────────────────────────────────────────

/**
 * Add uniform random greyscale noise to every pixel of a canvas.
 *
 * Each channel is perturbed by a value sampled uniformly from [−amp/2, +amp/2]
 * and clamped to [0, 255].  Because the same perturbation is applied to all
 * three channels, the noise is greyscale (no colour fringing).
 *
 * @param {CanvasRenderingContext2D} ctx - 2D context of the canvas to modify.
 * @param {number}                  W   - Canvas width.
 * @param {number}                  H   - Canvas height.
 * @param {number}                  amp - Noise amplitude in [0–255].
 *   Typical values: 18 (subtle), 32 (moderate), 55 (heavy degradation).
 */
export function addNoise(ctx, W, H, amp) {
  const imgData = ctx.getImageData(0, 0, W, H);
  const p = imgData.data;
  for (let i = 0; i < p.length; i += 4) {
    const n = (Math.random() - 0.5) * amp;
    p[i]   = Math.max(0, Math.min(255, p[i]   + n));
    p[i+1] = Math.max(0, Math.min(255, p[i+1] + n));
    p[i+2] = Math.max(0, Math.min(255, p[i+2] + n));
    // Alpha channel (p[i+3]) is intentionally left unchanged
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Overlay a radial dark-centre-to-edge vignette on a canvas.
 *
 * The vignette is drawn as a radial gradient from fully transparent at the
 * centre to `rgba(0,0,0,opacity)` at the edges, simulating the light
 * fall-off seen in flatbed scanner captures and photographed pages.
 *
 * @param {CanvasRenderingContext2D} ctx      - 2D context.
 * @param {number}                  W        - Canvas width.
 * @param {number}                  H        - Canvas height.
 * @param {number}                  [opacity=0.35] - Edge opacity in [0,1].
 */
export function addVignette(ctx, W, H, opacity = 0.35) {
  // Inner radius: 15% of width from centre (fully transparent)
  // Outer radius: 82% of width from centre (full opacity)
  const g = ctx.createRadialGradient(W/2, H/2, W * 0.15, W/2, H/2, W * 0.82);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${opacity})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// ── THEME RENDERERS ───────────────────────────────────────────────────────────

/**
 * Theme 1: academic technical document.
 *
 * Renders a heading, section subtitle, body paragraphs, a centred formula,
 * and a footer page number on a cream paper background.
 * Noise amplitude: 32 / Vignette opacity: 0.28
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W
 * @param {number} H
 */
export function docTheme(ctx, W, H) {
  // Paper background
  ctx.fillStyle = '#f2e8d3';
  ctx.fillRect(0, 0, W, H);
  addNoise(ctx, W, H, 32);

  // Title
  ctx.fillStyle = '#18140d';
  ctx.font = 'bold 28px Georgia, serif';
  ctx.fillText('Technical Documentation', 36, 54);

  // Section heading
  ctx.font = '600 16px Georgia, serif';
  ctx.fillStyle = '#2a240f';
  ctx.fillText('Section 3 — Image Binarization Methods', 36, 84);

  // Body paragraphs
  const body = [
    'Local thresholding algorithms divide an image into regions and',
    'compute a threshold value for each pixel from its neighborhood.',
    'Sauvola\'s method adapts to local contrast and illumination.',
    '',
    '  T(x,y) = μ(x,y) · [1 + k · (σ(x,y) / R − 1)]',
    '',
    'The window size controls locality. Larger windows capture global',
    'illumination variation; smaller windows respond to fine detail.',
    'Parameter k ∈ [0.2, 0.5] controls the threshold sensitivity.',
  ];
  ctx.font = '14.5px Georgia, serif';
  ctx.fillStyle = '#1c180e';
  body.forEach((t, i) => ctx.fillText(t, 36, 118 + i * 23));

  // Sub-section
  ctx.font = 'bold 16px Georgia, serif';
  ctx.fillText('3.1  Integral Image Acceleration', 36, 355);
  ctx.font = '14px Georgia, serif';
  ctx.fillStyle = '#2a240f';
  ctx.fillText('The Summed Area Table (SAT) enables O(1) window statistics,', 36, 378);
  ctx.fillText('reducing complexity from O(N·w²) to O(N) per threshold.', 36, 400);

  // Page number
  ctx.fillStyle = '#888';
  ctx.font = '11px Georgia, serif';
  ctx.fillText('— Page 47 —', W / 2 - 25, H - 16);

  addVignette(ctx, W, H, 0.28);
}

/**
 * Theme 2: monospaced invoice with ruled table.
 *
 * Renders an invoice header, a multi-column line-item table with thin
 * horizontal rules, and totals at the bottom.  The thin table rules are
 * intentionally close to the minimum density for the charFilter to reject,
 * making this a good stress-test for the non-character filter.
 * Noise amplitude: 18 / No vignette.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W
 * @param {number} H
 */
export function invoiceTheme(ctx, W, H) {
  ctx.fillStyle = '#fbfaf8';
  ctx.fillRect(0, 0, W, H);
  addNoise(ctx, W, H, 18);

  // Invoice header
  ctx.fillStyle = '#111';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('INVOICE #INV-2024-00847', W / 2, 44);
  ctx.textAlign = 'left';

  ctx.font = '12px monospace';
  ctx.fillStyle = '#444';
  ctx.fillText('Issued: 2024-10-15   Due: 2024-11-15', 36, 68);
  ctx.fillText('From: GPU Computing Ltd.    To: Vision Systems Inc.', 36, 88);

  // Horizontal separator
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(36, 98); ctx.lineTo(W - 36, 98); ctx.stroke();

  // Table header row
  const hdr  = ['DESCRIPTION', 'QTY', 'UNIT PRICE', 'TOTAL'];
  const cols = [36, 310, 420, 540];
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#111';
  hdr.forEach((h, i) => ctx.fillText(h, cols[i], 120));
  ctx.beginPath(); ctx.moveTo(36, 128); ctx.lineTo(W - 36, 128); ctx.stroke();

  // Line items
  const rows = [
    ['WebGPU Compute Pipeline',   '1',  '$3,200.00', '$3,200.00'],
    ['WGSL Shader Development',   '8h', '$175.00',   '$1,400.00'],
    ['Integral Image Module',     '1',  '$850.00',   '$850.00'],
    ['Document Analysis Suite',   '1',  '$2,100.00', '$2,100.00'],
    ['GPU Memory Optimization',   '4h', '$175.00',   '$700.00'],
    ['Testing & QA',              '6h', '$120.00',   '$720.00'],
  ];
  ctx.font = '12px monospace';
  ctx.fillStyle = '#222';
  rows.forEach((r, i) => {
    r.forEach((cell, j) => ctx.fillText(cell, cols[j], 152 + i * 28));
    if (i < rows.length - 1) {
      ctx.strokeStyle = '#e8e4e0'; ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(36, 160 + i * 28); ctx.lineTo(W - 36, 160 + i * 28);
      ctx.stroke();
    }
  });

  // Totals section
  ctx.beginPath(); ctx.strokeStyle = '#999'; ctx.lineWidth = 0.7;
  ctx.moveTo(36, 330); ctx.lineTo(W - 36, 330); ctx.stroke();
  ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#111';
  ctx.fillText('SUBTOTAL:  $8,970.00',  370, 352);
  ctx.fillText('VAT (20%): $1,794.00',  370, 374);
  ctx.fillText('TOTAL:    $10,764.00',  370, 400);

  ctx.font = '11px monospace'; ctx.fillStyle = '#888';
  ctx.fillText('Payment via bank transfer. Reference: INV-2024-00847', 36, 440);
  ctx.fillText('IBAN: GB12 WEST 1234 5678 9012 34  BIC: WESTGB22',    36, 460);
}

/**
 * Theme 3: degraded aged book page.
 *
 * Renders body text on a warm uneven gradient background simulating aged
 * paper, with heavy noise, a citation, and pronounced ink-bleed gradients
 * on the left and right edges.  This is the hardest of the three themes for
 * adaptive binarisation because the local contrast can be very low.
 * Noise amplitude: 55 / Vignette opacity: 0.40 / Ink-bleed edges.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W
 * @param {number} H
 */
export function degradedTheme(ctx, W, H) {
  // Uneven warm background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0,   '#e5d8c0');
  grad.addColorStop(0.4, '#ecdfc8');
  grad.addColorStop(1,   '#d8cab0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  addNoise(ctx, W, H, 55);

  // Chapter heading
  ctx.fillStyle = '#12100a';
  ctx.font = 'bold 24px "Times New Roman", serif';
  ctx.fillText('Chapter 7: Adaptive Methods', 42, 56);

  // Subtitle
  ctx.font = 'italic 16px "Times New Roman", serif';
  ctx.fillStyle = '#2a2010';
  ctx.fillText('A Survey of Document Image Binarization Techniques', 42, 82);

  // Body paragraphs
  ctx.font = '15px "Times New Roman", serif';
  ctx.fillStyle = '#1a1508';
  const para = [
    'Among the class of locally adaptive thresholding methods, the',
    'Sauvola algorithm demonstrates superior performance on aged and',
    'degraded document images where illumination varies significantly.',
    '',
    'The central innovation lies in the use of local standard deviation',
    'as a measure of local contrast, allowing the threshold to be raised',
    'in high-contrast regions and lowered in uniform areas.',
    '',
    'Experimental results on the DIBCO benchmark dataset show that',
    'Sauvola achieves an F-measure of 91.4% on severely degraded scans,',
    'outperforming Otsu\'s global method by a margin of 18.7 points.',
  ];
  para.forEach((t, i) => ctx.fillText(t, 42, 116 + i * 22));

  // Citation
  ctx.font = 'italic 12px "Times New Roman", serif';
  ctx.fillStyle = '#555';
  ctx.fillText(
    'Sauvola, J. & Pietikäinen, M. (2000). "Adaptive document image binarization."',
    42, 390
  );
  ctx.fillText('Pattern Recognition, 33(2), pp.225–236.', 42, 408);

  // Ink bleed at left and right edges
  const bleed = ctx.createLinearGradient(0, 0, W, 0);
  bleed.addColorStop(0,    'rgba(40,20,5,0.28)');
  bleed.addColorStop(0.15, 'rgba(0,0,0,0)');
  bleed.addColorStop(0.85, 'rgba(0,0,0,0)');
  bleed.addColorStop(1,    'rgba(40,20,5,0.22)');
  ctx.fillStyle = bleed;
  ctx.fillRect(0, 0, W, H);

  addVignette(ctx, W, H, 0.40);
}
