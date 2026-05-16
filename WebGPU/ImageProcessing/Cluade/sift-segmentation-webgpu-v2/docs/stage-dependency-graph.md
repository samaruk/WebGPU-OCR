# Stage Dependency Graph

```
srcTex ──▶ [01 Upload] ──▶ grayBuf
                               │
                        [02 Preprocess] ──▶ blurBuf
                               │
                        [03 Pyramid] ──▶ pyrLevels, gaussKernel
                               │
                        [04 DoG] ──▶ dogLevels
                               │
                        [05 Extrema] ──▶ kpPackedBuf, kpCtr
                               │
                        [06 Refine] ──▶ kpRefinedBuf
                               │
                        [07 Orientation] ──▶ kpFinalBuf, magBuf, oriBuf
                               │
                        [08 Descriptor] ──▶ descBuf
                               │
              ┌────────────────┤
         [09 Clustering]  [10 Stroke]
         densityBuf        gradMagBuf, gradAngBuf, swtBuf, consistBuf
              └────────────────┤
                        [11 Fusion] ──▶ confBuf, maskBuf, binaryBuf
                               │
                        [12 Segmentation] ──▶ relabelBuf
                               │
              ┌────────────────┤
         [13 Skeleton]   [14 Graph]
         skelBuf          graphEdgeBuf, mergeScores
              └────────────────┤
                        [15 Postprocess] ──▶ bboxBuf, keepBuf, polyBuf
```
