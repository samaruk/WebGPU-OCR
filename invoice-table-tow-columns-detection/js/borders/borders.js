/* ======================================================================
   BORDER (RULE) DETECTION — curved-line aware
   ----------------------------------------------------------------------
   Why this rewrite:
     The previous detector scanned each row to find horizontal bridged
     ink runs and clustered adjacent rows into "logical" rules.  That
     assumed every rule sat at a constant Y.  Scanned invoices often
     have residual page-curl after dewarping, so the table's horizontal
     rules curve gently across the page width — Y varies by a few
     pixels over hundreds of pixels of X.  The per-row scanner sees
     such a curve as many short, disconnected runs (one per row),
     none of which is long enough to pass minLen.  Result: the curve
     wasn't detected at all.

   New approach — morphological opening + CCA + centerline tracking:

     1. HORIZONTAL OPENING (erode + dilate with a horizontal kernel)
        of radius K.  A pixel survives iff every one of its 2K+1
        horizontal neighbours is ink.  This wipes out anything that
        isn't a locally-near-horizontal structure of length ≥ 2K+1.
        - Long horizontal rules (straight or smoothly curved) survive.
        - Text strokes (typically < 2K wide horizontally at any row)
          are erased.
        - The maximum slope a curve can have and still survive is
          (line thickness) / K — so a 2-px line with K=8 tolerates up
          to ~14° tilt at any local point.  That's plenty for the
          gentle page-curl curves seen on scanned documents.

     2. CCA (8-connectivity) on the opened binary.  Each connected
        component is one rule.  Curved rules emerge as a single
        component naturally, because the opening preserves their
        spatial connectivity along the curve.

     3. CENTERLINE TRACKING.  For each component, walk the X-range of
        its bounding box and at every column compute the mean Y of the
        component's pixels in that column.  The resulting array of
        (x, y) points is the rule's polyline — straight rules have a
        flat polyline, curved rules trace the curve.

     4. FILTERS.  A component becomes a horizontal rule iff:
          - Its width spans ≥ minLenH (a fraction of image width).
          - Its width is at least 4× its bbox height (horizontal
            orientation, not a square blob).
          - Its mean per-column thickness ≤ maxThickness.
        Vertical rules use the analogous filter swapped.

   Output shape (kept backwards-compatible with the previous consumer
   API — render.js and analyzeTableFromBorders both still work):

     hLine = {
       polyline : [{x, y}, ...],   // NEW — densely sampled centerline
       x0, x1,                     // horizontal extent
       y0, y1,                     // vertical extent (the curve's bbox)
       y,                          // representative Y = mean polyline Y
       thickness,                  // mean per-column ink height
       peak                        // density of the densest column
     }
     vLine = analogous with x/y swapped.

   The "y" / "x" scalars give callers the legacy straight-line view of
   each rule.  Renderers that know about polylines should draw those
   instead — analyzeTableFromBorders only needs the scalar to bound the
   band, which still works correctly on a curved rule because the mean
   Y captures where the curve sits on average.
   ====================================================================== */

/* ----------------------------------------------------------------------
   Polyline smoothing — sliding-window mean of the polyline's Y values
   (for h-rules) or X values (for v-rules).

   Why:  the raw polyline assigns Y = mean of all component ink pixels
   in each column.  Where text overlaps the rule — a character body
   that the rule passes through — the column's ink set is dominated by
   the body's pixels rather than the rule's, so the per-column mean
   shifts toward the body's center and the polyline kinks sharply.
   The underlying rule is smooth, so a sliding mean over the polyline
   (window radius >> typical character-body width) averages those
   text-induced kinks out while preserving the rule's actual curvature.

   Cost is O(N) per polyline thanks to running-sum updates.
   ---------------------------------------------------------------------- */
function smoothPolylineAlongX(polyline, windowRadius){
  const n = polyline.length;
  if(n < 2 || windowRadius <= 0) return polyline;
  const smoothed = new Array(n);

  let sum = 0;
  const initialRight = Math.min(windowRadius, n - 1);
  for(let i = 0; i <= initialRight; i++) sum += polyline[i].y;
  let windowSize = initialRight + 1;

  for(let i = 0; i < n; i++){
    smoothed[i] = { x: polyline[i].x, y: sum / windowSize };

    const newRightIdx = i + windowRadius + 1;
    if(newRightIdx < n){ sum += polyline[newRightIdx].y; windowSize++; }
    const departingLeftIdx = i - windowRadius;
    if(departingLeftIdx >= 0){ sum -= polyline[departingLeftIdx].y; windowSize--; }
  }
  return smoothed;
}

function smoothPolylineAlongY(polyline, windowRadius){
  const n = polyline.length;
  if(n < 2 || windowRadius <= 0) return polyline;
  const smoothed = new Array(n);

  let sum = 0;
  const initialRight = Math.min(windowRadius, n - 1);
  for(let i = 0; i <= initialRight; i++) sum += polyline[i].x;
  let windowSize = initialRight + 1;

  for(let i = 0; i < n; i++){
    smoothed[i] = { x: sum / windowSize, y: polyline[i].y };

    const newRightIdx = i + windowRadius + 1;
    if(newRightIdx < n){ sum += polyline[newRightIdx].x; windowSize++; }
    const departingLeftIdx = i - windowRadius;
    if(departingLeftIdx >= 0){ sum -= polyline[departingLeftIdx].x; windowSize--; }
  }
  return smoothed;
}

/* ----------------------------------------------------------------------
   Per-row / per-column GAP-BRIDGING.

   For each row (column), find the ink pixels.  Whenever two ink pixels
   are separated by a gap of width ≤ maxGap, fill the gap with ink.
   This is NOT a morphological closing: it never extends the structure
   beyond its original first/last ink position.  That distinction
   matters at image edges — a morphological dilate would pull ink from
   outside the structure's natural bounds, and a subsequent erosion
   can't always recover, so the structure ends up extended to the image
   edge.  Run-aware gap-bridging avoids that pathology entirely.
   ---------------------------------------------------------------------- */
function bridgeHorizontalGaps(binary, imageWidth, imageHeight, maxGap){
  const output = new Uint8Array(binary);     // start from a copy
  for(let y = 0; y < imageHeight; y++){
    const rowOffset = y * imageWidth;
    let lastInkX = -1;
    for(let x = 0; x < imageWidth; x++){
      if(binary[rowOffset + x]){
        if(lastInkX >= 0 && x - lastInkX > 1 && (x - lastInkX - 1) <= maxGap){
          for(let xi = lastInkX + 1; xi < x; xi++){
            output[rowOffset + xi] = 1;
          }
        }
        lastInkX = x;
      }
    }
  }
  return output;
}

function bridgeVerticalGaps(binary, imageWidth, imageHeight, maxGap){
  const output = new Uint8Array(binary);
  for(let x = 0; x < imageWidth; x++){
    let lastInkY = -1;
    for(let y = 0; y < imageHeight; y++){
      if(binary[y * imageWidth + x]){
        if(lastInkY >= 0 && y - lastInkY > 1 && (y - lastInkY - 1) <= maxGap){
          for(let yi = lastInkY + 1; yi < y; yi++){
            output[yi * imageWidth + x] = 1;
          }
        }
        lastInkY = y;
      }
    }
  }
  return output;
}



