/* ======================================================================
   QUAD EDIT  ·  the page's four corners, moved by hand
   Why: the page quad the detector finds is drawn over every page as soon
   as it is added, before any run, and a corner it put on a shadow, a
   second sheet or a hand is dragged to the page's true corner. The
   pipeline then warps the page from the corrected quad. Pure geometry
   here; the drawing and the pointer are in viewport.js.
     CORNERS               tl, tr, br, bl — the quad's keys, clockwise
     nearestCorner(quad, x, y, tol)      → the key of the corner within tol of (x, y), or null
     moveCorner(quad, key, x, y, W, H)   → a new quad with that corner at (x, y), clamped to the image
     defaultQuad(W, H, inset)            → the image's own frame inset a little — when no page was found
     quadIsConvex(quad)                  → the four corners wind one way (a self-crossing quad warps nothing)
     drawQuad(ctx, quad, view, dpr)      → the polygon and its corner handles on the viewport canvas
     thumbWithQuad(canvas, quad, width)  → a small JPEG data URL of the page with the quad drawn on it
   ====================================================================== */
export const CORNERS=['tl','tr','br','bl'];
export const HANDLE_PX=9;          // the handle's radius on screen

export function nearestCorner(quad, x, y, tol){
  if(!quad) return null;
  let best=null, bd=tol;
  for(const k of CORNERS){ const p=quad[k]; if(!p) continue; const d=Math.hypot(p.x-x, p.y-y); if(d<=bd){ bd=d; best=k; } }
  return best;
}
export function moveCorner(quad, key, x, y, W, H){
  const q={}; for(const k of CORNERS) q[k]={x:quad[k].x, y:quad[k].y};
  q[key]={x:Math.min(Math.max(0,x),W), y:Math.min(Math.max(0,y),H)};
  return q;
}
export function defaultQuad(W, H, inset=0.02){
  const dx=W*inset, dy=H*inset;
  return {tl:{x:dx,y:dy}, tr:{x:W-dx,y:dy}, br:{x:W-dx,y:H-dy}, bl:{x:dx,y:H-dy}};
}
export function quadIsConvex(quad){
  const q=CORNERS.map(k=>quad[k]); let sign=0;
  const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  for(let i=0;i<4;i++){ const z=Math.sign(cross(q[i],q[(i+1)%4],q[(i+2)%4])); if(!z) continue; if(sign===0) sign=z; else if(z!==sign) return false; }
  return sign!==0;
}
/* two quads the same to the pixel */
export function sameQuad(a,b){ return !!a && !!b && CORNERS.every(k=>Math.abs(a[k].x-b[k].x)<0.5 && Math.abs(a[k].y-b[k].y)<0.5); }

/* drawn in screen space over the page: the page's outline, the region outside dimmed, a handle on each corner */
export function drawQuad(ctx, quad, view, dpr, opts={}){
  if(!quad) return;
  const P=k=>({x:(view.tx+quad[k].x*view.scale)*dpr, y:(view.ty+quad[k].y*view.scale)*dpr});
  const pts=CORNERS.map(P);
  ctx.save(); ctx.setTransform(1,0,0,1,0,0);
  if(opts.W && opts.H){                                          // the region outside the page, dimmed
    ctx.beginPath(); ctx.rect((view.tx)*dpr,(view.ty)*dpr,opts.W*view.scale*dpr,opts.H*view.scale*dpr);
    ctx.moveTo(pts[0].x,pts[0].y); for(let i=3;i>=1;i--) ctx.lineTo(pts[i].x,pts[i].y); ctx.closePath();
    ctx.fillStyle='rgba(0,0,0,.28)'; ctx.fill('evenodd'); }
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(let i=1;i<4;i++) ctx.lineTo(pts[i].x,pts[i].y); ctx.closePath();
  ctx.lineWidth=2*dpr; ctx.strokeStyle=opts.convex===false?'rgba(255,90,90,.95)':'rgba(166,255,63,.95)'; ctx.stroke();
  const r=HANDLE_PX*dpr;
  pts.forEach((p,i)=>{ ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fillStyle=opts.active===CORNERS[i]?'rgba(166,255,63,.95)':'rgba(10,14,15,.85)'; ctx.fill(); ctx.lineWidth=2*dpr; ctx.strokeStyle='rgba(166,255,63,.95)'; ctx.stroke();
    ctx.fillStyle=opts.active===CORNERS[i]?'#0a0e0f':'#a6ff3f'; ctx.font=(9*dpr)+'px system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(CORNERS[i].toUpperCase(),p.x,p.y+0.5*dpr); });
  ctx.restore();
}

export function thumbWithQuad(canvas, quad, width=200){
  const s=Math.min(1, width/canvas.width); const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(canvas.width*s)); c.height=Math.max(1,Math.round(canvas.height*s));
  const ctx=c.getContext('2d'); ctx.drawImage(canvas,0,0,c.width,c.height);
  if(quad){ ctx.beginPath(); CORNERS.forEach((k,i)=>{ const p=quad[k]; if(i) ctx.lineTo(p.x*s,p.y*s); else ctx.moveTo(p.x*s,p.y*s); }); ctx.closePath(); ctx.lineWidth=2; ctx.strokeStyle='#a6ff3f'; ctx.stroke(); }
  return c.toDataURL('image/jpeg',0.8);
}
