/**
 * layout/layout_engine.js — Document Layout Analysis Engine
 *
 * Takes the recognized text regions and reconstructs the logical document
 * structure: paragraphs, columns, headers, tables, reading order.
 *
 * This is a pure CPU stage (layout analysis is graph/heuristic-based).
 * Uses geometric analysis of bounding boxes and text statistics.
 *
 * Output: a hierarchical document model with reading-order sorted blocks.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const BLOCK_TYPES = {
  PARAGRAPH: 'paragraph',
  HEADER:    'header',
  TABLE:     'table',
  CAPTION:   'caption',
  FOOTNOTE:  'footnote',
  OTHER:     'other',
};

// ─── Layout Engine ────────────────────────────────────────────────────────────

export class LayoutEngine {
  constructor(options = {}) {
    this.lineGapThreshold     = options.lineGapThreshold     ?? 0.5;  // fraction of line height
    this.columnGapThreshold   = options.columnGapThreshold   ?? 50;   // pixels
    this.headerHeightRatio    = options.headerHeightRatio    ?? 1.5;  // larger than avg = header
    this.minBlockLines        = options.minBlockLines        ?? 1;
    this.paragraphIndentPx    = options.paragraphIndentPx    ?? 20;
    this.tableColumnAlignment = options.tableColumnAlignment ?? 0.9;
  }

  /**
   * Analyze layout and build document structure.
   * @param {AnnotatedRegion[]} regions - from ConfidenceFeedbackStage
   * @param {number} imageW, imageH
   * @param {OrientationResult} orientResult
   * @returns {DocumentModel}
   */
  analyze(regions, imageW, imageH, orientResult = {}) {
    if (regions.length === 0) {
      return this._emptyDocument();
    }

    // ── 1. Filter and sort regions ─────────────────────────────────────────
    const validRegions = regions
      .filter(r => r.text && r.text.length > 0 && r.bbox)
      .sort((a, b) => {
        // Primary: top-to-bottom, secondary: left-to-right
        const dy = a.bbox.y - b.bbox.y;
        if (Math.abs(dy) > this._avgLineHeight(regions) * 0.5) return dy;
        return a.bbox.x - b.bbox.x;
      });

    if (validRegions.length === 0) return this._emptyDocument();

    // ── 2. Detect columns ─────────────────────────────────────────────────
    const columns = this._detectColumns(validRegions, imageW);

    // ── 3. Group regions into text lines ──────────────────────────────────
    const lines = this._groupIntoLines(validRegions);

    // ── 4. Group lines into blocks ─────────────────────────────────────────
    const blocks = this._groupIntoBlocks(lines, columns);

    // ── 5. Classify blocks ────────────────────────────────────────────────
    const classifiedBlocks = this._classifyBlocks(blocks, validRegions);

    // ── 6. Determine reading order ─────────────────────────────────────────
    const orderedBlocks = this._computeReadingOrder(classifiedBlocks, columns, orientResult);

    // ── 7. Build final text ────────────────────────────────────────────────
    const fullText = this._buildFullText(orderedBlocks);

    return {
      blocks:       orderedBlocks,
      columns:      columns.length,
      lineCount:    lines.length,
      regionCount:  validRegions.length,
      fullText,
      pageWidth:    imageW,
      pageHeight:   imageH,
      orientation:  orientResult.orientationDeg ?? 0,
      scriptDir:    orientResult.scriptDirection ?? 'LTR',
    };
  }

  // ── Private Methods ─────────────────────────────────────────────────────────

  _avgLineHeight(regions) {
    if (regions.length === 0) return 20;
    const heights = regions.map(r => r.bbox?.h ?? 20);
    return heights.reduce((a, b) => a + b, 0) / heights.length;
  }

  /**
   * Detect column boundaries using x-projection histogram.
   */
  _detectColumns(regions, imageW) {
    // Build x-projection (how many regions cover each x position)
    const BINS = 100;
    const binWidth = imageW / BINS;
    const xProj = new Float32Array(BINS);

    for (const r of regions) {
      const b = r.bbox;
      const binStart = Math.floor(b.x / binWidth);
      const binEnd   = Math.ceil((b.x + b.w) / binWidth);
      for (let i = binStart; i < Math.min(binEnd, BINS); i++) {
        xProj[i]++;
      }
    }

    // Find valleys (gaps between columns) as bins with zero or very low coverage
    const maxProj = Math.max(...xProj);
    const threshold = maxProj * 0.05;

    const columns = [];
    let inColumn = false;
    let colStart = 0;

    for (let i = 0; i < BINS; i++) {
      if (!inColumn && xProj[i] > threshold) {
        inColumn = true;
        colStart = i * binWidth;
      } else if (inColumn && xProj[i] <= threshold) {
        inColumn = false;
        columns.push({ x: colStart, w: i * binWidth - colStart });
      }
    }
    if (inColumn) {
      columns.push({ x: colStart, w: imageW - colStart });
    }

    return columns.length > 0 ? columns : [{ x: 0, w: imageW }];
  }

  /**
   * Group regions that are on the same horizontal line.
   */
  _groupIntoLines(regions) {
    const used = new Set();
    const lines = [];

    for (let i = 0; i < regions.length; i++) {
      if (used.has(i)) continue;
      const ri = regions[i];
      const lineMembers = [ri];
      used.add(i);

      for (let j = i + 1; j < regions.length; j++) {
        if (used.has(j)) continue;
        const rj = regions[j];
        // Same line: y-overlap by at least 50%
        const overlapY = Math.min(ri.bbox.y + ri.bbox.h, rj.bbox.y + rj.bbox.h)
                       - Math.max(ri.bbox.y, rj.bbox.y);
        const minH = Math.min(ri.bbox.h, rj.bbox.h);
        if (overlapY / minH > 0.5) {
          lineMembers.push(rj);
          used.add(j);
        }
      }

      // Sort line members left-to-right
      lineMembers.sort((a, b) => a.bbox.x - b.bbox.x);

      const lineY    = Math.min(...lineMembers.map(r => r.bbox.y));
      const lineH    = Math.max(...lineMembers.map(r => r.bbox.y + r.bbox.h)) - lineY;
      const lineText = lineMembers.map(r => r.text).join(' ');

      lines.push({
        regions: lineMembers,
        bbox:    { x: lineMembers[0].bbox.x, y: lineY, w: lineMembers[lineMembers.length - 1].bbox.x + lineMembers[lineMembers.length - 1].bbox.w - lineMembers[0].bbox.x, h: lineH },
        text:    lineText,
        confidence: lineMembers.reduce((s, r) => s + r.confidence, 0) / lineMembers.length,
      });
    }

    // Sort lines top-to-bottom
    lines.sort((a, b) => a.bbox.y - b.bbox.y);
    return lines;
  }

  /**
   * Group lines into paragraphs/blocks based on inter-line gaps.
   */
  _groupIntoBlocks(lines, columns) {
    if (lines.length === 0) return [];

    const blocks = [];
    let currentBlock = [lines[0]];
    const avgH = lines.reduce((s, l) => s + l.bbox.h, 0) / lines.length;

    for (let i = 1; i < lines.length; i++) {
      const prev = lines[i - 1];
      const curr = lines[i];
      const gap  = curr.bbox.y - (prev.bbox.y + prev.bbox.h);

      // New block if: large gap, or column change, or indentation
      const isLargeGap  = gap > avgH * this.lineGapThreshold;
      const isColChange = this._isDifferentColumn(prev, curr, columns);
      const isIndented  = Math.abs(curr.bbox.x - prev.bbox.x) > this.paragraphIndentPx
                          && curr.bbox.x > prev.bbox.x;

      if (isLargeGap || isColChange) {
        if (currentBlock.length >= this.minBlockLines) {
          blocks.push(this._makeBlock(currentBlock));
        }
        currentBlock = [curr];
      } else {
        currentBlock.push(curr);
      }
    }

    if (currentBlock.length >= this.minBlockLines) {
      blocks.push(this._makeBlock(currentBlock));
    }

    return blocks;
  }

  _isDifferentColumn(lineA, lineB, columns) {
    const colA = columns.findIndex(c => lineA.bbox.x >= c.x && lineA.bbox.x < c.x + c.w);
    const colB = columns.findIndex(c => lineB.bbox.x >= c.x && lineB.bbox.x < c.x + c.w);
    return colA !== colB && colA !== -1 && colB !== -1;
  }

  _makeBlock(lines) {
    const allText = lines.map(l => l.text).join('\n');
    const xs = lines.map(l => l.bbox.x);
    const ys = lines.map(l => l.bbox.y);
    const x2s = lines.map(l => l.bbox.x + l.bbox.w);
    const y2s = lines.map(l => l.bbox.y + l.bbox.h);
    return {
      lines,
      text:       allText,
      bbox:       { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...x2s) - Math.min(...xs), h: Math.max(...y2s) - Math.min(...ys) },
      type:       BLOCK_TYPES.PARAGRAPH,
      confidence: lines.reduce((s, l) => s + l.confidence, 0) / lines.length,
    };
  }

  /**
   * Classify blocks by type (header, paragraph, table, etc.)
   */
  _classifyBlocks(blocks, allRegions) {
    const avgFontSize = this._avgLineHeight(allRegions);

    return blocks.map(block => {
      const blockH = block.bbox.h / Math.max(block.lines.length, 1);
      const text   = block.text.trim();

      let type = BLOCK_TYPES.PARAGRAPH;

      // Header heuristics
      if (blockH > avgFontSize * this.headerHeightRatio && block.lines.length <= 2) {
        type = BLOCK_TYPES.HEADER;
      }

      // Footnote heuristics (small text, near bottom — requires imageH context)
      if (blockH < avgFontSize * 0.75) {
        type = BLOCK_TYPES.FOOTNOTE;
      }

      // Caption: short single line, often starts with "Fig" or "Table"
      if (block.lines.length === 1 && /^(fig\.?|figure|table|tbl\.?|photo|image)\s/i.test(text)) {
        type = BLOCK_TYPES.CAPTION;
      }

      // Table detection: multiple columns of numbers/aligned text
      const columnScore = this._tableScore(block);
      if (columnScore > 0.7) {
        type = BLOCK_TYPES.TABLE;
      }

      return { ...block, type };
    });
  }

  /**
   * Compute a "table-ness" score for a block.
   * Looks for aligned column patterns (multiple regions per line).
   */
  _tableScore(block) {
    const multiColumnLines = block.lines.filter(l => l.regions.length > 2).length;
    const totalLines       = block.lines.length;
    if (totalLines < 2) return 0;

    const ratio = multiColumnLines / totalLines;

    // Check x-alignment: do regions in different lines align to same x positions?
    const lineRegionCounts = block.lines.map(l => l.regions.length);
    const maxPerLine = Math.max(...lineRegionCounts);
    if (maxPerLine < 2) return 0;

    // Check if region x positions repeat across lines (column alignment)
    const xPositions = block.lines.map(l => l.regions.map(r => Math.round(r.bbox.x / 10) * 10));
    const allX = [...new Set(xPositions.flat())].sort((a, b) => a - b);
    const alignedCols = allX.filter(x =>
      xPositions.filter(row => row.some(rx => Math.abs(rx - x) < 15)).length >= 2
    ).length;

    return (ratio * 0.4 + (alignedCols >= 2 ? 0.6 : 0.0));
  }

  /**
   * Order blocks in natural reading order considering columns.
   * Strategy: column-major ordering (left column first, then right).
   */
  _computeReadingOrder(blocks, columns, orientResult) {
    if (columns.length <= 1) {
      return blocks.sort((a, b) => a.bbox.y - b.bbox.y);
    }

    // Assign each block to a column
    const withCol = blocks.map(block => {
      const cx = block.bbox.x + block.bbox.w / 2;
      const col = columns.reduce((best, c, i) => {
        const dist = Math.abs(cx - (c.x + c.w / 2));
        return dist < best.dist ? { idx: i, dist } : best;
      }, { idx: 0, dist: Infinity }).idx;
      return { block, col };
    });

    // Sort: by column first, then by y within column
    withCol.sort((a, b) => {
      if (a.col !== b.col) return a.col - b.col;
      return a.block.bbox.y - b.block.bbox.y;
    });

    return withCol.map(({ block }) => block);
  }

  /**
   * Build full document text from ordered blocks.
   */
  _buildFullText(blocks) {
    return blocks
      .map(block => {
        const prefix = block.type === BLOCK_TYPES.HEADER ? '# ' : '';
        return prefix + block.text;
      })
      .join('\n\n');
  }

  _emptyDocument() {
    return {
      blocks:      [],
      columns:     1,
      lineCount:   0,
      regionCount: 0,
      fullText:    '',
      pageWidth:   0,
      pageHeight:  0,
      orientation: 0,
      scriptDir:   'LTR',
    };
  }
}

export { BLOCK_TYPES };

/**
 * @typedef {Object} DocumentBlock
 * @property {object[]} lines
 * @property {string} text
 * @property {{x,y,w,h}} bbox
 * @property {string} type - from BLOCK_TYPES
 * @property {number} confidence
 */

/**
 * @typedef {Object} DocumentModel
 * @property {DocumentBlock[]} blocks
 * @property {number} columns
 * @property {number} lineCount
 * @property {number} regionCount
 * @property {string} fullText
 * @property {number} pageWidth
 * @property {number} pageHeight
 * @property {number} orientation
 * @property {string} scriptDir
 */
