/* ======================================================================
   CALIPER  ·  application entry point
   Why: a module is only evaluated if something imports it. main.js imports
   every module so each one's top-level wiring (event listeners, slider
   bindings) runs, then performs the two boot actions: initialise the GPU
   and start the viewport resize observer. This is the only file the page
   loads directly.
   ====================================================================== */
import './config/config.js';
import './state/state.js';
import './dom/dom.js';
import './webgpu/webgpu.js';
import './cca/cca.js';
import './lens/lens.js';
import './rectify/rectify.js';
import './contour/contour.js';
import './hull/hull.js';
import './calipers/calipers.js';
import './skew/skew.js';
import './dewarp/dewarp.js';
import './splitter/splitter.js';
import './table/table.js';
import './pipeline/pipeline.js';
import './render/render.js';
import './gallery/gallery.js';
import './viewport/viewport.js';
import './imageload/imageload.js';
import './ui/ui.js';

import { initGPU } from './webgpu/webgpu.js';
import { resizeView } from './viewport/viewport.js';
import { viewport } from './dom/dom.js';

/* boot */
initGPU();
new ResizeObserver(resizeView).observe(viewport);
