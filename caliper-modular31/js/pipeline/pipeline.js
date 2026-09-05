/* ======================================================================
   PIPELINE DRIVER
   Why: something has to be the conductor. readParams snapshots every control
   into a plain object; runPass executes the full per-image chain (Sauvola ->
   dilate -> CCA -> contour -> hull -> calipers -> filter); runPipeline
   sequences the two passes, skew, splitting, table analysis and rendering.
   ====================================================================== */
import { $, overlay, runBtn, oStep, savePng, saveJson, showError } from '../dom/dom.js';
import { S } from '../state/state.js';
import { gpuSauvola, gpuDilate } from '../webgpu/webgpu.js';
import { cca } from '../cca/cca.js';
import { traceContour } from '../contour/contour.js';
import { convexHull } from '../hull/hull.js';
import { minAreaRect } from '../calipers/calipers.js';
import { obbToPart, splitMergedBoxes } from '../splitter/splitter.js';
import { filterByHeightDensity } from '../blobfilter/blobfilter.js';
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
    deskew:$('deskew').checked, skewMax:+$('skewMax').value,
    radius:(win-1)>>1, k:+$('k').value, R:+$('rr').value, invert:$('invert').checked,
    dilA:{h:+$('dilHa').value, v:+$('dilVa').value},                       // before rotate
    dilB:{h:+$('rowDilH').value, v:+$('rowDilV').value},                   // after rotate · Pass B (rows)
    dilC:{h:+$('colDilH').value, v:+$('colDilV').value},                   // after rotate · Pass C (columns)
    conn8:$('conn').querySelector('.on').dataset.c==='8',
    minArea:+$('minA').value,
    rmNon:$('rmNon').checked,
    maxAspect:+$('asp').value, minFill:+$('fill').value,
    maxLen:+$('len').value, maxArea:+$('amax').value,
    splitMerged:$('splitMerged').checked, splitRatio:+$('splitRatio').value,
    densityFilter:$('densityFilter').checked, densityThresh:+$('densityThresh').value,
    detectTable:$('detectTable').checked, tableSens:+$('tableSens').value,
    kBorder:+$('kBorder').value,
    rlsa:$('rlsa').checked, rowDilH:+$('rowDilH').value, colDilV:+$('colDilV').value,
    showRej:$('showRej').checked
  };
}
export const raf=()=>new Promise(r=>requestAnimationFrame(()=>r()));

/* signed degree formatter, e.g. +15.00° / −3.40° */
export const fmtDeg=a=>`${a>=0?'+':'−'}${Math.abs(a).toFixed(2)}°`;


export async function runPass(imgData, dil, p){
  const W=S.W,H=S.H;
  const binary  = await gpuSauvola(imgData,p);
  const dilated = await gpuDilate(dil.h,dil.v);
  const cc = cca(dilated,W,H,p.conn8);
  const blobs=[]; const lab2blob=new Int32Array(cc.count).fill(-1);
  for(let l=0;l<cc.count;l++){
    if(cc.area[l]>=p.minArea){
      lab2blob[l]=blobs.length;
      blobs.push({label:l,area:cc.area[l],
        bb:{x0:cc.bx0[l],y0:cc.by0[l],x1:cc.bx1[l],y1:cc.by1[l]},
        start:cc.start[l]});
    }
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
  return {binary,dilated,labels:cc.labels,ncomp:cc.count,lab2blob,blobs};
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
    oStep.textContent='1 · lens distortion'; await raf();
    let lens=null;
    try{ lens=correctLensDistortion(S.origCanvas); }catch(e){ lens=null; }
    S.lensCanvas = lens || S.origCanvas;
    t.lens=performance.now()-t0;

    // 2 · perspective rectification — warp the (now straight-edged) page
    //     quad back to a rectangle. Conservative: a flat/square-on
    //     capture passes straight through.
    t0=performance.now();
    oStep.textContent='2 · perspective rectification'; await raf();
    let rect=null;
    try{ rect=rectifyPerspective(S.lensCanvas); }catch(e){ rect=null; }
    S.workCanvas = rect || S.lensCanvas;
    S.workImageData = (S.workCanvas===S.origCanvas)
      ? S.origImageData
      : S.workCanvas.getContext('2d').getImageData(0,0,S.W,S.H);
    t.rect=performance.now()-t0;

    // 3 · pass A — detection on the corrected, un-rotated image
    t0=performance.now();
    oStep.textContent='3 · pass A — before rotate'; await raf();
    S.passes.A = await runPass(S.workImageData, p.dilA, p);
    t.passA=performance.now()-t0;

    // 4 · skew — measured directly from pass A's accepted word OBBs,
    //     which already sit at the page's true rotation
    t0=performance.now();
    oStep.textContent='4 · skew detection'; await raf();
    S.angle = p.deskew ? estimateSkew(S.passes.A, S.workCanvas, p.skewMax) : 0;
    buildDeskew(S.angle);
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
      try{ dw=dewarpCurl(S.deskewCanvas, words); }catch(e){ dw=null; }
      S.dewarpCanvas = dw || S.deskewCanvas;
      S.dewarpImageData = dw
        ? dw.getContext('2d').getImageData(0,0,S.W,S.H)
        : S.deskewImageData;
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
    S.passes.B = await runPass(S.dewarpImageData, p.dilB, {...p, rmNon: false});
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
    S.passes.C = await runPass(S.dewarpImageData, p.dilC, {...p, rmNon: false});
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
    if(p.kBorder === p.k){
      S.passes.B.binaryBorder = S.passes.B.binary;
    } else {
      S.passes.B.binaryBorder = await gpuSauvola(S.dewarpImageData, { ...p, k: p.kBorder });
    }
    S.passes.B.borders = detectBorders(S.passes.B.binaryBorder, S.W, S.H);

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
      `<span class="k">pass A</span> <span class="v">${t.passA.toFixed(0)}ms</span> · `+
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
