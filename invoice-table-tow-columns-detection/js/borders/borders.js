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
       existing cluster only if it is within rowJoin in the scan axis
       AND has an overlapping x-range (for horizontals) / y-range (for
       verticals).  Two distinct rules at the same y stay separate;
       a thick rule on adjacent scanlines merges.
     - reject clusters whose orthogonal "thickness" (scanline count)
       exceeds maxThickness.  Real rules are 1-3 px thick; a column or
       row of text characters is 6-15 px thick across the orthogonal
       direction and registers as a chunky cluster — this filter is
       what distinguishes a rule from a tightly-packed text stripe.
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

/* 2-D cluster horizontal candidates.  A candidate joins an existing
   cluster only if it is within rowJoin pixels in y AND has overlapping
   (or touching) x-range with the cluster.  Two distinct rules at the
   same y therefore stay in separate clusters. */
function clusterH(cands, rowJoin){
  cands.sort((a,b)=>a.y-b.y);
  const clusters=[];
  for(const c of cands){
    let host=null;
    for(const cl of clusters){
      if(c.y-cl.lastY>rowJoin) continue;
      const overlap=Math.min(c.x1,cl.x1)-Math.max(c.x0,cl.x0);
      if(overlap>=0){ host=cl; break; }              // touching or overlapping
    }
    if(host){
      host.ys.push(c.y);
      host.lastY=c.y;
      if(c.x0<host.x0) host.x0=c.x0;
      if(c.x1>host.x1) host.x1=c.x1;
    } else {
      clusters.push({ys:[c.y], lastY:c.y, x0:c.x0, x1:c.x1});
    }
  }
  return clusters;
}

/* 2-D cluster vertical candidates — same idea, axes swapped. */
function clusterV(cands, colJoin){
  cands.sort((a,b)=>a.x-b.x);
  const clusters=[];
  for(const c of cands){
    let host=null;
    for(const cl of clusters){
      if(c.x-cl.lastX>colJoin) continue;
      const overlap=Math.min(c.y1,cl.y1)-Math.max(c.y0,cl.y0);
      if(overlap>=0){ host=cl; break; }
    }
    if(host){
      host.xs.push(c.x);
      host.lastX=c.x;
      if(c.y0<host.y0) host.y0=c.y0;
      if(c.y1>host.y1) host.y1=c.y1;
    } else {
      clusters.push({xs:[c.x], lastX:c.x, y0:c.y0, y1:c.y1});
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
       stripes are 50-70 %; pure noise is < 30 %.  Tunable up if false
       positives become a problem in practice.
     rowJoin      (3) — adjacent scanlines within this gap merge into
       one logical rule.
     maxThickness (6) — discards clusters whose orthogonal extent (scan-
       line count) exceeds this.  A genuine rule is 1-3 px thick; a
       column or row of text characters is 6-15 px thick across the
       orthogonal direction and registers as a chunky cluster.  Bumped
       up if real thick rules (heading dividers, multi-pixel anti-
       aliased rules) get rejected. */
export function detectBorders(binary, W, H, opts={}){
  const minLenFrac   = opts.minLenFrac   ?? 0.18;
  const minDensity   = opts.minDensity   ?? 0.40;
  const rowJoin      = opts.rowJoin      ?? 3;
  const maxThickness = opts.maxThickness ?? 6;
  const maxGapH      = opts.maxGap       ?? Math.max(8, Math.round(W*0.08));
  const maxGapV      = opts.maxGap       ?? Math.max(8, Math.round(H*0.08));
  const minLenH = Math.max(8, Math.floor(W * minLenFrac));
  const minLenV = Math.max(8, Math.floor(H * minLenFrac));

  // -- horizontal: scan each row, collect every passing bridged run --
  const hCands=[];
  for(let y=0;y<H;y++){
    const runs=rowBridgedRuns(binary, W, y, maxGapH, minDensity, minLenH);
    for(const r of runs) hCands.push({y, x0:r.x0, x1:r.x1});
  }
  const hLines = clusterH(hCands, rowJoin)
    .filter(c => c.ys.length <= maxThickness)
    .map(c => {
      c.ys.sort((a,b)=>a-b);
      return { y: c.ys[c.ys.length>>1], x0: c.x0, x1: c.x1, thickness: c.ys.length };
    });

  // -- vertical: scan each column the same way --
  const vCands=[];
  for(let x=0;x<W;x++){
    const runs=colBridgedRuns(binary, W, H, x, maxGapV, minDensity, minLenV);
    for(const r of runs) vCands.push({x, y0:r.y0, y1:r.y1});
  }
  const vLines = clusterV(vCands, rowJoin)
    .filter(c => c.xs.length <= maxThickness)
    .map(c => {
      c.xs.sort((a,b)=>a-b);
      return { x: c.xs[c.xs.length>>1], y0: c.y0, y1: c.y1, thickness: c.xs.length };
    });

  return { hLines, vLines, minLenH, minLenV, maxGapH, maxGapV };
}
