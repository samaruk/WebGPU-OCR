/* ======================================================================
   BLOB HEIGHT-DENSITY FILTER
   ----------------------------------------------------------------------
   Why this exists:
     After CCA + dilation + merged-line splitting, the accepted blob set
     still contains a long tail of garbage:
       - dots, descender shards, page-edge specks, accent marks         → too short
       - logos, barcodes, two-line merge residues                        → too tall
     Real text in a single document clusters tightly around one height,
     so a histogram of accepted-blob heights has a sharp mode at the
     body-text line-height.  Anything well outside that mode is noise.

   The rule, from the user's spec:
     1. Bucket all currently-accepted blob heights and find the modal
        ("max-density") height range.
     2. Heights inside the range  → keep.
     3. Heights below the range   → eliminate (almost always noise).
     4. Heights above the range   → try a one-shot vertical valley
                                    split.  If every sub-piece lands in
                                    range, accept the split children;
                                    otherwise eliminate the parent.

   "Eliminate" here means set `accepted = false` and tag the reason on
   the part itself.  We never physically remove a part from the array
   because downstream tooling (the gallery, the splitter, OBB rendering)
   still wants to display rejected boxes in a different colour for
   debugging.
   ====================================================================== */
import { S } from '../state/state.js';

/* ----------------------------------------------------------------------
   Geometry helpers — every part in pass.blobs[i].parts carries a 4-point
   corner array (the OBB).  Post-deskew the OBB is near axis-aligned, so
   the AABB derived from the corners matches what `wordAABBs` exposes to
   the rest of the pipeline.  Using AABB height keeps the filter's view
   of "height" consistent with downstream consumers.
   ---------------------------------------------------------------------- */
function aabbHeightOfPart(part){
  const corners = part.corners;
  let minY = corners[0].y;
  let maxY = corners[0].y;
  for(let i = 1; i < 4; i++){
    if(corners[i].y < minY) minY = corners[i].y;
    if(corners[i].y > maxY) maxY = corners[i].y;
  }
  return maxY - minY;
}

function aabbOfPart(part){
  const corners = part.corners;
  let minX = corners[0].x, maxX = corners[0].x;
  let minY = corners[0].y, maxY = corners[0].y;
  for(let i = 1; i < 4; i++){
    if(corners[i].x < minX) minX = corners[i].x;
    if(corners[i].x > maxX) maxX = corners[i].x;
    if(corners[i].y < minY) minY = corners[i].y;
    if(corners[i].y > maxY) maxY = corners[i].y;
  }
  return {x0:minX, y0:minY, x1:maxX, y1:maxY};
}

/* Build a fresh part record for a split child.  Sub-pieces of a tall
   blob produced by the valley split are axis-aligned by construction
   (we cut horizontally), so corners are the four AABB corners and
   angle is zero.  All the downstream fields the part shape carries
   (cx, cy, w, h, area, aspect, fill, split, accepted) are filled in
   so wordAABBs, OBB rendering, etc. treat the child like any other
   part. */
function createAxisAlignedChildPart(x0, y0, x1, y1){
  const width  = x1 - x0;
  const height = y1 - y0;
  return {
    corners : [
      {x:x0, y:y0}, {x:x1, y:y0},
      {x:x1, y:y1}, {x:x0, y:y1}
    ],
    cx       : (x0 + x1) / 2,
    cy       : (y0 + y1) / 2,
    w        : width,
    h        : height,
    angle    : 0,
    accepted : true,
    area     : width * height,
    aspect   : width / (height + 1e-6),
    fill     : 1,
    split    : true,
    fromDensitySplit : true
  };
}

/* ----------------------------------------------------------------------
   Find the modal height range.
   - Histogram bucket width is ~10% of the median height: fine enough to
     pick out the line-height mode but coarse enough to smooth out single
     pixel noise.
   - Starting at the peak bucket, expand outward in both directions while
     the bucket count stays above `peakCount × densityThreshold`.  The
     resulting [minHeight, maxHeight) is the dominant text-line height
     band.
   ---------------------------------------------------------------------- */
