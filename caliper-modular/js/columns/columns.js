/* ======================================================================
   COLUMN DETECTION  ·  table band, gutters, columns and cells, pre pass A
   Why: once the text-line clean stage has produced trustworthy rows (full
   lines) with a known page tilt, the column structure of the invoice can
   be read directly from where the glyphs are and are not. Doing it here,
   before any word box is fitted, gives every later stage the table
   skeleton for free and does not depend on rules or borders at all.

   Everything is computed in the DE-SKEWED frame of the text-line stage:
       x' = x + slope·y        y' = y − slope·x
   so a tilted photo does not smear a gutter across neighbouring columns.

   Method
     1. Row bands. Every full line is a row; a row with at least
        minPieces pieces is tabular. Runs of tabular rows (tolerating up
        to rowGap non-tabular rows in between — blank or wrapped cells)
        are found; the longest is the seed of the TABLE BAND. An invoice
        has exactly one item table, so a watermark, a pen line or a paper
        fold that damages a few rows must not cut it in two: every other
        run within mergeGap rows of the band whose glyphs respect the
        band's gutters (column-compatible) is merged into it, the damaged
        rows in between included, and the gutters are recomputed from the
        whole table. The band also grows through every adjacent tabular,
        column-compatible row, so a seed that stopped early (a border box
        ending at a crease, a run cut by a damaged row) is completed. Rows
        glued to the band's ends that cross most of its gutters (a
        paragraph, a summary block) are trimmed off. Rows above the band
        are HEADER, rows below FOOTER.
     2. Coverage profile. For every 1 px column x' inside the band, count
        how many band rows have a GLYPH covering it. Glyph-level (not
        piece-level) coverage matters: two table columns whose cells were
        chained into one piece (invoice no + product name) still show a
        gap that lines up in every row, while ordinary word spaces fall at
        different x' in every row and never line up.
     3. Gutters. Maximal runs of x' where the coverage is at most
        gutterCov × rows and the run is at least gutterW × glyph height
        wide (wider than a word space). The page edges are not gutters.
     4. Columns. The intervals between gutters, each trimmed to the glyphs
        it actually contains, classified left / right / centre aligned
        from the spread of the cell edges across rows.
     5. Cells. Every glyph of every band row goes to the column under its
        centre; the union of a row's glyphs in a column is the cell. A
        piece that spanned two columns is thereby split correctly.
   ====================================================================== */

const sd=a=>{ if(a.length<2) return 0; const m=a.reduce((s,x)=>s+x,0)/a.length;
  return Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/a.length); };

