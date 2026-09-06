/* ======================================================================
   CHARACTER SEGMENTATION  ·  one symbol per box
   Why: the text-line stage works on connected components, and a component
   is not always one character: an "i" is two components (dot and stem),
   a colon is two, while touching letters ("rn", "00", bold digits) are
   one component holding several. Recognition wants exactly one symbol per
   box. This stage repairs both directions inside every accepted line:
     1. JOIN — components of the same line whose x ranges overlap by at
        least joinOverlap of the narrower one AND that do not overlap
        vertically are stacked parts of one symbol (dot over stem, the two
        dots of ":", the bars of "="); side-by-side glyphs overlap
        vertically and are never joined.
     2. SPLIT — a symbol wider than splitRatio × the line's typical
        character width (the 75th percentile of symbol widths, so narrow
        glyphs like i, l and 1 cannot drag it down) is a merge. It is cut
        at columns that are local minima of the column ink profile and
        either
          · a VALLEY: at most valleyDepth × the mean ink, not sitting at
            the top or bottom edge (the arches of m and w, the base of u
            are edge valleys, not junctions), or
          · a NECK: a single short ink run in the middle of the glyph
            height — how two touching round glyphs ("00", "88", "co")
            join, which leaves no projection valley at all;
        cuts are at least minCharWidth × cw apart and pieces narrower than
        that are merged back.
   Every character records its line, its member components, how it was
   made (single / joined / split) and, when the column stage found a
   table, the cell it lies in.
   ====================================================================== */
import { median } from '../morph/morph.js';

const widthOf=b=>b.x1-b.x0+1, heightOf=b=>b.y1-b.y0+1;

/* per-column ink of one component (labels === label AND clean ink):
   the ink count, the number of ink runs, the longest run and its centre */
function componentColumns(comp,labels,ink,W){
  const bb=comp.bb, w=widthOf(bb);
  const profile=new Uint16Array(w), runs=new Uint8Array(w), runLen=new Uint16Array(w), runCentre=new Float32Array(w);
  for(let x=bb.x0;x<=bb.x1;x++){
    let count=0, nRuns=0, best=0, bestC=0, cur=0, curStart=0;
    for(let y=bb.y0;y<=bb.y1+1;y++){
      const on = y<=bb.y1 && labels[y*W+x]===comp.label && ink[y*W+x];
      if(on){ if(!cur) curStart=y; cur++; count++; }
      else if(cur){ nRuns++; if(cur>best){ best=cur; bestC=curStart+cur/2; } cur=0; }
    }
    const i=x-bb.x0; profile[i]=count; runs[i]=nRuns; runLen[i]=best; runCentre[i]=bestC;
  }
  return {profile,runs,runLen,runCentre};
}
const percentile=(values,q)=>{ if(!values.length) return 0; const s=values.slice().sort((a,b)=>a-b); return s[Math.min(s.length-1,Math.floor(q*(s.length-1)))]; };

/* textLines : the text-line stage result (S.textLines)
   columns   : the column stage result (S.columns) or null
   W,H       : image size
   params    : {joinOverlap, splitRatio, valleyDepth, minCharWidth}
   Returns {lines:[{chainIndex, height, charWidth, characters:[...]}],
            characters:[...], splits:[...], stats}                          */