/* ----------------------------------------------------------------------
   Sliding-window morphological primitives, O(N) total per axis.

   The erode pass keeps a running count of zero pixels inside the 2K+1
   horizontal/vertical window centred on the current pixel; the pixel
   survives iff that count is zero.  The dilate pass keeps a running
   count of one pixels and outputs 1 iff that count is positive.  When
   the window advances by one pixel the count is updated by adding the
   new tail pixel and subtracting the departing head pixel — constant
   work per output pixel, independent of K.
   ---------------------------------------------------------------------- */
function erodeHorizontal(binary, imageWidth, imageHeight, kernelRadius){
  const output = new Uint8Array(binary.length);
  for(let y = 0; y < imageHeight; y++){
    const rowOffset = y * imageWidth;

    // Prime the window for x = 0.  Initial window is [-K..K] clipped
    // to [0..K]; we count zeros in that range.
    let zerosInWindow = 0;
    const initialRightEdge = Math.min(kernelRadius, imageWidth - 1);
    for(let xi = 0; xi <= initialRightEdge; xi++){
      if(!binary[rowOffset + xi]) zerosInWindow++;
    }

    for(let x = 0; x < imageWidth; x++){
      // A pixel survives erosion iff every window pixel is ink (no zeros).
      output[rowOffset + x] = (zerosInWindow === 0) ? 1 : 0;

      // Slide the window one step right: add new right edge if in bounds,
      // remove the departing left edge if it was in bounds.
      const newRightEdgeX = x + kernelRadius + 1;
      if(newRightEdgeX < imageWidth){
        if(!binary[rowOffset + newRightEdgeX]) zerosInWindow++;
      }
      const departingLeftEdgeX = x - kernelRadius;
      if(departingLeftEdgeX >= 0){
        if(!binary[rowOffset + departingLeftEdgeX]) zerosInWindow--;
      }
    }
  }
  return output;
}

function dilateHorizontal(binary, imageWidth, imageHeight, kernelRadius){
  const output = new Uint8Array(binary.length);
  for(let y = 0; y < imageHeight; y++){
    const rowOffset = y * imageWidth;

    let onesInWindow = 0;
    const initialRightEdge = Math.min(kernelRadius, imageWidth - 1);
    for(let xi = 0; xi <= initialRightEdge; xi++){
      if(binary[rowOffset + xi]) onesInWindow++;
    }

    for(let x = 0; x < imageWidth; x++){
      output[rowOffset + x] = (onesInWindow > 0) ? 1 : 0;

      const newRightEdgeX = x + kernelRadius + 1;
      if(newRightEdgeX < imageWidth){
        if(binary[rowOffset + newRightEdgeX]) onesInWindow++;
      }
      const departingLeftEdgeX = x - kernelRadius;
      if(departingLeftEdgeX >= 0){
        if(binary[rowOffset + departingLeftEdgeX]) onesInWindow--;
      }
    }
  }
  return output;
}

function erodeVertical(binary, imageWidth, imageHeight, kernelRadius){
  const output = new Uint8Array(binary.length);
  for(let x = 0; x < imageWidth; x++){

    let zerosInWindow = 0;
    const initialBottomEdge = Math.min(kernelRadius, imageHeight - 1);
    for(let yi = 0; yi <= initialBottomEdge; yi++){
      if(!binary[yi * imageWidth + x]) zerosInWindow++;
    }

    for(let y = 0; y < imageHeight; y++){
      output[y * imageWidth + x] = (zerosInWindow === 0) ? 1 : 0;

      const newBottomEdgeY = y + kernelRadius + 1;
      if(newBottomEdgeY < imageHeight){
        if(!binary[newBottomEdgeY * imageWidth + x]) zerosInWindow++;
      }
      const departingTopEdgeY = y - kernelRadius;
      if(departingTopEdgeY >= 0){
        if(!binary[departingTopEdgeY * imageWidth + x]) zerosInWindow--;
      }
    }
  }
  return output;
}

function dilateVertical(binary, imageWidth, imageHeight, kernelRadius){
  const output = new Uint8Array(binary.length);
  for(let x = 0; x < imageWidth; x++){

    let onesInWindow = 0;
    const initialBottomEdge = Math.min(kernelRadius, imageHeight - 1);
    for(let yi = 0; yi <= initialBottomEdge; yi++){
      if(binary[yi * imageWidth + x]) onesInWindow++;
    }

    for(let y = 0; y < imageHeight; y++){
      output[y * imageWidth + x] = (onesInWindow > 0) ? 1 : 0;

      const newBottomEdgeY = y + kernelRadius + 1;
      if(newBottomEdgeY < imageHeight){
        if(binary[newBottomEdgeY * imageWidth + x]) onesInWindow++;
      }
      const departingTopEdgeY = y - kernelRadius;
      if(departingTopEdgeY >= 0){
        if(binary[departingTopEdgeY * imageWidth + x]) onesInWindow--;
      }
    }
  }
  return output;
}

/* ----------------------------------------------------------------------
   8-connectivity CCA + per-component centerline tracking.

   For each connected component on the opened-horizontal binary, we
   collect:
     - The component's bounding box (minX..maxX, minY..maxY).
     - Per-column accumulators: sum of Y values and pixel count at
       every X in the component's bbox.  The mean Y at each X becomes
       one polyline vertex.
     - Per-column extent: minY and maxY at every X — used to derive the
       mean thickness across the component.

   The accumulators are stored in image-wide typed arrays that are
   zeroed out per-component (over only the relevant X range), so a
   document with many short noise components doesn't blow up memory.
   ---------------------------------------------------------------------- */
