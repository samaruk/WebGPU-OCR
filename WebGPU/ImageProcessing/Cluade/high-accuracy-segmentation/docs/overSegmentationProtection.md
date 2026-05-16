# Over-Segmentation Protection

Over-segmentation (splitting one character into multiple regions) is the primary
failure mode on low-quality images. This document explains the protective layers.

## Layer 1: h-Minima Suppression (Stage 09)
Shallow local maxima in the distance transform correspond to weak internal ridges
within a single character stroke. Suppressing them with h = 0.3 × msw prevents
the watershed from treating these as separate character seeds.

**Effect:** Reduces intra-character seeds by ~40-60% on typical low-quality input.

## Layer 2: Peak Prominence Filter (Stage 10)
Removes distance map peaks that protrude less than 0.3 × msw above their surroundings.
These correspond to noise bumps, not character centers.

## Layer 3: Stroke Consistency Filter (Stage 10)
Removes peaks located in regions with inconsistent stroke width distribution.
Eliminates markers placed on noise blobs that happen to look like local maxima.

## Layer 4: Weak Boundary Suppression (Stage 11)
After watershed, removes boundary lines where the original image gradient is below
`WEAK_BOUNDARY_GRADIENT_MIN = 0.04`. Merges regions separated only by the watershed
algorithm, not by actual ink gap.

## Layer 5: Phase 1 Merge (Stage 13)
Loose-threshold merge catches residual fragment pairs that survived watershed intact.

## Layer 6: Split Detector + Phase 2 Merge (Stages 14-15)
Highest-precision layer. Uses five independent criteria to decide whether adjacent
components are actually parts of one character. Only merges with sufficient
multi-criteria confidence.

## Monitoring Over-Segmentation

`research/perStageMetrics.js` tracks split errors at each stage.
The `findWorstDropStage()` method identifies which layer is failing for a given image type.
Add `perStageMetrics.record("stage_name", bboxes, gtBoxes)` calls in `main.js` during development.
