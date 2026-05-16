// stages/15_regionCropper.js
// Crop cell regions from the original image using OffscreenCanvas.
// Returns ImageBitmaps ready for OCR.

export async function regionCropper(ctx) {
  const { imageBitmap, cells, textLines, width, height } = ctx;

  /**
   * Crop a region from the source bitmap.
   * Adds small whitespace padding and returns an ImageBitmap.
   */
  async function cropRegion(x, y, w, h) {
    const cw = Math.max(4, Math.min(w, width  - x));
    const ch = Math.max(4, Math.min(h, height - y));
    if (cw <= 0 || ch <= 0) return null;

    // Scale up small crops for better OCR accuracy
    const scale   = Math.max(1, Math.min(4, Math.round(48 / ch)));
    const paddedW = cw * scale + 16;
    const paddedH = ch * scale + 16;

    const canvas = new OffscreenCanvas(paddedW, paddedH);
    const ctx2d  = canvas.getContext('2d');

    // White background
    ctx2d.fillStyle = '#ffffff';
    ctx2d.fillRect(0, 0, paddedW, paddedH);

    // Draw scaled cell
    ctx2d.drawImage(imageBitmap, x, y, cw, ch, 8, 8, cw * scale, ch * scale);

    return createImageBitmap(canvas);
  }

  // Crop cells
  const croppedCells = await Promise.all(
    cells.map(async (cell) => ({
      ...cell,
      bitmap: await cropRegion(cell.x, cell.y, cell.w, cell.h),
    }))
  );

  // Crop text lines
  const croppedLines = await Promise.all(
    textLines.map(async (line) => ({
      ...line,
      bitmap: await cropRegion(line.x, line.y, line.w, line.h),
    }))
  );

  // Filter out nulls
  return {
    croppedCells: croppedCells.filter(c => c.bitmap !== null),
    croppedLines: croppedLines.filter(l => l.bitmap !== null),
  };
}
