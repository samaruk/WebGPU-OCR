/* ======================================================================
   RUN-TIME STATE  ·  the shared mutable object `S`
   Why: the loaded image, the GPU device, every stage result and the
   viewport transform are needed by almost every module. Holding them in
   one object keeps the modules stateless (functions over S) and lets the
   whole data model be inspected from one console reference.
   ====================================================================== */
import { STAGES } from '../config/config.js';

export const S={
  /* GPU */
  device:null, maxPixels:32_000_000, gpuBufN:0, gpuBuf:null,

  /* loaded image: source size, working size (after the pixel budget) */
  img:null, srcW:0, srcH:0, W:0, H:0, scaledFrom:null,
  origCanvas:null, origImageData:null,          // working-size raster as loaded

  /* geometric correction (section 00b) */
  lensCanvas:null,                              // lens-distortion corrected
  workCanvas:null, workImageData:null,          // + perspective rectified: the working image (border stage reads this)
  cleanCanvas:null, cleanImageData:null,        // working image with every rule painted out (all later stages read this)

  /* stage results */
  borders:null,                                 // section 02 · see borderlayout.js
  textLines:null,                               // section 03 · see textlines.js
  columns:null,                                 // section 04 · see columns.js
  characters:null,                              // section 05 · see characters.js
  recognition:null,                             // section 06 · see recognition.js

  /* viewer */
  stage:STAGES.length-1, stageCv:null,          // current stage index + offscreen render target
  thumbs:[],                                    // gallery thumbnails
  view:{scale:1,tx:0,ty:0}, dpr:Math.min(devicePixelRatio||1,2)
};
