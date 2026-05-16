# SIFT Segmentation GPU – Architecture

## Overview

This project implements a fully GPU-accelerated SIFT-based image segmentation pipeline
using WebGPU compute shaders. The pipeline runs in the browser with no server-side
processing required.

## Pipeline Stages

```
Input Image
  │
  ├─ Preprocessing
  │    ├─ Grayscale conversion    (GPU)
  │    ├─ Gamma correction        (GPU)
  │    ├─ CLAHE                   (CPU)
  │    └─ Bilateral filter        (CPU)
  │
  ├─ Gaussian Scale-Space Pyramid
  │    ├─ Incremental Gaussian blur at each scale  (GPU)
  │    └─ 2× downsampling between octaves         (GPU)
  │
  ├─ SIFT Keypoint Detection
  │    ├─ Difference-of-Gaussians (DoG)            (CPU/GPU)
  │    ├─ 3×3×3 extrema detection                  (CPU)
  │    ├─ Hessian edge rejection                   (CPU)
  │    ├─ Sub-pixel localisation                   (CPU)
  │    ├─ Orientation assignment                   (CPU)
  │    └─ 128-dim descriptor extraction            (CPU)
  │
  ├─ Keypoint Clustering
  │    └─ Grid-based suppression                   (CPU)
  │
  ├─ Segmentation
  │    ├─ Gradient map                             (GPU)
  │    ├─ Adaptive mask fusion                     (CPU+GPU)
  │    ├─ Connected Component Analysis (CCA)       (CPU)
  │    └─ Skeletonisation (Zhang-Suen)             (CPU)
  │
  ├─ Graph Building & Merging
  │    ├─ Adjacency graph construction             (CPU)
  │    ├─ Merge score computation                  (CPU)
  │    └─ Deterministic greedy merge               (CPU)
  │
  └─ Post-processing
       ├─ Bounding box extraction
       ├─ Aspect ratio filtering
       ├─ Douglas-Peucker polygon fitting
       └─ JSON / SVG / PNG export
```

## Module Map

| Directory       | Responsibility                                     |
|-----------------|---------------------------------------------------|
| `core/`         | WebGPU device, pipeline cache, buffer/texture mgmt |
| `preprocessing/`| Image normalisation before scale-space             |
| `pyramid/`      | Gaussian scale-space pyramid                       |
| `sift/`         | Keypoint detection, orientation, descriptors       |
| `clustering/`   | Keypoint grid suppression + descriptor matching    |
| `stroke/`       | Gradient maps, Stroke Width Transform              |
| `segmentation/` | Mask fusion, CCA, skeletonisation                  |
| `graph/`        | Adjacency graph, merge/split scoring               |
| `postprocess/`  | Polygons, bounding boxes, export                   |
| `utils/`        | Math, image utilities, logger, profiler            |
| `workers/`      | Web Worker threads for CPU-heavy passes            |

## Design Principles

- **Single-file modules**: each `.js` file has one clear responsibility.
- **GPU-first**: all per-pixel operations target WebGPU compute shaders (`.wgsl`).
- **CPU fallback**: CLAHE, bilateral filter, and some SIFT passes run on CPU
  for correctness; they can be ported to GPU without API changes.
- **Zero external dependencies**: the codebase has no npm dependencies.
- **Deterministic**: given the same inputs and config, the pipeline always
  produces the same output (no random sampling).
