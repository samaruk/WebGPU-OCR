/* ======================================================================
   FULL LINES  ·  join line pieces left → right into one line per text row
   Why: text-line pieces stop at every column gutter, so one physical row
   of a table arrives as several pieces. Reading order and row detection
   want the whole row. Pieces are joined under three rules:
     · vertical overlap with the NEAREST piece already in the row (local,
       so a gently curled row still joins end to end and one odd piece
       cannot poison a row);
     · the two neighbours together must not be taller than one line;
     · no piece may overlap another horizontally — reading left to right
       there is exactly one piece at any x position, so pieces sharing an
       x range are different lines however small their vertical offset.
   Everything vertical is judged in a DE-SKEWED frame: the page slope is
   estimated from the pieces themselves, so on a tilted photo row N on the
   left is never joined to row N-1 on the right.
   ====================================================================== */
import { median, weightedMedian } from '../morph/morph.js';

const heightOf=box=>box.y1-box.y0+1, widthOf=box=>box.x1-box.x0+1;

/* Page slope (dy/dx) from wide pieces with ≥ 4 members: a least-squares
   line through each piece's member centres, combined as a member-weighted
   median so a few odd pieces cannot tilt it.                            */
function estimateSlope(pieces){
  const slopes=[], weights=[];
  for(const piece of pieces){
    const members=piece.words||[]; if(members.length<4) continue;
    if(widthOf(piece.ink) < 3*heightOf(piece.ink)) continue;
    let sx=0,sy=0,sxx=0,sxy=0,n=0;
    for(const m of members){ const cx=(m.bb.x0+m.bb.x1)/2, cy=(m.bb.y0+m.bb.y1)/2;
      sx+=cx; sy+=cy; sxx+=cx*cx; sxy+=cx*cy; n++; }
    const det=n*sxx-sx*sx; if(det<=0) continue;
    slopes.push((n*sxy-sx*sy)/det); weights.push(n);
  }
  return {slope:slopes.length?weightedMedian(slopes,weights):0, samples:slopes.length};
}

/* pieces     : [{ink:{x0,y0,x1,y1}, bb, words:[{bb}]}] — text-line pieces
   maxHeight  : max single-line height in px; 0 → 1.6 × median piece height
   minOverlap : required vertical overlap as a fraction of the shorter piece
   Returns {maxHeight, slope, slopeSamples, rows:[{bb, ink, dy, poly,
   centerline, lines:[pieces], words}]} sorted top → bottom, each row's
   pieces sorted left → right. `dy` is the row's de-skewed vertical
   extent; `poly` is the closed outline that follows the pieces and
   `centerline` the left → right reading path.                            */
