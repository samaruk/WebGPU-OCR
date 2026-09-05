# CALIPER

**Browser-only, WebGPU-accelerated document layout analysis for scanned and photographed invoices.**

CALIPER takes a single page image and, entirely in the browser with no server and no external libraries, produces oriented word boxes, detected table rules, and a row × column table layout. Every intermediate stage is rendered to a clickable gallery so each parameter slider can be tuned against what it actually changes.

The name comes from the *rotating calipers* algorithm used to fit the minimum-area oriented bounding box (OBB) around each word.

## Requirements

- A browser with **WebGPU**: recent Chrome or Edge, or Safari Technology Preview. The pipeline does not run without it. Firefox is not supported.
- A static file server. The app uses ES modules, so it cannot be opened directly from `file://`.

## Running

Serve the folder and open `index.html`:

```bash
npx serve .
```

or

```bash
python -m http.server 8080
```

Then drop a PNG, JPG, WEBP, or BMP onto the drop zone and click **RUN PIPELINE**. Images larger than the GPU storage-buffer budget are downscaled on load and the new size is shown in the metadata panel.

## What the pipeline does

The pipeline runs three geometric correction stages, then three detection passes, then table analysis.

### Geometric correction

1. **Lens distortion** ([js/lens/lens.js](js/lens/lens.js)). Self-calibrates a radial barrel/pincushion model from the bowing of the page edges and straightens them. Engages only when the edges actually bow.
2. **Perspective rectification** ([js/rectify/rectify.js](js/rectify/rectify.js), [js/rectify/detectPageQuad.js](js/rectify/detectPageQuad.js)). Finds the four page corners and warps the quadrilateral back to a rectangle with a homography. Passes the image through unchanged when no confident quad is found.
3. **Skew** ([js/skew/skew.js](js/skew/skew.js)). Measures the page tilt from the median angle of pass A's word boxes, with a projection-profile fallback for near-blank pages, and rotates the raster upright.
4. **Curl dewarp** ([js/dewarp/dewarp.js](js/dewarp/dewarp.js)). Fits the text-line baselines and applies a dense displacement field to straighten the non-planar curl that a homography cannot remove.

### Detection passes

Each pass runs the same chain: Sauvola binarisation → optional erode → separable dilation → connected-component analysis → Moore contour trace → Andrew monotone-chain hull → rotating calipers → minimum-area rectangle. The passes differ only in which image they read and in their dilation kernel.

| Pass | Input image | Dilation | Purpose |
|------|-------------|----------|---------|
| A | corrected, un-rotated | small H, small V | word boxes; feeds skew estimation and dewarp |
| B | deskewed + dewarped | large H, small V | fuses each text line into one blob; gives table rows |
| C | deskewed + dewarped | small H, large V | fuses each column into one stripe; gives table columns |

Pass A applies the non-character filter, which rejects blobs by aspect ratio, fill ratio, length and area to drop rules and box borders. Passes B and C bypass it, because text lines and column stripes are exactly the shapes it rejects.

Two optional clean-up steps run on pass B:

- **Merged-box splitter** ([js/splitter/splitter.js](js/splitter/splitter.js)) cuts boxes that span two text lines at the ink valley, retrying with weaker dilation before flagging the box rejected.
- **Height-density filter** ([js/blobfilter/blobfilter.js](js/blobfilter/blobfilter.js)) finds the modal text-line height and rejects blobs outside that band.

### Borders and table layout

- **Border detection** ([js/borders/borders.js](js/borders/borders.js)) runs on a separate Sauvola binary built with its own lower threshold weight so faint rules survive. Solid rules are found by gap-bridging, morphological opening and centerline tracing, so gently curved rules are followed as polylines. Dashed and dotted rules are found by chaining small components with consistent size and stride.
- **Table analysis** ([js/table/table.js](js/table/table.js)) produces two layouts side by side: a pass-based layout from pass B rows and pass C columns plus ink occupancy, and a border-only layout where vertical rules define columns and horizontal rules bound the table band. Header and footer bands are separated from the line-item table.

## Stage gallery

Every stage is rendered at full resolution into the gallery under the main viewport. Click any panel to inspect it with pan and zoom. The stage list, in order, lives in [js/config/config.js](js/config/config.js): source, lens-corrected, rectified, the eight pass A stages, deskewed, dewarped, the eight pass B and pass C stages, the height-density filter, five border-debugging stages, and the two table layouts.

The border-debugging stages are the fastest way to find out why a rule was missed. If it is absent from **Border · Binary** the problem is the threshold; if it is present in **Border · H-opened** but missing from **Detected Borders**, one of the length, coverage or thickness filters removed it.

## Exports

- **Stage PNG** downloads the currently displayed stage at full resolution.
- **OBB JSON** downloads `caliper_obb.json` containing the run parameters, the accepted word boxes for pass A (original image space) and pass B (deskewed image space) with centre, size, angle and four corners, and the detected table with its region, rows, columns, header and footer.

## Project layout

```
index.html              controls, viewport and gallery markup
css/caliper.css         styling
js/main.js              entry point: imports every module, initialises the GPU
js/config/              ordered stage list shared by renderer, gallery and captions
js/state/               the single shared mutable state object S
js/dom/                 DOM handles resolved once
js/webgpu/              WGSL compute shaders: grayscale, box sums, Sauvola, dilate, erode, morphology
js/cca/                 union-find connected components (CPU)
js/contour/             Moore-neighbour boundary tracing
js/hull/                Andrew monotone-chain convex hull
js/calipers/            rotating calipers minimum-area rectangle
js/lens/                radial lens distortion correction
js/rectify/             page quad detection and perspective rectification
js/skew/                skew estimation and deskew rotation
js/dewarp/              curl dewarping via displacement field
js/splitter/            merged two-line box splitting
js/blobfilter/          height-density blob filter
js/borders/             solid and dashed rule detection
js/table/               row, column and table layout analysis
js/pipeline/            pipeline driver: readParams, runPass, runPipeline
js/render/              draws each stage to an offscreen canvas
js/gallery/             stage thumbnails
js/viewport/            pan and zoom blitter
js/imageload/           file decode with GPU-budget downscaling
js/ui/                  slider bindings and export buttons
```

Each module starts with a comment explaining why it exists. The shared state object is exported as `S` from [js/state/state.js](js/state/state.js) and can be inspected from the browser console after a run.

## Performance notes

Sauvola thresholding, erosion, dilation and the border opening chain run on the GPU as WGSL compute shaders, so re-running after a slider change is fast even on multi-megapixel scans. Connected-component analysis, contour tracing, hull fitting and table analysis run on the CPU. The readout panel shows per-stage timings after each run.

## Repository

Part of [samaruk/WebGPU-OCR](https://github.com/samaruk/WebGPU-OCR).
