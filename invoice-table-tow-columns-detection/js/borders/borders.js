/* ======================================================================
   TABLE BORDER DETECTION  ·  Phase 1 — detection + clustering only
   Why: invoices vary in how much explicit table structure they print.
   When rules are drawn (full grid, columns-only, rows-only, header-only)
   they are the strongest possible signal — unambiguous geometry that
   should trump every heuristic detector. Phase 1 finds them; Phase 2
   will use them to drive rotation, column/row boundaries and to
   subtract line pixels before word detection so touching text stays
   detectable.

   Algorithm:
     - on the binarised image, per scanline (each row for horizontals,
       each column for verticals), find ALL bridged runs of ink that are
       ≥ minLenFrac · dim long and at least minDensity ink-coverage
       within their bridged span.  Bridging absorbs short gaps caused by
       text descenders crossing the rule or pixels dropped by Sauvola;
       the density check rejects sparse dots that would otherwise bridge
       into a fake line.  Emitting all runs (not just the longest) means
       a rule broken by a wide column header still yields BOTH halves
       rather than one half plus silence.
     - cluster scanline candidates in 2-D: a new candidate joins an
       existing cluster only if it is within rowJoin in the scan axis,
       has an overlapping x-range (for horizontals) / y-range (for
       verticals), AND its length is at least spanRatio of the cluster's
       widest scanline.  The span gate is what stops a rule's full-width
       scanline from absorbing the narrower scanlines of touching text
       above and below it into one chunky cluster (which would then
       trip maxThickness and erase the rule's own detection).
     - reject clusters whose orthogonal "thickness" (scanline count)
       exceeds maxThickness.  Real rules are 1-3 px thick; a column or
       row of text characters is 6-15 px thick across the orthogonal
       direction and registers as a chunky cluster.
   ====================================================================== */

/* All bridged ink runs on row y that pass minLen + minDensity.
   Returns an array of {x0, x1}.  Bridges absorb gaps ≤ maxGap. */
function rowBridgedRuns(binary, W, y, maxGap, minDensity, minLen){
  const out=[];
  let runStart=-1, runEnd=-1, gapStart=-1, inkCount=0;
  const base=y*W;
  const close=()=>{
    if(runStart<0) return;
    const span=runEnd-runStart+1;
    if(span>=minLen && inkCount/span>=minDensity){
      out.push({x0:runStart,x1:runEnd});
    }
  };
  for(let x=0;x<W;x++){
    if(binary[base+x]){
      if(runStart<0){ runStart=x; inkCount=0; }
      runEnd=x; inkCount++; gapStart=-1;
    } else if(runStart>=0){
      if(gapStart<0) gapStart=x;
      if(x-gapStart>=maxGap){
        close();
        runStart=-1; runEnd=-1; gapStart=-1; inkCount=0;
      }
    }
  }
  close();
  return out;
}

/* All bridged ink runs on column x — vertical analogue. */
function colBridgedRuns(binary, W, H, x, maxGap, minDensity, minLen){
  const out=[];
  let runStart=-1, runEnd=-1, gapStart=-1, inkCount=0;
  const close=()=>{
    if(runStart<0) return;
    const span=runEnd-runStart+1;
    if(span>=minLen && inkCount/span>=minDensity){
      out.push({y0:runStart,y1:runEnd});
    }
  };
  for(let y=0;y<H;y++){
    if(binary[y*W+x]){
      if(runStart<0){ runStart=y; inkCount=0; }
      runEnd=y; inkCount++; gapStart=-1;
    } else if(runStart>=0){
      if(gapStart<0) gapStart=y;
      if(y-gapStart>=maxGap){
        close();
        runStart=-1; runEnd=-1; gapStart=-1; inkCount=0;
      }
    }
  }
  close();
  return out;
}

/* 2-D cluster horizontal candidates with span-ratio gating.
   A candidate joins an existing cluster only if:
     - its y is within rowJoin of the cluster's latest scanline
     - its x-range overlaps (or touches) the cluster's x-range
     - its span is at least spanRatio of the cluster's widest scanline
   The span gate keeps a full-width rule scanline (e.g. 380 px) from
   merging with the narrower scanlines of touching text bodies above
   and below it (e.g. 100-150 px wide), which would otherwise inflate
   the cluster's thickness past maxThickness and erase the line. */