export function buildFullLines(pieces,maxHeight,minOverlap){
  const src=pieces.slice();
  if(!src.length) return {maxHeight:maxHeight||0, slope:0, slopeSamples:0, rows:[]};
  const {slope,samples}=estimateSlope(src);

  // de-skewed vertical extent of a piece = union of its members' extents,
  // each shifted by the slope at that member's own x
  const deskewed=piece=>{
    const members=piece.words&&piece.words.length?piece.words:null;
    if(!members){ const cx=(piece.ink.x0+piece.ink.x1)/2; return {y0:piece.ink.y0-slope*cx, y1:piece.ink.y1-slope*cx}; }
    let y0=1/0,y1=-1/0;
    for(const m of members){ const cx=(m.bb.x0+m.bb.x1)/2;
      const a=m.bb.y0-slope*cx, b=m.bb.y1-slope*cx; if(a<y0)y0=a; if(b>y1)y1=b; }
    return {y0,y1};
  };
  for(const piece of src) piece.dy=deskewed(piece);
  if(!(maxHeight>0)) maxHeight=1.6*median(src.map(p=>heightOf(p.dy)));

  src.sort((a,b)=>a.dy.y0-b.dy.y0 || a.ink.x0-b.ink.x0);
  const xTolerance=(a,b)=>Math.max(2,0.05*Math.min(widthOf(a),widthOf(b)));   // dilation slop only
  const rows=[];
  for(const piece of src){
    const ink=piece.ink, dy=piece.dy; let home=null, bestScore=-1;
    for(const row of rows){
      let stacked=false, nearest=null, nearestDist=1/0;
      for(const other of row.lines){ const o=other.ink;
        const xOverlap=Math.min(o.x1,ink.x1)-Math.max(o.x0,ink.x0)+1;
        if(xOverlap>xTolerance(o,ink)){ stacked=true; break; }       // sits over an existing piece
        const dist=o.x1<ink.x0 ? ink.x0-o.x1 : o.x0-ink.x1;
        if(dist<nearestDist){ nearestDist=dist; nearest=other; } }
      if(stacked || !nearest) continue;
      const nd=nearest.dy;
      const overlap=Math.min(nd.y1,dy.y1)-Math.max(nd.y0,dy.y0)+1;
      const shorter=Math.min(heightOf(nd),heightOf(dy));
      if(overlap<minOverlap*shorter) continue;
      if(Math.max(nd.y1,dy.y1)-Math.min(nd.y0,dy.y0)+1>maxHeight) continue;   // would become two lines
      const score=overlap/shorter;
      if(score>bestScore){ bestScore=score; home=row; }
    }
    if(home){
      home.lines.push(piece);
      home.ink={x0:Math.min(home.ink.x0,ink.x0),y0:Math.min(home.ink.y0,ink.y0),x1:Math.max(home.ink.x1,ink.x1),y1:Math.max(home.ink.y1,ink.y1)};
      home.bb ={x0:Math.min(home.bb.x0,piece.bb.x0),y0:Math.min(home.bb.y0,piece.bb.y0),x1:Math.max(home.bb.x1,piece.bb.x1),y1:Math.max(home.bb.y1,piece.bb.y1)};
      home.dy ={y0:Math.min(home.dy.y0,dy.y0), y1:Math.max(home.dy.y1,dy.y1)};
    } else rows.push({lines:[piece], ink:{...ink}, bb:{...piece.bb}, dy:{...dy}});
  }
  for(const row of rows) rebuildRow(row,slope);
  rows.sort((a,b)=>a.dy.y0-b.dy.y0 || a.ink.x0-b.ink.x0);
  return {maxHeight, slope, slopeSamples:samples, rows};
}

/* Recompute a row from its pieces: order, word count, ink / bb / de-skewed
   extents, and the outline that follows the pieces (top edge along the
   piece tops left → right, bottom edge back along the bottoms, gaps
   bridged) plus the centreline. Call it whenever pieces are added to a
   row after the join (the column stage folds rescued pieces in).       */
export function rebuildRow(row,slope){
  row.lines.sort((a,b)=>a.ink.x0-b.ink.x0);
  row.words=row.lines.reduce((n,p)=>n+p.words.length,0);
  let ink=null, bb=null, dy=null;
  for(const p of row.lines){
    ink=ink?{x0:Math.min(ink.x0,p.ink.x0),y0:Math.min(ink.y0,p.ink.y0),x1:Math.max(ink.x1,p.ink.x1),y1:Math.max(ink.y1,p.ink.y1)}:{...p.ink};
    bb =bb ?{x0:Math.min(bb.x0,p.bb.x0),y0:Math.min(bb.y0,p.bb.y0),x1:Math.max(bb.x1,p.bb.x1),y1:Math.max(bb.y1,p.bb.y1)}:{...p.bb};
    if(!p.dy){ const cx=(p.ink.x0+p.ink.x1)/2; p.dy={y0:p.ink.y0-slope*cx, y1:p.ink.y1-slope*cx}; }
    dy =dy ?{y0:Math.min(dy.y0,p.dy.y0), y1:Math.max(dy.y1,p.dy.y1)}:{...p.dy};
  }
  row.ink=ink; row.bb=bb; row.dy=dy;
  const top=[], bottom=[], centre=[];
  for(const p of row.lines){ const b=p.ink;
    top.push({x:b.x0,y:b.y0},{x:b.x1+1,y:b.y0});
    bottom.push({x:b.x0,y:b.y1+1},{x:b.x1+1,y:b.y1+1});
    const cy=(b.y0+b.y1+1)/2; centre.push({x:b.x0,y:cy},{x:b.x1+1,y:cy}); }
  row.poly=top.concat(bottom.reverse());
  row.centerline=centre;
  return row;
}