/* coverage profile + gutters for a set of rows (steps 2–3) */
function gutterProfile(band,p,hMed){
  let X0=1/0,X1=-1/0;
  for(const r of band) for(const g of r.glyphs){ if(g.x0<X0)X0=g.x0; if(g.x1>X1)X1=g.x1; }
  if(X0===1/0) return {X0:0,X1:0,cov:new Uint16Array(1),nRows:band.length,thr:0,minW:0,gutters:[]};
  X0=Math.floor(X0); X1=Math.ceil(X1);
  const nb=Math.max(1,X1-X0+1), cov=new Uint16Array(nb), mask=new Uint8Array(nb);
  for(const r of band){
    mask.fill(0);
    for(const g of r.glyphs){
      // g.x1 is exclusive: covered bins are floor(x0) .. ceil(x1)-1
      const a=Math.max(0,Math.floor(g.x0)-X0), b=Math.min(nb-1,Math.ceil(g.x1)-1-X0);
      for(let x=a;x<=b;x++) mask[x]=1;
    }
    for(let x=0;x<nb;x++) cov[x]+=mask[x];
  }
  const nR=band.length, thr=p.clGutterCov*nR, minW=Math.max(2,p.clGutterW*hMed);
  /* --- gutters = valleys of the profile ------------------------------
     Two kinds qualify:
       · absolute: coverage ≤ thr (almost no row has ink there);
       · relative: coverage ≤ 42 % of the lower of the two neighbouring
         peaks. Columns separated only by a word-space-sized gap (plus a
         printed rule) show up this way: the gap sits at the same x in
         every row, so the profile drops deeply there, whereas word
         spaces inside a column fall at different x per row and merely
         dent it. Comparing against the LOCAL peaks keeps a sparse column
         (few filled cells) from being swallowed by the gaps around it.
     The search is recursive: find the deepest valid valley of a range,
     widen it to the run that stays near the minimum, then search both
     sides again. A candidate must leave at least one glyph width of
     column on either side.                                             */
  const sm=new Float32Array(nb);
  for(let x=0;x<nb;x++){ const a=cov[Math.max(0,x-1)], b=cov[x], c=cov[Math.min(nb-1,x+1)]; sm[x]=(a+b+c)/3; }
  const minCol=Math.max(3,Math.round(0.8*hMed));
  const gutters=[];
  const rec=(a,b)=>{
    if(b-a+1 < 2*minCol+minW) return;
    // local minima of the smoothed profile, deepest first
    const cands=[];
    for(let x=a+minCol;x<=b-minCol;x++) if(sm[x]<=sm[x-1] && sm[x]<=sm[x+1]) cands.push(x);
    cands.sort((u,v)=>sm[u]-sm[v]);
    for(const bi of cands){
      const bv=sm[bi];
      let lp=0,rp=0; for(let x=a;x<bi;x++) if(sm[x]>lp) lp=sm[x]; for(let x=bi+1;x<=b;x++) if(sm[x]>rp) rp=sm[x];
      const peak=Math.min(lp,rp);
      if(!(bv<=thr || (peak>0 && bv<=0.42*peak))) continue;
      // the run that stays near the minimum — measured on the RAW
      // profile: smoothing blurs the edges of a narrow gap and would
      // report a 5 px gap as 3 px
      const lim=Math.max(bv+0.05*nR, thr);
      let s=bi,e=bi; while(s-1>=a && cov[s-1]<=lim) s--; while(e+1<=b && cov[e+1]<=lim) e++;
      if(e-s+1>=minW && s>0 && e<nb-1) gutters.push({x0:X0+s, x1:X0+e, w:e-s+1, rel:bv>thr, depth:peak?bv/peak:0});
      rec(a,s-1); rec(e+1,b);
      return;
    }
  };
  rec(0,nb-1);
  gutters.sort((u,v)=>u.x0-v.x0);
  return {X0,X1,cov,nRows:nR,thr,minW,gutters};
}

/* does a row respect the given gutters?  A gutter is CROSSED when the
   row's glyphs cover at least half of its width. A table row crosses at
   most one or two (a long name spilling into the next column); a
   paragraph or a summary line crosses nearly all of them. Compatible when
   the crossed fraction is at most maxFrac (0.34 for joining a separate
   run and for the band's own edge rows: a table row crosses at most a
   couple of gutters, a paragraph or summary line a third or more). */
function rowOk(r,gutters,maxFrac=0.34){
  if(!gutters.length || !r.glyphs.length) return true;
  let crossed=0;
  for(const gt of gutters){
    const w=gt.x1-gt.x0+1; let cov=0;
    for(const g of r.glyphs){ const o=Math.min(g.x1,gt.x1+1)-Math.max(g.x0,gt.x0); if(o>0) cov+=o; }
    if(cov>=0.5*w) crossed++;
  }
  return crossed<=maxFrac*gutters.length;
}
/* a run is compatible when at least 70 % of its rows are */
function compatibleRun(rows,gutters){
  if(!gutters.length) return true;
  let ok=0; for(const r of rows) if(rowOk(r,gutters)) ok++;
  return ok>=0.7*rows.length;
}

/* TL    : the text-line clean result (S.textLines)
   p     : {clMinPieces, clGutterW, clGutterCov, clRowGap, clMergeGap}
   prior : optional border layout (section 02a): {table:{x0,y0,x1,y1}|null,
           colsX:[{x,y0,y1}]} in image space. A table box forces the band
           (rows whose de-skewed centre lies inside it); column boundaries
           are added as gutters where the glyph coverage allows.        */
