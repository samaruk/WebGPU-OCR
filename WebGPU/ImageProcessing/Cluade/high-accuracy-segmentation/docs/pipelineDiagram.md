# Pipeline Diagram

```
INPUT IMAGE
│
├── 00  Quality & Adaptation Layer
│     qualityScorer → dpiEstimator → paramResolver → stageGating
│
├── 01  Geometry Normalization
│     Deskew (projection + Hough) → Perspective Correction (homography)
│
├── 02  Background & Illumination  [stageGated]
│     Bleedthrough → Retinex → CLAHE
│
├── 03  Edge-Preserving Denoising
│     Bilateral  OR  NLM (selected by qualityScorer)
│
├── 04  Structural Artifact Removal
│     Width-Gated Hough Line Removal  [on denoised grayscale]
│
├── 05  Stroke-Aware Adaptive Thresholding
│     Sauvola Pass 1 (DPI window) → runLengthStrokeEst → Sauvola Pass 2 (stroke window)
│
├── 06  Morphological Stabilization
│     Morphological Reconstruction → HoleFill [stageGated]
│
├── 07  Stroke Width Transform  [on stabilized binary]
│     SWT → swtQualityGate → meanStrokeExtract → strokeWidthStore
│                                                        │
│                              meanStrokeWidth flows ───►│
│
├── 08  Euclidean Distance Transform
│
├── 09  h-Minima Suppression
│     h = 0.30 × meanStrokeWidth   [from strokeWidthStore]
│
├── 10  Marker Extraction
│     RegionalMaxima → PeakProminence → StrokeConsistencyFilter
│
├── 11  Marker-Controlled Watershed
│     Flooding + WeakBoundarySuppression
│
├── 12  Connected Component Labeling (two-pass GPU union-find)
│
├── 13  Graph Merge Phase 1  [loose: gap < 1.5 × msw]
│     AdjacentGraph → DeterministicMergeLoose
│
├── 14  Split Detector
│     StrokeWidthContinuity · SkeletonAngleContinuity ·
│     BoundaryEnergy · CompactnessTest · EulerCheck
│     → emits MERGE_CANDIDATE + confidence per pair
│
├── 15  Graph Merge Phase 2  [strict: gap < 0.6 × msw + confidence gate]
│     AdjacentGraph → Skeletonize → EndpointMap → SkeletonScore
│     → DeterministicMergeStrict
│
├── 16  Shape Filtering
│     area/msw² · aspect ratio · convexity · Euler number
│
├── 17  Rotated Bounding Box Extraction (minAreaRect)
│
└── 18  Rendering / Output
```
