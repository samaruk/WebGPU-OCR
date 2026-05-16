# Performance Notes

## GPU Occupancy

- Workgroup size is fixed at 8×8 = 64 threads per workgroup.
- At 8 MP (3264×2448) the pyramid construction dispatches ~50k workgroups.
- For best occupancy on mobile GPUs, reduce to 4×4 if timestamp queries
  indicate the pipeline is workgroup-bound.

## Memory Budget

| Resource                      | Estimate (8 MP)  |
|-------------------------------|-----------------|
| Input RGBA texture            | 32 MB           |
| Grayscale r8unorm             | 8 MB            |
| Pyramid scales (all octaves)  | ~11 MB          |
| DoG stack (CPU Float32Array)  | ~11 MB          |
| Mask + CCA labels             | 8 MB            |
| Descriptor buffer (4096 kp)   | 2 MB            |
| **Total GPU**                 | **~52 MB**      |

## Timing Targets (desktop GPU)

| Stage                | Target   |
|----------------------|----------|
| Preprocessing        | < 8 ms   |
| Pyramid (4 octaves)  | < 15 ms  |
| SIFT detection       | < 20 ms  |
| Descriptor extract   | < 25 ms  |
| Mask fusion          | < 5 ms   |
| CCA                  | < 10 ms  |
| Graph merge          | < 3 ms   |
| **Total**            | **< 86 ms** |

## Bottlenecks

1. **CLAHE and bilateral filter** are CPU-bound. Port to GPU compute for a
   ~4× speedup at high resolution.
2. **Descriptor extraction** is the costliest CPU stage. The `.wgsl` reference
   kernel in `sift/descriptorExtract.wgsl` shows the GPU layout.
3. **CCA union-find** is inherently sequential; consider the parallel label
   propagation scheme for a GPU port.
