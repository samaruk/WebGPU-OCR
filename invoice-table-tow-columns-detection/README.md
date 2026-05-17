# CALIPER — modular build

The single-file `caliper-obb-pipeline.html` split into one ES module per
section, plus a configuration module and a `main.js` that imports them all.
Behaviour is byte-for-byte identical to the monolith — only the file layout
changed.

## Running it

ES module scripts are fetched with CORS rules and **will not load from a
`file://` path**. Serve the folder over HTTP:

```
cd caliper-modular
python3 -m http.server 8000
```

then open `http://localhost:8000/`. (The original single-file
`caliper-obb-pipeline.html` still opens directly with no server — that is the
trade-off for splitting into modules.) A WebGPU-capable browser is required.

## Layout

```
index.html          markup only — links the stylesheet, loads js/main.js
css/caliper.css      the stylesheet, extracted verbatim
js/main.js           entry point: imports every module, then boots
js/*.js              one module per section
```

## Why the split is shaped this way

Each module carries a header comment explaining why it exists; the summary:

| Module         | Section it owns            | Why it is a separate file |
|----------------|----------------------------|---------------------------|
| `config.js`    | stage tables               | One source of truth for the 21-stage list, so render / gallery / caption never desync. |
| `state.js`     | the shared object `S`      | Isolates all mutable run-time data; every other module stays a stateless function over `S`. |
| `dom.js`       | element handles + `showError` | Resolves every DOM node once; a markup change breaks one import here, not many nulls. |
| `webgpu.js`    | 1 · GPU binarisation       | Sauvola is far too slow on CPU per interactive run — five WGSL compute shaders move it to the GPU. |
| `cca.js`       | 2 · connected components   | Turns the binary mask into discrete blobs — the bridge from pixels to objects. |
| `contour.js`   | 3 · contour tracing        | Reduces a filled blob to an ordered boundary polygon for the hull. |
| `hull.js`      | 4 · convex hull            | The min-area-rectangle theorem requires a convex polygon. |
| `calipers.js`  | 5 · oriented bounding box  | Rotating calipers gives the exact minimum-area rotated box per word. |
| `skew.js`      | skew detect + correct      | Scanned pages tilt; uncorrected, every box and the table grid shear. |
| `splitter.js`  | merged-box splitter        | Recovers one-box-per-word when dilation fused two stacked lines. |
| `table.js`     | table-layout analysis      | Groups boxes into rows/columns — turns geometry into invoice structure. |
| `pipeline.js`  | pipeline driver            | The conductor: `runPass` is the per-image chain, `runPipeline` sequences everything. |
| `render.js`    | stage rendering            | One descriptor-driven routine draws all 21 stages identically. |
| `gallery.js`   | stage gallery              | Full-res thumbnail of every stage — what makes the sliders tunable. |
| `viewport.js`  | pan / zoom                 | Inspect word boxes at pixel scale on a page larger than the screen. |
| `imageload.js` | image loading              | Decodes and downscales to the GPU buffer budget so allocation never fails mid-run. |
| `ui.js`        | UI wiring                  | All slider/button behaviour in one place, away from the image-processing code. |

## Dependency notes

The graph contains intentional cycles (`pipeline ↔ gallery ↔ ui`,
`pipeline ↔ viewport`). They are safe: every cross-module *call* happens at
run time, and the only cross-module reference evaluated during import
(`runBtn.onclick = runPipeline` in `ui.js`) targets a hoisted function
declaration, which ES modules initialise before any module body runs.