function traceHorizontalRules(openedBinary, originalBinary, imageWidth, imageHeight, minRuleLength, maxAspectFlip, smoothingRadius){
  const labels = new Int32Array(openedBinary.length);
  const bfsStack = new Int32Array(openedBinary.length);

  // Per-X accumulators reused across components.
  const columnYSum   = new Float64Array(imageWidth);
  const columnYCount = new Int32Array(imageWidth);
  const columnYMin   = new Int32Array(imageWidth);
  const columnYMax   = new Int32Array(imageWidth);

  let nextLabel = 0;
  const rules = [];

  for(let seedY = 0; seedY < imageHeight; seedY++){
    for(let seedX = 0; seedX < imageWidth; seedX++){
      const seedIdx = seedY * imageWidth + seedX;
      if(!openedBinary[seedIdx] || labels[seedIdx]) continue;

      // --- BFS to flood-fill this component ---
      nextLabel++;
      const componentLabel = nextLabel;
      let stackTop = 0;
      bfsStack[stackTop++] = seedIdx;
      labels[seedIdx] = componentLabel;

      let bboxMinX = seedX, bboxMaxX = seedX;
      let bboxMinY = seedY, bboxMaxY = seedY;
      let totalPixelsInComponent = 0;

      while(stackTop > 0){
        const idx = bfsStack[--stackTop];
        const px = idx % imageWidth;
        const py = (idx - px) / imageWidth;

        totalPixelsInComponent++;
        if(px < bboxMinX) bboxMinX = px;
        if(px > bboxMaxX) bboxMaxX = px;
        if(py < bboxMinY) bboxMinY = py;
        if(py > bboxMaxY) bboxMaxY = py;

        // Per-column accumulation.
        if(columnYCount[px] === 0){
          columnYMin[px] = py;
          columnYMax[px] = py;
        } else {
          if(py < columnYMin[px]) columnYMin[px] = py;
          if(py > columnYMax[px]) columnYMax[px] = py;
        }
        columnYSum[px]   += py;
        columnYCount[px] += 1;

        // 8-connectivity neighbours.
        for(let dy = -1; dy <= 1; dy++){
          const ny = py + dy;
          if(ny < 0 || ny >= imageHeight) continue;
          for(let dx = -1; dx <= 1; dx++){
            if(dx === 0 && dy === 0) continue;
            const nx = px + dx;
            if(nx < 0 || nx >= imageWidth) continue;
            const nidx = ny * imageWidth + nx;
            if(openedBinary[nidx] && !labels[nidx]){
              labels[nidx] = componentLabel;
              bfsStack[stackTop++] = nidx;
            }
          }
        }
      }

      const bboxWidth  = bboxMaxX - bboxMinX + 1;
      const bboxHeight = bboxMaxY - bboxMinY + 1;
      const longEnough        = bboxWidth >= minRuleLength;
      const horizontallyShaped = bboxWidth >= bboxHeight * maxAspectFlip;

      if(longEnough && horizontallyShaped){
        // Collect per-column data: x, mean Y of component pixels at this
        // column, and the per-column thickness (maxY - minY + 1).
        const cols = [];
        for(let x = bboxMinX; x <= bboxMaxX; x++){
          if(columnYCount[x] > 0){
            cols.push({
              x,
              y         : columnYSum[x] / columnYCount[x],
              thickness : columnYMax[x] - columnYMin[x] + 1
            });
          }
        }

        if(cols.length >= 2){
          // Median per-column thickness gives the rule's typical thickness.
          // Columns whose thickness vastly exceeds this are "body" columns
          // — text glyphs or other thick ink that the rule passes through.
          // Including them in the per-column mean pulls the polyline Y
          // toward the body's vertical centre and produces sharp kinks
          // at those positions, even though the underlying rule is smooth.
          // Exclude them from the polyline and interpolate the rule's Y
          // across them from non-body neighbours.
          const sortedThick     = cols.map(c => c.thickness).slice().sort((a, b) => a - b);
          const medianThickness = sortedThick[sortedThick.length >> 1];
          const bodyThreshold   = Math.max(medianThickness * 2, medianThickness + 4);
          const isBody = cols.map(c => c.thickness > bodyThreshold);

          // Linear-interp Y across body columns; edge replication at ends.
          const interpolated = new Array(cols.length);
          for(let i = 0; i < cols.length; i++){
            if(!isBody[i]){
              interpolated[i] = { x: cols[i].x, y: cols[i].y };
              continue;
            }
            let leftIdx = i - 1;
            while(leftIdx >= 0 && isBody[leftIdx]) leftIdx--;
            let rightIdx = i + 1;
            while(rightIdx < cols.length && isBody[rightIdx]) rightIdx++;
            let interpY;
            if(leftIdx < 0 && rightIdx >= cols.length){
              interpY = cols[i].y;                                // no non-body neighbours
            } else if(leftIdx < 0){
              interpY = cols[rightIdx].y;
            } else if(rightIdx >= cols.length){
              interpY = cols[leftIdx].y;
            } else {
              const t = (i - leftIdx) / (rightIdx - leftIdx);
              interpY = cols[leftIdx].y + t * (cols[rightIdx].y - cols[leftIdx].y);
            }
            interpolated[i] = { x: cols[i].x, y: interpY };
          }

          // Smooth.  Cleans up residual pixel-level jitter; the
          // interpolation above already handled the larger
          // text-body-induced shifts.
          const polyline = smoothPolylineAlongX(interpolated, smoothingRadius);

          // True thickness = mean per-column thickness over non-body
          // columns — the rule's own ink height, not the bodies'.
          let trueThickSum = 0, trueThickCount = 0;
          for(let i = 0; i < cols.length; i++){
            if(!isBody[i]){
              trueThickSum   += cols[i].thickness;
              trueThickCount += 1;
            }
          }
          const meanThickness = trueThickCount > 0
                                ? trueThickSum / trueThickCount
                                : medianThickness;

          const continuity      = polyline.length / bboxWidth;
          const representativeY = polyline.reduce((s, p) => s + p.y, 0) / polyline.length;

          // Sample the smoothed polyline against the original (un-bridged)
          // binary.  For a real rule (curved or straight) every polyline
          // point lies on ink, so coverage ~1.0.  For a bridge-induced
          // false positive (sparse dots or text row), most points land
          // on background in the original, so coverage drops sharply.
          let originalInkHits = 0;
          for(const p of polyline){
            const sampleX = p.x | 0;
            const sampleY = Math.round(p.y);
            if(sampleY >= 0 && sampleY < imageHeight &&
               originalBinary[sampleY * imageWidth + sampleX]){
              originalInkHits++;
            }
          }
          const originalInkCoverage = originalInkHits / polyline.length;

          rules.push({
            polyline,
            x0       : bboxMinX,
            x1       : bboxMaxX,
            y0       : bboxMinY,
            y1       : bboxMaxY,
            y        : representativeY,
            thickness: meanThickness,
            coverage : originalInkCoverage,
            continuity,
            peak     : originalInkCoverage,
            pixels   : totalPixelsInComponent
          });
        }
      }

      // Zero out only the columns we touched, ready for the next component.
      for(let x = bboxMinX; x <= bboxMaxX; x++){
        columnYSum[x]   = 0;
        columnYCount[x] = 0;
      }
    }
  }
  return rules;
}

