/* ======================================================================
   COLUMN DETECTION  ·  table band, gutters, columns and cells
   Why: once the text-line stage has produced trustworthy rows (full
   lines) with a known page tilt, the column structure of the invoice can
   be read directly from where the glyphs are and are not. It does not
   depend on rules or borders, but uses them as priors when present.

   Everything is computed in the DE-SKEWED frame of the text-line stage:
       x' = x + slope·y        y' = y − slope·x
   so a tilted photo does not smear a gutter across neighbouring columns.

   Method
     1. Row bands. Every full line is a row; a row with at least minPieces
        pieces is tabular. Runs of tabular rows (tolerating rowGap non-
        tabular rows in between) are found and scored by column structure
        (gutters × rows). A table box from the border stage is folded in
        afterwards — its rows join the band when they touch it — but never
        replaces the text-based search. Rows glued to the band's ends that
        cross a third or more of its gutters (a paragraph, a summary block)
        are trimmed off; the band then grows through every adjacent
        tabular, column-compatible row (a seed that stopped early at a
        crease or a damaged row is completed), and every other run within
        mergeGap rows whose glyphs respect the gutters is merged in, the
        damaged rows in between included. One invoice, one item table.
        Rows above the band are HEADER, rows below FOOTER.
     2. Coverage profile. For every 1 px column x' inside the band, how
        many band rows have a GLYPH covering it. Glyph-level, not piece-
        level: two columns whose cells were chained into one piece still
        show a gap that lines up in every row, while ordinary word spaces
        fall at different x' in every row and never line up.
     3. Gutters = valleys of the profile: clear runs almost no row crosses,
        or deep valleys at most 42 % of the neighbouring peaks (a word-
        space-sized gap that lines up in every row). Found recursively so
        peaks are local and a sparse column is not swallowed. Column
        boundaries from the border stage are added where the coverage
        allows.
     4. Columns = intervals between gutters, trimmed to content, classified
        left / right / centre aligned from the spread of the cell edges.
     5. Cells: every glyph of every band row goes to the column under its
        centre; the union of a row's glyphs in a column is the cell. A
        piece that spanned two columns is thereby split correctly. Pieces
        the full-line join left out (a one-piece row of their own, or a
        piece outside every row) are first folded into the band row they
        sit on, so no text inside the table is left without a cell.
   ====================================================================== */

import { rebuildRow } from '../lines/lines.js';
import { median } from '../morph/morph.js';

const stdDev=a=>{ if(a.length<2) return 0; const m=a.reduce((s,x)=>s+x,0)/a.length;
  return Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/a.length); };

/* Coverage profile + gutters for a set of rows (steps 2–3).
   params: {minGutterWidth (× glyph height), maxGutterCoverage (× rows)}  */
