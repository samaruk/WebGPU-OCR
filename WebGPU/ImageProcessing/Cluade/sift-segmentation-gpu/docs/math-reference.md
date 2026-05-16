# Mathematical Reference

## Gaussian Scale-Space

The Gaussian scale-space is defined as:

```
L(x, y, σ) = G(x, y, σ) * I(x, y)
```

where `G(x, y, σ) = (1/2πσ²) exp(-(x²+y²)/2σ²)`.

The incremental blur between consecutive scales uses:

```
σ_inc = sqrt(σ_target² − σ_prev²)
```

## Difference of Gaussians (DoG)

```
D(x, y, σ) = L(x, y, kσ) − L(x, y, σ)
```

DoG approximates the Laplacian of Gaussian (LoG) scale-normalised by σ².

## Hessian Edge Rejection

The ratio of principal curvatures is tested via:

```
Tr(H)² / Det(H) < (r+1)² / r
```

where `r = edgeThreshold` (default 10) and H is the 2×2 Hessian of D.

## Sub-pixel Localisation

A 3-D Taylor expansion of D at the candidate extremum:

```
D(x) ≈ D + (∂D/∂x)ᵀ x + ½ xᵀ ∂²D/∂x² x
```

Solved by setting the gradient to zero:

```
x̂ = − H⁻¹ ∂D/∂x
```

## SIFT Descriptor

128-dimensional histogram over a 4×4 grid of 8-bin orientation histograms,
extracted in a scale- and orientation-normalised patch of size `16σ`.

Contrast normalisation: clamp to 0.2 then re-normalise.

## Douglas-Peucker Polygon Simplification

Given a polyline P₀…Pₙ and tolerance ε:

1. Find the point Pₘ farthest from the line P₀Pₙ.
2. If dist(Pₘ, line) > ε, recurse on P₀…Pₘ and Pₘ…Pₙ.
3. Otherwise, replace the segment with just its endpoints.

## Adaptive Mask Fusion

```
score(x,y) = (1−α)·mag(x,y) + α·kpDensity(x,y)
mask(x,y)  = score > θ
```

Default: α = 0.5, θ = 0.15.

## Merge Score

```
mergeScore = 0.45·colourSim + 0.35·areaBalance + 0.20·kpFlow
```

where `colourSim = 1 − ||ΔC||/√3`, `areaBalance = 2·min(A,B)/(A+B)`.
