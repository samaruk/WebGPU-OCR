// stages/16_transformerOCR.js
// OCR stage: uses Tesseract.js (loaded via CDN) for text recognition.
// Architecture note: For production you would swap this for an ONNX TrOCR / 
// PaddleOCR model running via onnxruntime-web with WebGPU execution provider.
// Tesseract.js is used here as the practical browser-native fallback.

let _worker = null;

/** Lazy-init Tesseract worker */
async function getTesseractWorker(lang = 'eng') {
  if (_worker) return _worker;

  if (typeof Tesseract === 'undefined') {
    throw new Error('Tesseract.js not loaded. Add CDN script to index.html.');
  }

  _worker = await Tesseract.createWorker(lang, 1, {
    logger: () => {},   // silence progress spam
    cacheMethod: 'write',
  });
  await _worker.setParameters({ tessedit_pageseg_mode: '6' });
  return _worker;
}

/**
 * Recognise text from an ImageBitmap.
 * Returns the trimmed text string.
 */
async function recognise(worker, bitmap) {
  if (!bitmap) return '';
  try {
    // Convert ImageBitmap → canvas → data URL (Tesseract needs a URL or canvas)
    const c   = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    // Use the raw canvas reference
    const { data: { text } } = await worker.recognize(c);
    return text.trim().replace(/\n+/g, ' ');
  } catch (e) {
    console.warn('[OCR] Recognition failed:', e);
    return '';
  }
}

/**
 * Main OCR stage entry point.
 * Processes all text lines and table cells.
 */
export async function transformerOCR(ctx) {
  const { croppedCells, croppedLines, tables, config, onOCRProgress } = ctx;

  let worker;
  try {
    worker = await getTesseractWorker(config.OCR_LANG);
  } catch (e) {
    console.error('[OCR] Worker init failed:', e);
    return buildFallbackResult(croppedCells, croppedLines, tables);
  }

  const total   = croppedCells.length + croppedLines.length;
  let   done    = 0;

  // ── Recognise text lines ──────────────────────────────────────────────────
  const recognisedLines = [];
  for (const line of croppedLines) {
    const text = await recognise(worker, line.bitmap);
    recognisedLines.push({ ...line, text });
    done++;
    onOCRProgress?.(done, total);
  }

  // ── Recognise table cells ─────────────────────────────────────────────────
  const recognisedCells = [];
  for (const cell of croppedCells) {
    const text = await recognise(worker, cell.bitmap);
    recognisedCells.push({ ...cell, text });
    done++;
    onOCRProgress?.(done, total);
  }

  // ── Structure into JSON output ────────────────────────────────────────────
  const invoiceData = structureOutput(recognisedLines, recognisedCells, tables);
  return { recognisedLines, recognisedCells, invoiceData };
}

// ── Output structuring ────────────────────────────────────────────────────────

function structureOutput(lines, cells, tables) {
  // Heuristic field extraction from text lines
  const allText = lines.map(l => l.text).join('\n');

  const invoice = {
    meta: {
      processedAt: new Date().toISOString(),
      lineCount:   lines.length,
      tableCount:  tables.length,
    },
    fields: extractFields(allText),
    textLines: lines.map(l => l.text).filter(Boolean),
    tables: buildTables(cells, tables),
  };

  return invoice;
}

function extractFields(text) {
  const fields = {};

  const patterns = [
    ['invoiceNumber', /(?:invoice|inv)[\s#:]+([A-Z0-9\-]{3,20})/i],
    ['date',         /(?:date|dated)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
    ['dueDate',      /(?:due|payment due)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
    ['total',        /(?:total|amount due|grand total)[:\s$]+([0-9,]+\.?[0-9]*)/i],
    ['subtotal',     /(?:subtotal|sub-total)[:\s$]+([0-9,]+\.?[0-9]*)/i],
    ['tax',          /(?:tax|vat|gst)[:\s$]+([0-9,]+\.?[0-9]*)/i],
    ['vendor',       /(?:from|vendor|company|billed by)[:\s]+([A-Za-z][\w\s&,\.]{2,40})/i],
    ['client',       /(?:to|bill to|client|customer)[:\s]+([A-Za-z][\w\s&,\.]{2,40})/i],
    ['poNumber',     /(?:p\.?o\.?\s*#?|purchase order)[:\s]+([A-Z0-9\-]{3,20})/i],
  ];

  for (const [key, pattern] of patterns) {
    const match = text.match(pattern);
    if (match) fields[key] = match[1].trim();
  }

  return fields;
}

function buildTables(cells, tables) {
  return tables.map((table, ti) => {
    const tableCells = cells.filter(c => c.tableIdx === ti);
    if (tableCells.length === 0) return null;

    const maxRow = Math.max(...tableCells.map(c => c.row));
    const maxCol = Math.max(...tableCells.map(c => c.col));

    // Build grid
    const grid = Array.from({ length: maxRow + 1 }, () =>
      Array.from({ length: maxCol + 1 }, () => '')
    );
    for (const cell of tableCells) {
      grid[cell.row][cell.col] = cell.text;
    }

    // First row might be header
    const headers = grid[0] || [];
    const rows    = grid.slice(1);

    return {
      headers,
      rows,
      cols: maxCol + 1,
      rowCount: maxRow + 1,
      boundingBox: { x: table.x, y: table.y, w: table.w, h: table.h },
    };
  }).filter(Boolean);
}

function buildFallbackResult(cells, lines, tables) {
  return {
    recognisedLines: lines.map(l => ({ ...l, text: '' })),
    recognisedCells: cells.map(c => ({ ...c, text: '' })),
    invoiceData: {
      meta: { error: 'OCR unavailable', lineCount: lines.length, tableCount: tables.length },
      fields: {},
      textLines: [],
      tables: [],
    },
  };
}
