/* ======================================================================
   RUN-TIME STATE  ·  the shared mutable object `S`
   Why: the loaded image, GPU device, both pass results and the viewport
   transform are needed by almost every module. Holding them in one object
   keeps the modules themselves stateless (pure functions over S) and means
   the entire data model can be inspected from a single console reference.
   ====================================================================== */
import { STAGES } from '../config/config.js';

/* ---------- global state ---------- */
export const S={
  device:null, maxPixels:32_000_000,
  img:null, srcW:0, srcH:0, W:0, H:0, scaledFrom:null,
  origImageData:null, origCanvas:null,        // original working-size raster (as loaded)
  lensCanvas:null,                            // lens-distortion-corrected raster (feeds rectification)
  workCanvas:null, workImageData:null,        // fully corrected working raster (border stage reads this)
  cleanCanvas:null, cleanImageData:null,      // working raster with every detected rule painted out — all later processing uses this
  deskewOrigCanvas:null,                      // original (rules intact) levelled with the same angle — pass B's border detection
  dewarpOrigCanvas:null, dewarpOrigImageData:null,
  deskewCanvas:null, deskewImageData:null, angle:0,   // rotation-corrected image + skew
  dewarpCanvas:null, dewarpImageData:null,    // curl-dewarped raster (pass B runs on this)
  borders:null,                             // pre-pass-A border / rule layout (section 02a)
  textLines:null,                           // pre-pass-A text-line clean result (section 02b)
  columns:null,                             // pre-pass-A column detection result (section 02c)
  passes:{A:null,B:null,C:null},            // per-pass {binary,dilated,labels,ncomp,lab2blob,blobs}
  stage:STAGES.length-1, stageCv:null,        // current stage index + offscreen render target
  thumbs:[],                                  // gallery thumbnail canvases
  view:{scale:1,tx:0,ty:0}, dpr:Math.min(devicePixelRatio||1,2),
  gpuBufN:0, gpuBuf:null
};
