# CALIPER

**Browser-only, WebGPU-accelerated invoice layout analysis.**

CALIPER takes a photographed or scanned invoice and, entirely in the browser with no server and no external libraries, finds its printed rules, its text lines and the row × column structure of the item table. Every intermediate stage is rendered to a clickable gallery so each parameter can be tuned against what it actually changes.

## Requirements

- A browser with **WebGPU**: recent Chrome or Edge, or Safari Technology Preview. The pipeline does not run without it.
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

Then drop a PNG, JPG, WEBP or BMP onto the drop zone and click **RUN PIPELINE**. Images larger than the GPU storage-buffer budget are downscaled on load and the new size is shown in the metadata panel.

## Pipeline

The pipeline has seven steps and 25 gallery stages. Sidebar sections are numbered to match.

### 00b · Rectification

The **Rectify image** checkbox, on by default, runs two geometric corrections: a self-calibrated radial lens correction ([js/lens/lens.js](js/lens/lens.js)) and a perspective rectification that finds the page quad and warps it back to a rectangle ([js/rectify/rectify.js](js/rectify/rectify.js)). When it is off, every stage works on the original image. Stages 1 to 3 show the source, the lens-corrected and the rectified image.

### 01 · Binarisation

Sauvola adaptive thresholding on the GPU ([js/webgpu/webgpu.js](js/webgpu/webgpu.js)), plus the connectivity and minimum component area used by every later analysis.

### 02 · Borders · rules — stages 4 to 9

The rule detector ([js/borders/borders.js](js/borders/borders.js)) traces solid and dashed rules on a separate Sauvola binary built with a lower threshold weight. The layout module ([js/borderlayout/borderlayout.js](js/borderlayout/borderlayout.js)) interprets them: intersecting rules form a grid, three or more horizontals with verticals give the whole table from borders, two horizontals with verticals give the region and columns, a short boxed header row gives column boundaries extended down to a totals line of the same width, stacked long horizontals bound an open table, and long rules outside the table are section separators. Every rule is then painted out of the working image with the surrounding paper, following the actual ink run of each rule so the soft fringe of a photographed rule goes too. All later stages process this rule-free image.

### 03 · Text lines · clean — stages 10 to 14

The text-line module ([js/textlines/textlines.js](js/textlines/textlines.js)) turns character components into clean text lines. The reference glyph height is an ink-weighted median that ignores solid components, so halftone cannot drag it down. The component filter ([js/heightfilter/heightfilter.js](js/heightfilter/heightfilter.js)) cuts tall components at their ink valleys and drops anything too short, still multi-line or rule-shaped. Survivors are chained by horizontal proximity, vertical overlap and comparable height. A component whose neighbours sit on two different lines is a bridge, a pen tick or stroke reaching across, and can never join them. A Theil–Sen line through each chain splits two-line merges and drops off-line marks. Lone components must look like a glyph and sit inside the page. Accepted chains are joined left to right into full lines ([js/lines/lines.js](js/lines/lines.js)) in a de-skewed frame, each piece against its nearest neighbour, one piece per x position, never taller than one line, and drawn as a polygon that follows the pieces. Only the ink of accepted lines survives into the clean binary.

### 04 · Columns — stages 15 to 19

The column module ([js/columns/columns.js](js/columns/columns.js)) reads the table skeleton from the full lines in the de-skewed frame. Rows and columns get separate slopes: the rows' slope de-skews y, while x is de-skewed along the columns, whose slope is the one under which the table rows show the most clear bins in their coverage profile (searched ±3.4° around the rows' slope). On a rectified photo the two differ by a residual shear, and de-skewing x with the rows' slope would shear every column and fill the narrow gaps between TP and VAT. Rows with enough pieces form runs; the run with the most column structure seeds the band, or a table box from the border stage does. Foreign rows that cross a third or more of the gutters are trimmed off the ends, the band grows through every adjacent column-compatible table row, and other runs across damaged rows are merged in when they share the columns, so one invoice yields one whole item table. A glyph coverage profile across the band exposes the gutters, either as clear runs almost no row crosses or as deep valleys at most 42 percent of the neighbouring peaks, which finds columns separated only by a word space. A valley too narrow for a gutter (0.4 glyph heights for a clear one, 0.6 for a deep one, so a single character gap or a word space never qualifies) is skipped in favour of the next valley of the same stretch. Border column boundaries are added where the coverage allows. Every invoice is header, item table and footer. Inside the band, a tabular row that does not respect the gutters and has under 60 % of the pieces of a table row is foreign (a Client Name / Bill No. block glued to the table), and the table is the block between such rows holding the most tabular rows; an item row whose name ran into the next column keeps its piece count and never breaks a block, nor do non-tabular rows, so a table damaged by a fold or watermark stays whole. Then: thin rows are first folded into the item row they sit on (a product code that drifted into a row of its own), then, once the item rows are established, the first tabular row whose first column (code / serial) is empty, that fills clearly fewer columns than an item row and that is followed by fewer first-column rows than precede it, is a totals row and the table ends before it, and after recognition the rows reading Sub Total, Grand Total, Amount in words or Free Product are handed back to the column stage, which ends the table before the first of them. Either way, a totals row immediately followed by a run of item rows is a sub-total inside the table (one page can carry several product groups) and does not end it. Columns are classified left, right or centre aligned, and every glyph goes to the column under its centre to form the cell grid.

