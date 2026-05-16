// stages/14_transformerOCR.js
// Uses Tesseract.js (loaded via CDN) for OCR on cropped regions.
// Falls back to mock data if Tesseract is not available.

let tesseractWorker = null;

async function ensureWorker(onProgress) {
  if (tesseractWorker) return tesseractWorker;

  // Tesseract.js loaded via CDN in index.html
  if (typeof Tesseract === 'undefined') {
    console.warn('Tesseract.js not loaded — using mock OCR');
    return null;
  }

  tesseractWorker = await Tesseract.createWorker('eng', 1, {
    logger: m => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(m.progress);
      }
    }
  });
  return tesseractWorker;
}

/**
 * Run OCR on all cropped regions.
 * Returns { lines: [{text, x, y, w, h}], tableLines: [{text, x, y, w, h}] }
 */
export async function transformerOCR(regions, imgW, imgH, onProgress) {
  const worker = await ensureWorker(onProgress);

  const lines = [];
  const tableRegions = [];

  for (const region of regions) {
    // Convert OffscreenCanvas to ImageBitmap
    let bitmap;
    try {
      bitmap = await createImageBitmap(region.canvas);
    } catch (e) {
      continue;
    }

    // Draw to a regular canvas for Tesseract
    const c = document.createElement('canvas');
    c.width = bitmap.width; c.height = bitmap.height;
    const ctx2d = c.getContext('2d');
    ctx2d.drawImage(bitmap, 0, 0);
    bitmap.close();

    if (worker) {
      try {
        const { data } = await worker.recognize(c);
        const text = data.text.trim();
        if (region.type === 'line' && text.length > 0) {
          lines.push({ text, x: region.x, y: region.y, w: region.w, h: region.h });
        } else if (region.type === 'table') {
          // Parse table rows from Tesseract lines
          const rows = data.lines.map(l => ({
            text: l.text.trim(),
            words: l.words.map(ww => ({ text: ww.text, confidence: ww.confidence })),
            bbox: l.bbox,
          })).filter(l => l.text.length > 0);
          tableRegions.push({ ...region, rows });
        }
      } catch (e) {
        console.warn('OCR error on region:', e);
      }
    } else {
      // Mock OCR
      if (region.type === 'line') {
        lines.push({ text: '[OCR not available — add Tesseract CDN]', x: region.x, y: region.y, w: region.w, h: region.h });
      }
    }
  }

  // Try to extract structured table from table region
  const tableData = extractTableData(tableRegions, imgW, imgH);

  return { lines, tableData };
}

function extractTableData(tableRegions, imgW, imgH) {
  if (tableRegions.length === 0) return null;
  const tr = tableRegions[0];
  if (!tr.rows || tr.rows.length === 0) return null;

  // Heuristic: first row is header if it's shorter than subsequent rows
  const rows = tr.rows;
  const allWords = rows.flatMap(r => r.words.map(w => w.text));

  // Try to detect header row (often has keywords like Qty, Description, Amount, etc.)
  const headerKeywords = /^(qty|quantity|desc|description|item|product|unit|price|amount|total|tax|rate|no\.|#)$/i;
  let headerIdx = 0;
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    if (rows[i].words.some(w => headerKeywords.test(w.text))) {
      headerIdx = i;
      break;
    }
  }

  const header = rows[headerIdx]?.words.map(w => w.text) || [];
  const dataRows = rows.slice(headerIdx + 1).map(r => r.words.map(w => w.text));

  return { header, rows: dataRows, raw: rows };
}

export async function destroyOCRWorker() {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
  }
}
