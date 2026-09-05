# invoice-engine

**GRIDLIFT** (WebGPU geometry) + **InvoiceForensics** (structural/semantic
analysis) + a **PaddleOCR-VL sidecar** reached only for the rectangles that are
still ambiguous.

The organising principle: *OCR is never responsible for discovering the
layout.* Understand the image geometry first, identify regions and cells
second, and only then let a recogniser interpret the contents of known
rectangles.

```
                  INPUT
                    │
             image normalisation
                    │
        ┌───────────┴────────────┐
        │        GRIDLIFT        │   stages 01-12 on the GPU
        └───────────┬────────────┘   stages 13-15 on the CPU
                    │
             geometry graph
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
    OCR engine              Forensics
        │                        │
        └───────────┬────────────┘
                    ▼
            confidence fusion
                    │
            conf < threshold?
                    │ yes
                    ▼
             PaddleOCR-VL  ← only the problematic ROIs
                    │
             evidence fusion
                    │
            invoice structure
                    │
            validation engine
                    │
             FINAL JSON / DB
```

---

## Quick start

```bash
npm install          # nothing required at runtime; dev only
npm test             # CPU stages + GPU orchestration, no GPU needed
npx serve .          # ES modules need http://, not file://
# open http://localhost:3000  in Chrome/Edge 113+
```

The demo page renders the geometry graph back over the invoice: rules coloured
by `tableness` (red = decorative), the winning grid, per-column semantic roles,
and dashed boxes around every rectangle that *would* be escalated.

```js
import { InvoiceEngine, loadImage } from './src/index.js';
import { createTesseractProvider } from './src/ocr/tesseract.js';
import { PaddleOcrVLSidecar } from './src/ocr/paddleSidecar.js';

const engine = await InvoiceEngine.create({
  config:  { workingMaxDim: 1800 },
  baseOcr: await createTesseractProvider(),
  sidecar: new PaddleOcrVLSidecar({ endpoint: 'http://127.0.0.1:8760' }),
  budget:  { acceptConfidence: 0.9, maxRois: 12 },
});

const result = await engine.process(await loadImage(file));
console.log(result.invoice.lineItems, result.invoice.totals, result.invoice.checks);
```

Geometry only — no OCR, no network, ~10 ms on a discrete GPU:

```js
const { geometry } = await engine.geometryOnly(bitmap);
```

---

## GRIDLIFT — "where are things?"

| # | stage | where | what it does |
|---|-------|-------|--------------|
| 01 | upload | CPU→GPU | one `copyExternalImageToTexture`, once |
| 02 | decode / normalise | GPU | **area-average** downsample to the working resolution, packed RGBA8 |
| 03 | luminance | GPU | Rec.601 luma, composited over white |
| 04 | adaptive contrast | GPU | separable local mean/variance → Sauvola soft ink probability |
| 05 | denoise | GPU | 3×3 median (sorting network) |
| 06 | gradients | GPU | Scharr magnitude + angle, and an orientation histogram → page skew |
| 07 | horizontal strokes | GPU | 1×N directional opening |
| 08 | vertical strokes | GPU | N×1 directional opening |
| 09 | stroke linking | GPU | directional closing bridges dashed/broken rules |
| 10 | border suppression | GPU | two images: geometry keeps the rules, OCR gets them removed |
| 11 | connected components | GPU | union-find label equivalence + compaction + bbox accumulation |
| 12 | projection analysis | GPU | row/column profiles via workgroup-reduced atomics |
| 13 | grid hypotheses | CPU | several candidate grids from independent evidence, scored |
| 14 | cell reconstruction | CPU | rectangles, membership, per-cell confidence |
| 15 | confidence + output | CPU | geometry graph |

### Why it is fast

The invoice crosses the bus **twice**: up once as a texture, back once as a
packed mask. Everything else that returns is already compacted — a component
table (only the used prefix), four projection profiles, a 180-bin histogram.

