# Dispatch Order

Each named block below is a single `GPUComputePass` (with implicit barrier on end).

```
1.  textureUpload          — rgba8 → r32float storage texture
2.  rgbToGray              — linearise + luminance
3.  bilateralFilter        — edge-preserving denoise
4.  gammaCorrection        — optional gamma lift

Per octave o = 0..3:
  Per scale s = 0..S+2:
    5.  gaussianPyramid    — separable 2-D Gaussian
  Per scale s = 1..S+2:
    6.  dog                — difference of Gaussians
  Per scale s = 1..S (interior):
    7.  extrema3D          — 3×3×3 local extrema
    8.  contrastReject     — low-contrast filter
    9.  hessianReject      — edge point filter
    10. subpixelRefine     — Taylor-series correction
    11. gradientMap        — per-pixel ∇I magnitude+orientation
    12. orientationAssign  — 36-bin histogram → peak angles
    13. descriptorHistogram— 4×4×8 histogram accumulation
    14. descriptorNormalize— L2-clamp-reL2
    15. keypointCompaction — append to global keypoint list

16. spatialGridBuild       — keypoints → uniform grid
17. densityMap             — Gaussian splat → density image
18. gradientMagnitude      — Sobel |∇I| for SWT
19. rayCastStrokeWidth     — ray-cast SWT
20. strokeMedianReduce     — per-component median SWT
21. strokeConsistencyMap   — pixel-level consistency
22. adaptiveMaskFusion     — density + SWT → mask
23. confidenceScore        — sqrt( mask × density ) → binary

24. binaryThreshold        — hard threshold
25. localLabelInit         — label[i] ← i
For iter = 0..127:
    26. labelEquivalenceResolve — union-find step
27. labelFlatten           — path compression
28. relabelCompact         — remap to [1..N]
29. componentMetrics       — area + bounding box

30. adjacencyBuild         — pixel labels → edge list
31. mergeScoreCompute      — shared boundary ratio
For iter = 0..63:
    32. deterministicMerge — merge edges above threshold
33. labelUpdate            — propagate merge to pixels

For iter = 0..255 (thinning):
    34. thinningPassA      — Zhang-Suen mark A
    35. thinningPassB      — delete marked
36. endpointDetect         — degree-1 skeleton pixels
37. branchDetect           — degree-≥3 skeleton pixels

38. boundingBoxReduce      — atomic min/max bbox per label
39. aspectRatioFilter      — remove invalid shapes
40. polygonApprox          — bounding box corners
41. finalMaskWrite         — write coloured result texture
```

Total GPU passes per frame: ~200–300 depending on pyramid size and iteration counts.
