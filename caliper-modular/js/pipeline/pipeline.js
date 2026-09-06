/* ======================================================================
   PIPELINE DRIVER
   Why: something has to be the conductor. readParams snapshots every control
   into a plain object; runPass executes the full per-image chain (Sauvola ->
   dilate -> CCA -> contour -> hull -> calipers -> filter); runPipeline
   sequences the two passes, skew, splitting, table analysis and rendering.
   ====================================================================== */
import { $, overlay, runBtn, oStep, savePng, saveJson, showError } from '../dom/dom.js';
import { S } from '../state/state.js';
import { gpuSauvola, gpuDilate, gpuMorph, gpuErode, gpuUploadBinary } from '../webgpu/webgpu.js';
import { cca } from '../cca/cca.js';
import { traceContour } from '../contour/contour.js';
import { convexHull } from '../hull/hull.js';
import { minAreaRect } from '../calipers/calipers.js';
import { obbToPart, splitMergedBoxes } from '../splitter/splitter.js';
import { filterByHeightDensity } from '../blobfilter/blobfilter.js';
import { filterBlobsByHeight } from '../heightfilter/heightfilter.js';
import { buildLineBlobs, buildFullLines } from '../lines/lines.js';
import { detectTextLines } from '../textlines/textlines.js';
import { detectColumns } from '../columns/columns.js';
import { analyseBorders, inpaintRules } from '../borderlayout/borderlayout.js';
import { estimateSkew, buildDeskew } from '../skew/skew.js';
import { rectifyPerspective } from '../rectify/rectify.js';
import { correctLensDistortion } from '../lens/lens.js';
import { dewarpCurl } from '../dewarp/dewarp.js';
import { analyzeTable, analyzeTableFromBorders } from '../table/table.js';
import { detectBorders } from '../borders/borders.js';
import { buildGallery, showStage } from '../gallery/gallery.js';
import { fitView } from '../viewport/viewport.js';

/* =====================================================================
   PIPELINE DRIVER
   ===================================================================== */