```
GPU ─ grayscale ─ contrast ─ gradients ─ morphology ─ components ─ projections ─ grid
                                                                                  │
                                                                          small result
                                                                                  ▼
                                                                                 CPU
```

The four mask lanes ride in one `u32` per pixel:

```
byte0 ink │ byte1 horizontal │ byte2 vertical │ byte3 border-suppressed ink
```

### Ratios, not pixel counts

A hard-coded `gap < 10` is correct at exactly one DPI. Every threshold in
[`config.js`](src/gridlift/config.js) is a ratio of the working resolution, so
the same invoice at 150 and 600 dpi behaves the same.

### Hypotheses, not assertions

Stage 13 never says "I found a table". It proposes grids from independent
evidence — vertical rules, whitespace gutters at three thresholds, word-edge
alignment clusters, and their union and consensus — then scores each:

```
GridScore = 0.25·lineEvidence
          + 0.25·textAlignment
          + 0.20·rowConsistency
          + 0.20·columnConsistency
          + 0.10·componentDensity

          × (1 − splitPenalty)     over-segmentation:  a boundary through a word
          × (1 − missedGutters)    under-segmentation: an empty corridor with no boundary
```

Those last two matter more than the weights. Without `splitPenalty` a grid
happily cuts "Paracetamol" in half; without `missedGutters` a scan with two
surviving rules scores a perfect 1.0 on line evidence for a grid that merges
*SL + Description* into one column. A bordered table wins on line evidence, a
borderless one on alignment and row consistency — **same scorer, no separate
code path.**

### Borders are evidence, not instructions

```
┌────────┬─────────┐        ══════════════════
│ Apple  │  100    │              INVOICE
├────────┼─────────┤        ══════════════════
```

The left is a table: its horizontal rules have *crossings*. The right has four
crisp rules, no crossings, and is decoration — `annotateSegments` marks it
`decorative`, `tableness = 0`, and `rejectDecorative` refuses to report it as a
1×1 table.

---

## InvoiceForensics — "what do these things mean?"

* **Regions** — HEADER / SELLER / BUYER / SHIPPING / ITEM_TABLE / SUMMARY / TAX
  / PAYMENT / FOOTER, from keywords plus positional priors. Zoning first means
  "Total" in SUMMARY, "Total" as a column header, and "Total" in the footer stop
  competing.
* **Semantic columns** — from three independent signals: the header text, the
  column's token profile (ints vs money vs prose), and **arithmetic**: the
  triple `(q, p, a)` where `a == q × p` across most rows. The third needs no
  header at all, which is why a headerless table still types correctly.
* **Logical rows** — the hard one:

  ```
  Product A
  long product description
  continued description             10     500
  ```

  Merging is driven by *anchors* (the cells a real line item must have) plus
  serial numbers and indentation. Prose with no anchor is a continuation;
  anchors with no prose are the tail of the item above; only both together
  start a new item.
* **Semantic repair of geometry** — adjacent prose columns with no numerics and
  no rule between them get folded back into one description column, and the
  table is re-typed. Evidence flows *back* from semantics into geometry.
* **Arithmetic forensics** — an invoice is a closed system, and every identity
  that must hold is a free check on both layout and OCR:

  ```
  10 × 5.00 = 50.00                     ✓ line product
  50 + 40 + 45 + 25 = 160.00            ✓ subtotal
  160.00 − 0 + 24.00 = 184.00           ✓ grand total
  ```

  A miss is diagnosed, not just flagged: `expected 50.00, read 5000` is
  reported as `decimal-point` with `suggested: 50`, because that is a scanner
  artefact and not a different number.

The question is never "did OCR read this correctly?" but **"does this
interpretation hold up geometrically, textually and mathematically?"**


---

## Rectification — recovering the page plane from the components

A photographed page stacks three distortions, and they must be undone in this
order because each one blinds the estimator for the next:

