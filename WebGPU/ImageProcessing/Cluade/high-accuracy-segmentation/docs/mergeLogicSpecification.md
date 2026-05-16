# Merge Logic Specification

## Two-Phase Design

The pipeline uses two separate graph merge phases sandwiching the split detector.
This ensures the split detector never has to reason about noise fragments.

### Phase 1 (Stage 13): Noise Fragment Elimination
**Purpose:** Consolidate fragments from broken strokes, small blobs, and watershed over-splits.
**Criteria:** Gap < 1.5 × msw AND angle difference < 35°
**No split detector gate** — these merges are unconditional within loose threshold.

### Split Detector (Stage 14): Deep Analysis
**Input:** Phase 1 output (cleaner components — no noise fragments).
**Output:** MERGE_CANDIDATE flag + confidence score per adjacent pair.
**Criteria (weighted):**
| Criterion | Weight | Rationale |
|-----------|--------|-----------|
| Stroke width continuity | 0.25 | Same stroke width → same character |
| Skeleton angle continuity | 0.25 | Same direction → same stroke |
| Boundary energy weakness | 0.20 | Low gradient → no real ink gap |
| Compactness improvement | 0.15 | Merge makes shape more compact |
| Euler topology consistency | 0.15 | Merge preserves topology |

**Confidence gate:** 0.55 (from `config.js SPLIT_CONFIDENCE_GATE`)

### Phase 2 (Stage 15): Strict Normalized Merge
**Input:** Phase 1 output + MERGE_CANDIDATE flags from Stage 14.
**Criteria:** Gap < 0.6 × msw AND angle < 18° AND confidence ≥ 0.55
**Purpose:** High-precision merge of broken characters (diacritics, italic strokes).