function computeModalHeightRange(heightsArray, densityThreshold){
  // Defensive copy so we don't mutate the caller's data.
  const sortedHeights = heightsArray.slice().sort((a, b) => a - b);
  const medianHeight  = sortedHeights[sortedHeights.length >> 1];
  const bucketSize    = Math.max(1, Math.round(medianHeight * 0.10));
  const tallestHeight = sortedHeights[sortedHeights.length - 1];
  const bucketCount   = Math.ceil(tallestHeight / bucketSize) + 1;

  const histogram = new Array(bucketCount).fill(0);
  for(const height of heightsArray){
    const bucketIndex = Math.min(bucketCount - 1, Math.floor(height / bucketSize));
    histogram[bucketIndex]++;
  }

  // Find the peak bucket.
  let peakBucket = 0;
  for(let i = 1; i < bucketCount; i++){
    if(histogram[i] > histogram[peakBucket]) peakBucket = i;
  }
  const peakCount         = histogram[peakBucket];
  const expandThreshold   = peakCount * densityThreshold;

  // Grow the window outward while density stays above the threshold.
  let loBucket = peakBucket;
  let hiBucket = peakBucket;
  while(loBucket > 0              && histogram[loBucket - 1] >= expandThreshold) loBucket--;
  while(hiBucket < bucketCount-1  && histogram[hiBucket + 1] >= expandThreshold) hiBucket++;

  return {
    minHeight   : loBucket * bucketSize,
    maxHeight   : (hiBucket + 1) * bucketSize,         // exclusive upper bound
    peakHeight  : peakBucket * bucketSize + bucketSize / 2,
    bucketSize  : bucketSize,
    peakCount   : peakCount,
    histogram   : histogram,
    medianHeight: medianHeight
  };
}

/* ----------------------------------------------------------------------
   Attempt a vertical split of a part whose height exceeds maxHeight.
   - Project the binary ink onto the Y axis inside the part's AABB.
   - Find low-density "valley" runs (rows whose ink count is ≤ 15% of
     the peak row's ink count — same heuristic the existing splitter
     uses in valleySplitPts).
   - Cut at the midpoint of each internal valley (valleys touching the
     top or bottom of the AABB are not real gaps, just the silhouette
     of ascenders/descenders).
   - For the split to be accepted, EVERY resulting sub-piece must fall
     inside [minHeight, maxHeight).  Partial splits would just create
     new out-of-range stragglers, so we reject the entire attempt and
     leave the caller to mark the parent as 'too-tall-no-split'.
   Returns the array of new child parts, or [] on failure.
   ---------------------------------------------------------------------- */
function attemptValleySplit(part, pass, minHeight, maxHeight){
  if(!pass.binary) return [];
  const binary    = pass.binary;
  const imageW    = S.W;
  const imageH    = S.H;
  const aabb      = aabbOfPart(part);

  // Clamp to image bounds (the part's AABB can spill 0.5px because OBB
  // corners are floats).
  const clampedX0 = Math.max(0,         Math.floor(aabb.x0));
  const clampedX1 = Math.min(imageW-1,  Math.ceil (aabb.x1));
  const clampedY0 = Math.max(0,         Math.floor(aabb.y0));
  const clampedY1 = Math.min(imageH-1,  Math.ceil (aabb.y1));
  if(clampedX1 <= clampedX0 || clampedY1 <= clampedY0) return [];

  // Vertical ink profile = ink-pixel count per row inside the AABB.
  const profileLength = clampedY1 - clampedY0 + 1;
  const inkPerRow     = new Array(profileLength).fill(0);
  for(let y = clampedY0; y <= clampedY1; y++){
    const rowOffset = y * imageW;
    let inkCountThisRow = 0;
    for(let x = clampedX0; x <= clampedX1; x++){
      if(binary[rowOffset + x]) inkCountThisRow++;
    }
    inkPerRow[y - clampedY0] = inkCountThisRow;
  }

  // Peak ink count drives the valley threshold.
  let peakRowInk = 0;
  for(let i = 0; i < profileLength; i++){
    if(inkPerRow[i] > peakRowInk) peakRowInk = inkPerRow[i];
  }
  if(peakRowInk <= 0) return [];                // empty part — nothing to split

  // A row is "in a valley" when its ink count is ≤ 15% of the peak row.
  const valleyInkLimit = Math.max(1, peakRowInk * 0.15);
  const cutPositions   = [];               // y offsets relative to AABB top
  let   insideValley   = false;
  let   valleyStartY   = -1;
  for(let y = 0; y < profileLength; y++){
    const inValley = inkPerRow[y] <= valleyInkLimit;
    if(inValley && !insideValley){
      valleyStartY = y;
      insideValley = true;
    } else if(!inValley && insideValley){
      // Closing a valley.  Only count it as a real cut if it sits
      // INSIDE the AABB (not flush against the top or bottom edge).
      const valleyEndY = y - 1;
      if(valleyStartY > 1 && valleyEndY < profileLength - 1){
        cutPositions.push(Math.floor((valleyStartY + valleyEndY) / 2));
      }
      insideValley = false;
    }
  }
  if(cutPositions.length === 0) return [];

  // Build candidate sub-pieces and validate.  Each piece must land in
  // [minHeight, maxHeight) or the whole split is aborted.
  const childParts = [];
  let   sliceTopY  = 0;
  for(const cutY of cutPositions){
    const sliceHeight = cutY - sliceTopY + 1;
    if(sliceHeight < minHeight || sliceHeight >= maxHeight) return [];
    childParts.push(createAxisAlignedChildPart(
      clampedX0, clampedY0 + sliceTopY,
      clampedX1, clampedY0 + cutY
    ));
    sliceTopY = cutY + 1;
  }
  const tailHeight = profileLength - sliceTopY;
  if(tailHeight < minHeight || tailHeight >= maxHeight) return [];
  childParts.push(createAxisAlignedChildPart(
    clampedX0, clampedY0 + sliceTopY,
    clampedX1, clampedY1
  ));
  return childParts;
}