export function segmentCharacters(TL,columns,W,H,params){
  const labels=TL.labels, ink=TL.cleanBinary;
  const lines=[], characters=[], splits=[];
  let joined=0, splitCount=0;

  TL.chains.forEach((chain,chainIndex)=>{
    if(!chain.accepted) return;
    const lineHeight=chain.heightMed||median(chain.members.map(m=>heightOf(m.bb)));
    /* --- 1 · join stacked parts of one symbol ------------------------- */
    const members=chain.members.slice().sort((a,b)=>a.bb.x0-b.bb.x0);
    const groups=[];
    for(const m of members){
      const g=groups[groups.length-1];
      if(g){
        const overlap=Math.min(g.bb.x1,m.bb.x1)-Math.max(g.bb.x0,m.bb.x0)+1;
        const narrower=Math.min(widthOf(g.bb),widthOf(m.bb));
        const joinedWidth=Math.max(g.bb.x1,m.bb.x1)-Math.min(g.bb.x0,m.bb.x0)+1;
        // stacked parts of one symbol (dot over stem, the dots of a colon)
        // do not overlap vertically; side-by-side glyphs do — a narrow i
        // or l kerned a pixel under its neighbour must not be swallowed
        const vOverlap=Math.min(g.bb.y1,m.bb.y1)-Math.max(g.bb.y0,m.bb.y0)+1;
        const stacked=vOverlap<=0.3*Math.min(heightOf(g.bb),heightOf(m.bb));
        if(stacked && overlap>=params.joinOverlap*narrower && joinedWidth<=1.3*lineHeight){
          g.members.push(m); g.area+=m.area;
          g.bb={x0:Math.min(g.bb.x0,m.bb.x0),y0:Math.min(g.bb.y0,m.bb.y0),x1:Math.max(g.bb.x1,m.bb.x1),y1:Math.max(g.bb.y1,m.bb.y1)};
          g.kind='joined'; joined++;
          continue;
        }
      }
      groups.push({members:[m], bb:{...m.bb}, area:m.area, kind:'single'});
    }
    /* --- 2 · split merged symbols --------------------------------------- */
    const narrowWidths=groups.filter(g=>widthOf(g.bb)<=1.2*lineHeight).map(g=>widthOf(g.bb));
    const charWidth=narrowWidths.length?percentile(narrowWidths,0.75):0.6*lineHeight;
    const lineChars=[];
    for(const g of groups){
      const w=widthOf(g.bb), h=heightOf(g.bb);
      if(w<=params.splitRatio*charWidth || w<0.9*h || g.members.length!==1){ lineChars.push(g); continue; }
      const comp=g.members[0];
      const {profile,runs,runLen,runCentre}=componentColumns(comp,labels,ink,W);
      let mean=0; for(const v of profile) mean+=v; mean/=profile.length;
      const minGap=Math.max(2,Math.round(params.minCharWidth*charWidth));
      const top=comp.bb.y0, bottom=comp.bb.y1, glyphH=bottom-top+1;
      const isValley=x=>profile[x]<=params.valleyDepth*mean
        && (runs[x]!==1 || (runCentre[x]-top>0.2*glyphH && bottom-runCentre[x]>0.2*glyphH));   // not an edge arch / base
      const isNeck=x=>runs[x]===1 && runLen[x]<=0.35*glyphH && profile[x]<=0.6*mean
        && runCentre[x]-top>0.2*glyphH && bottom-runCentre[x]>0.2*glyphH;
      const cuts=[]; let lastCut=0;
      for(let x=minGap;x<profile.length-minGap;x++){
        if(x-lastCut<minGap) continue;
        if(profile[x]>profile[x-1] || profile[x]>profile[x+1]) continue;   // local minimum only
        if(!isValley(x) && !isNeck(x)) continue;
        cuts.push(x); lastCut=x;
      }
      if(!cuts.length){ lineChars.push(g); continue; }
      // pieces between cuts, trimmed to their ink columns
      const pieces=[]; let start=0;
      for(const cut of cuts.concat([profile.length])){
        let a=start,b=cut-1;
        while(a<=b && !profile[a]) a++; while(b>=a && !profile[b]) b--;
        if(a<=b) pieces.push({a,b});
        start=cut;
      }
      // merge slivers back into their neighbour
      for(let i=pieces.length-1;i>=0;i--){
        if(pieces[i].b-pieces[i].a+1>=minGap || pieces.length===1) continue;
        const target=i>0?pieces[i-1]:pieces[i+1];
        target.a=Math.min(target.a,pieces[i].a); target.b=Math.max(target.b,pieces[i].b);
        pieces.splice(i,1);
      }
      if(pieces.length<2){ lineChars.push(g); continue; }
      splitCount++;
      const made=pieces.map(p=>{
        // vertical extent of the ink inside this column range
        let y0=comp.bb.y1,y1=comp.bb.y0,count=0;
        for(let y=comp.bb.y0;y<=comp.bb.y1;y++){ const row=y*W;
          for(let x=comp.bb.x0+p.a;x<=comp.bb.x0+p.b;x++){ const i=row+x; if(labels[i]===comp.label && ink[i]){ count++; if(y<y0)y0=y; if(y>y1)y1=y; } } }
        return {members:[comp], bb:{x0:comp.bb.x0+p.a,y0,x1:comp.bb.x0+p.b,y1}, area:count, kind:'split', parent:comp};
      });
      splits.push({bb:{...comp.bb}, profile, mean, cuts:cuts.map(c=>comp.bb.x0+c), pieces:made.length, chainIndex});
      lineChars.push(...made);
    }
    lineChars.sort((a,b)=>a.bb.x0-b.bb.x0);
    lineChars.forEach((ch,i)=>{ ch.line=chainIndex; ch.index=i; ch.height=heightOf(ch.bb); ch.width=widthOf(ch.bb); });
    lines.push({chainIndex, height:lineHeight, charWidth, characters:lineChars});
    characters.push(...lineChars);
  });

  assignCells(characters,columns);
  return {lines, characters, splits,
    stats:{lines:lines.length, characters:characters.length, joined, split:splitCount,
           inCells:characters.filter(c=>c.cell).length}};
}

/* Table cell membership: every character whose de-skewed centre lies on a
   band row and inside a column gets {row, col}; re-run after the table is
   refined. Returns the number of characters in cells.                   */
export function assignCells(characters,columns){
  for(const ch of characters) delete ch.cell;
  if(!columns || !columns.band) return 0;
  const band=columns.band; let n=0;
  for(const ch of characters){
    const cx=(ch.bb.x0+ch.bb.x1)/2, cy=(ch.bb.y0+ch.bb.y1)/2;
    const xp=columns.toDeskewedX(cx,cy), yp=cy-columns.slope*cx;
    let rowIndex=-1;
    band.rows.forEach((r,ri)=>{ if(yp>=r.row.dy.y0-1 && yp<=r.row.dy.y1+1) rowIndex=ri; });
    if(rowIndex<0) continue;
    let colIndex=-1;
    columns.columns.forEach((c,ci)=>{ if(xp>=c.gutterX0 && xp<=c.gutterX1+1) colIndex=ci; });
    if(colIndex>=0){ ch.cell={row:rowIndex,col:colIndex}; n++; }
  }
  return n;
}
