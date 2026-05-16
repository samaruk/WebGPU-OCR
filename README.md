# ⬡ WebGPU OCR Pipeline

A three-stage GPU-accelerated OCR processing pipeline built entirely with
[WebGPU](https://developer.chrome.com/docs/web-platform/webgpu) compute shaders.
Each stage has its own WGSL shader file and JavaScript module.

```
ocr-webgpu/
├── index.html                    ← UI (dark industrial, drag-drop upload)
├── main.js                       ← Pipeline orchestrator
├── utils/
│   └── webgpu-utils.js           ← Shared GPU helpers, renderers, Otsu, BBox
├── preprocessing/
│   ├── preprocessing.wgsl        ← WGSL: grayscalePass, gaussianBlurPass, binarizePass
│   └── preprocessing.js          ← PreprocessingPipeline class
├── detection/
│   ├── detection.wgsl            ← WGSL: sobelPass, probabilityMapPass, dilatePass
│   └── detection.js              ← TextDetectionPipeline class
└── cnn/
    ├── cnn.wgsl                  ← WGSL: convPass, reluPass, maxPoolPass
    └── cnn.js                    ← CNNPipeline class (8 filters)
```

---

## Requirements

| Requirement | Details |
|---|---|
| **Browser** | Chrome 113+, Edge 113+, or any browser with WebGPU enabled |
| **GPU** | Any discrete or integrated GPU (WebGPU uses `high-performance` adapter) |
| **Server** | A local HTTP server — ES modules and `fetch()` for WGSL require `http://` |

> **Note:** Opening `index.html` directly via `file://` will fail because
> `fetch('./preprocessing/preprocessing.wgsl')` is blocked on the `file:` protocol.
> You **must** serve the folder over HTTP.

---

## Quick Start

Pick any local server you have available:

```bash
# Python (built-in, no install)
cd ocr-webgpu
python -m http.server 8080

# Node.js (npx, no global install needed)
npx serve ocr-webgpu

# VS Code
# Install the "Live Server" extension, right-click index.html → Open with Live Server
```

Then open **http://localhost:8080** in Chrome/Edge.

---

## Pipeline Architecture

### Stage 1 — Preprocessing (`preprocessing.wgsl`)

| Pass | Entry Point | Input | Output |
|---|---|---|---|
| 1 | `grayscalePass` | RGBA f32 array (stride-4) | Greyscale f32 array |
| 2 | `gaussianBlurPass` | Greyscale f32 | Blurred greyscale f32 |
| 3 | `binarizePass` | Blurred greyscale f32 | Binary {0,1} f32 |

- **Grayscale** uses BT.709 luma coefficients (0.2126 R + 0.7152 G + 0.0722 B).
- **Gaussian blur** applies a 5×5 Pascal-triangle kernel (sum = 256) for noise reduction.
- **Otsu threshold** is computed on the CPU from the blurred histogram, then uploaded
  as a uniform before the binarise dispatch. Text is inverted (dark strokes → 1).

All passes share identical `@group(0)` bindings (`inp`, `out`, `unif`) with
`workgroup_size(16, 16)`.

---

### Stage 2 — Text Detection (`detection.wgsl`)

DBNet-inspired probability map approach, approximated without a trained network:

| Pass | Entry Point | Description |
|---|---|---|
| 1 | `sobelPass` | Sobel 3×3 gradient magnitude |
| 2 | `probabilityMapPass` | Local edge density (7×7) → text probability via smoothstep |
| 3 | `dilatePass` | 5×5 morphological max-dilation of thresholded probability |

Bounding boxes are found CPU-side via two-pass connected-component labelling
with union-find (O(N)), then overlaid on a canvas with confidence badges.

---

### Stage 3 — CNN Feature Extraction (`cnn.wgsl`)

Eight 3×3 filters are applied sequentially:

| # | Name | Purpose |
|---|---|---|
| 0 | Sobel-H | Horizontal edges (baselines) |
| 1 | Sobel-V | Vertical edges (character stems) |
| 2 | Diag-NW | Diagonal strokes ↘ |
| 3 | Diag-NE | Diagonal strokes ↙ |
| 4 | Laplacian | Blob / corner detection |
| 5 | Sharpen | High-frequency enhancement |
| 6 | Emboss | Surface-relief (orientation) |
| 7 | Smooth | Gaussian low-pass (context) |

For each filter: `convPass` → `reluPass` → `maxPoolPass`.

- Filter weights are uploaded to a storage buffer (`@binding(3)`) before each dispatch.
- `layout: 'auto'` correctly excludes binding 3 from the relu/pool pipeline layouts.
- Results are rendered as 4×2 grids with a turbo colormap.

---

## WebGPU Binding Layouts

```
Preprocessing / Detection shared layout:
  @binding(0) var<storage, read>       inp  : array<f32>
  @binding(1) var<storage, read_write> out  : array<f32>
  @binding(2) var<uniform>             unif : Uniforms    // 16 bytes

CNN layout:
  @binding(0) var<storage, read>       inp     : array<f32>
  @binding(1) var<storage, read_write> out     : array<f32>
  @binding(2) var<uniform>             unif    : CNNUniforms  // 16 bytes
  @binding(3) var<storage, read>       weights : array<f32>   // convPass only
```

Uniform structs are exactly 16 bytes (4 × 4-byte fields) to satisfy the
WebGPU `minUniformBufferOffsetAlignment` requirement.

---

## Enabling WebGPU (if needed)

Chrome/Edge 113+ have WebGPU enabled by default. If you see a warning:

```
chrome://flags/#enable-unsafe-webgpu   → Enable
```

Or use Chrome Canary for the latest WebGPU support.
"# WebGPU-OCR" 
