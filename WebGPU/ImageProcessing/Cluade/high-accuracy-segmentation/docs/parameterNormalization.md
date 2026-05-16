# Parameter Normalization

All tunable thresholds in this pipeline trace back to either `adaptiveHeuristics.js` or `paramResolver.js`.
No magic pixel-absolute values exist anywhere in the pipeline.

## Core Normalizer: meanStrokeWidth

`meanStrokeWidth` (msw) is extracted in Stage 07 from the SWT distribution.
It flows into every downstream threshold via `strokeWidthStore`.

| Parameter | Formula | Stage |
|-----------|---------|-------|
| Sauvola window (P2) | `3.0 × msw` (odd) | 05 |
| h-Minima h | `0.30 × msw × noiseFactor` | 09 |
| Phase 1 merge gap | `1.5 × msw` | 13 |
| Phase 2 merge gap | `0.6 × msw` | 15 |
| Shape min area | `0.5 × msw²` | 16 |

## Bootstrap Before SWT

Before SWT runs, Stage 05 needs a Sauvola window. The bootstrap uses:

```
sauvolaWindowBootstrap = round(0.12 × estimatedDPI)  (clipped to [11, 127], odd)
```

This is replaced in Pass 2 by the run-length stroke estimate.

## DPI-Adaptive Parameters

| Parameter | Formula |
|-----------|---------|
| Hough threshold | `80 × (dpi / 150)` |
| Shape area min factor | `0.5 × (dpi / 150)` |
| Bilateral σ_space | `3.0 × (1 + 2 × noiseRatio)` |