export function readParams(){
  const win=+$('win').value;
  return {
    rectify:$('rectify').checked,
    deskew:$('deskew').checked, skewMax:+$('skewMax').value,
    radius:(win-1)>>1, k:+$('k').value, R:+$('rr').value, invert:$('invert').checked,
    brEnable:$('brEnable').checked, brMinLen:+$('brMinLen').value, brSectionLen:+$('brSectionLen').value,
    brErase:$('brErase').checked, brUseCols:$('brUseCols').checked,
    tlEnable:$('tlEnable').checked, tlMinH:+$('tlMinH').value, tlMaxH:+$('tlMaxH').value,
    tlMaxAsp:+$('tlMaxAsp').value, tlGap:+$('tlGap').value, tlOverlap:+$('tlOverlap').value,
    tlMinChars:+$('tlMinChars').value,
    clEnable:$('clEnable').checked, clMinPieces:+$('clMinPieces').value, clRowGap:+$('clRowGap').value,
    clGutterW:+$('clGutterW').value, clGutterCov:+$('clGutterCov').value, clMergeGap:+$('clMergeGap').value,
    dilA:{h:+$('dilHa').value, v:+$('dilVa').value, eh:0, ev:0},                       // before rotate (word detection — no erode, would damage thin glyphs)
    dilB:{h:+$('rowDilH').value, v:+$('rowDilV').value,                                 // after rotate · Pass B (rows)
          eh:+$('rowEroH').value, ev:+$('rowEroV').value},                              //   erode is selectable from the UI; defaults are 0/0 (off) — opt-in for noisy scans
    dilC:{h:+$('colDilH').value, v:+$('colDilV').value,                                 // after rotate · Pass C (columns)
          eh:+$('colEroH').value, ev:+$('colEroV').value},                              //   mirror of Pass B; defaults 0/0 (off)
    conn8:$('conn').querySelector('.on').dataset.c==='8',
    minArea:+$('minA').value,
    heightFilter:$('heightFilter').checked, hMinF:+$('hMinF').value, hSplitF:+$('hSplitF').value,
    lineBlobs:$('lineBlobs').checked, lineDilH:+$('lineDilH').value, lineDilV:+$('lineDilV').value,
    fullLines:$('fullLines').checked, fullOverlap:+$('fullOverlap').value,
    rmNon:$('rmNon').checked,
    maxAspect:+$('asp').value, minFill:+$('fill').value,
    maxLen:+$('len').value, maxArea:+$('amax').value,
    splitMerged:$('splitMerged').checked, splitRatio:+$('splitRatio').value,
    densityFilter:$('densityFilter').checked, densityThresh:+$('densityThresh').value,
    detectTable:$('detectTable').checked, tableSens:+$('tableSens').value,
    kBorder:+$('kBorder').value,
    // border-detection (solid-rule pipeline)
    bMaxGapH       : +$('bMaxGapH').value,
    bMaxGapV       : +$('bMaxGapV').value,
    bOpenH         : +$('bOpenH').value,
    bOpenV         : +$('bOpenV').value,
    bMaxThickness  : +$('bMaxThick').value,
    bMinCoverage   : +$('bMinCov').value,
    bSmoothing     : +$('bSmoothR').value,
    bMinLenFrac    : +$('bMinLenF').value,
    // border-detection (dashed-rule pipeline)
    bDetectDashed  : $('bDetectDashed').checked,
    bDotMaxSize    : +$('bDotMaxSize').value,
    bDotMinDots    : +$('bDotMinDots').value,
    bDotStrideRatio: +$('bDotStrideR').value,
    bDashMinLenFrac: +$('bDashMinLenF').value,
    rlsa:$('rlsa').checked, rowDilH:+$('rowDilH').value, colDilV:+$('colDilV').value,
    showRej:$('showRej').checked
  };
}
export const raf=()=>new Promise(r=>requestAnimationFrame(()=>r()));

/* signed degree formatter, e.g. +15.00° / −3.40° */
export const fmtDeg=a=>`${a>=0?'+':'−'}${Math.abs(a).toFixed(2)}°`;