function clusterH(cands, rowJoin, spanRatio){
  cands.sort((a,b)=>a.y-b.y);
  const clusters=[];
  for(const c of cands){
    const cLen=c.x1-c.x0+1;
    let host=null;
    for(const cl of clusters){
      if(c.y-cl.lastY>rowJoin) continue;
      const overlap=Math.min(c.x1,cl.x1)-Math.max(c.x0,cl.x0);
      if(overlap<0) continue;
      const ratio=Math.min(cLen,cl.maxSpan)/Math.max(cLen,cl.maxSpan);
      if(ratio<spanRatio) continue;
      host=cl; break;
    }
    if(host){
      host.ys.push(c.y);
      host.lastY=c.y;
      if(c.x0<host.x0) host.x0=c.x0;
      if(c.x1>host.x1) host.x1=c.x1;
      if(cLen>host.maxSpan) host.maxSpan=cLen;
    } else {
      clusters.push({ys:[c.y], lastY:c.y, x0:c.x0, x1:c.x1, maxSpan:cLen});
    }
  }
  return clusters;
}

/* 2-D cluster vertical candidates — same idea with axes swapped. */
function clusterV(cands, colJoin, spanRatio){
  cands.sort((a,b)=>a.x-b.x);
  const clusters=[];
  for(const c of cands){
    const cLen=c.y1-c.y0+1;
    let host=null;
    for(const cl of clusters){
      if(c.x-cl.lastX>colJoin) continue;
      const overlap=Math.min(c.y1,cl.y1)-Math.max(c.y0,cl.y0);
      if(overlap<0) continue;
      const ratio=Math.min(cLen,cl.maxSpan)/Math.max(cLen,cl.maxSpan);
      if(ratio<spanRatio) continue;
      host=cl; break;
    }
    if(host){
      host.xs.push(c.x);
      host.lastX=c.x;
      if(c.y0<host.y0) host.y0=c.y0;
      if(c.y1>host.y1) host.y1=c.y1;
      if(cLen>host.maxSpan) host.maxSpan=cLen;
    } else {
      clusters.push({xs:[c.x], lastX:c.x, y0:c.y0, y1:c.y1, maxSpan:cLen});
    }
  }
  return clusters;
}

/* main entry: returns { hLines, vLines } in the binary's coordinate frame.
   opts (all tunable; defaults chosen for a typical 800-1200 px wide
   invoice — permissive enough to catch table-width rules, strict enough
   to keep tightly packed text columns out):
     minLenFrac   (0.18) — a rule must span ≥ this fraction of W/H.
     maxGap       (0.08·dim, floor 8) — bridge gaps up to this width
       inside one candidate run.  Big enough to swallow a column-header
       label sitting on a rule; well below a real column gutter so two
       distinct rules sharing a scanline remain separate.
     minDensity   (0.40) — ink coverage within a bridged span.  Real
       rules with text crossings are 80-95 % ink; sparse character text
       stripes are 50-70 %; pure noise is < 30 %.
     spanRatio    (0.50) — a scanline only merges into an existing
       cluster if its span is at least this fraction of the cluster's
       widest scanline.  Stops a full-width rule from merging with
       narrower touching-text scanlines and getting erased by the
       thickness filter.  Set low because real lines can have fragmented
       binarisation with somewhat-varying per-scanline spans; 0.50 is
       generous enough for fragmentation but tight enough for typical
       touching-text bodies (which are 20-40 % of line width).
     rowJoin      (3) — adjacent scanlines within this gap merge into
       one logical rule.
     maxThickness (6) — discards clusters whose orthogonal extent (scan-
       line count) exceeds this.  A genuine rule is 1-3 px thick; a
       column or row of text characters is 6-15 px thick across the
       orthogonal direction and registers as a chunky cluster.
     minPeakDensity (0.65) — at least one row (for horizontals) or
       column (for verticals) within the cluster's bbox must have ink
       coverage ≥ this fraction.  A real rule always has at least one
       scanline where ink covers most of the x-range — the line itself.
       A text-row cluster that survives thickness filtering has every
       row at ~50-65 % density (gappy at character boundaries) and no
       single scanline that's nearly-solid, so the peak fails.  Unlike
       a bbox-average check this is immune to anti-aliased adjacent
       scanlines bringing the average down — the line's own scanline
       always wins the max. */