function traceVerticalRules(openedBinary, originalBinary, imageWidth, imageHeight, minRuleLength, maxAspectFlip, smoothingRadius){
  const labels = new Int32Array(openedBinary.length);
  const bfsStack = new Int32Array(openedBinary.length);

  // Per-Y accumulators reused across components.
  const rowXSum   = new Float64Array(imageHeight);
  const rowXCount = new Int32Array(imageHeight);
  const rowXMin   = new Int32Array(imageHeight);
  const rowXMax   = new Int32Array(imageHeight);

  let nextLabel = 0;
  const rules = [];

  for(let seedY = 0; seedY < imageHeight; seedY++){
    for(let seedX = 0; seedX < imageWidth; seedX++){
      const seedIdx = seedY * imageWidth + seedX;
      if(!openedBinary[seedIdx] || labels[seedIdx]) continue;

      nextLabel++;
      const componentLabel = nextLabel;
      let stackTop = 0;
      bfsStack[stackTop++] = seedIdx;
      labels[seedIdx] = componentLabel;

      let bboxMinX = seedX, bboxMaxX = seedX;
      let bboxMinY = seedY, bboxMaxY = seedY;
      let totalPixelsInComponent = 0;

      while(stackTop > 0){
        const idx = bfsStack[--stackTop];
        const px = idx % imageWidth;
        const py = (idx - px) / imageWidth;

        totalPixelsInComponent++;
        if(px < bboxMinX) bboxMinX = px;
        if(px > bboxMaxX) bboxMaxX = px;
        if(py < bboxMinY) bboxMinY = py;
        if(py > bboxMaxY) bboxMaxY = py;

        if(rowXCount[py] === 0){
          rowXMin[py] = px;
          rowXMax[py] = px;
        } else {
          if(px < rowXMin[py]) rowXMin[py] = px;
          if(px > rowXMax[py]) rowXMax[py] = px;
        }
        rowXSum[py]   += px;
        rowXCount[py] += 1;

        for(let dy = -1; dy <= 1; dy++){
          const ny = py + dy;
          if(ny < 0 || ny >= imageHeight) continue;
          for(let dx = -1; dx <= 1; dx++){
            if(dx === 0 && dy === 0) continue;
            const nx = px + dx;
            if(nx < 0 || nx >= imageWidth) continue;
            const nidx = ny * imageWidth + nx;
            if(openedBinary[nidx] && !labels[nidx]){
              labels[nidx] = componentLabel;
              bfsStack[stackTop++] = nidx;
            }
          }
        }
      }

      const bboxWidth  = bboxMaxX - bboxMinX + 1;
      const bboxHeight = bboxMaxY - bboxMinY + 1;
      const longEnough       = bboxHeight >= minRuleLength;
      const verticallyShaped = bboxHeight >= bboxWidth * maxAspectFlip;

      if(longEnough && verticallyShaped){
        // Symmetric of the h-tracer: per-row data with x-mean and
        // per-row thickness, then body detection and interpolation
        // along Y.
        const rows = [];
        for(let y = bboxMinY; y <= bboxMaxY; y++){
          if(rowXCount[y] > 0){
            rows.push({
              y,
              x         : rowXSum[y] / rowXCount[y],
              thickness : rowXMax[y] - rowXMin[y] + 1
            });
          }
        }

        if(rows.length >= 2){
          const sortedThick     = rows.map(r => r.thickness).slice().sort((a, b) => a - b);
          const medianThickness = sortedThick[sortedThick.length >> 1];
          const bodyThreshold   = Math.max(medianThickness * 2, medianThickness + 4);
          const isBody = rows.map(r => r.thickness > bodyThreshold);

          const interpolated = new Array(rows.length);
          for(let i = 0; i < rows.length; i++){
            if(!isBody[i]){
              interpolated[i] = { x: rows[i].x, y: rows[i].y };
              continue;
            }
            let leftIdx = i - 1;
            while(leftIdx >= 0 && isBody[leftIdx]) leftIdx--;
            let rightIdx = i + 1;
            while(rightIdx < rows.length && isBody[rightIdx]) rightIdx++;
            let interpX;
            if(leftIdx < 0 && rightIdx >= rows.length){
              interpX = rows[i].x;
            } else if(leftIdx < 0){
              interpX = rows[rightIdx].x;
            } else if(rightIdx >= rows.length){
              interpX = rows[leftIdx].x;
            } else {
              const t = (i - leftIdx) / (rightIdx - leftIdx);
              interpX = rows[leftIdx].x + t * (rows[rightIdx].x - rows[leftIdx].x);
            }
            interpolated[i] = { x: interpX, y: rows[i].y };
          }

          const polyline = smoothPolylineAlongY(interpolated, smoothingRadius);

          let trueThickSum = 0, trueThickCount = 0;
          for(let i = 0; i < rows.length; i++){
            if(!isBody[i]){
              trueThickSum   += rows[i].thickness;
              trueThickCount += 1;
            }
          }
          const meanThickness = trueThickCount > 0
                                ? trueThickSum / trueThickCount
                                : medianThickness;

          const continuity      = polyline.length / bboxHeight;
          const representativeX = polyline.reduce((s, p) => s + p.x, 0) / polyline.length;

          let originalInkHits = 0;
          for(const p of polyline){
            const sampleX = Math.round(p.x);
            const sampleY = p.y | 0;
            if(sampleX >= 0 && sampleX < imageWidth &&
               originalBinary[sampleY * imageWidth + sampleX]){
              originalInkHits++;
            }
          }
          const originalInkCoverage = originalInkHits / polyline.length;

          rules.push({
            polyline,
            x0       : bboxMinX,
            x1       : bboxMaxX,
            y0       : bboxMinY,
            y1       : bboxMaxY,
            x        : representativeX,
            thickness: meanThickness,
            coverage : originalInkCoverage,
            continuity,
            peak     : originalInkCoverage,
            pixels   : totalPixelsInComponent
          });
        }
      }

      for(let y = bboxMinY; y <= bboxMaxY; y++){
        rowXSum[y]   = 0;
        rowXCount[y] = 0;
      }
    }
  }
  return rules;
}

/* ----------------------------------------------------------------------
   Public entry point.

   The pipeline is two steps per axis:

     1. GAP-BRIDGING (per row or per column).  Fills gaps of width
        ≤ maxGap between adjacent ink runs.  This restores continuity
        across text crossings on a rule without extending the rule
        beyond its original endpoints — important so a rule that
        stops short of the image edge stays inside its true span
        rather than getting pulled out to the boundary.

     2. OPENING (erode then dilate with a directional kernel).
        Wipes out anything that isn't a locally-near-horizontal
        (or near-vertical) structure of length ≥ 2·openKernel + 1.
        Text strokes disappear; long rules, straight or smoothly
        curved, survive.  The maximum slope a curve can have and
        still survive is (line thickness) / openKernel.

   CCA on the opened binary then yields one component per rule, and
   per-column (or per-row) centerline tracking gives the rule's
   polyline.

   opts (all tunable):
     minLenFrac        (0.18)  — a rule must span ≥ this fraction of W/H.

     maxGapH           (12)    — horizontal gap-bridging tolerance.
                                   Gaps of ≤ this many background pixels
                                   between two ink runs in the same row
                                   are filled.  Set ≥ the widest text
                                   glyph that typically crosses a rule.
     maxGapV           (12)    — vertical gap-bridging tolerance.

     openKernelH       (8)     — horizontal opening kernel radius for
                                   h-rules.  Larger = more aggressive
                                   text rejection, less curvature
                                   tolerance.  Max tolerable slope at
                                   any local point ≈ lineThickness / K.
     openKernelV       (8)     — vertical opening kernel radius.

     maxThickness      (8)     — discard rules whose mean per-column
                                   (h-rules) or per-row (v-rules) ink
                                   height exceeds this.  Genuine rules
                                   are 1-3 px thick; text "lines"
                                   register as 6-15 px.

     minCoverage       (0.70)  — fraction of the rule's polyline points
                                   whose location coincides with ink in
                                   the ORIGINAL binary.  A genuine rule
                                   (curved or straight) scores ~1.0
                                   because the polyline traces the line
                                   itself.  A false-positive built by
                                   the gap-bridging step on a sparse-dot
                                   row or text-row scores far lower
                                   because most polyline points land on
                                   background pixels in the original.

     orientationRatio  (4)     — bbox aspect-ratio gate; an h-rule's
                                   width must be ≥ this multiple of
                                   its bbox height (and v-rule symm).

     smoothingRadius   (15)    — sliding-window radius for smoothing
                                   each rule's polyline along its
                                   principal axis.  The raw polyline
                                   is the per-column mean Y of the
                                   CCA component, which kinks where
                                   text overlaps the rule (the column
                                   mean is pulled toward the text's
                                   vertical centre).  A smoothly
                                   curved rule has a much longer
                                   wavelength than typical character
                                   bodies (~20 px), so a window of
                                   ~30 px averages those kinks out
                                   without smearing the rule's actual
                                   curvature.  Set to 0 to disable.
   ---------------------------------------------------------------------- */