| # | distortion | evidence used | fixed by |
|---|---|---|---|
| 1 | quarter turn (90/180/270) | median glyph aspect, projection peakiness | whole-turn matrix |
| 2 | in-plane skew | nearest-neighbour baseline angles | rotation |
| 3 | **perspective** | two vanishing points | homography |

(3) is the one no rotation can fix, and it is what a component overlay of a
phone photo shows: the rows **fan**, and the row pitch tightens down the page.

### Breaking the circularity

Line clustering needs to know the skew; measuring skew normally needs lines.
The way out is to skip lines entirely: characters sit densely along their own
baseline, so the angle from each glyph to its nearest right-hand neighbour peaks
sharply at the *local* baseline angle. No grouping, and being local it survives
perspective where a global angle would smear.

Two details in that estimator were worth a bug each:

* **Anchor on the glyph bottom, not its centroid.** Centroids sit at different
  heights for `o` and `l`, so centroid-to-centroid angles carry the font's
  vertical metrics as noise — enough to invent a third of a degree of skew on a
  perfectly square page.
* **Smooth with a triangular kernel, and locate the peak by weighted centroid.**
  One box pass turns a sharp peak into a flat plateau, and taking the argmax of
  a plateau lands on its left edge — a systematic bias of half the window.

### The two families and the two vanishing points

* **Horizontal**: text baselines, fitted in a deskewed frame so clustering
  works, reported back in image space. Detected rules join this family.
* **Vertical**: column edges, found by **RANSAC over word left/right edges**.
  Clustering edges by x is what a non-perspective pipeline does and it fails
  here: under keystone one column drifts sideways by more than the gap between
  columns, so the clusters merge. Fitting actual lines assumes nothing about
  verticality.

Both are reduced to a vanishing point by RANSAC plus a least-squares null space
(Jacobi on `Σ lᵢlᵢᵀ`). The residual is **angular, not algebraic**, because a
squared algebraic residual blows up exactly when the vanishing point runs off to
infinity — which is what happens on a nearly-square photo.

### Two orthogonal vanishing points give you the focal length

```
f² = −(v_h − c) · (v_v − c)          c = principal point
H  = Rᵀ K⁻¹                          R = [r₁ r₂ r₁×r₂],  rᵢ = unit(K⁻¹ vᵢ)
```

That one extra number makes the rectification **metric** — the page comes back
with its true aspect ratio rather than straight but stretched. When a vanishing
point is at infinity (no perspective on that axis) or the configuration is
inconsistent, it falls back to killing the projective part with the horizon and
squaring up the two directions affinely: angles right, absolute aspect not.
Pass `targetAspect` (A4 portrait = `1/Math.SQRT2`) to pin it exactly.

### Chosen by evidence, applied only if it helps

Nothing here is asserted. Candidate transforms — identity, rotation-only, the
full homography, and a **second refinement round** — are each *applied* to the
components and scored on how flat the page actually became:

```
cost = mean|angle| + 2·(angle spread) + 25·(row-pitch drift)
```

Row pitch *variance* would be the obvious metric and is the wrong one: an
invoice's own paragraph gaps dominate it and say nothing about perspective. The
drift between the top half and the bottom half isolates the part perspective
caused.

The second round is not a flourish. The first estimate is made from lines fitted
through a curved page, where every fit is wrong in the same direction; once the
bulk of the distortion is gone the fits are clean and the residual perspective
can be measured properly. On the hardest case in the suite — sideways plus 3°
skew plus keystone on both axes — one round removes 33% of the pitch drift and
two rounds remove 80%.

A page that is already flat is left alone: warping costs a second GPU pass and a
second set of OCR crops, and `needsRectification` only says yes when the
measurement says the page got flatter.

### Applying it costs nothing extra

Stage 02 already maps every working pixel to a place in the source texture.
Replacing that axis-aligned box mapping with a homography is one extra
matrix-vector product per pixel, so **rectification is folded into the resample
the pipeline was doing anyway** — there is no separate warp pass and no second
copy of the page. The footprint is taken from the local Jacobian rather than
assumed square, because under keystone the top of the page is minified far more
than the bottom and a fixed box would alias one end while blurring the other.