export function detectBorders(binary, W, H, opts={}){
  const minLenFrac     = opts.minLenFrac     ?? 0.18;
  const minDensity     = opts.minDensity     ?? 0.40;
  const spanRatio      = opts.spanRatio      ?? 0.50;
  const rowJoin        = opts.rowJoin        ?? 3;
  const maxThickness   = opts.maxThickness   ?? 6;
  const minPeakDensity = opts.minPeakDensity ?? 0.65;
  const maxGapH        = opts.maxGap         ?? Math.max(8, Math.round(W*0.08));
  const maxGapV        = opts.maxGap         ?? Math.max(8, Math.round(H*0.08));
  const minLenH = Math.max(8, Math.floor(W * minLenFrac));
  const minLenV = Math.max(8, Math.floor(H * minLenFrac));

  // peak per-row density inside [x0..x1] over y in [y0..y1].
  // For a real horizontal rule this hits ~1.0 on the line's own scanline
  // regardless of how many sparse adjacent scanlines joined the cluster.
  const peakRow = (x0,x1,y0,y1) => {
    const w = x1-x0+1;
    let best=0;
    for(let y=y0;y<=y1;y++){
      let n=0;
      const r=y*W;
      for(let x=x0;x<=x1;x++) if(binary[r+x]) n++;
      const f=n/w;
      if(f>best) best=f;
    }
    return best;
  };
  // peak per-column density — same for verticals.
  const peakCol = (x0,x1,y0,y1) => {
    const h = y1-y0+1;
    let best=0;
    for(let x=x0;x<=x1;x++){
      let n=0;
      for(let y=y0;y<=y1;y++) if(binary[y*W+x]) n++;
      const f=n/h;
      if(f>best) best=f;
    }
    return best;
  };

  // -- horizontal: scan each row, collect every passing bridged run --
  const hCands=[];
  for(let y=0;y<H;y++){
    const runs=rowBridgedRuns(binary, W, y, maxGapH, minDensity, minLenH);
    for(const r of runs) hCands.push({y, x0:r.x0, x1:r.x1});
  }
  const hLines = clusterH(hCands, rowJoin, spanRatio)
    .filter(c => c.ys.length <= maxThickness)
    .map(c => {
      c.ys.sort((a,b)=>a-b);
      const y0=c.ys[0], y1=c.ys[c.ys.length-1];
      const peak = peakRow(c.x0,c.x1,y0,y1);
      return { y:c.ys[c.ys.length>>1], x0:c.x0, x1:c.x1, thickness:c.ys.length, peak };
    })
    .filter(line => line.peak >= minPeakDensity);

  // -- vertical: scan each column the same way --
  const vCands=[];
  for(let x=0;x<W;x++){
    const runs=colBridgedRuns(binary, W, H, x, maxGapV, minDensity, minLenV);
    for(const r of runs) vCands.push({x, y0:r.y0, y1:r.y1});
  }
  const vLines = clusterV(vCands, rowJoin, spanRatio)
    .filter(c => c.xs.length <= maxThickness)
    .map(c => {
      c.xs.sort((a,b)=>a-b);
      const x0=c.xs[0], x1=c.xs[c.xs.length-1];
      const peak = peakCol(x0,x1,c.y0,c.y1);
      return { x:c.xs[c.xs.length>>1], y0:c.y0, y1:c.y1, thickness:c.xs.length, peak };
    })
    .filter(line => line.peak >= minPeakDensity);

  return { hLines, vLines, minLenH, minLenV, maxGapH, maxGapV };
}