function gutterProfile(bandRows,params,glyphHeight){
  let X0=1/0,X1=-1/0;
  for(const r of bandRows) for(const g of r.glyphs){ if(g.x0<X0)X0=g.x0; if(g.x1>X1)X1=g.x1; }
  if(X0===1/0) return {X0:0,X1:0,coverage:new Uint16Array(1),rowCount:bandRows.length,clearMax:0,minWidth:0,gutters:[]};
  X0=Math.floor(X0); X1=Math.ceil(X1);
  const bins=Math.max(1,X1-X0+1), coverage=new Uint16Array(bins), rowMask=new Uint8Array(bins);
  for(const r of bandRows){
    rowMask.fill(0);
    for(const g of r.glyphs){                      // g.x1 is exclusive: bins floor(x0) .. ceil(x1)-1
      const a=Math.max(0,Math.floor(g.x0)-X0), b=Math.min(bins-1,Math.ceil(g.x1)-1-X0);
      for(let x=a;x<=b;x++) rowMask[x]=1;
    }
    for(let x=0;x<bins;x++) coverage[x]+=rowMask[x];
  }
  const rowCount=bandRows.length, clearMax=params.maxGutterCoverage*rowCount;
  const minWidth=Math.max(2,params.minGutterWidth*glyphHeight);
  /* valleys: candidates on a lightly smoothed profile, run width on the
     raw one (smoothing blurs the edges of a narrow gap) */
  const smooth=new Float32Array(bins);
  for(let x=0;x<bins;x++){ smooth[x]=(coverage[Math.max(0,x-1)]+coverage[x]+coverage[Math.min(bins-1,x+1)])/3; }
  const minColumn=Math.max(3,Math.round(0.8*glyphHeight));
  const gutters=[];
  const search=(a,b)=>{
    if(b-a+1 < 2*minColumn+minWidth) return;
    const candidates=[];
    for(let x=a+minColumn;x<=b-minColumn;x++) if(smooth[x]<=smooth[x-1] && smooth[x]<=smooth[x+1]) candidates.push(x);
    candidates.sort((u,v)=>smooth[u]-smooth[v]);
    for(const at of candidates){
      const depth=smooth[at];
      let leftPeak=0,rightPeak=0;
      for(let x=a;x<at;x++) if(smooth[x]>leftPeak) leftPeak=smooth[x];
      for(let x=at+1;x<=b;x++) if(smooth[x]>rightPeak) rightPeak=smooth[x];
      const peak=Math.min(leftPeak,rightPeak);
      if(!(depth<=clearMax || (peak>0 && depth<=0.42*peak))) continue;
      const limit=Math.max(depth+0.05*rowCount, clearMax);   // the run that stays near the minimum
      let s=at,e=at; while(s-1>=a && coverage[s-1]<=limit) s--; while(e+1<=b && coverage[e+1]<=limit) e++;
      // too narrow to be a gutter: try the next valley of this stretch —
      // a needle at the bottom of a wider trough is rejected, the trough's
      // shoulder is the next candidate and is measured on its own; the
      // stretch is not split at the needle, which would hide that shoulder
      // inside the margin no candidate may lie in
      // a RELATIVE valley (deep but not clear) is weaker evidence and must
      // be half as wide again: word gaps inside a name column line up over
      // a few rows and are exactly one word space wide
      if(e-s+1 < (depth>clearMax ? 1.5*minWidth : minWidth)) continue;
      if(s>0 && e<bins-1) gutters.push({x0:X0+s, x1:X0+e, width:e-s+1, relative:depth>clearMax});
      search(a,s-1); search(e+1,b);
      return;
    }
  };
  search(0,bins-1);
  gutters.sort((u,v)=>u.x0-v.x0);
  return {X0,X1,coverage,rowCount,clearMax,minWidth,gutters};
}

/* Does a row respect the given gutters?  A gutter is CROSSED when the
   row's glyphs cover at least half of its width. A table row crosses at
   most one or two (a long name spilling into the next column); a
   paragraph or a summary line crosses a third or more.                  */
function rowRespectsGutters(row,gutters,maxCrossedFrac=0.34){
  if(!gutters.length || !row.glyphs.length) return true;
  let crossed=0;
  for(const gt of gutters){
    const w=gt.x1-gt.x0+1; let covered=0;
    for(const g of row.glyphs){ const o=Math.min(g.x1,gt.x1+1)-Math.max(g.x0,gt.x0); if(o>0) covered+=o; }
    if(covered>=0.5*w) crossed++;
  }
  return crossed<=maxCrossedFrac*gutters.length;
}
function runRespectsGutters(rows,gutters){
  if(!gutters.length) return true;
  let ok=0; for(const r of rows) if(rowRespectsGutters(r,gutters)) ok++;
  return ok>=0.7*rows.length;
}

/* textLines : the text-line stage result (S.textLines)
   params    : {minPieces, rowGap, mergeGap, minGutterWidth, maxGutterCoverage}
   prior     : optional border layout (section 02): {kind, table:{x0,y0,x1,y1}|null,
               colsX:[{x,y0,y1}]} in image space. A table box seeds the band;
               column boundaries are added as gutters where the coverage allows. */
/* Column direction. The rows' slope de-skews y; the COLUMNS' slope
   de-skews x, and on a rectified photo the two differ: a residual shear
   leaves the text rows tilted while the columns stand nearly upright.
   De-skewing x with the rows' slope shears every column and fills the
   narrow gaps (TP | VAT) so that columns merge and slivers appear. The
   column slope is the one under which the given rows show the most clear
   bins in their coverage profile, searched ±0.06 (±3.4°) around the rows'
   slope; bins outside the rows' common extent do not count, so spreading
   the rows apart cannot score.                                          */
