/**
 * config.js — Central parameter store for the TextLine GPU detector.
 *
 * WHY THIS FILE EXISTS:
 *   Every meaningful number in the pipeline lives here with an explanation
 *   of what it controls and what breaks when it goes out of range.
 *   Changing a parameter in one place propagates everywhere automatically,
 *   because every module imports CONFIG instead of hard-coding values.
 *
 * USAGE:
 *   import { CONFIG } from './config.js';
 *   CONFIG.sauvolaRadius = 50; // override at runtime
 */

/** Maximum RGBA image size (MB) before auto-downscaling the processing pass.
 *
 * WHY MB-BASED INSTEAD OF A FIXED WIDTH:
 *   A fixed width cap (e.g. 1800px) ignores the height, so a narrow-but-tall
 *   image can still allocate huge GPU buffers. Basing the limit on total
 *   RGBA bytes (W × H × 4) gives a consistent VRAM budget regardless of
 *   aspect ratio. At 128 MB, GPU f32 buffers stay under ~2 GB total — safe
 *   for dedicated GPUs; reduce to 32–64 MB for integrated graphics.
 *
 * HOW THE SCALE IS APPLIED IN ui.js:
 *   maxPixels = MAX_PROC_MB × 1024² / 4
 *   if W×H > maxPixels: scale = sqrt(maxPixels / (W×H)), then
 *     imgW = floor(W × scale), imgH = floor(H × scale)
 *   This keeps the original aspect ratio and ensures W×H×4 ≤ MAX_PROC_MB MB.
 */
export const MAX_PROC_MB = 128;