export async function runPass(imgData, dil, p, opts = {}){
  const W=S.W,H=S.H;

  /* Pass B and Pass C share the Sauvola binary but must be independent
     after that.  When the caller supplies opts.binary (a precomputed
     Sauvola binary), runPass uploads it explicitly to b.outB so the
     subsequent erode + dilation starts from that exact binary —
     regardless of what any previous pass left in b.outB.  When no
     opts.binary is supplied, the legacy path runs gpuSauvola here
     (still used by Pass A). */
  let binary;
  if(opts.binary){
    binary = opts.binary;
    await gpuUploadBinary(binary);
  } else {
    binary = await gpuSauvola(imgData,p);
  }
  // Optional asymmetric erode of the Sauvola binary BEFORE the main
  // dilation, to remove isolated noise specks.  See gpuErode's comment
  // for the trade-off; called only when dil.eh or dil.ev is set so
  // existing call sites (Pass A and any caller not opting in) are
  // unaffected.  The Sauvola binary lives in b.outB, gpuErode mutates
  // it in place, and gpuDilate then reads the cleaned binary.  The
  // `binary` Uint8Array returned by gpuSauvola was already copied out
  // before the erosion, so it preserves the raw Sauvola output for
  // downstream ink-occupancy analyses that want untouched ink.
  if(dil.eh || dil.ev){
    await gpuErode(dil.eh || 0, dil.ev || 0);
  }
  const dilated = await gpuDilate(dil.h,dil.v);
  const cc = cca(dilated,W,H,p.conn8);
  let blobs=[]; let lab2blob=new Int32Array(cc.count).fill(-1);
  for(let l=0;l<cc.count;l++){
    if(cc.area[l]>=p.minArea){
      lab2blob[l]=blobs.length;
      blobs.push({label:l,area:cc.area[l],
        bb:{x0:cc.bx0[l],y0:cc.by0[l],x1:cc.bx1[l],y1:cc.by1[l]},
        start:cc.start[l]});
    }
  }
  /* Optional height filter (section 05, pass A only).  Multi-line blobs
     are cut at their ink valleys into one blob per line (the label map is
     rewritten in place), then every blob is kept only if its height sits
     in the [minF, maxF] × median band and it is not rule-shaped.  Runs
     BEFORE the geometry stages, so contours / hulls / calipers / OBBs
     are only computed for single-line, text-shaped blobs.  The full
     pre-filter list is kept on the pass (blobsAll / lab2blobAll) so the
     Blob Pixels stage still shows everything and the Height Filter
     stage can colour the rejects and the split children. */
  let blobsAll=blobs, lab2blobAll=lab2blob, heightFilter=null;
  if(opts.heightFilter && blobs.length){
    const r=filterBlobsByHeight(blobs, cc.labels, binary, W, H, {
      lo:opts.heightFilter.lo, split:opts.heightFilter.split,
      maxAspect:opts.heightFilter.maxAspect, minArea:p.minArea, conn8:p.conn8, count:cc.count });
    blobs=r.blobs; lab2blob=r.lab2blob; lab2blobAll=r.lab2blobAll; blobsAll=r.blobsAll;
    heightFilter=r.heightFilter;
  }
  for(const bl of blobs) bl.contour=traceContour(cc.labels,W,H,bl.label,bl.start,bl.bb);
  for(const bl of blobs) bl.hull=convexHull(bl.contour);
  const minSide=Math.min(W,H), imgArea=W*H;
  for(const bl of blobs){
    const r=minAreaRect(bl.hull); bl.obb=r;
    const boxArea=Math.max(r.w*r.h,1e-6);
    const lng=Math.max(r.w,r.h), sht=Math.max(Math.min(r.w,r.h),1e-6);
    bl.aspect=lng/sht;
    bl.fill=bl.area/boxArea;
    bl.lenFrac=lng/minSide;
    bl.areaFrac=(r.w*r.h)/imgArea;
    let ok=true,why='';
    if(p.rmNon){
      if(bl.aspect>p.maxAspect){ok=false;why='aspect';}
      else if(bl.lenFrac>p.maxLen){ok=false;why='too long';}
      else if(bl.areaFrac>p.maxArea){ok=false;why='too large';}
      else if(bl.fill<p.minFill){ok=false;why='hollow';}
    }
    bl.accepted=ok; bl.reject=why;
    bl.parts=[obbToPart(r,ok,bl.area,bl.aspect,bl.fill)];   // 1 box; split step may replace
  }
  return {binary,dilated,labels:cc.labels,ncomp:cc.count,lab2blob,blobs,blobsAll,lab2blobAll,heightFilter};
}

