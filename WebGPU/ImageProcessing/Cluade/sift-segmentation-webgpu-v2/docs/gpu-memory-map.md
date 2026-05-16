# GPU Memory Map

All GPU buffers live in `MemoryLayout` (core/memoryLayout.js).

| Buffer         | Size             | Description                         |
|----------------|------------------|-------------------------------------|
| grayBuf        | W×H × f32        | linearised luminance after upload   |
| blurBuf        | W×H × f32        | post-preprocess (bilateral+gaussian) |
| pyrLevels[o][s]| Wo×Ho × f32      | Gaussian pyramid level              |
| dogLevels[o][s]| Wo×Ho × f32      | DoG level                           |
| kpPackedBuf    | 16384 × u32      | packed (x<<16|y) extrema candidates |
| kpRefinedBuf   | 16384 × vec4<f32>| subpixel refined (x,y,σ,resp)       |
| kpFinalBuf     | 16384 × vec4<f32>| with assigned orientation           |
| descBuf        | 16384 × 128 × f32| normalized SIFT descriptors         |
| densityBuf     | W×H × f32        | keypoint density map                |
| gradMagBuf     | W×H × f32        | Sobel gradient magnitude            |
| gradAngBuf     | W×H × f32        | gradient angle (0..π)               |
| swtBuf         | W×H × f32        | stroke width transform              |
| consistBuf     | W×H × f32        | stroke width consistency (0/1)      |
| maskBuf        | W×H × f32        | fused (density+consist) mask        |
| confBuf        | W×H × f32        | confidence (geometric mean)         |
| binaryBuf      | W×H × u32        | hard foreground mask                |
| labelBuf       | W×H × u32        | CCL labels (union-find roots)       |
| relabelBuf     | W×H × u32        | compacted labels [1..N]             |
| skelBuf        | W×H × u32        | thinned skeleton                    |
| endpBuf        | W×H × u32        | skeleton endpoints                  |
| graphEdgeBuf   | 65536 × vec2<u32>| component adjacency edges           |
| mergeScoreBuf  | 65536 × f32      | edge merge scores                   |
| bboxBuf        | MAX_L × BBox     | component bounding boxes            |
| keepBuf        | MAX_L × u32      | component keep mask                 |
| polyBuf        | MAX_L × 4 × vec2 | polygon corners                     |
