/* ======================================================================
   CALIPER  ·  application entry point
   Why: a module is only evaluated if something imports it. main.js imports
   every module so each one's top-level wiring (event listeners, slider
   bindings) runs, then performs the two boot actions: initialise the GPU
   and start the viewport resize observer. This is the only file the page
   loads directly.

   Module map
     config      ordered stage list
     state       the shared mutable state object S
     dom         element handles
     webgpu      WGSL compute shaders: Sauvola, dilation, erosion, opening
     cca         connected components (union-find)
     morph       small CPU helpers: dilation, smoothing, medians
     lens        radial lens-distortion correction
     rectify     page-quad detection and perspective rectification
     borders     rule tracing (solid + dashed)
     borderlayout rules → grid / header box / row rules / sections, erase mask
     heightfilter component height filter with multi-line splitting
     lines       full-line join (left → right, de-skewed)
     textlines   glyph chaining → text lines → clean binary
     columns     table band, gutters, columns, cells
     characters  one symbol per box: join stacked parts, cut merged symbols
     recognition Tesseract.js per full line, symbols mapped onto the boxes
     pipeline    the conductor
     render      one drawing routine per stage kind
     gallery     stage thumbnails
     viewport    pan / zoom blitter
     imageload   file decode with GPU-budget downscaling
     ui          slider bindings and export buttons
   ====================================================================== */
import './config/config.js';
import './state/state.js';
import './dom/dom.js';
import './webgpu/webgpu.js';
import './pipeline/pipeline.js';
import './render/render.js';
import './gallery/gallery.js';
import './viewport/viewport.js';
import './imageload/imageload.js';
import './ui/ui.js';

import { initGPU } from './webgpu/webgpu.js';
import { resizeView } from './viewport/viewport.js';
import { viewport } from './dom/dom.js';

initGPU();
new ResizeObserver(resizeView).observe(viewport);