/* ----------------------------------------------------------------------
   Public entry point.

   Inputs:
     pass : the pass result object — needs .blobs[*].parts and .binary.
     p    : the parameter bag from readParams — uses p.densityThresh.

   Side effects on pass:
     pass.heightFilter is populated with diagnostics (range, counts,
     histogram, median).  When the input is too small to be meaningful,
     pass.heightFilter is { reason: 'too-few-parts' }.

   Side effects on parts:
     - In-range parts: untouched.
     - Below-range parts: accepted=false, rejectedBy='density-small'.
     - Above-range parts whose valley split succeeds: parent
       accepted=false, rejectedBy='density-replaced-by-split'; the new
       child parts are appended to bl.parts with accepted=true and
       fromDensitySplit=true.
     - Above-range parts whose split fails: accepted=false,
       rejectedBy='density-tall-no-split'.
   ---------------------------------------------------------------------- */
export function filterByHeightDensity(pass, p){
  pass.heightFilter = null;
  if(!pass.blobs || pass.blobs.length < 4) return;
  const densityThreshold = p.densityThresh ?? 0.50;

  // Snapshot heights BEFORE we start rejecting, so the range isn't
  // distorted by parts we're about to drop.
  const heightsOfAcceptedParts = [];
  for(const blob of pass.blobs){
    for(const part of blob.parts){
      if(part.accepted) heightsOfAcceptedParts.push(aabbHeightOfPart(part));
    }
  }
  if(heightsOfAcceptedParts.length < 8){
    pass.heightFilter = { reason: 'too-few-parts' };
    return;
  }

  const range = computeModalHeightRange(heightsOfAcceptedParts, densityThreshold);
  const { minHeight, maxHeight } = range;

  // Counters for diagnostics.
  let keptCount         = 0;
  let droppedSmallCount = 0;
  let splitSuccessCount = 0;
  let splitChildrenCount = 0;
  let splitFailureCount = 0;

  // One walk per blob — for each currently-accepted part, decide its
  // fate and assemble a new parts list (we may need to append split
  // children, which is why we rebuild instead of mutating in place).
  for(const blob of pass.blobs){
    const newPartsForThisBlob = [];

    for(const part of blob.parts){
      if(!part.accepted){
        newPartsForThisBlob.push(part);
        continue;
      }

      const partHeight = aabbHeightOfPart(part);

      if(partHeight >= minHeight && partHeight < maxHeight){
        // In the modal band — keep as is.
        newPartsForThisBlob.push(part);
        keptCount++;
      }
      else if(partHeight < minHeight){
        // Too short — almost always Sauvola speckle, a dot, an accent
        // mark, or a descender shard.  Reject outright.
        part.accepted   = false;
        part.rejectedBy = 'density-small';
        newPartsForThisBlob.push(part);
        droppedSmallCount++;
      }
      else {
        // Too tall — try a valley split.  All children must be in
        // range or the whole attempt fails.
        const childParts = attemptValleySplit(part, pass, minHeight, maxHeight);
        if(childParts.length >= 2){
          part.accepted   = false;
          part.rejectedBy = 'density-replaced-by-split';
          newPartsForThisBlob.push(part);
          for(const child of childParts) newPartsForThisBlob.push(child);
          splitSuccessCount++;
          splitChildrenCount += childParts.length;
        } else {
          part.accepted   = false;
          part.rejectedBy = 'density-tall-no-split';
          newPartsForThisBlob.push(part);
          splitFailureCount++;
        }
      }
    }

    blob.parts = newPartsForThisBlob;
  }

  pass.heightFilter = {
    ...range,
    densityThreshold,
    kept              : keptCount,
    tooSmall          : droppedSmallCount,
    splitOk           : splitSuccessCount,
    splitChildren     : splitChildrenCount,
    splitFail         : splitFailureCount,
    totalPartsBefore  : heightsOfAcceptedParts.length
  };
}
