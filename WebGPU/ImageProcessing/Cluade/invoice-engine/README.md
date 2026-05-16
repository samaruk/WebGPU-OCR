# Invoice Engine — WebGPU

A fully GPU-accelerated invoice analysis pipeline using WebGPU compute shaders.

## Architecture

```
invoice-engine/
├── index.html              # UI shell (dark terminal aesthetic)
├── main.js                 # Pipeline orchestrator
├── config.js               # Tunable parameters
├── vite.config.js
│
├── core/
│   ├── gpuContext.js       # WebGPU device init + helpers
│   ├── bufferManager.js    # Texture/buffer registry
│   ├── pipelineManager.js  # Shader compilation + dispatch
│   └── utils.js            # Image loading, texture I/O
│
├── stages/                 # 14 sequential pipeline stages
│   ├── 01_uploadTexture.js   → ImageData → GPU texture
│   ├── 02_grayscale.js       → RGBA → grayscale (weighted)
│   ├── 03_adaptiveThreshold.js → Local mean threshold
│   ├── 04_jfaInit.js         → Seed JFA ping-pong buffer
│   ├── 05_jfaPass.js         → Log2(N) JFA passes
│   ├── 06_distanceFinalize.js → JFA seeds → distance field
│   ├── 07_localMaxCircles.js  → Local maxima = circle centers
│   ├── 08_morphologyHorizontal.js → H-dilation for text blobs
│   ├── 09_morphologyVertical.js   → V-dilation
│   ├── 10_projectionRow.js    → GPU row histogram
│   ├── 11_projectionColumn.js → GPU column histogram
│   ├── 12_tableDetector.js    → Band detection → table region
│   ├── 13_regionCropper.js    → Crop lines + table region
│   └── 14_transformerOCR.js   → Tesseract.js OCR
│
├── shaders/               # WGSL compute shaders
│   ├── grayscale.wgsl
│   ├── threshold.wgsl
│   ├── jfa_init.wgsl
│   ├── jfa_pass.wgsl
│   ├── localmax.wgsl
│   ├── morph_horizontal.wgsl
│   ├── morph_vertical.wgsl
│   ├── projection_row.wgsl
│   └── projection_column.wgsl
│
└── ui/
    └── tableMarker.js     # Canvas overlay renderer
```

## Algorithm

### Circle Detection (Medial Axis / Maximal Inscribed Circles)

1. **Grayscale** — luminosity-weighted RGB→grey
2. **Adaptive Threshold** — per-pixel local mean with constant offset
3. **JFA (Jump Flooding Algorithm)** — computes Euclidean distance transform in O(log N) GPU passes
4. **Local Maxima** — distance field peaks = centers of maximal inscribed circles

Each detected circle is tangent to the nearest text boundary. Large circles in whitespace = inter-line gaps. Small circles pack densely inside text strokes.

### Text Line Detection

1. **Morphology** — horizontal dilation merges characters into text-line blobs
2. **Row Projection** — GPU histogram of foreground pixels per row
3. **Band Detection** — runs of active rows = text line bands

### Table Detection

1. **Column Projection** — GPU histogram per column
2. **Dual Projection** — intersect row bands × column bands
3. **Region Clustering** — find densest grid of row×col bands

## Usage

```bash
npm install
npm run dev
```

Open http://localhost:3000, drop an invoice image, click **Run Pipeline**.

## Requirements

- Chrome 113+ or Edge 113+ (WebGPU required)
- Enable `chrome://flags/#enable-unsafe-webgpu` if needed on older Chrome

## Config

Edit `config.js` to tune:
- `circles.scoreThreshold` — lower = more circles detected
- `circles.minRadius` — minimum inscribed circle size
- `threshold.C` — adaptive threshold sensitivity
- `morphology.horizontalKernel` — text blob merge distance