### 05 · Characters — stages 20 to 22

The character module ([js/characters/characters.js](js/characters/characters.js)) makes every box one symbol. Inside each accepted line, components whose x ranges overlap are stacked parts of one symbol and are joined, such as the dot and stem of an i. A symbol much wider than the line's median character width is a merge and is cut at the significant valleys of its column ink profile, with slivers merged back. Each character records its line, its member components, how it was made and the table cell it lies in. The stages show the character boxes, the split profiles with cut positions, and a contact sheet of every character crop.

### 06 · Recognition — stages 23 to 25

The recognition module ([js/recognition/recognition.js](js/recognition/recognition.js)) loads Tesseract.js from the jsDelivr CDN on first use and recognises every full line in single-line mode with the dictionaries off, so batch codes and amounts are not "corrected" into words. Each row crop holds only the row's own glyphs, sheared level with the page tilt and upscaled, with punctuation drawn slightly fatter so decimal points survive the engine's noise filter. The character boxes are then reconciled with the engine word by word: when a word has as many boxes as characters they map one to one, otherwise the word's region is re-segmented into exactly that many boxes at the best ink valleys, so every character carries a text and a confidence. Chains sitting on a dark background, the desk around the paper, are rejected as off-page before any of this. The text of each table cell is assembled from the characters inside it. The stages show the recognised symbol over every box coloured by confidence, the text of each full line, and the recognised text of each table cell. The first run needs a network connection to fetch the library and language data; later runs use the browser cache.

## Stage gallery

Every stage is rendered at full resolution into the gallery under the viewport; click any panel to inspect it with pan and zoom. The list lives in [js/config/config.js](js/config/config.js). The border stages show the binary, both openings, the rules, the erased image and the interpreted layout. The text-line stages show the binary, the component filter, the chains with rejection reasons, the full lines and the clean binary. The column stages show the row bands, the coverage profile with gutters, the columns, the cells and the table layout.

## Exports

- **Stage PNG** downloads the currently displayed stage at full resolution.
- **Layout JSON** downloads `caliper_layout.json` with the parameters, the border layout, the text lines and full lines with polygons and centrelines, the table band, gutters, columns with alignment and cells, every character with its box, kind, cell, text and confidence, and the recognised line and cell texts.

## Project layout

```
index.html              controls, viewport and gallery markup
css/caliper.css         styling
js/main.js              entry point: imports every module, initialises the GPU
js/config/              ordered stage list
js/state/               the shared mutable state object S
js/dom/                 DOM handles resolved once
js/webgpu/              WGSL compute shaders: Sauvola, dilation, erosion, opening
js/cca/                 union-find connected components
js/morph/               CPU dilation, smoothing and medians
js/hull/                convex hull (used by the page-quad fit)
js/lens/                radial lens-distortion correction
js/rectify/             page-quad detection and perspective rectification
js/borders/             rule tracing, solid and dashed
js/borderlayout/        rules → grid, header box, row rules, sections; erase mask and inpainting
js/heightfilter/        component height filter with multi-line splitting
js/lines/               full-line join, de-skewed, polygon outlines
js/textlines/           glyph chaining → text lines → clean binary
js/columns/             table band, gutters, columns, cells
js/characters/          one symbol per box: join stacked parts, cut merged symbols
js/recognition/         Tesseract.js per full line, symbols mapped onto the character boxes
js/pipeline/            the conductor: readParams and runPipeline
js/render/              one drawing routine per stage kind
js/gallery/             stage thumbnails
js/viewport/            pan and zoom blitter
js/imageload/           file decode with GPU-budget downscaling
js/ui/                  slider bindings and export buttons
```

Each module starts with a comment explaining why it exists and how it works. The shared state object is exported as `S` from [js/state/state.js](js/state/state.js) and can be inspected from the browser console after a run.

## Repository

Part of [samaruk/WebGPU-OCR](https://github.com/samaruk/WebGPU-OCR).