```js
const { geometry, rectification } = await gridlift.analyse(bitmap);  // 'auto'
geometry.image.rectification.applied   // did it warp?
rectification.quality.before / .after  // what it measured, before and after
rectification.Hinv                     // rectified -> original pixels
```

The full-resolution original is **never** warped. Geometry runs on the rectified
working image; each OCR crop is warped on its own, at its own scale, only when
it is about to be read (`RectifyingCropper`). On a 12 MP page that is a few
hundred thousand pixels of resampling instead of twelve million.

### What geometry cannot tell you

A page is statistically identical to its upside-down twin, so `quarterTurns`
comes back with an `ambiguous` pair (e.g. `[1, 3]`). `polarityScore` gives a
geometric opinion from ascender/descender asymmetry — ascenders and capitals
carry far more mass than descenders, overwhelmingly so on an invoice full of
digits — but OCR on two crops is the reliable arbiter and is cheap at that size.

### Check EXIF first

Before blaming geometry for a 90° rotation, check that the bitmap was decoded
with its EXIF orientation applied. Phone photos record rotation in metadata, not
in pixels, and browsers have disagreed about whether `createImageBitmap` honours
it. `loadImage` passes `imageOrientation: 'from-image'` explicitly rather than
trusting the default — that alone accounts for most "the page arrived sideways"
reports.

---

## Evidence fusion

The wrong architecture is *GRIDLIFT says A, PaddleOCR says B → take B.* Every
source stays evidence with a weight:

```
FinalScore = WG·geometry + WT·text + WA·alignment + WS·semantic + WM·arithmetic
```

Missing sources are dropped and the remaining weights renormalised, so a
geometry-only run is not penalised for having no text evidence. Weights live in
[`fusion.js`](src/forensics/fusion.js) and are a prior to be fitted, not a
truth.

---

## ROI escalation

```
                Invoice
                   │
               GRIDLIFT
         ┌─────────┴─────────┐
   conf > 0.90          conf < 0.90
         │                   │
      accept          InvoiceForensics
                       ┌─────┴─────┐
                   resolved    unresolved
                       │           │
                    accept   PaddleOCR-VL  ← the ROIs, never the page
```

Escalation is rectangle-addressed, priority-ordered and hard-capped in count,
pixels and wall-clock, and it stops the moment confidence clears the bar. A
whole-band structure parse is the last resort, not the first move.

| what escalates | why |
|---|---|
| a cell | fused cell confidence below threshold |
| a **row** | `qty × rate ≠ amount` — the error may be in any of the three numbers |
| a column | role unresolved |
| a region | candidate rejected as ambiguous |

See [`docs/server-contract.md`](docs/server-contract.md) for the service API and
a reference FastAPI implementation.

---

## Layout

```
src/
  gpu/          device, pooled buffers, dispatch helper
  gridlift/
    shaders/    WGSL: preprocess, morphology, cca, projections
    pipeline.js stages 01-12 orchestration
    geometry.js segments, components, lines, projections, skew
    grid.js     stage 13 - bands, candidates, scoring
    cells.js    stages 14-15 - cells, confidence, geometry graph
    rectify/    orientation, baseline skew, vanishing points, homography,
                per-ROI warping
  forensics/    regions, columns, rows, tokens, semantics, borderless, fusion
  ocr/          provider contract, ROI cropper, tesseract adapter,
                PaddleOCR-VL sidecar, escalation controller
  demo/         browser harness
test/
  synthetic.js  renders packed masks + component tables without a GPU
  run.js        stages 13-15 and all of InvoiceForensics
  mockgpu.js    validating WebGPU stand-in (bind groups, usages, aliasing)
  gpu.js        stages 01-12 orchestration
  rectify.js    known distortions in, flatness measured out
tools/          shader dump + naga validation
```

---

## Testing without a GPU

Two independent nets, because the failures are of two different kinds.

