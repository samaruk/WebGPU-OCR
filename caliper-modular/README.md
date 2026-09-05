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

### Text-line clean

Before pass A, the **text-line clean** stage ([js/textlines/textlines.js](js/textlines/textlines.js), section 02b) detects whole text lines on the rectified image and removes everything that is not text. Character components from the Sauvola binary are filtered by height, shape and multi-line splitting, then chained into lines by horizontal proximity, vertical overlap and comparable height. Chaining is used instead of a horizontal dilation so that skewed lines are followed and stacked lines never fuse. Lone specks, dash-like fragments and chains with uneven heights are rejected. Accepted lines are joined left to right into full lines, and only their ink is kept in a clean binary. Pass A runs on that clean binary, so rules, borders, logos, halftone and dust never reach the word-box stages.

### Detection passes

Each pass runs the same chain: Sauvola binarisation → optional erode → separable dilation → connected-component analysis → Moore contour trace → Andrew monotone-chain hull → rotating calipers → minimum-area rectangle. The passes differ only in which image they read and in their dilation kernel.

| Pass | Input image | Dilation | Purpose |
|------|-------------|----------|---------|
| A | corrected, un-rotated | small H, small V | word boxes; feeds skew estimation and dewarp |
| B | deskewed + dewarped | large H, small V | fuses each text line into one blob; gives table rows |
| C | deskewed + dewarped | small H, large V | fuses each column into one stripe; gives table columns |

Pass A adds two filters and one extra output that the other passes skip.

- **Height filter** ([js/heightfilter/heightfilter.js](js/heightfilter/heightfilter.js), section 05). Right after the min-area filter it enforces that one blob is a single letter, word or line. Any blob taller than the max line height is cut at its ink valleys into one blob per line, with the bridge rows dropped. Every blob is then kept only if its height is between the min height and the max line height and it is not rule-shaped. A merge that could not be cut is removed, not kept. Dots, thin rules, logos, box borders and multi-line merges therefore never reach the contour, hull, calipers and OBB stages.
- **Line blobs** ([js/lines/lines.js](js/lines/lines.js), section 05b). The kept word blobs are dilated horizontally and re-labelled, so each connected component is one whole text line. Because the height filter already removed everything that is not text, the strong horizontal growth cannot pull rules or borders into a line. Each line records the word blobs inside it and is included in the JSON export.
- **Full lines** (same module, section 05c). Line blobs that overlap vertically are joined left to right into one full line per text row. A join is refused when the combined height would exceed the max line height, and whenever the two pieces overlap horizontally, since one line has exactly one piece at any horizontal position. A full line therefore never contains more than one line, even when neighbouring columns are staggered or a fragment sits just above or below a line.
- **Non-character filter** (section 06) rejects the remaining blobs by aspect ratio, fill ratio, length and area.

Passes B and C bypass both filters, because text lines and column stripes are exactly the shapes they reject.

Two optional clean-up steps run on pass B:

- **Merged-box splitter** ([js/splitter/splitter.js](js/splitter/splitter.js)) cuts boxes that span two text lines at the ink valley, retrying with weaker dilation before flagging the box rejected.
- **Height-density filter** ([js/blobfilter/blobfilter.js](js/blobfilter/blobfilter.js)) finds the modal text-line height and rejects blobs outside that band.

### Borders and table layout

- **Border detection** ([js/borders/borders.js](js/borders/borders.js)) runs on a separate Sauvola binary built with its own lower threshold weight so faint rules survive. Solid rules are found by gap-bridging, morphological opening and centerline tracing, so gently curved rules are followed as polylines. Dashed and dotted rules are found by chaining small components with consistent size and stride.
- **Table analysis** ([js/table/table.js](js/table/table.js)) produces two layouts side by side: a pass-based layout from pass B rows and pass C columns plus ink occupancy, and a border-only layout where vertical rules define columns and horizontal rules bound the table band. Header and footer bands are separated from the line-item table.

## Stage gallery

Every stage is rendered at full resolution into the gallery under the main viewport. Click any panel to inspect it with pan and zoom. The stage list, in order, lives in [js/config/config.js](js/config/config.js): source, lens-corrected, rectified, the five text-line clean stages, the eleven pass A stages (height filter, line blobs and full lines included), deskewed, dewarped, the eight pass B and pass C stages, the height-density filter, five border-debugging stages, and the two table layouts.

The border-debugging stages are the fastest way to find out why a rule was missed. If it is absent from **Border · Binary** the problem is the threshold; if it is present in **Border · H-opened** but missing from **Detected Borders**, one of the length, coverage or thickness filters removed it.

## Exports

- **Stage PNG** downloads the currently displayed stage at full resolution.
- **OBB JSON** downloads `caliper_obb.json` containing the run parameters, the detected text lines and full lines from the clean stage, the accepted word boxes, line-blob boxes and full-line boxes for pass A (rectified image space) and the word boxes for pass B (deskewed image space) with centre, size, angle and four corners, and the detected table with its region, rows, columns, header and footer.

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
js/textlines/           pre-pass-A text-line detection and non-text removal
js/heightfilter/        blob height filter and multi-line blob splitting (shared by 02b and 05)
js/lines/               pass A whole-line blobs and left-to-right full lines
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
