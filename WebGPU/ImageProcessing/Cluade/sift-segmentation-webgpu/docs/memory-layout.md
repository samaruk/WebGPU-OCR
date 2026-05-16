# Memory Layout

## Pyramid Buffers (`memory/pyramidBuffers.js`)

```
levels[octave][scale] : f32[]  — W_o × H_o pixels, row-major
dogLevels[octave][s]  : f32[]  — DoG(scale s+1 - scale s)
kernel                : f32[]  — separable 1-D Gaussian kernel
sigmaTable            : f32[]  — σ for each (octave, scale)
```

Octave 0 has the original (W×H) resolution; octave k has (W/2^k × H/2^k).

## SIFT Buffers (`memory/siftBuffers.js`)

```
kpXY[i]       : u32    — packed (x<<16 | y) after extrema3D
kpRefined[i]  : vec4   — (x_sub, y_sub, sigma, angle) after subpixel+orientation
kpFinal[i]    : KP     — struct {x,y,sigma,angle,octave,layer,resp,_pad}
descriptors   : f32[]  — [maxKP × 128] row-major
kpCounter     : u32    — atomic append counter (reset each octave/layer)
mag, ori      : f32[]  — gradient map for current pyramid level
```

## Segmentation Buffers (`memory/segmentationBuffers.js`)

```
binary   : u32[]  — thresholded foreground mask
labels   : u32[]  — CCL labels (0 = background, 1..N = component ID)
relabels : u32[]  — compacted label array (output)
remap    : u32[]  — root → compact ID mapping table
metrics  : Metric[]  — area, bounding box per component
swt      : f32[]  — stroke width per pixel
density  : f32[]  — SIFT keypoint density map
mask, conf: f32[] — fused mask and confidence
keep     : u32[]  — 0/1 filter per component
bboxes   : BBox[] — atomic bounding box reduction
polys    : vec2[] — 4 corners per kept component
```

## Graph Buffers (`memory/graphBuffers.js`)

```
edges       : vec2<u32>[]  — (label_a, label_b) adjacency list
edgeCtr     : u32          — atomic edge count
mergeScores : f32[]        — score per edge
splitScores : f32[]        — score per label
labelMap    : u32[]        — merge result: label → new_label
```

## Buffer Flags Convention

| Flag combo                    | Meaning                     |
|-------------------------------|-----------------------------|
| STORAGE                       | read-only input (read alias) |
| STORAGE + COPY_DST            | written once from CPU        |
| STORAGE (read_write)          | compute read+write           |
| STORAGE + COPY_SRC            | readback to CPU              |
| UNIFORM + COPY_DST            | per-pass uniform block       |