**Structural** — `node test/gpu.js` runs stages 01-12 against a validating mock
device. It reproduces the rule that bites hardest in practice: `layout: 'auto'`
derives the bind-group layout from the resources *reachable from the entry
point*, so a binding declared but only touched by an uncalled helper silently
vanishes and the bind group fails validation at runtime. The mock walks the
WGSL call graph from `main` and rejects any mismatch. It also checks
storage/uniform usage flags, read↔write aliasing in one dispatch, dispatch
coverage of the working resolution, buffer sizes against device limits, and
that exactly one full-resolution buffer is ever read back.

**Semantic** — `node tools/dump-shaders.mjs && python3 tools/validate-shaders.py`
compiles all 21 kernels with naga.

**Algorithmic** — `node test/run.js` drives stages 13-15 and all of
InvoiceForensics from synthetic packed masks: ruled, borderless, broken-ruled,
decorative-banner, wrapped-row and headerless invoices.

**Geometric** — `node test/rectify.js` applies known homographies (quarter
turn, skew, keystone on either axis, and all of them at once) to a synthetic
page's components and checks that the recovered transform actually flattens it.
It deliberately does *not* compare the recovered matrix to the ground truth:
rectification is only defined up to a similarity, so two very different-looking
matrices can be equally correct.

```
21 passed, 0 failed     (test/run.js)
11 passed, 0 failed     (test/gpu.js)
16 passed, 0 failed     (test/rectify.js)
22 compiled, 0 failed   (naga)
```

---

## Using it from .NET

The engine emits plain JSON, so the C# host consumes it without any JS
interop in the extraction path itself:

```
InvoiceEngine (WebView2 / headless Chrome / Node+Dawn)
        │  geometry graph + invoice JSON
        ▼
InvoiceEngine.exe  (C#)
        │  HTTP/gRPC, only for escalated ROIs
        ▼
PaddleOCR-VL service (Python)
```

The mapping onto the C# shapes:

```csharp
class InvoiceCell {
    Rect Bounds;           // cell.bounds (working) / cell.sourceBounds (full-res)
    int  Row, Column;
    List<Component> Components;
    float Confidence;
    bool HasText, HasBorder;
}
```

Cells carry **both** working-resolution and source-resolution rectangles,
because geometry is cheapest at 1800 px while crops for OCR must come from the
full-resolution original.

If you would rather keep the GPU work in .NET, `analyseGeometry(raw, config)` is
exported separately from the GPU class — a host that runs stages 01-12 itself
(any WebGPU/Dawn binding) can call just the CPU half with the same `raw` shape.

---

## Tuning

| symptom | knob |
|---|---|
| faint text on a scan is lost | `sauvola.k` ↓, `sauvola.minStdDev` ↓ |
| dashed rules read as fragments | `strokes.linkGapRatioH/V` ↑ |
| underlined headings read as rules | `strokes.crowdingDamp` ↑ |
| columns over-split | `hypotheses.minGutterRatio` ↑ |
| columns under-split | `hypotheses.mergeRatio` ↓ |
| `component-capacity-exceeded` | `cca.capacity` ↑ or `workingMaxDim` ↓ |
| skew warning | deskew upstream, or raise the link ratios |

---

## Known limits

* **The 180° ambiguity is not resolvable from geometry.** `polarityScore` is a
  heuristic; confirm with OCR on two crops when it matters.
* **Curl and fold are not modelled.** A homography assumes the page is planar.
  A curled receipt needs a mesh, not a 3x3.
* **Light text on dark headers** reads as background in stage 04. A polarity
  pass per region is the natural fix.
* **Rotated or curved text** (stamps, watermarks) is component noise. It is
  excluded from lines but not modelled.
* **Multi-page and continuation tables** are out of scope; each page is
  analysed independently.
* **Spanning cells** are reconstructed as a grid, so a merged header spanning
  three columns appears as one populated cell and two confidently empty ones.

## License

MIT
