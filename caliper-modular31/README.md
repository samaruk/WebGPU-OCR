# CALIPER — modular build

The single-file `caliper-obb-pipeline.html` split so that **every section is
its own folder**, plus a configuration section and a `main.js` that imports
them all. Behaviour is identical to the monolith — only the file layout
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

Every section is its own folder under `js/`; the module file inside shares
the folder's name.

```
index.html              markup only — links the stylesheet, loads js/main.js
css/caliper.css          the stylesheet, extracted verbatim
js/main.js               entry point: imports every section, then boots
js/config/config.js      one folder per section
js/state/state.js
js/dom/dom.js
js/webgpu/webgpu.js
js/cca/cca.js
js/contour/contour.js
js/hull/hull.js
js/calipers/calipers.js
js/skew/skew.js
js/splitter/splitter.js
js/table/table.js
js/pipeline/pipeline.js
js/render/render.js
js/gallery/gallery.js
js/viewport/viewport.js
js/imageload/imageload.js
js/ui/ui.js
```

A section folder is free to grow — split a module into more files inside its
own folder without touching any other section. Cross-section imports use the
`../<section>/<section>.js` path.

## Why the split is shaped this way

Each module carries a header comment explaining why it exists; the summary:

| Section        | What it owns               | Why it is a separate folder |
|----------------|----------------------------|-----------------------------|
| `config`       | stage tables               | One source of truth for the 21-stage list, so render / gallery / caption never desync. |
| `state`        | the shared object `S`      | Isolates all mutable run-time data; every other module stays a stateless function over `S`. |
| `dom`          | element handles + `showError` | Resolves every DOM node once; a markup change breaks one import here, not many nulls. |
| `webgpu`       | 1 · GPU binarisation       | Sauvola is far too slow on CPU per interactive run — five WGSL compute shaders move it to the GPU. |
| `cca`          | 2 · connected components   | Turns the binary mask into discrete blobs — the bridge from pixels to objects. |
| `contour`      | 3 · contour tracing        | Reduces a filled blob to an ordered boundary polygon for the hull. |
| `hull`         | 4 · convex hull            | The min-area-rectangle theorem requires a convex polygon. |
| `calipers`     | 5 · oriented bounding box  | Rotating calipers gives the exact minimum-area rotated box per word. |
| `skew`         | skew detect + correct      | Scanned pages tilt; uncorrected, every box and the table grid shear. |
| `splitter`     | merged-box splitter        | Recovers one-box-per-word when dilation fused two stacked lines. |
| `table`        | table-layout analysis      | Groups boxes into rows/columns — turns geometry into invoice structure. |
| `pipeline`     | pipeline driver            | The conductor: `runPass` is the per-image chain, `runPipeline` sequences everything. |
| `render`       | stage rendering            | One descriptor-driven routine draws all 21 stages identically. |
| `gallery`      | stage gallery              | Full-res thumbnail of every stage — what makes the sliders tunable. |
| `viewport`     | pan / zoom                 | Inspect word boxes at pixel scale on a page larger than the screen. |
| `imageload`    | image loading              | Decodes and downscales to the GPU buffer budget so allocation never fails mid-run. |
| `ui`           | UI wiring                  | All slider/button behaviour in one place, away from the image-processing code. |

## Dependency notes

The graph contains intentional cycles (`pipeline ↔ gallery ↔ ui`,
`pipeline ↔ viewport`). They are safe: every cross-module *call* happens at
run time, and the only cross-module reference evaluated during import
(`runBtn.onclick = runPipeline` in `ui`) targets a hoisted function
declaration, which ES modules initialise before any module body runs.