export async function runPipeline(){
  if(!S.device || !S.origImageData) return;
  const p=readParams();
  overlay.classList.add('show'); runBtn.disabled=true;
  const t={};
  try{
    // 1 · lens distortion — undo radial (barrel/pincushion) edge bowing
    //     first of all, so the page edges are straight before the
    //     perspective stage fits a quad to them. Auto-gated: engages
    //     only when the page edges actually bow.
    let t0=performance.now();
    let lens=null, rect=null;
    if(p.rectify){
      oStep.textContent='1 · lens distortion'; await raf();
      try{ lens=correctLensDistortion(S.origCanvas); }catch(e){ lens=null; }
    }
    S.lensCanvas = lens || S.origCanvas;
    t.lens=performance.now()-t0;

    // 2 · perspective rectification — warp the (now straight-edged) page
    //     quad back to a rectangle. Conservative: a flat/square-on
    //     capture passes straight through. Both corrections are skipped
    //     when "Rectify image" (section 00b) is unchecked: every later
    //     stage then works on the original image as loaded.
    t0=performance.now();
    if(p.rectify){
      oStep.textContent='2 · perspective rectification'; await raf();
      try{ rect=rectifyPerspective(S.lensCanvas); }catch(e){ rect=null; }
    }
    S.workCanvas = rect || S.lensCanvas;
    S.workImageData = (S.workCanvas===S.origCanvas)
      ? S.origImageData
      : S.workCanvas.getContext('2d').getImageData(0,0,S.W,S.H);
    t.rect = performance.now() - t0;
    // 2a · borders — long rules on the rectified image, interpreted as a
    //      table grid / header box / row rules / section separators, and
    //      an erase mask so glyph detection never sees them
    t0=performance.now();
    S.borders=null;
    if(p.brEnable){
      oStep.textContent='2a · borders · rules'; await raf();
      const binaryBorder = await gpuSauvola(S.workImageData, { ...p, k: p.kBorder });
      const hOpenedPre = await gpuMorph(binaryBorder, S.W, S.H, [
        { op: 'bridge', axis: 'h', radius: p.bMaxGapH },
        { op: 'erode',  axis: 'h', radius: p.bOpenH  },
        { op: 'dilate', axis: 'h', radius: p.bOpenH  } ]);
      const vOpenedPre = await gpuMorph(binaryBorder, S.W, S.H, [
        { op: 'bridge', axis: 'v', radius: p.bMaxGapV },
        { op: 'erode',  axis: 'v', radius: p.bOpenV  },
        { op: 'dilate', axis: 'v', radius: p.bOpenV  } ]);
      const borders = detectBorders(binaryBorder, S.W, S.H, {
        maxGapH:p.bMaxGapH, maxGapV:p.bMaxGapV, openKernelH:p.bOpenH, openKernelV:p.bOpenV,
        maxThickness:p.bMaxThickness, minCoverage:p.bMinCoverage, smoothingRadius:p.bSmoothing,
        minLenFrac:p.bMinLenFrac, hOpenedPrecomputed:hOpenedPre, vOpenedPrecomputed:vOpenedPre,
        detectDashed:p.bDetectDashed, maxDotSize:p.bDotMaxSize, minDots:p.bDotMinDots,
        minStrideToSizeRatio:p.bDotStrideRatio, minLenFracDashed:p.bDashMinLenFrac });
      S.borders = Object.assign({ binaryRaw:binaryBorder, borders }, analyseBorders(borders, S.W, S.H, p, binaryBorder));
    }
    // rules-erased raster: every detected rule (table border, section
    // line, pen line, dashed rule) is painted out with the surrounding
    // paper. Every later processing stage reads THIS raster; the
    // original stays for display and for pass B's own border detection.
    if(S.borders && p.brErase){
      const r=inpaintRules(S.workImageData, S.borders.erase, S.W, S.H);
      S.cleanCanvas=r.canvas; S.cleanImageData=r.imageData;
      S.borders.cleanCanvas=r.canvas;
    } else { S.cleanCanvas=S.workCanvas; S.cleanImageData=S.workImageData; if(S.borders) S.borders.cleanCanvas=null; }
    t.borders=performance.now()-t0;

    // 2b · text-line clean — detect whole text lines on the rectified
    //      image and drop every non-text component. Pass A then runs on
    //      the resulting clean binary rather than on its own threshold.
    t0=performance.now();
    S.textLines=null;
    if(p.tlEnable){
      oStep.textContent='2b · text lines · clean'; await raf();
      S.textLines = await detectTextLines(S.cleanImageData, p,
        { erase: (p.brErase && S.borders) ? S.borders.erase : null });
    }
    t.textLines=performance.now()-t0;

    // 2c · columns — table band, gutters, columns and cells from the
    //      clean full lines, in the de-skewed frame
    t0=performance.now();
    S.columns=null;
    if(p.clEnable && S.textLines){
      oStep.textContent='2c · columns'; await raf();
      S.columns=detectColumns(S.textLines,p,(p.brUseCols && S.borders) ? S.borders.layout : null);
    }
    t.columns=performance.now()-t0;

    // 3 · pass A — detection on the corrected, un-rotated image
    t0=performance.now();
    oStep.textContent='3 · pass A — before rotate'; await raf();
    const passAopts = p.heightFilter ? { heightFilter:{lo:p.hMinF, split:p.hSplitF,
                                                        maxAspect:p.rmNon ? p.maxAspect : 0} } : {};
    if(S.textLines) passAopts.binary = S.textLines.binary;
    S.passes.A = await runPass(S.cleanImageData, p.dilA, p, passAopts);
    t.passA=performance.now()-t0;

    // 3b · line blobs — fuse the clean pass-A word blobs into whole text
    //      lines (section 05b). Uses the GPU dilation buffers, which pass B
    //      re-initialises with its own explicit upload later on.
    t0=performance.now();
    S.passes.A.lines=null;
    if(p.lineBlobs){
      oStep.textContent='3b · pass A — line blobs'; await raf();
      S.passes.A.lines = await buildLineBlobs(S.passes.A, {lineDilH:p.lineDilH, lineDilV:p.lineDilV, conn8:p.conn8});
    }
    // 3c · full lines — join the line blobs left → right per text row
    //      (section 05c), never taller than one line.
    S.passes.A.rows = (p.fullLines && S.passes.A.lines)
      ? buildFullLines(S.passes.A.lines, S.passes.A.heightFilter ? S.passes.A.heightFilter.hMax : 0, p.fullOverlap)
      : null;
    t.lines=performance.now()-t0;

    // 4 · skew — measured directly from pass A's accepted word OBBs,
    //     which already sit at the page's true rotation
    t0=performance.now();
    oStep.textContent='4 · skew detection'; await raf();
    // Preferred source: the page tilt the text-line stage measured from
    // whole lines (weighted median over every wide line). Falls back to
    // the pass-A word-box estimate, then to the projection profile.
    const tlTilt = (S.textLines && S.textLines.rows && S.textLines.rows.slopeN>=3)
      ? Math.atan(S.textLines.rows.slope)*180/Math.PI : null;
    S.angle = !p.deskew ? 0
            : (tlTilt!==null && Math.abs(tlTilt)<=p.skewMax) ? -tlTilt
            : estimateSkew(S.passes.A, S.cleanCanvas, p.skewMax);
    if(!Number.isFinite(S.angle)) S.angle=0;
    buildDeskew(S.angle, S.cleanCanvas);                       // → S.deskewCanvas (rules erased)
    if(S.cleanCanvas!==S.workCanvas){                          // original, same angle, for pass B borders
      if(!S.deskewOrigCanvas) S.deskewOrigCanvas=document.createElement('canvas');
      buildDeskew(S.angle, S.workCanvas, S.deskewOrigCanvas);
    } else S.deskewOrigCanvas=null;
    t.skew=performance.now()-t0;
    $('skewOut').innerHTML = p.deskew
      ? `<span class="k">found</span> <span class="v">${fmtDeg(S.angle)}</span> &middot; `+
        `<span class="k">rotated back</span> <span class="v">${fmtDeg(-S.angle)}</span>`
      : `<span class="k">deskew</span> <span class="v">off</span>`;
    $('sAngle').textContent = p.deskew ? fmtDeg(S.angle) : '—';

    // 5 · curl dewarp — straighten smoothly curved text-line baselines,
    //     the non-planar page curl a homography cannot remove. Pass A's
    //     word boxes are rotated onto the deskewed frame to find the
    //     text rows; conservative — a flat page passes straight through.
    t0=performance.now();
    oStep.textContent='5 · curl dewarp'; await raf();
    {
      const a=S.angle*Math.PI/180, ca=Math.cos(a), sa=Math.sin(a);
      const mx=S.W/2, my=S.H/2, words=[];
      for(const bl of S.passes.A.blobs) for(const pt of bl.parts){
        if(!pt.accepted) continue;
        const c=pt.corners;
        let x0=c[0].x,x1=c[0].x,y0=c[0].y,y1=c[0].y;
        for(let i=1;i<4;i++){ const q=c[i];
          if(q.x<x0)x0=q.x; if(q.x>x1)x1=q.x; if(q.y<y0)y0=q.y; if(q.y>y1)y1=q.y; }
        const dx=(x0+x1)/2-mx, dy=(y0+y1)/2-my;
        words.push({cx:mx+dx*ca-dy*sa, cy:my+dx*sa+dy*ca, h:y1-y0});
      }
      let dw=null;
      try{ dw=dewarpCurl(S.deskewCanvas, words, S.deskewOrigCanvas?[S.deskewOrigCanvas]:[]); }catch(e){ dw=null; }
      S.dewarpCanvas = dw || S.deskewCanvas;
      S.dewarpImageData = dw
        ? dw.getContext('2d').getImageData(0,0,S.W,S.H)
        : S.deskewImageData;
      // the original, warped with the same field, keeps its rules for
      // pass B's border detection
      S.dewarpOrigCanvas = S.deskewOrigCanvas ? ((dw && dw.also && dw.also[0]) || S.deskewOrigCanvas) : null;
      S.dewarpOrigImageData = S.dewarpOrigCanvas ? S.dewarpOrigCanvas.getContext('2d').getImageData(0,0,S.W,S.H) : null;
    }
    t.dewarp=performance.now()-t0;

    /* ------------------------------------------------------------------
       Step 6 — Pass B: ROW detection
       ------------------------------------------------------------------
       Asymmetric dilation: H large, V small.
         - rowDilH (~120 px) fuses every word in a text-line into one
           CCA component.
         - rowDilV (~2 px) is just enough to heal the small vertical gap
           between a descender and its body, or between an i-dot and
           its stem.  Kept much smaller than the line gap so that two
           stacked text-lines stay separate components.
       Each accepted blob in S.passes.B therefore corresponds to one
       row.

       rmNon (the non-character / aspect filter) is intentionally
       BYPASSED here.  That filter is tuned for word-shaped blobs and
       rejects exactly what we want — text-lines have aspect ratios of
       20–50 which would all fail maxAspect.  Pass-level shape
       filtering (row-shape, column-shape) is instead performed inside
       rowsFromPassB / columnsFromPassC, where it can use pass-
       appropriate criteria.

       Post-processing on the raw blobs:
         - splitMergedBoxes catches the occasional 2-line bridge (two
           lines fused vertically through stray ink) and cuts at the gap.
         - filterByHeightDensity rejects blobs whose height lies outside
           the modal text-line height band, and attempts a valley split
           on too-tall residues.
       ------------------------------------------------------------------ */
    t0 = performance.now();
    oStep.textContent = '6 · pass B — after rotate (rows)';
    await raf();

    /* Compute the Sauvola binary ONCE for the dewarped image, shared by
       Pass B and Pass C (and reused for the border binary when
       kBorder === k below).  Each pass uploads this binary explicitly
       to b.outB at the start of its erode + dilation, so Pass B's
       dilated output cannot leak into Pass C's input. */
    const passBCbinary = await gpuSauvola(S.dewarpImageData, p);

    S.passes.B = await runPass(S.dewarpImageData, p.dilB, {...p, rmNon: false},
                               { binary: passBCbinary });
    if(p.splitMerged)   splitMergedBoxes(S.passes.B, p);
    if(p.densityFilter) filterByHeightDensity(S.passes.B, p);
    t.passB = performance.now() - t0;

    /* ------------------------------------------------------------------
       Step 6c — Pass C: COLUMN detection
       ------------------------------------------------------------------
       Asymmetric dilation: V large, H small.
         - colDilV (~12 px) fuses every text-line stacked inside the
           same column into one CCA component.
         - colDilH (~2 px) is just enough to glue together a row's
           word fragments so a single text-line is captured as one
           horizontal piece of the stripe, but kept much smaller than
           the column gutter so side-by-side columns stay separate.
       Each accepted blob in S.passes.C therefore corresponds to one
       column-stripe.

       rmNon is bypassed for the same reason as Pass B — column-stripes
       have aspect ratios that the character-filter would reject.
       Column-shape filtering happens in columnsFromPassC.

       Pass C runs on the same dewarped image as Pass B, so its Sauvola
       binary is identical to Pass B's — the only difference is the
       dilation kernel and the resulting CCA groupings.
       ------------------------------------------------------------------ */
    t0 = performance.now();
    oStep.textContent = '6c · pass C — after rotate (columns)';
    await raf();
    S.passes.C = await runPass(S.dewarpImageData, p.dilC, {...p, rmNon: false},
                               { binary: passBCbinary });
    t.passC = performance.now() - t0;

    /* ------------------------------------------------------------------
       Border detection — runs on a SEPARATE Sauvola binary built with
       its own threshold weight (kBorder, typically lower than k so thin
       / faint rules survive).  We do NOT touch S.passes.B.binary; word
       detection keeps using its own tuning.

       When kBorder === k the two Sauvola passes would produce identical
       binaries, so we skip the second GPU call and reuse the existing
       binary as a shortcut.
       ------------------------------------------------------------------ */
    if(S.dewarpOrigImageData){
      // rules were erased from the working raster: read them from the
      // original, levelled and dewarped with the same transforms
      S.passes.B.binaryBorder = await gpuSauvola(S.dewarpOrigImageData, { ...p, k: p.kBorder });
    } else if(p.kBorder === p.k){
      S.passes.B.binaryBorder = S.passes.B.binary;
    } else {
      S.passes.B.binaryBorder = await gpuSauvola(S.dewarpImageData, { ...p, k: p.kBorder });
    }

    /* GPU pre-computation of the border opening pipeline.  This is
       the costliest CPU step inside detectBorders (six O(N) sliding-
       window morphology passes on the multi-megapixel border binary):
         - bridge_H → erode_H → dilate_H  produces hOpened
         - bridge_V → erode_V → dilate_V  produces vOpened
       gpuMorph runs all three ops of each chain on the GPU as a
       single command stream (one upload + many dispatches + one
       download), so the binary never leaves GPU memory between ops.
       At 3000×4000 this saves roughly an order of magnitude over the
       CPU sliding-window implementation in borders.js.

       If GPU is unavailable for any reason we just don't precompute —
       detectBorders falls back to its CPU loops automatically. */
    const hOpenedPrecomputed = await gpuMorph(S.passes.B.binaryBorder, S.W, S.H, [
      { op: 'bridge', axis: 'h', radius: p.bMaxGapH },
      { op: 'erode',  axis: 'h', radius: p.bOpenH  },
      { op: 'dilate', axis: 'h', radius: p.bOpenH  }
    ]);
    const vOpenedPrecomputed = await gpuMorph(S.passes.B.binaryBorder, S.W, S.H, [
      { op: 'bridge', axis: 'v', radius: p.bMaxGapV },
      { op: 'erode',  axis: 'v', radius: p.bOpenV  },
      { op: 'dilate', axis: 'v', radius: p.bOpenV  }
    ]);

    S.passes.B.borders = detectBorders(S.passes.B.binaryBorder, S.W, S.H, {
      // Solid-rule pipeline
      maxGapH         : p.bMaxGapH,
      maxGapV         : p.bMaxGapV,
      openKernelH     : p.bOpenH,
      openKernelV     : p.bOpenV,
      maxThickness    : p.bMaxThickness,
      minCoverage     : p.bMinCoverage,
      smoothingRadius : p.bSmoothing,
      minLenFrac      : p.bMinLenFrac,
      // Pre-computed GPU outputs — detectBorders uses these directly
      // and skips its own CPU sliding-window morphology.
      hOpenedPrecomputed,
      vOpenedPrecomputed,
      // Dashed-rule detector
      detectDashed       : p.bDetectDashed,
      maxDotSize         : p.bDotMaxSize,
      minDots            : p.bDotMinDots,
      minStrideToSizeRatio: p.bDotStrideRatio,
      minLenFracDashed   : p.bDashMinLenFrac,
      // Text masks for the structural discriminator: a dashed-rule
      // candidate whose dots lie inside the row-dilation (h-chains)
      // or column-dilation (v-chains) is rejected as text-aligned
      // punctuation rather than a real border.  Pass B is row-dilated;
      // Pass C is column-dilated.
      textMaskH          : S.passes.B.dilated,
      textMaskV          : S.passes.C && S.passes.C.dilated
    });

    /* ------------------------------------------------------------------
       Two table layouts in parallel:
         - analyzeTable          : pass-based detection (Pass B rows ×
                                   Pass C columns + ink occupancy).
         - analyzeTableFromBorders : rules-only — vertical borders give
                                     columns, horizontal borders bound
                                     the band.
       Both write to separate fields on S.passes.B (.layout vs
       .layoutBorders) so the gallery can show them side-by-side.
       ------------------------------------------------------------------ */
    if(p.detectTable){
      analyzeTable(S.passes.B, p, S.passes.C);
      analyzeTableFromBorders(S.passes.B, p);
    }

    oStep.textContent='7 · rendering stage outputs'; await raf();
    // readout reflects the after-rotate pass (the corrected result)
    const B=S.passes.B;
    let keepB=0, boxesB=0;
    for(const b of B.blobs) for(const pt of b.parts){ boxesB++; if(pt.accepted) keepB++; }
    const splitN=B.blobs.filter(b=>b.parts.length>1).length;
    $('sComp').textContent=B.ncomp.toLocaleString();
    $('sBlob').textContent=B.blobs.length.toLocaleString();
    $('sKeep').textContent=keepB.toLocaleString();
    $('sRej').textContent=(boxesB-keepB).toLocaleString();
    $('timing').innerHTML=
      `<span class="k">lens</span> <span class="v">${t.lens.toFixed(0)}ms</span> · `+
      `<span class="k">rectify</span> <span class="v">${t.rect.toFixed(0)}ms</span> · `+
      `<span class="k">skew</span> <span class="v">${t.skew.toFixed(0)}ms</span> · `+
      `<span class="k">dewarp</span> <span class="v">${t.dewarp.toFixed(0)}ms</span> · `+
      `<span class="k">borders</span> <span class="v">${t.borders.toFixed(0)}ms</span> · `+
      `<span class="k">text lines</span> <span class="v">${t.textLines.toFixed(0)}ms</span> · `+
      `<span class="k">columns</span> <span class="v">${t.columns.toFixed(0)}ms</span> · `+
      `<span class="k">pass A</span> <span class="v">${t.passA.toFixed(0)}ms</span> · `+
      `<span class="k">lines</span> <span class="v">${t.lines.toFixed(0)}ms</span> · `+
      `<span class="k">pass B</span> <span class="v">${t.passB.toFixed(0)}ms</span> · `+
      `<span class="k">pass C</span> <span class="v">${t.passC.toFixed(0)}ms</span>`+
      (splitN?` · <span class="k">split</span> <span class="v">${splitN}</span>`:'');

    await buildGallery();
    savePng.disabled=false; saveJson.disabled=false;
    showStage(S.stage); fitView();
  }catch(e){
    console.error(e);
    showError('Pipeline error: '+e.message);
  }finally{
    overlay.classList.remove('show'); runBtn.disabled=false;
  }
}
