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
  rawCanvas:null, rawImageData:null,            // working-size raster exactly as loaded
  origCanvas:null, origImageData:null,          // the image the pipeline starts from: raw, or raw with the watermark removed
  watermark:null,                               // section 00 · {contrast, window, ms, watermarkPixels} once removed

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
  api:null,                                     // section 00c · PaddleOCR API request entry, see api.js
  final:null,                                   // FINAL · best of local + API, see final.js
  pipelineDone:false, galleryPromise:null,      // the API continuation needs both to know when to draw

  /* viewer */
  stage:STAGES.length-1, stageCv:null,          // current stage index + offscreen render target
  thumbs:[],                                    // gallery thumbnails
  view:{scale:1,tx:0,ty:0}, dpr:Math.min(devicePixelRatio||1,2)
};