function estimateColumnSlope(rowSet,slope,clearFrac){
  if(rowSet.length<3) return slope;
  const rowsG=rowSet.map(r=>r.glyphs.map(g=>({x0:Math.min(g.bb.x0+1,g.bb.x1), x1:Math.max(g.bb.x1,g.bb.x0+1), cy:(g.bb.y0+g.bb.y1)/2}))).filter(g=>g.length);
  const clearMax=clearFrac*rowsG.length;
  const score=s=>{
    const ext=rowsG.map(gl=>gl.map(g=>[g.x0+s*g.cy, g.x1+s*g.cy]));
    const lo=median(ext.map(gl=>Math.min(...gl.map(a=>a[0])))), hi=median(ext.map(gl=>Math.max(...gl.map(a=>a[1]))));
    const X0=Math.floor(lo), bins=Math.ceil(hi)-X0+1; if(bins<=0) return 0;
    const cov=new Uint16Array(bins), mask=new Uint8Array(bins);
    for(const gl of ext){ mask.fill(0);
      for(const [a,b] of gl){ const p=Math.max(0,Math.floor(a)-X0), q=Math.min(bins-1,Math.ceil(b)-1-X0); for(let x=p;x<=q;x++) mask[x]=1; }
      for(let x=0;x<bins;x++) cov[x]+=mask[x]; }
    let clear=0; for(let x=0;x<bins;x++) if(cov[x]<=clearMax) clear++;
    return clear;
  };
  let best=slope, bestScore=-1;
  for(let k=-60;k<=60;k++){ const s=slope+k*0.001; const sc=score(s);
    if(sc>bestScore || (sc===bestScore && Math.abs(s-slope)<Math.abs(best-slope))){ bestScore=sc; best=s; } }
  return best;
}