export function detectBorders(binary, imageWidth, imageHeight, opts = {}){
  const minLenFrac        = opts.minLenFrac        ?? 0.18;
  const maxGapH           = opts.maxGapH           ?? 12;
  const maxGapV           = opts.maxGapV           ?? 12;
  const openKernelH       = opts.openKernelH       ?? 8;
  const openKernelV       = opts.openKernelV       ?? 8;
  const maxThickness      = opts.maxThickness      ?? 8;
  const minCoverage       = opts.minCoverage       ?? 0.70;
  const orientationRatio  = opts.orientationRatio  ?? 4;
  const smoothingRadius   = opts.smoothingRadius   ?? 15;

  const minLenH = Math.max(8, Math.floor(imageWidth  * minLenFrac));
  const minLenV = Math.max(8, Math.floor(imageHeight * minLenFrac));

  // -- horizontal rules: bridge-then-open + CCA -----------------------
  const hBridged       = bridgeHorizontalGaps(binary, imageWidth, imageHeight, maxGapH);
  const hErodedForOpen = erodeHorizontal     (hBridged,         imageWidth, imageHeight, openKernelH);
  const hOpened        = dilateHorizontal    (hErodedForOpen,   imageWidth, imageHeight, openKernelH);
  const hRulesRaw      = traceHorizontalRules(hOpened, binary, imageWidth, imageHeight,
                                              minLenH, orientationRatio, smoothingRadius);
  const hLines = hRulesRaw
    .filter(r => r.thickness <= maxThickness)
    .filter(r => r.coverage  >= minCoverage);

  // -- vertical rules: same pipeline, axis swapped -------------------
  const vBridged       = bridgeVerticalGaps(binary, imageWidth, imageHeight, maxGapV);
  const vErodedForOpen = erodeVertical     (vBridged,         imageWidth, imageHeight, openKernelV);
  const vOpened        = dilateVertical    (vErodedForOpen,   imageWidth, imageHeight, openKernelV);
  const vRulesRaw      = traceVerticalRules(vOpened, binary, imageWidth, imageHeight,
                                            minLenV, orientationRatio, smoothingRadius);
  const vLines = vRulesRaw
    .filter(r => r.thickness <= maxThickness)
    .filter(r => r.coverage  >= minCoverage);

  // -- dashed / dotted rules (separate detector, merged into output) --
  const dashed = detectDashedRules(binary, imageWidth, imageHeight, opts);

  return {
    hLines : hLines.concat(dashed.hLines),
    vLines : vLines.concat(dashed.vLines),
    minLenH, minLenV,
    maxGapH, maxGapV,
    openKernelH, openKernelV,
    smoothingRadius,
    dashedHCount : dashed.hLines.length,
    dashedVCount : dashed.vLines.length,
    // Debug surfaces for the gallery's Border · ... stages.  These let
    // the user see exactly what the detector is reading and what each
    // intermediate step produces.
    debug : {
      hOpened,
      vOpened,
      dots             : dashed.dots || [],
      rejectedChains   : dashed.rejectedChains || []
    }
  };
}

/* ======================================================================
   DASHED / DOTTED RULES
   ----------------------------------------------------------------------
   The morphological detector above handles solid rules and rules with
   short gaps (text crossings).  Dashed and dotted patterns have gaps
   that are wider than the gap-bridging tolerance and would survive as
   many short components, none long enough to pass the length filter.

   This detector handles those patterns directly:

     1. CCA on the ORIGINAL binary.  Components are kept only if their
        bounding box fits inside maxDotSize × maxDotSize — dots and
        short dashes pass, full text characters do not (typical text is
        8-20 px in either dimension).

     2. CHAIN BUILDING.  Greedy: sort the small components by their
        X centre (for h-rules) or Y centre (for v-rules); for each
        un-used seed, walk forward consuming the next un-used component
        whose centre lies within the secondary-axis tolerance and the
        primary-axis stride limit.  The result is a sequence of
        approximately collinear, approximately equidistant components.

     3. PERIODICITY + SIZE VALIDATION.  A genuine dashed rule has:
          - uniform gaps      → maxGap / medianGap ≤ maxGapRatio
          - uniform dot sizes → maxSize / medianSize ≤ maxSizeRatio
          - enough dots       → chain.length ≥ minDots
          - long enough span  → spans ≥ minLenFracDashed × image dim
        Chains that fail any of these are discarded.  The conditions
        together reject scattered noise (varying gaps), unrelated
        large blobs (excluded by size), and short coincidental
        alignments (length cutoff).

     4. POLYLINE.  Each surviving chain is exported as a rule whose
        polyline is the sequence of dot centres.  A renderer drawing
        the polyline produces a visually smooth path through the
        centres — the right shape for a downstream table-cell layout,
        since cells are bounded by the line of dots, not by the dots'
        individual extents.
   ====================================================================== */

