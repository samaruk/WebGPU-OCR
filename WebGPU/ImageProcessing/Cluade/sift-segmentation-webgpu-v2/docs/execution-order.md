# Execution Order

```
stage 01  UploadStage          — image → r32float gray buffer
stage 02  PreprocessStage      — gamma, bilateral blur
stage 03  PyramidStage         — 4-octave Gaussian scale-space
stage 04  DogStage             — difference of Gaussians per octave
stage 05  ExtremaStage         — 3D local extrema + contrast/Hessian filter
stage 06  RefineStage          — quadratic subpixel refinement
stage 07  OrientationStage     — gradient map + dominant orientation
stage 08  DescriptorStage      — 128-D SIFT descriptor + L2-norm
stage 09  ClusteringStage      — density map + descriptor similarity
stage 10  StrokeStage          — Sobel edge + SWT ray-cast + consistency
stage 11  FusionStage          — density × stroke → confidence mask
stage 12  SegmentationStage    — iterative CCL (union-find on GPU)
stage 13  SkeletonStage        — Zhang-Suen thinning + endpoint detect
stage 14  GraphStage           — adjacency build + merge scoring
stage 15  PostprocessStage     — bounding boxes, filter, polygon approx
```