export function detectColumns(textLines,params,prior=null,limits=null){
  const full=textLines.fullLines||{}, slope=full.slope||0, fullRows=full.rows||[];
  const glyphHeight=textLines.stats.reference||10;
  let colSlope=slope;                                   // refined against the table's own gutters below
  const toDeskewedX=(x,y)=>x+colSlope*y;
  const toDeskewedY=(x,y)=>y-slope*x;
  const toImage=(xp,yp)=>{ const x=xp-colSlope*yp; return {x, y:yp+slope*x}; };
  const out={slope, columnSlope:slope, glyphHeight, toDeskewedX, toImage, rows:[], band:null, profile:null,
             gutters:[], columns:[], cells:[], reason:'', priorKind:prior?prior.kind:'none', runs:[]};

  /* --- 1 · rows -------------------------------------------------------- */
  const rows=fullRows.map((row,index)=>{
    const glyphs=[];
    for(const piece of row.lines) for(const m of piece.words){
      const cy=(m.bb.y0+m.bb.y1)/2;
      // glyph boxes come from the healed (1 px dilated) mask; take that
      // pixel back on each side so a word-space-sized gap keeps its width
      const x0=Math.min(m.bb.x0+1,m.bb.x1), x1=Math.max(m.bb.x1,m.bb.x0+1);
      glyphs.push({bb:m.bb, x0:toDeskewedX(x0,cy), x1:toDeskewedX(x1,cy)});
    }
    return {index,row,pieces:row.lines.length,glyphs,kind:'other'};
  });
  out.rows=rows;
  if(!rows.length){ out.reason='no rows'; return out; }

  const isTabular=rows.map(r=>r.pieces>=params.minPieces);
  const runs=[];
  for(let i=0;i<rows.length;i++){
    if(!isTabular[i]) continue;
    let j=i,last=i,count=0;
    while(j<rows.length){
      if(isTabular[j]){ last=j; count++; j++; continue; }
      let k=j; while(k<rows.length && !isTabular[k]) k++;
      if(k<rows.length && k-j<=params.rowGap) j=k; else break;
    }
    runs.push({first:i,last,count});
    i=last;
  }
  out.runs=runs;
  if(!runs.length){ out.reason='no row has '+params.minPieces+'+ pieces'; return out; }

  /* Structure discovery uses a RELAXED coverage threshold (up to 35 % of
     rows may cross a gutter) so a few foreign rows cannot wipe the gutters
     out before anything can be judged. Seeds are scored with the STRICT
     profile on purpose: a run that has swallowed a paragraph keeps, under
     the relaxed profile, exactly the gutters the paragraph does not cross
     and would pass every later test; under the strict profile those rows
     wipe its gutters out and a clean run wins.                            */
  const relaxedParams={...params, maxGutterCoverage:Math.max(params.maxGutterCoverage,0.35)};
  const relaxedGutters=rs=>gutterProfile(rs,relaxedParams,glyphHeight).gutters;
  for(const r of runs){ r.gutters=gutterProfile(rows.slice(r.first,r.last+1),params,glyphHeight).gutters.length; r.score=(r.gutters+1)*r.count; }
  let seed=runs[0]; for(const r of runs) if(r.score>seed.score) seed=r;
  let first=seed.first, last=seed.last, parts=1, fromBorders=false;
  // de-skew x along the COLUMNS, estimated on the seed rows; every glyph
  // extent is recomputed under the refined slope
  const reglyph=()=>{ for(const r of rows) for(const g of r.glyphs){ const cy=(g.bb.y0+g.bb.y1)/2;
    g.x0=toDeskewedX(Math.min(g.bb.x0+1,g.bb.x1),cy); g.x1=toDeskewedX(Math.max(g.bb.x1,g.bb.x0+1),cy); } };
  const setColumnSlope=cs=>{ if(cs===colSlope) return; colSlope=cs; out.columnSlope=cs; reglyph(); };
  setColumnSlope(estimateColumnSlope(rows.slice(seed.first,seed.last+1).filter(r=>isTabular[r.index]),slope,params.maxGutterCoverage));
  for(const r of runs){ r.gutters=gutterProfile(rows.slice(r.first,r.last+1),params,glyphHeight).gutters.length; r.score=(r.gutters+1)*r.count; }
  // rows whose de-skewed centre lies inside the border stage's table box —
  // a HINT that is folded into the band after the text-based search, never
  // a replacement for it: a boxed header mistaken for the table, or a box
  // that ends at a crease, must not hide the body rows
  let boxRows=null;
  if(prior && prior.table){
    const bx=(prior.table.x0+prior.table.x1)/2;
    const by0=toDeskewedY(bx,prior.table.y0), by1=toDeskewedY(bx,prior.table.y1);
    const inside=[];
    rows.forEach((r,i)=>{ const cy=(r.row.dy.y0+r.row.dy.y1)/2; if(cy>=by0 && cy<=by1) inside.push(i); });
    if(inside.length>=1) boxRows={first:inside[0], last:inside[inside.length-1]};
  }
  let gutters=relaxedGutters(rows.slice(first,last+1));
  const trim=(a,b)=>{ if(!gutters.length) return [a,b];
    while(a<b && !rowRespectsGutters(rows[a],gutters)) a++;
    while(b>a && !rowRespectsGutters(rows[b],gutters)) b--;
    return [a,b]; };
  for(let it=0;it<2;it++){ [first,last]=trim(first,last); gutters=relaxedGutters(rows.slice(first,last+1)); }
  const extend=()=>{
    for(const dir of [1,-1]){
      let k=dir>0?last+1:first-1, gap=0;
      while(k>=0 && k<rows.length){
        const respects=rowRespectsGutters(rows[k],gutters);
        if(isTabular[k] && respects){ if(dir>0) last=k; else first=k; gap=0; }
        else if(respects && gap<params.rowGap){ gap++; }
        else break;
        k+=dir;
      }
    }
    gutters=relaxedGutters(rows.slice(first,last+1));
  };
  extend();
  const used=new Set([seed]);
  for(const r of runs) if(r.last>=first && r.first<=last) used.add(r);
  let merged=true;
  while(merged){
    merged=false;
    let above=null, below=null;
    for(const r of runs){ if(used.has(r)) continue;
      if(r.last<first && (!above || r.last>above.last)) above=r;
      if(r.first>last && (!below || r.first<below.first)) below=r; }
    for(const candidate of [above,below]){
      if(!candidate) continue;
      used.add(candidate);
      const gap = candidate.last<first ? first-candidate.last-1 : candidate.first-last-1;
      if(gap>params.mergeGap){ candidate.rejected='too far'; continue; }
      const [a,b]=trim(candidate.first,candidate.last);
      if(!runRespectsGutters(rows.slice(a,b+1),gutters)){ candidate.rejected='columns differ'; continue; }
      first=Math.min(first,a); last=Math.max(last,b); parts++; candidate.mergedIn=true;
      extend();
      for(const r of runs) if(r.last>=first && r.first<=last) used.add(r);
      merged=true;
    }
  }
  // fold the border box in: its rows join the band when they touch it or
  // lie within the merge gap of it (then the rows between join as well)
  if(boxRows){
    const gap = boxRows.last<first ? first-boxRows.last-1 : boxRows.first>last ? boxRows.first-last-1 : 0;
    if(gap<=params.mergeGap){
      const f=Math.min(first,boxRows.first), l=Math.max(last,boxRows.last);
      if(f!==first || l!==last){ first=f; last=l; fromBorders=true; extend(); }
    }
  }
  /* --- keep the largest gutter-respecting block --------------------------
     Trimming only peels rows off the band's ends, so a key-value block
     glued to the table (Client Name / Bill No. … whose long values run
     across the item columns) survives whenever its row nearest the table
     happens to respect the gutters while the rows inside it do not. Inside
     the band a TABULAR row that does not respect the gutters is foreign;
     the table is the block between such rows holding the most tabular
     rows. Non-tabular rows (a wrapped name, a section title, a row a fold
     merged into one piece) never break a block, so a damaged table stays
     whole.                                                               */
  let foreignRows=0;
  for(let it=0;it<2;it++){
    gutters=relaxedGutters(rows.slice(first,last+1));
    if(!gutters.length) break;
    // a row that fails the gutter test is foreign only when it is also
    // piece-poor: an item row whose name ran into the next column still
    // has nearly as many pieces as its neighbours, a Client Name /
    // Bill No. row has a third of them
    const respecting=[]; for(let k=first;k<=last;k++) if(isTabular[k] && rowRespectsGutters(rows[k],gutters)) respecting.push(rows[k].pieces);
    const itemPieces=respecting.length?median(respecting):0;
    const foreign=k=>isTabular[k] && !rowRespectsGutters(rows[k],gutters) && rows[k].pieces<0.6*itemPieces;
    const blocks=[]; let cur=null;
    for(let k=first;k<=last;k++){
      if(foreign(k)){ cur=null; continue; }
      if(!cur){ cur={first:k,last:k,count:0}; blocks.push(cur); }
      cur.last=k; if(isTabular[k]) cur.count++;
    }
    let best=null; for(const b of blocks) if(b.count && (!best || b.count>best.count)) best=b;
    if(!best) break;
    while(best.first<best.last && !isTabular[best.first]) best.first++;
    while(best.last>best.first && !isTabular[best.last]) best.last--;
    if(best.first===first && best.last===last) break;
    foreignRows+=(best.first-first)+(last-best.last);
    first=best.first; last=best.last;
  }

  /* --- footer split ------------------------------------------------------
     An invoice is header, item table, footer. Totals rows ("Sub Total",
     "Grand Total"), the amount in words and a free-product block sit
     under the item columns and have enough pieces to look tabular, so
     the band would run through them. Two cuts:
       · structural: item rows carry content in the table's FIRST column
         (code / serial). Once three item rows are established, the first
         tabular row whose first column is empty — with fewer first-column
         rows after it than before it — is a totals row and the table ends
         before it (a wrapped product-name line is not tabular and cannot
         trigger this; the top line of a two-line column title is followed
         by the whole table and cannot either).
       · keywords: after recognition the pipeline passes the rows whose
         text reads Sub Total / Grand Total / Amount in words / Free
         Product (limits.footerRows); such a row ends the table too.
     Either way a totals row that is immediately followed by a run of
     item rows is a SUB-total inside the table and does not end it.      */
  let footerCut='';
  const keywordRows=new Set((limits&&limits.footerRows)||[]);   // rows the recognised text names as totals

  /* --- rescue (a): thin rows folded into the proper row they sit on ------
     A piece that failed to join its row (a curl, a tiny offset, a broken
     number) becomes a one-piece row of its own: not tabular, so its glyphs
     never reach a cell although the text plainly sits in the table. A band
     row with fewer than minPieces pieces whose centre lies on a proper band
     row (within 0.6 glyph height) is merged into it. This runs BEFORE the
     footer test so an item row whose code drifted into a thin row of its
     own is not mistaken for a totals row.                                */
  const glyphOf=m=>{ const cy=(m.bb.y0+m.bb.y1)/2;
    const x0=Math.min(m.bb.x0+1,m.bb.x1), x1=Math.max(m.bb.x1,m.bb.x0+1);
    return {bb:m.bb, x0:toDeskewedX(x0,cy), x1:toDeskewedX(x1,cy)}; };
  let mergedRows=0, rescuedPieces=0;
  {
    const candidates=rows.slice(first,last+1), proper=candidates.filter(r=>isTabular[r.index]);
    for(const r of candidates){
      if(isTabular[r.index]) continue;
      // nearest proper row by the thin row's de-skewed centre (an offset of
      // half a glyph is a curl or a broken number, not another row)
      const cy=(r.row.dy.y0+r.row.dy.y1)/2;
      let host=null, bestDist=1/0;
      for(const h of proper){ const d=h.row.dy; const dist=cy<d.y0?d.y0-cy:cy>d.y1?cy-d.y1:0; if(dist<bestDist){ bestDist=dist; host=h; } }
      if(!host || bestDist>0.6*glyphHeight) continue;
      host.glyphs.push(...r.glyphs); host.row.lines.push(...r.row.lines); host.pieces+=r.pieces; r.kind='merged'; mergedRows++;
    }
  }

  /* --- structural footer cut -------------------------------------------- */
  {
    const bandNow=rows.slice(first,last+1).filter(r=>r.kind!=='merged');
    const g=relaxedGutters(bandNow);
    if(g.length){
      const firstGutter=g[0].x0;
      const hasFirst=r=>r.glyphs.some(gl=>(gl.x0+gl.x1)/2<firstGutter);
      // number of column slots (the stretches between gutters) a row fills
      const slots=[]; for(let i=0;i<=g.length;i++) slots.push({x0:i?g[i-1].x1+1:-1/0, x1:i<g.length?g[i].x0-1:1/0});
      const filled=r=>slots.filter(sl=>r.glyphs.some(gl=>{ const c=(gl.x0+gl.x1)/2; return c>=sl.x0 && c<=sl.x1; })).length;
      const tabularRows=bandNow.filter(r=>isTabular[r.index]);
      if(tabularRows.filter(hasFirst).length>=0.7*tabularRows.length){
        const itemFill=median(tabularRows.filter(hasFirst).map(filled));
        // the first tabular row without a first-column entry, once three
        // item rows are established, is a totals row and the table ends
        // before it — provided fewer first-column rows follow it than
        // precede it (the top line of a two-line column title has no
        // first-column entry either, but the whole table follows it) and
        // it fills clearly fewer columns than an item row (an item row
        // whose code was lost fills them all; a totals row fills a few).
        // A totals row immediately followed by a run of three item rows
        // (first-column entries, wrapped names allowed between) is a
        // SUB-total inside the table, not its end: the table continues.
        const continues=k=>{
          let j=k+1, skipped=0;
          while(j<=last && (!isTabular[j] || rows[j].kind==='merged')){ j++; if(++skipped>1) return false; }
          let n=0;
          for(;j<=last;j++){ if(rows[j].kind==='merged' || !isTabular[j]) continue;
            if(hasFirst(rows[j])){ if(++n>=3) return true; } else break; }
          return false;
        };
        let established=0;
        for(let k=first;k<=last;k++){
          if(!isTabular[k] || rows[k].kind==='merged') continue;
          const keyword=keywordRows.has(k);
          if(hasFirst(rows[k]) && !keyword){ established++; continue; }
          if(established<3) continue;
          let following=0; for(let j=k+1;j<=last;j++) if(isTabular[j] && rows[j].kind!=='merged' && hasFirst(rows[j])) following++;
          const totalsLike = keyword || (following<established && filled(rows[k])<0.7*itemFill);
          if(!totalsLike || continues(k)) continue;
          last=k-1; footerCut=keyword?'keywords':'structure'; break;
        }
      }
    }
  }
  for(let k=0;k<rows.length;k++) if(rows[k].kind!=='merged') rows[k].kind = k<first?'header':k>last?'footer':'table';
  let band=rows.slice(first,last+1).filter(r=>r.kind!=='merged');

  /* --- rescue (b): accepted pieces outside the band rows whose de-skewed
     centre lies on a band row (within 0.6 glyph height) are added to it. */
  const inBand=new Set(); for(const r of band) for(const piece of r.row.lines) inBand.add(piece);
  for(const piece of textLines.accepted||[]){
    if(inBand.has(piece) || !piece.words || !piece.words.length) continue;
    const cx=(piece.ink.x0+piece.ink.x1)/2, cy=(piece.ink.y0+piece.ink.y1)/2, yp=toDeskewedY(cx,cy);
    let host=null, bestDist=1/0;
    for(const r of band){ const d=r.row.dy; const dist=yp<d.y0?d.y0-yp:yp>d.y1?yp-d.y1:0; if(dist<bestDist){ bestDist=dist; host=r; } }
    if(!host || bestDist>0.6*glyphHeight) continue;
    host.glyphs.push(...piece.words.map(glyphOf)); host.row.lines.push(piece); host.pieces++; inBand.add(piece); rescuedPieces++;
  }
  // rows that took pieces in get their extents and outline recomputed, so
  // recognition crops and the Full Lines drawing include the new pieces
  for(const r of band) if(r.pieces!==r.row.lines.length || mergedRows || rescuedPieces) rebuildRow(r.row,slope);

  const yTop=Math.min(...band.map(r=>r.row.dy.y0)), yBottom=Math.max(...band.map(r=>r.row.dy.y1));
  out.band={first,last,rows:band,yTop,yBottom,parts,seed:{first:seed.first,last:seed.last},fromBorders,mergedRows,rescuedPieces,foreignRows,footerCut};

  /* --- 2–3 · coverage profile and gutters of the whole table (strict) -- */
  setColumnSlope(estimateColumnSlope(band.filter(r=>isTabular[r.index]),slope,params.maxGutterCoverage));   // the whole table now, not just the seed
  const profile=gutterProfile(band,params,glyphHeight);
  const {X0,X1,coverage,rowCount,clearMax,minWidth}=profile;
  const finalGutters=profile.gutters;
  out.profile={X0,X1,coverage,rowCount,clearMax,minWidth};
  let guttersFromBorders=0;
  if(prior && prior.colsX && prior.colsX.length){
    const w=Math.max(2,Math.round(minWidth)), half=w/2;
    for(const c of prior.colsX){
      const xp=toDeskewedX(c.x,(c.y0+c.y1)/2);
      if(xp<=X0+half || xp>=X1-half) continue;                // page / table edge, not a gutter
      if(finalGutters.some(g=>xp>=g.x0-half && xp<=g.x1+half)) continue;
      let sum=0,n=0; for(let x=Math.floor(xp-half);x<=Math.ceil(xp+half);x++){ const i=x-X0; if(i>=0&&i<coverage.length){ sum+=coverage[i]; n++; } }
      if(n && sum/n<=0.35*rowCount){ finalGutters.push({x0:xp-half,x1:xp+half,width:w,fromBorder:true}); guttersFromBorders++; }
    }
    finalGutters.sort((a,b)=>a.x0-b.x0);
  }
  out.gutters=finalGutters; out.guttersFromBorders=guttersFromBorders;

  /* --- 4 · columns between gutters, trimmed to content ----------------- */
  const bounds=[X0]; for(const g of finalGutters) bounds.push(g.x0-1, g.x1+1); bounds.push(X1);
  const columns=[];
  for(let c=0;c<bounds.length;c+=2){
    const a=bounds[c], b=bounds[c+1];
    let cx0=1/0,cx1=-1/0,n=0;
    for(const r of band) for(const g of r.glyphs){
      const m=(g.x0+g.x1)/2;
      if(m>=a && m<=b+1){ n++; if(g.x0<cx0)cx0=g.x0; if(g.x1>cx1)cx1=g.x1; }
    }
    if(n) columns.push({x0:cx0,x1:cx1,gutterX0:a,gutterX1:b,glyphs:n});
  }
  out.columns=columns;

  /* --- 5 · cells (row × column) ----------------------------------------- */
  const cells=band.map(()=>columns.map(()=>null));
  band.forEach((r,ri)=>{
    columns.forEach((c,ci)=>{
      let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0,n=0;
      for(const g of r.glyphs){
        const m=(g.x0+g.x1)/2;
        if(m<c.gutterX0 || m>c.gutterX1+1) continue;
        n++; const b=g.bb;
        if(b.x0<x0)x0=b.x0; if(b.y0<y0)y0=b.y0; if(b.x1>x1)x1=b.x1; if(b.y1>y1)y1=b.y1;
      }
      if(n){ const cy=(y0+y1)/2;
        cells[ri][ci]={bb:{x0,y0,x1,y1},glyphs:n,xp0:toDeskewedX(x0,cy),xp1:toDeskewedX(x1+1,cy)}; }
    });
  });
  out.cells=cells;
  columns.forEach((c,ci)=>{                       // alignment from the spread of the cell edges
    const L=[],R=[],C=[];
    for(let ri=0;ri<band.length;ri++){ const cell=cells[ri][ci]; if(!cell) continue;
      L.push(cell.xp0); R.push(cell.xp1); C.push((cell.xp0+cell.xp1)/2); }
    const sl=stdDev(L),sr=stdDev(R),sc=stdDev(C), lowest=Math.min(sl,sr,sc);
    c.cells=L.length;
    c.align = L.length<2 ? 'single' : lowest===sl ? 'left' : lowest===sr ? 'right' : 'center';
  });
  let spanning=0;                                  // pieces that chained two columns
  for(const r of band) for(const piece of r.row.lines){
    const cy=(piece.ink.y0+piece.ink.y1)/2, a=toDeskewedX(piece.ink.x0,cy), b=toDeskewedX(piece.ink.x1+1,cy);
    let n=0; for(const c of columns) if(Math.min(b,c.gutterX1+1)-Math.max(a,c.gutterX0)>0) n++;
    if(n>1) spanning++;
  }
  out.spanningPieces=spanning;
  return out;
}