export function detectColumns(TL,p,prior=null){
  const slope=(TL.rows&&TL.rows.slope)||0, rows=(TL.rows&&TL.rows.rows)||[], hMed=TL.stats.hMed||10;
  const toX=(x,y)=>x+slope*y;                        // de-skewed x'
  const toY=(x,y)=>y-slope*x;                        // de-skewed y'
  const back=(xp,yp)=>({x:xp-slope*yp, y:yp+slope*xp}); // (x',y') → image
  const out={slope, hMed, toX, back, rowsInfo:[], band:null, profile:null,
             gutters:[], columns:[], cells:[], reason:'', prior:prior?prior.kind:'none'};

  // 1 · rows
  const info=rows.map((r,i)=>{
    const glyphs=[];
    for(const ln of r.lines) for(const m of ln.words){
      const cy=(m.bb.y0+m.bb.y1)/2;
      // glyph boxes come from the healed (1 px dilated) mask; take that
      // pixel back on each side so a word-space-sized gap keeps its width
      const x0=Math.min(m.bb.x0+1,m.bb.x1), x1=Math.max(m.bb.x1,m.bb.x0+1);
      glyphs.push({bb:m.bb, x0:toX(x0,cy), x1:toX(x1,cy)});
    }
    return {i,row:r,pieces:r.lines.length,glyphs,kind:'other'};
  });
  out.rowsInfo=info;
  if(!info.length){ out.reason='no rows'; return out; }

  // tabular runs (rowGap-tolerant)
  const tab=info.map(r=>r.pieces>=p.clMinPieces);
  const runs=[];
  for(let i=0;i<info.length;i++){
    if(!tab[i]) continue;
    let j=i,last=i,count=0;
    while(j<info.length){
      if(tab[j]){ last=j; count++; j++; continue; }
      let k=j; while(k<info.length && !tab[k]) k++;
      if(k<info.length && k-j<=p.clRowGap) j=k; else break;
    }
    runs.push({r0:i,r1:last,count});
    i=last;
  }
  out.runs=runs;
  if(!runs.length){ out.reason='no row has '+p.clMinPieces+'+ pieces'; return out; }

  /* --- structure discovery with a RELAXED coverage threshold ----------
     Rows that do not belong to the table (a paragraph glued to its end,
     a summary block) cross every gutter; with the strict threshold a few
     of them wipe the gutters out and nothing can be judged. The relaxed
     profile tolerates up to 35 % crossing rows, which is enough to see
     the column structure, judge every row against it, trim the band's
     ends and merge compatible runs. The final columns are then computed
     with the strict threshold on the cleaned band.                      */
  const relaxedP={...p, clGutterCov:Math.max(p.clGutterCov,0.35)};
  const relaxed=rows=>gutterProfile(rows,relaxedP,hMed).gutters;
  // seed = the run with the most column structure (gutters × rows), so a
  // long paragraph block never outranks the item table
  // (scored with the STRICT profile on purpose: a run that has swallowed
  // a paragraph keeps, under the relaxed profile, exactly the gutters the
  // paragraph does not cross and would pass every later test; under the
  // strict profile those rows wipe its gutters out and a clean run wins)
  for(const r of runs){ r.gutters=gutterProfile(info.slice(r.r0,r.r1+1),p,hMed).gutters.length; r.score=(r.gutters+1)*r.count; }
  let seed=runs[0]; for(const r of runs) if(r.score>seed.score) seed=r;
  let r0=seed.r0, r1=seed.r1, parts=1, fromBorders=false;
  // a table box from the borders overrides the run search: the band is
  // every row whose de-skewed centre lies inside the box
  if(prior && prior.table){
    const bx=(prior.table.x0+prior.table.x1)/2;
    const by0=toY(bx,prior.table.y0), by1=toY(bx,prior.table.y1);
    const inside=[];
    info.forEach((r,i)=>{ const cy=(r.row.dy.y0+r.row.dy.y1)/2; if(cy>=by0 && cy<=by1) inside.push(i); });
    if(inside.length>=2){ r0=inside[0]; r1=inside[inside.length-1]; fromBorders=true; }
  }
  let G=relaxed(info.slice(r0,r1+1));
  const trim=(a,b)=>{ if(!G.length) return [a,b];
    while(a<b && !rowOk(info[a],G,0.34)) a++;
    while(b>a && !rowOk(info[b],G,0.34)) b--;
    return [a,b]; };
  for(let it=0;it<2;it++){ [r0,r1]=trim(r0,r1); G=relaxed(info.slice(r0,r1+1)); }
  /* --- extension: the band grows through every adjacent row that is
     tabular and column-compatible, tolerating rowGap non-tabular rows in
     between. This is what makes the band self-correcting: a border box
     that ends early (a crease or pen line taken for the bottom rule) or
     a seed run that stopped at a damaged row is completed here, and a
     footer block that does not share the columns stops it.             */
  const extend=()=>{
    for(const dir of [1,-1]){
      let k=dir>0?r1+1:r0-1, gap=0;
      while(k>=0 && k<info.length){
        const okRow=rowOk(info[k],G,0.34);
        if(tab[k] && okRow){ if(dir>0) r1=k; else r0=k; gap=0; }
        else if(okRow && gap<p.clRowGap){ gap++; }
        else break;
        k+=dir;
      }
    }
    G=relaxed(info.slice(r0,r1+1));
  };
  extend();
  // merge column-compatible runs across damaged rows (watermark, pen
  // line, paper fold) — one invoice, one item table
  const mergeGap=p.clMergeGap!==undefined?p.clMergeGap:6;
  const used=new Set([seed]);
  for(const r of runs) if(r.r1>=r0 && r.r0<=r1) used.add(r);   // runs already inside the band
  let merged=true;
  while(merged){
    merged=false;
    let above=null, below=null;                    // nearest unused runs
    for(const r of runs){ if(used.has(r)) continue;
      if(r.r1<r0 && (!above || r.r1>above.r1)) above=r;
      if(r.r0>r1 && (!below || r.r0<below.r0)) below=r; }
    for(const cand of [above,below]){
      if(!cand) continue;
      used.add(cand);
      const gap = cand.r1<r0 ? r0-cand.r1-1 : cand.r0-r1-1;
      if(gap>mergeGap){ cand.rejected='too far'; continue; }
      const [a,b]=trim(cand.r0,cand.r1);           // drop incompatible edge rows
      if(!compatibleRun(info.slice(a,b+1),G)){ cand.rejected='columns differ'; continue; }
      r0=Math.min(r0,a); r1=Math.max(r1,b); parts++; cand.mergedIn=true;
      extend();
      for(const r of runs) if(r.r1>=r0 && r.r0<=r1) used.add(r);
      merged=true;
    }
  }
  for(let k=0;k<info.length;k++) info[k].kind = k<r0?'header':k>r1?'footer':'table';
  const band=info.slice(r0,r1+1);
  const yTop=Math.min(...band.map(r=>r.row.dy.y0)), yBot=Math.max(...band.map(r=>r.row.dy.y1));
  out.band={r0,r1,rows:band,yTop,yBot,parts,seed:{r0:seed.r0,r1:seed.r1},fromBorders};

  // 2–3 · coverage profile and gutters of the whole table (strict)
  const {X0,X1,cov,nRows:nR,thr,minW,gutters}=gutterProfile(band,p,hMed);
  out.profile={X0,X1,cov,nRows:nR,thr,minW};
  // border column boundaries become gutters where the glyph coverage
  // does not contradict them (≤ 35 % of rows crossing)
  let addedFromBorders=0;
  if(prior && prior.colsX && prior.colsX.length){
    const w=Math.max(2,Math.round(minW)), half=w/2;
    for(const c of prior.colsX){
      const xp=toX(c.x,(c.y0+c.y1)/2);
      if(xp<=X0+half || xp>=X1-half) continue;                // page/table edge, not a gutter
      if(gutters.some(g=>xp>=g.x0-half && xp<=g.x1+half)) continue;
      let s=0,n=0; for(let x=Math.floor(xp-half);x<=Math.ceil(xp+half);x++){ const i=x-X0; if(i>=0&&i<cov.length){ s+=cov[i]; n++; } }
      if(n && s/n<=0.35*nR){ gutters.push({x0:xp-half,x1:xp+half,w,fromBorder:true}); addedFromBorders++; }
    }
    gutters.sort((a,b)=>a.x0-b.x0);
  }
  out.gutters=gutters; out.guttersFromBorders=addedFromBorders;

  // 4 · columns between gutters, trimmed to content
  const bounds=[X0]; for(const g of gutters) bounds.push(g.x0-1, g.x1+1); bounds.push(X1);
  const columns=[];
  for(let c=0;c<bounds.length;c+=2){
    const a=bounds[c], b=bounds[c+1];
    let cx0=1/0,cx1=-1/0,n=0;
    for(const r of band) for(const g of r.glyphs){
      const m=(g.x0+g.x1)/2;
      if(m>=a && m<=b+1){ n++; if(g.x0<cx0)cx0=g.x0; if(g.x1>cx1)cx1=g.x1; }
    }
    if(!n) continue;
    columns.push({x0:cx0,x1:cx1,gx0:a,gx1:b,glyphs:n});
  }
  out.columns=columns;

  // 5 · cells (row × column)
  const cells=band.map(()=>columns.map(()=>null));
  band.forEach((r,ri)=>{
    columns.forEach((c,ci)=>{
      let x0=1/0,y0=1/0,x1=-1/0,y1=-1/0,n=0;
      for(const g of r.glyphs){
        const m=(g.x0+g.x1)/2;
        if(m<c.gx0 || m>c.gx1+1) continue;
        n++; const b=g.bb;
        if(b.x0<x0)x0=b.x0; if(b.y0<y0)y0=b.y0; if(b.x1>x1)x1=b.x1; if(b.y1>y1)y1=b.y1;
      }
      if(n){ const cy=(y0+y1)/2;
        cells[ri][ci]={bb:{x0,y0,x1,y1},glyphs:n,xp0:toX(x0,cy),xp1:toX(x1+1,cy)}; }
    });
  });
  out.cells=cells;

  // alignment per column from the spread of cell edges
  columns.forEach((c,ci)=>{
    const L=[],R=[],C=[];
    for(let ri=0;ri<band.length;ri++){ const cl=cells[ri][ci]; if(!cl) continue;
      L.push(cl.xp0); R.push(cl.xp1); C.push((cl.xp0+cl.xp1)/2); }
    const sl=sd(L),sr=sd(R),sc=sd(C), mn=Math.min(sl,sr,sc);
    c.cells=L.length; c.sd={l:sl,r:sr,c:sc};
    c.align = L.length<2 ? 'single' : mn===sl ? 'left' : mn===sr ? 'right' : 'center';
  });
  // pieces that were split across columns (chained cells)
  let spanning=0;
  for(const r of band) for(const ln of r.row.lines){
    const cy=(ln.ink.y0+ln.ink.y1)/2, a=toX(ln.ink.x0,cy), b=toX(ln.ink.x1+1,cy);
    let n=0; for(const c of columns) if(Math.min(b,c.gx1+1)-Math.max(a,c.gx0)>0) n++;
    if(n>1) spanning++;
  }
  out.spanningPieces=spanning;
  return out;
}