export const CONFIG = {

  // ── BINARIZATION (Sauvola adaptive threshold) ────────────────────────────
  //
  // WHY SAUVOLA INSTEAD OF A GLOBAL THRESHOLD:
  //   Invoice images have uneven illumination — fold shadows, scanner vignetting,
  //   or phone camera perspective. A single global threshold classifies the
  //   dark-shadow region as text and the bright-corner region as background.
  //   Sauvola computes a per-pixel threshold from the LOCAL mean and standard
  //   deviation inside a window. Each region adapts to its own lighting.
  //   Formula: T = mean * (1 + k * (σ / 0.5 − 1))
  //
  // WHY SAT (SUMMED AREA TABLE) FOR SAUVOLA:
  //   The naive box-filter approach runs a loop of 2r+1 iterations per pixel,
  //   making it O(N * r²). SAT precomputes prefix sums in O(N) and then answers
  //   any rectangular sum in O(1). For r=40 on a 1800×2500 image this is a
  //   40× speedup — the difference between 2 s and 50 ms on the GPU.

  sauvolaRadius: 40,
  // Half-radius of the local statistics window (in pixels).
  // Larger: more context, handles coarser illumination gradients.
  // Smaller: faster, but may fail on large shadow gradients.
  // Rule of thumb: should be 1–3× the tallest character height.

  sauvolaK: 0.30,
  // Sensitivity factor (0.1 – 0.5 typical range).
  // Higher k → stricter threshold → thinner/fewer text pixels.
  // Lower k → looser threshold → thicker ink, more noise classified as text.
  // 0.25–0.35 works well for clean invoice scans; use 0.15–0.25 for faint ink.

  invertBinary: false,
  // Set true when the image has a dark background (whiteboard photo, dark paper).
  // Negates the Sauvola comparison so light strokes become "text".


  // ── SKEW CORRECTION ──────────────────────────────────────────────────────
  //
  // WHY SKEW CORRECTION IS NECESSARY:
  //   Even a 3° rotation makes horizontal dilation miss the inter-word connection
  //   between characters whose bounding boxes no longer overlap horizontally.
  //   This fragments one text line into many short blobs, defeating CCA grouping.
  //   Correcting the angle first lets every downstream step assume horizontal text.
  //
  // WHY PROJECTION PROFILE VARIANCE:
  //   For text at angle θ, projecting pixels onto a rotated horizontal axis
  //   creates a profile with sharp peaks (one per text line). At θ = true angle
  //   the peaks are sharpest → maximum variance. We scan candidate angles and
  //   pick the one with highest variance. O(N * num_angles), fast on CPU.

  skewRangeDeg: 45,
  // Maximum angle to search in each direction (degrees).
  // ±20° covers most hand-held photos; ±45° covers portraits scanned landscape.

  skewStepDeg: 0.5,
  // Resolution of the angular search.
  // 1° is coarse — 0.5° residual error shifts a 1000px line by 9px vertically.
  // 0.5° keeps residual under 4px which is within dilation tolerance.

  skewThreshDeg: 0.5,
  // Minimum detected angle to trigger GPU rotation.
  // Below this threshold the image is considered already straight.
  // Avoids unnecessary GPU work and bilinear blur for near-zero angles.


  // ── MORPHOLOGICAL PROCESSING ─────────────────────────────────────────────
  //
  // WHY DILATION BEFORE CCA:
  //   Individual characters have gaps between them (inter-character and inter-word
  //   spacing). Connected Component Analysis on the raw binary would find hundreds
  //   of tiny per-character blobs rather than one blob per text line.
  //   Horizontal dilation (max-pooling) expands each character blob rightward and
  //   leftward until it overlaps with its neighbours, merging the whole line into
  //   one connected region. CCA then finds one blob per line.
  //
  // WHY SEPARATE H AND V PASSES:
  //   A single 2D dilation kernel would be O(r²) per pixel. Two 1D passes
  //   (horizontal then vertical) are O(r) each — separable morphology.
  //   It also gives independent control: dilH bridges word gaps, dilV adds
  //   just enough vertical thickness to close small vertical gaps within letters.

  dilationH: 30,
  // Horizontal dilation radius (pixels).
  // Should exceed the widest inter-word gap in the image.
  // Too large: merges adjacent columns of text → one blob for two columns.
  // Too small: word gaps remain open → fragmented line blobs.

  dilationV: 4,
  // Vertical dilation radius (pixels).
  // Small value: just closes small within-character vertical gaps.
  // Large value: merges adjacent text lines into one tall blob (paragraph).


  // ── ZHANG-SUEN SKELETONIZATION ───────────────────────────────────────────
  //
  // WHY SKELETONIZATION:
  //   The dilated line blob is a thick band. We need a 1-pixel-wide centreline
  //   to:
  //     1. Compute PCA direction (axis of the text line).
  //     2. Run 2-sweep BFS (graph diameter) to find the line's start and end.
  //   Zhang-Suen thinning iteratively removes border pixels that are redundant
  //   for 8-connectivity, converging to a medial axis.
  //
  // WHY ON GPU IN PING-PONG BUFFERS:
  //   Each sub-iteration must read the state from the previous sub-iteration
  //   (not partially-updated state). Double-buffering (A→B sub1, B→A sub2)
  //   ensures all threads read consistent input. Batching all iterations into
  //   one GPU submit avoids ~120 CPU-GPU round-trips.

  zsIterations: 60,
  // Number of full ZS iterations (each = 2 sub-iterations on GPU).
  // Convergence needs ≈ blob_height / 2 iterations.
  // dilV=4 adds 4px each side → blob up to 120px tall → 60 iterations.
  // More iterations = fully thinned skeleton at the cost of GPU time.


  // ── SKELETON GRAPH ───────────────────────────────────────────────────────
  //
  // WHY BUILD A GRAPH INSTEAD OF GREEDY WALK:
  //   A greedy walk (follow the nearest unvisited neighbour) breaks at T/Y
  //   junctions — it picks an arbitrary branch and misses the rest of the line.
  //   Building an explicit adjacency graph lets us:
  //     - Prune short spike branches (noise from character joints)
  //     - Run 2-sweep BFS to find the exact diameter (longest path) of the graph,
  //       which is the true extent of the text line regardless of topology.
  //
  // WHY PER-CCA-COMPONENT LOCAL GRAPHS (NOT ONE GLOBAL GRAPH):
  //   The global skeleton graph can connect adjacent line blobs if their dilated
  //   regions touch at even one pixel. One global graphComponents() call would
  //   then see two lines as one component. By driving the loop from CCA
  //   components and filtering skeleton pixels by their CCA label, each local
  //   graph is structurally isolated to exactly one text line.

  minBranchPx: 12,
  // Prune branches shorter than this many pixels.
  // ZS leaves spikes at character stroke junctions (T-junctions of ink paths).
  // Pruning removes these before the diameter BFS so the longest path is the
  // true text-line axis rather than a spike-to-spike path.
  // Should be less than the typical character width to avoid removing real paths.


  // ── CENTRELINE SIMPLIFICATION ────────────────────────────────────────────
  //
  // WHY RDP (RAMER-DOUGLAS-PEUCKER):
  //   The longestPath BFS returns one point per skeleton pixel — hundreds or
  //   thousands of points for a long line. Most are collinear and redundant.
  //   RDP recursively finds points that deviate most from the line between
  //   endpoints, keeping only those that matter. Result: 5–20 key points
  //   that capture real curvature (fold distortion) without noise.
  //
  // WHY CATMULL-ROM AFTER RDP:
  //   RDP produces a polyline with sharp corners at each kept point. These
  //   sharp corners propagate to the OBB edges, making the top/bottom edges
  //   of the rectangle jagged. Catmull-Rom re-interpolates the polyline as a
  //   smooth spline through the same key points, giving smooth OBB edges that
  //   follow the actual curvature of fold-distorted text lines.

  rdpEpsilon: 2.0,
  // Max perpendicular deviation (pixels) for a point to be removed by RDP.
  // Higher: more aggressive simplification, less detail preserved.
  // Lower: more points kept, smoother axis but heavier Catmull-Rom.

  catmullSamples: 5,
  // Number of interpolated points per RDP segment in Catmull-Rom.
  // More samples = smoother OBB edges at the cost of more buildMinRect iterations.


  // ── ORIENTED BOUNDING RECTANGLE ──────────────────────────────────────────
  //
  // WHY BUILD AN OBB INSTEAD OF AN AABB:
  //   Axis-Aligned Bounding Boxes are much larger than the text for skewed lines.
  //   An oriented rectangle aligned to the PCA axis of the text fits tightly.
  //
  // WHY PROJECT ACTUAL INK PIXELS (NOT ESTIMATE FROM SKELETON):
  //   Height sampling at skeleton points fails in inter-character gaps (the
  //   skeleton passes through regions where bin=0, giving zero height).
  //   Projecting every binary ink pixel onto the PCA normal gives the exact
  //   perpendicular extent — both the top and bottom edges of the rectangle
  //   are guaranteed to touch the outermost ink pixels.

  heightScale: 1.0,
  // Multiplier on the measured ink height.
  // 1.0 = rectangle exactly covers all ink pixels.
  // 1.05–1.1 = small safety margin useful for OCR cropping.

  minLineWidthPct: 0.05,
  // Minimum line width as a fraction of the image width (0.01–0.30).
  // Filters out small isolated blobs (punctuation, noise) that pass the
  // elongation test but are too short to be real text lines.
};