/* JSON-friendly summary */
export function columnsToJson(C){
  if(!C||!C.band) return {detected:false, reason:C?C.reason:'disabled'};
  const box=b=>({x0:Math.round(b.x0),y0:Math.round(b.y0),x1:Math.round(b.x1),y1:Math.round(b.y1)});
  return {
    detected:true, pageTiltDeg:+(Math.atan(C.slope)*180/Math.PI).toFixed(3), columnTiltDeg:+(Math.atan(C.columnSlope)*180/Math.PI).toFixed(3),
    tableRows:{first:C.band.first, last:C.band.last, count:C.band.rows.length, mergedParts:C.band.parts, fromBorders:!!C.band.fromBorders},
    headerRows:C.rows.filter(r=>r.kind==='header').length,
    footerRows:C.rows.filter(r=>r.kind==='footer').length,
    guttersFromBorders:C.guttersFromBorders||0,
    gutters:C.gutters.map(g=>({xDeskewed0:Math.round(g.x0), xDeskewed1:Math.round(g.x1), width:g.width})),
    columns:C.columns.map((c,i)=>({index:i+1, xDeskewed0:Math.round(c.x0), xDeskewed1:Math.round(c.x1), align:c.align, cells:c.cells})),
    cells:C.cells.map((row,ri)=>row.map((cell,ci)=>cell?{row:ri+1,col:ci+1,bbox:box(cell.bb),glyphs:cell.glyphs}:null).filter(Boolean))
  };
}