function extractSmallComponents(binary, imageWidth, imageHeight, maxComponentSize){
  const labels   = new Int32Array(binary.length);
  const bfsStack = new Int32Array(binary.length);
  let nextLabel  = 0;
  const components = [];

  for(let seedIdx = 0; seedIdx < binary.length; seedIdx++){
    if(!binary[seedIdx] || labels[seedIdx]) continue;

    nextLabel++;
    const myLabel = nextLabel;
    let stackTop = 0;
    bfsStack[stackTop++] = seedIdx;
    labels[seedIdx] = myLabel;

    const seedX = seedIdx % imageWidth;
    const seedY = (seedIdx - seedX) / imageWidth;
    let minX = seedX, maxX = seedX, minY = seedY, maxY = seedY;
    let pixelCount = 0;
    let stillSmall = true;

    while(stackTop > 0){
      const idx = bfsStack[--stackTop];
      const x = idx % imageWidth;
      const y = (idx - x) / imageWidth;

      pixelCount++;
      if(x < minX) minX = x;
      if(x > maxX) maxX = x;
      if(y < minY) minY = y;
      if(y > maxY) maxY = y;

      // Component grows past the max-dot-size threshold; we still need
      // to finish the BFS so subsequent seeds don't try to re-label
      // this component's pixels, but we won't keep it as a dot.
      if((maxX - minX + 1) > maxComponentSize || (maxY - minY + 1) > maxComponentSize){
        stillSmall = false;
      }

      for(let dy = -1; dy <= 1; dy++){
        const ny = y + dy;
        if(ny < 0 || ny >= imageHeight) continue;
        for(let dx = -1; dx <= 1; dx++){
          if(dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if(nx < 0 || nx >= imageWidth) continue;
          const nidx = ny * imageWidth + nx;
          if(binary[nidx] && !labels[nidx]){
            labels[nidx] = myLabel;
            bfsStack[stackTop++] = nidx;
          }
        }
      }
    }

    if(stillSmall && pixelCount > 0){
      components.push({
        cx     : (minX + maxX) / 2,
        cy     : (minY + maxY) / 2,
        x0     : minX,
        x1     : maxX,
        y0     : minY,
        y1     : maxY,
        w      : maxX - minX + 1,
        h      : maxY - minY + 1,
        pixels : pixelCount
      });
    }
  }

  return components;
}

/* Greedy chain build along the primary axis (X for h-rules, Y for v).
   Each new dot must lie within secondaryTolerance of the chain's last
   dot in the orthogonal axis, and within maxStride of the last dot in
   the primary axis.  This permits gentle drift in the orthogonal axis
   over the chain's length — important for slowly curved dashed lines. */
function buildDashedChains(dots, orientation, secondaryTolerance, maxStride, minDots){
  const isHorizontal = orientation === 'horizontal';
  const sorted = dots.slice().sort((a, b) =>
    isHorizontal ? a.cx - b.cx : a.cy - b.cy);

  const consumed = new Array(sorted.length).fill(false);
  const chains   = [];

  for(let i = 0; i < sorted.length; i++){
    if(consumed[i]) continue;
    consumed[i] = true;
    const chain = [sorted[i]];

    for(let j = i + 1; j < sorted.length; j++){
      if(consumed[j]) continue;
      const last     = chain[chain.length - 1];
      const primaryDelta   = isHorizontal ? sorted[j].cx - last.cx
                                          : sorted[j].cy - last.cy;
      if(primaryDelta > maxStride) break;       // sorted order — nothing further is closer
      const secondaryDelta = Math.abs(isHorizontal ? sorted[j].cy - last.cy
                                                   : sorted[j].cx - last.cx);
      if(secondaryDelta <= secondaryTolerance){
        chain.push(sorted[j]);
        consumed[j] = true;
      }
    }

    if(chain.length >= minDots) chains.push(chain);
  }
  return chains;
}

function summariseChain(chain, isHorizontal){
  // Gaps and dot sizes are the two consistency metrics.
  const n = chain.length;
  const gaps = new Array(n - 1);
  for(let i = 1; i < n; i++){
    gaps[i - 1] = isHorizontal ? chain[i].cx - chain[i - 1].cx
                               : chain[i].cy - chain[i - 1].cy;
  }
  const sortedGaps = gaps.slice().sort((a, b) => a - b);
  const medianGap  = sortedGaps[sortedGaps.length >> 1];
  const maxGap     = sortedGaps[sortedGaps.length - 1];

  const sizes = chain.map(d => Math.max(d.w, d.h));
  const sortedSizes = sizes.slice().sort((a, b) => a - b);
  const medianSize  = sortedSizes[sortedSizes.length >> 1];
  const maxSize     = sortedSizes[sortedSizes.length - 1];

  return {
    gaps, medianGap, maxGap,
    gapRatio  : medianGap > 0 ? maxGap  / medianGap  : Infinity,
    sizes, medianSize, maxSize,
    sizeRatio : medianSize > 0 ? maxSize / medianSize : 1
  };
}

/* For each dot in a chain, look for ink in the PERPENDICULAR direction
   to the chain (above/below for h-chains, left/right for v-chains),
   inside a strip the dot's primary-axis-width wide and extending
   perpIsolationDistance pixels into the perpendicular axis on each
   side.  Returns the fraction of dots that have ANY ink in that strip.

   A real isolated dashed rule's dots live in perpendicular empty space —
   the strips around each dot are all-background, so the fraction is ~0.
   Text patterns that *look* like dashed rules fail this:
     - 'i'-dot rows: each dot has the letter's stem 2-3 px below.
     - period columns at line-ends: each period has text characters to
       its left at line-spacing intervals.
   In both cases most dots have ink in the perpendicular strip, so the
   fraction is high and the chain is rejected. */
/* For each dot in a chain, measure the ORTHOGONAL extent of the text
   mask at that dot's position.  Returns the fraction of dots whose
   surrounding mask extent is "wide" relative to the chain's own dot
   size — i.e., the dot sits inside a structure that's much wider than
   the dot itself.

   This is the right discriminator between a real dashed border and
   punctuation embedded in text:
     - A real dashed border's dot sits inside the BORDER'S OWN
       dilation component, whose orthogonal extent is roughly
       (dot_size + 2 × colDilH) ≈ dot_size + 4 px.  Tight.
     - A decimal point in "12.34" sits inside the column's text
       dilation component, whose orthogonal extent is the FULL
       digit-body width (typically 40-80 px).  Wide.

   We pass medianSize so the threshold can scale with the chain's
   own dot size — a chain of 5-px-wide dashes naturally has a wider
   dilation than a chain of 1-px dots, and we don't want to count
   that as "text-wide". */
function chainOrthogonalExtentFraction(chain, mask, imageWidth, imageHeight,
                                       orientation, medianSize){
  if(!mask) return 0;
  // Width threshold: anything that's more than 4× the dot's own size
  // (and at least 8 px) is "wider than the dot alone could account
  // for", and thus is a text-column or text-row dilation.
  const threshold = Math.max(8, Math.round(medianSize * 4));
  let hits = 0;
  for(const dot of chain){
    const cx = Math.round(dot.cx);
    const cy = Math.round(dot.cy);
    if(cx < 0 || cx >= imageWidth || cy < 0 || cy >= imageHeight) continue;
    if(!mask[cy * imageWidth + cx]) continue;     // mask cold at dot, can't be wide

    let extent;
    if(orientation === 'vertical'){
      // Measure horizontal extent at the dot's Y.
      let left = cx, right = cx;
      while(left > 0 && mask[cy * imageWidth + (left - 1)])  left--;
      while(right < imageWidth - 1 && mask[cy * imageWidth + (right + 1)]) right++;
      extent = right - left + 1;
    } else {
      // Measure vertical extent at the dot's X.
      let top = cy, bot = cy;
      while(top > 0 && mask[(top - 1) * imageWidth + cx])  top--;
      while(bot < imageHeight - 1 && mask[(bot + 1) * imageWidth + cx]) bot++;
      extent = bot - top + 1;
    }
    if(extent > threshold) hits++;
  }
  return hits / chain.length;
}

function chainTextMaskFraction(chain, textMask, imageWidth, imageHeight){
  // Legacy "inside/outside" check, retained for backwards compatibility.
  if(!textMask) return 0;
  let hits = 0;
  for(const dot of chain){
    const cx = Math.round(dot.cx);
    const cy = Math.round(dot.cy);
    if(cx < 0 || cx >= imageWidth || cy < 0 || cy >= imageHeight) continue;
    if(textMask[cy * imageWidth + cx]) hits++;
  }
  return hits / chain.length;
}

function chainPerpendicularInkFraction(chain, binary, imageWidth, imageHeight,
                                       perpDistance, orientation){
  let hits = 0;
  // Widen the strip's principal-axis extent slightly.  A decimal point in
  // numbers like "12.34" sits 1-2 px below the digit baseline, so checking
  // ink at ONLY the dot's exact Y range misses the digits to either side
  // — the digits' bottom edge is above the decimal, not at its Y.  A
  // small principal-axis pad picks them up.
  const principalPad = Math.max(2, Math.floor(perpDistance / 2));

  for(const dot of chain){
    let hasInk = false;
    if(orientation === 'horizontal'){
      // Strip is dot.x0..dot.x1 wide (PLUS pad), extending perpDistance above and below.
      const yAboveStart = Math.max(0, dot.y0 - perpDistance);
      const yAboveEnd   = dot.y0 - 1;
      const yBelowStart = dot.y1 + 1;
      const yBelowEnd   = Math.min(imageHeight - 1, dot.y1 + perpDistance);
      const xStart = Math.max(0, dot.x0 - principalPad);
      const xEnd   = Math.min(imageWidth - 1, dot.x1 + principalPad);

      outer: for(let y = yAboveStart; y <= yAboveEnd; y++){
        for(let x = xStart; x <= xEnd; x++){
          if(binary[y * imageWidth + x]){ hasInk = true; break outer; }
        }
      }
      if(!hasInk){
        outer2: for(let y = yBelowStart; y <= yBelowEnd; y++){
          for(let x = xStart; x <= xEnd; x++){
            if(binary[y * imageWidth + x]){ hasInk = true; break outer2; }
          }
        }
      }
    } else {
      // Strip is dot.y0..dot.y1 tall (PLUS pad), extending perpDistance left and right.
      const xLeftStart  = Math.max(0, dot.x0 - perpDistance);
      const xLeftEnd    = dot.x0 - 1;
      const xRightStart = dot.x1 + 1;
      const xRightEnd   = Math.min(imageWidth - 1, dot.x1 + perpDistance);
      const yStart = Math.max(0, dot.y0 - principalPad);
      const yEnd   = Math.min(imageHeight - 1, dot.y1 + principalPad);

      outer: for(let y = yStart; y <= yEnd; y++){
        for(let x = xLeftStart; x <= xLeftEnd; x++){
          if(binary[y * imageWidth + x]){ hasInk = true; break outer; }
        }
        for(let x = xRightStart; x <= xRightEnd; x++){
          if(binary[y * imageWidth + x]){ hasInk = true; break outer; }
        }
      }
    }
    if(hasInk) hits++;
  }
  return hits / chain.length;
}

function detectDashedRules(binary, imageWidth, imageHeight, opts){
  if(opts.detectDashed === false) return { hLines: [], vLines: [] };

  // -- scale-aware defaults ---------------------------------------------
  // Most absolute parameters (dot size, axis-tolerance, isolation distance)
  // need to grow with image resolution.  A 1pt-printed dot is 2-3 px at
  // 150 DPI and 8-12 px at 400 DPI; a fixed 6-px threshold rejects all the
  // larger dots and the chain is never built, which is why dashed rules
  // disappeared at 3000×4000.  Use the smaller image dimension as the
  // reference (the printable page's short edge usually dominates) and
  // scale linearly with min(W, H) so the parameters track resolution
  // straightforwardly.
  const minDim       = Math.min(imageWidth, imageHeight);
  const scaleFactor  = Math.max(1, minDim / 1500);   // 1.0 at 1500-, 2.0 at 3000, 3.0 at 4500
  const sR           = (v) => Math.max(1, Math.round(v * scaleFactor));

  const maxDotSize          = opts.maxDotSize          ?? sR(6);
  const minDots             = opts.minDots             ?? 4;
  // dashYTolerance / dashXTolerance: how much the dot centres are allowed
  // to drift in the perpendicular axis between consecutive chain links.
  // Loosened from 3 to 5 px at the base scale — real scanned dashed
  // borders show 2-4 px of drift from binarisation noise and slight
  // page curl, and a 3-px tolerance broke chains at every drift point.
  const dashYTolerance      = opts.dashYTolerance      ?? sR(5);
  const dashXTolerance      = opts.dashXTolerance      ?? sR(5);
  const maxGapRatio         = opts.dashMaxGapRatio     ?? 3.0;
  const maxSizeRatio        = opts.dashMaxSizeRatio    ?? 2.5;
  const minStrideToSizeRatio = opts.minStrideToSizeRatio ?? 2.0;
  // minLenFracDashed: dropped from 0.25 to 0.18 (same as solid rules).
  // Table-cell-only vertical rules don't span 30 % of page height.
  const minLenFracDashed    = opts.minLenFracDashed    ?? 0.18;
  // dashMaxStride: bumped from 0.15 to 0.20 of image dim so long-gap
  // patterns chain through.  At W=1500 this is 300 px between dots.
  const dashMaxStrideH      = opts.dashMaxStrideH      ?? Math.max(40, Math.floor(imageWidth  * 0.20));
  const dashMaxStrideV      = opts.dashMaxStrideV      ?? Math.max(40, Math.floor(imageHeight * 0.20));
  const minLenH             = Math.max(40, Math.floor(imageWidth  * minLenFracDashed));
  const minLenV             = Math.max(40, Math.floor(imageHeight * minLenFracDashed));

  // -- perpendicular-isolation filter ----------------------------------
  // perpDistance default LOWERED from sR(15) to sR(5).  The previous 15 px
  // was rejecting real borders whose padding to nearby text was less than
  // 15 px — which is most invoice borders.  5 px still catches the
  // diagnostic cases:
  //   - 'i'-dot stem: 2-3 px below the dot.
  //   - period adjacent to text: 1-3 px gap.
  //   - decimal point next to digits: 0-2 px gap.
  // Real borders are typically ≥ 5 px from any text, so this lower
  // distance spares them.
  const perpDistance        = opts.perpIsolationDistance ?? sR(5);
  const maxPerpInkFraction  = opts.maxPerpInkFraction    ?? 0.30;

  // Text masks — used to reject chains whose dots sit inside text
  // structures (rows for h-chains, columns for v-chains).  Optional
  // (when borders.js runs in isolation we don't have them); when
  // provided by the pipeline they're the dominant discriminator
  // between real borders and text-aligned dot patterns (decimals,
  // periods at line-ends, accent-marks, etc.).
  const textMaskH           = opts.textMaskH || null;
  const textMaskV           = opts.textMaskV || null;
  const maxTextMaskFraction = opts.maxTextMaskFraction ?? 0.70;

  const dots = extractSmallComponents(binary, imageWidth, imageHeight, maxDotSize);
  const rejectedChains = [];                          // for the gallery diagnostic stage
  if(dots.length < minDots) return { hLines: [], vLines: [], dots, rejectedChains };

  // Local helper to log a rejection and continue.  The reason is a short
  // tag; metric is the numeric value that violated the threshold.
  const rejectWith = (chain, orientation, reason, metric) => {
    rejectedChains.push({ chain, orientation, reason, metric });
  };

  // -- horizontal dashed rules -----------------------------------------
  const hChains = buildDashedChains(dots, 'horizontal', dashYTolerance, dashMaxStrideH, minDots);
  const hLines = [];
  for(const chain of hChains){
    const summary = summariseChain(chain, true);
    if(summary.gapRatio  > maxGapRatio){
      rejectWith(chain, 'horizontal', 'gapRatio', summary.gapRatio); continue;
    }
    if(summary.sizeRatio > maxSizeRatio){
      rejectWith(chain, 'horizontal', 'sizeRatio', summary.sizeRatio); continue;
    }
    if(summary.medianGap < summary.medianSize * minStrideToSizeRatio){
      rejectWith(chain, 'horizontal', 'strideTooTight',
                 summary.medianGap / Math.max(1, summary.medianSize)); continue;
    }

    const x0 = chain[0].x0;
    const x1 = chain[chain.length - 1].x1;
    if((x1 - x0 + 1) < minLenH){
      rejectWith(chain, 'horizontal', 'tooShort', (x1 - x0 + 1)); continue;
    }

    const perpInkFraction = chainPerpendicularInkFraction(
      chain, binary, imageWidth, imageHeight, perpDistance, 'horizontal');
    if(perpInkFraction > maxPerpInkFraction){
      rejectWith(chain, 'horizontal', 'perpInk', perpInkFraction); continue;
    }

    // Reject if the chain's dots sit inside the row-dilated text mask
    // (i.e., the dots are punctuation embedded in a row of text).
    // For h-chains, "wide" means VERTICAL extent — a row dilation
    // that's much taller than the dot itself indicates the dot is
    // embedded in a row of text.
    const textMaskFraction = chainOrthogonalExtentFraction(
      chain, textMaskH, imageWidth, imageHeight, 'horizontal', summary.medianSize);
    if(textMaskFraction > maxTextMaskFraction){
      rejectWith(chain, 'horizontal', 'inTextRow', textMaskFraction); continue;
    }

    const polyline = chain.map(d => ({ x: d.cx, y: d.cy }));
    const y0 = Math.min(...chain.map(d => d.y0));
    const y1 = Math.max(...chain.map(d => d.y1));
    const representativeY = polyline.reduce((s, p) => s + p.y, 0) / polyline.length;

    hLines.push({
      polyline,
      x0, x1, y0, y1,
      y         : representativeY,
      thickness : summary.medianSize,
      coverage  : 1.0,
      continuity: polyline.length / Math.max(1, (x1 - x0 + 1)),
      peak      : 1.0,
      pixels    : chain.reduce((s, d) => s + d.pixels, 0),
      isDashed  : true,
      dotCount  : chain.length,
      medianGap : summary.medianGap,
      medianSize: summary.medianSize,
      perpInkFraction,
      textMaskFraction
    });
  }

  // -- vertical dashed rules -------------------------------------------
  const vChains = buildDashedChains(dots, 'vertical', dashXTolerance, dashMaxStrideV, minDots);
  const vLines = [];
  for(const chain of vChains){
    const summary = summariseChain(chain, false);
    if(summary.gapRatio  > maxGapRatio){
      rejectWith(chain, 'vertical', 'gapRatio', summary.gapRatio); continue;
    }
    if(summary.sizeRatio > maxSizeRatio){
      rejectWith(chain, 'vertical', 'sizeRatio', summary.sizeRatio); continue;
    }
    if(summary.medianGap < summary.medianSize * minStrideToSizeRatio){
      rejectWith(chain, 'vertical', 'strideTooTight',
                 summary.medianGap / Math.max(1, summary.medianSize)); continue;
    }

    const y0 = chain[0].y0;
    const y1 = chain[chain.length - 1].y1;
    if((y1 - y0 + 1) < minLenV){
      rejectWith(chain, 'vertical', 'tooShort', (y1 - y0 + 1)); continue;
    }

    const perpInkFraction = chainPerpendicularInkFraction(
      chain, binary, imageWidth, imageHeight, perpDistance, 'vertical');
    if(perpInkFraction > maxPerpInkFraction){
      rejectWith(chain, 'vertical', 'perpInk', perpInkFraction); continue;
    }

    // Reject if the chain's dots sit inside the column-dilated text
    // mask (i.e., the dots are decimals / glyph-parts embedded in a
    // column of text).  This is the discriminator for "very long
    // distance dots from floating-point numbers being detected as a
    // vertical dashed border" — those decimals lie inside the column
    // dilation while a real v-rule in the column gap lies outside it.
    // For v-chains, "wide" means HORIZONTAL extent — a column dilation
    // that's much wider than the dot itself indicates the dot is
    // embedded in a column of text.  Decimal points in right-aligned
    // numbers sit inside a column whose horizontal extent spans the
    // full digit-body width; a real dashed border in the column gap
    // sits inside its own narrow dilation stripe (≈ dot + dilation).
    const textMaskFraction = chainOrthogonalExtentFraction(
      chain, textMaskV, imageWidth, imageHeight, 'vertical', summary.medianSize);
    if(textMaskFraction > maxTextMaskFraction){
      rejectWith(chain, 'vertical', 'inTextColumn', textMaskFraction); continue;
    }

    const polyline = chain.map(d => ({ x: d.cx, y: d.cy }));
    const x0 = Math.min(...chain.map(d => d.x0));
    const x1 = Math.max(...chain.map(d => d.x1));
    const representativeX = polyline.reduce((s, p) => s + p.x, 0) / polyline.length;

    vLines.push({
      polyline,
      x0, x1, y0, y1,
      x         : representativeX,
      thickness : summary.medianSize,
      coverage  : 1.0,
      continuity: polyline.length / Math.max(1, (y1 - y0 + 1)),
      peak      : 1.0,
      pixels    : chain.reduce((s, d) => s + d.pixels, 0),
      isDashed  : true,
      dotCount  : chain.length,
      medianGap : summary.medianGap,
      medianSize: summary.medianSize,
      perpInkFraction,
      textMaskFraction
    });
  }

  return { hLines, vLines, dots, rejectedChains };
}
