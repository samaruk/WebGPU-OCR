# GPU Architecture

## Overview

The pipeline is structured as a directed acyclic graph (DAG) of compute passes,
each reading from and writing to GPU-resident buffers/textures.

```
[Image Upload]
      │
  [Preprocess]  — bilateral filter, CLAHE, gamma
      │
  [Pyramid]     — Gaussian scale-space (4 octaves × 5 scales)
      │
  [SIFT]        — DoG → extrema → refine → descriptors
      │
 ┌────┴────┐
[Cluster] [Stroke]   — descriptor similarity | SWT
 └────┬────┘
  [Fusion]      — weighted cue combination
      │
 [Segmentation] — CCL (iterative union-find on GPU)
      │
  [Skeleton]    — Zhang-Suen thinning (A+B passes)
      │
   [Graph]      — merge/split scoring on adjacency graph
      │
[Postprocess]   — bounding boxes, polygon approx, mask write
```

## Workgroup Sizes

| Pass              | Workgroup        | Rationale                        |
|-------------------|------------------|----------------------------------|
| Image ops (2D)    | 8 × 8 = 64       | fits tile cache on most HW       |
| Flat reduction    | 256 × 1          | saturates occupancy              |
| Descriptor hist   | 1 × 1 (serial)   | per-kp serial accumulation       |
| Descriptor norm   | 128 × 1          | matches 128-dim descriptor       |
| Thinning          | 8 × 8            | reads 8-neighbour halo           |

## Memory Layout

All pyramid levels are stored as **linearised `f32` arrays** (row-major) in
`GPUBuffer` objects rather than textures to allow atomic operations and arbitrary
random-access reads in subsequent passes.

Keypoints use a **packed u32** format at the detection stage (x in bits 31:16,
y in bits 15:0) to allow atomic append without branch divergence.
