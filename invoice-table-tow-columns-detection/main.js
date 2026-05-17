/* ======================================================================
   CALIPER  ·  application entry point
   Why: a module is only evaluated if something imports it. main.js imports
   every module so each one's top-level wiring (event listeners, slider
   bindings) runs, then performs the two boot actions: initialise the GPU
   and start the viewport resize observer. This is the only file the page
   loads directly.
   ====================================================================== */
import './config.js';
import './state.js';
import './dom.js';
import './webgpu.js';
import './cca.js';
import './contour.js';
import './hull.js';
import './calipers.js';
import './skew.js';
import './splitter.js';
import './table.js';
import './pipeline.js';
import './render.js';
import './gallery.js';
import './viewport.js';
import './imageload.js';
import './ui.js';

import { initGPU } from './webgpu.js';
import { resizeView } from './viewport.js';
import { viewport } from './dom.js';

/* boot */
initGPU();
new ResizeObserver(resizeView).observe(viewport);