/* JSON-friendly summary */
export function columnsToJson(C){
  if(!C||!C.band) return {detected:false, reason:C?C.reason:'disabled'};
  const ib=b=>({x0:Math.round(b.x0),y0:Math.round(b.y0),x1:Math.round(b.x1),y1:Math.round(b.y1)});
  return {
    detected:true, space:'rectified image', pageTiltDeg:+(Math.atan(C.slope)*180/Math.PI).toFixed(3),
    tableRows:{first:C.band.r0, last:C.band.r1, count:C.band.rows.length, mergedParts:C.band.parts, fromBorders:!!C.band.fromBorders},
    guttersFromBorders:C.guttersFromBorders||0,
    headerRows:C.rowsInfo.filter(r=>r.kind==='header').length,
    footerRows:C.rowsInfo.filter(r=>r.kind==='footer').length,
    gutters:C.gutters.map(g=>({xDeskewed0:Math.round(g.x0), xDeskewed1:Math.round(g.x1), width:g.w})),
    columns:C.columns.map((c,i)=>({index:i+1, xDeskewed0:Math.round(c.x0), xDeskewed1:Math.round(c.x1),
      align:c.align, cells:c.cells})),
    cells:C.cells.map((row,ri)=>row.map((cl,ci)=>cl?{row:ri+1,col:ci+1,bbox:ib(cl.bb),glyphs:cl.glyphs}:null).filter(Boolean))
  };
}
