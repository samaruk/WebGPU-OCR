/* ======================================================================
   LENS DISTORTION CORRECTION  ·  the first geometric step
   Why: a phone lens bends straight lines into arcs (barrel / pincushion),
   the bow growing toward the frame edge. This is baked in at capture,
   underneath perspective and rotation, so it must be undone FIRST — the
   perspective stage detects the page as a straight-edged quad, and lens
   bowing makes those edges curve, corrupting the corner fit.

   Self-calibration trick: a flat sheet has four straight edges, and
   perspective projection keeps straight lines straight — so any *bowing*
   of the detected page edges is lens distortion and nothing else. The
   stage extracts the page-edge boundary points, then searches for the
   single radial coefficient k1 that, applied as an undistortion, makes
   all the edges straightest (the classic plumb-line method).

   Auto-gated for the "not every photo bows" case: it bails unless the
   edges visibly bow AND one global k1 substantially straightens them —
   a clean capture is passed straight through untouched. k1 only (no k2):
   one parameter captures barrel/pincushion without overfitting from just
   a handful of edges. Self-contained: Canvas2D + JS, sole import `cca`.
   ====================================================================== */
import { cca } from '../cca/cca.js';

/* Otsu's method — the gray level that best splits page from background. */
function otsu(g,n){
  const hist=new Int32Array(256);
  for(let i=0;i<n;i++) hist[g[i]]++;
  let sum=0; for(let i=0;i<256;i++) sum+=i*hist[i];
  let sumB=0,wB=0,best=-1,thr=127;
  for(let t=0;t<256;t++){
    wB+=hist[t]; if(!wB) continue;
    const wF=n-wB; if(!wF) break;
    sumB+=t*hist[t];
    const d=sumB/wB-(sum-sumB)/wF, v=wB*wF*d*d;
    if(v>best){ best=v; thr=t; }
  }
  return thr;
}

/* Total-least-squares line fit (PCA) — works for near-horizontal and
   near-vertical edges alike. Returns the centroid and unit direction. */
function fitLine(pts){
  const n=pts.length; let mx=0,my=0;
  for(const p of pts){ mx+=p.x; my+=p.y; } mx/=n; my/=n;
  let sxx=0,sxy=0,syy=0;
  for(const p of pts){ const dx=p.x-mx,dy=p.y-my; sxx+=dx*dx; sxy+=dx*dy; syy+=dy*dy; }
  sxx/=n; sxy/=n; syy/=n;
  const tr=sxx+syy, det=sxx*syy-sxy*sxy;
  const l1=tr/2+Math.sqrt(Math.max(0,tr*tr/4-det));   // larger eigenvalue
  let vx,vy;
  if(Math.abs(sxy)>1e-9){ vx=l1-syy; vy=sxy; }
  else { vx=sxx>=syy?1:0; vy=sxx>=syy?0:1; }
  const vn=Math.hypot(vx,vy)||1;
  return {mx,my,vx:vx/vn,vy:vy/vn};
}
/* signed perpendicular distance of each point from a fitted line */
function perpResiduals(pts,L){
  const nx=-L.vy, ny=L.vx;
  return pts.map(p=>(p.x-L.mx)*nx+(p.y-L.my)*ny);
}
/* drop detection-noise outliers, then keep the cleaned point set */
function robustClean(pts){
  if(pts.length<8) return pts;
  const L=fitLine(pts), res=perpResiduals(pts,L);
  let s=0; for(const r of res) s+=r*r;
  const rms=Math.sqrt(s/res.length);
  const keep=pts.filter((p,i)=>Math.abs(res[i])<2.5*rms+0.75);
  return keep.length>=8?keep:pts;
}

/* Map a distorted point to its undistorted position, for radial
   coefficient k. The model is corrected->distorted r_d = r_c·(1+k·r_c²),
   so undistortion inverts it by a few fixed-point iterations. */
function undistort(x,y,k,cx,cy,norm){
  const xn=(x-cx)/norm, yn=(y-cy)/norm;
  const rd=Math.hypot(xn,yn);
  if(rd<1e-6) return {x,y};
  let rc=rd;
  for(let i=0;i<10;i++) rc=rd/(1+k*rc*rc);
  const s=rc/rd;
  return {x:cx+xn*s*norm, y:cy+yn*s*norm};
}
/* straightness cost of k: mean RMS edge residual after undistortion */
function cost(edges,k,cx,cy,norm){
  let total=0,cnt=0;
  for(const e of edges){
    const u=e.map(p=>undistort(p.x,p.y,k,cx,cy,norm));
    const res=perpResiduals(u,fitLine(u));
    let s=0; for(const r of res) s+=r*r;
    total+=Math.sqrt(s/res.length); cnt++;
  }
  return cnt?total/cnt:1e9;
}

/* topmost / bottommost page pixel per column across a span */
function vEdge(labels,w,h,L,x0,x1,top){
  const pts=[];
  for(let x=Math.round(x0);x<=Math.round(x1);x++){
    if(x<0||x>=w) continue;
    if(top){ for(let y=0;y<h;y++)   if(labels[y*w+x]===L){ pts.push({x,y}); break; } }
    else   { for(let y=h-1;y>=0;y--)if(labels[y*w+x]===L){ pts.push({x,y}); break; } }
  }
  return pts;
}
/* leftmost / rightmost page pixel per row across a span */
function hEdge(labels,w,h,L,y0,y1,left){
  const pts=[];
  for(let y=Math.round(y0);y<=Math.round(y1);y++){
    if(y<0||y>=h) continue;
    if(left){ for(let x=0;x<w;x++)   if(labels[y*w+x]===L){ pts.push({x,y}); break; } }
    else    { for(let x=w-1;x>=0;x--)if(labels[y*w+x]===L){ pts.push({x,y}); break; } }
  }
  return pts;
}

/* Correct radial lens distortion. Returns a new W×H canvas, or null when
   no confident edge bowing is found (caller keeps the original image). */
export function correctLensDistortion(canvas){
  const CW=canvas.width, CH=canvas.height;
  if(CW<64||CH<64) return null;

  // --- detect the page region on a downscaled copy ---
  const sc=Math.min(1, 1100/Math.max(CW,CH));
  const w=Math.max(48,Math.round(CW*sc)), h=Math.max(48,Math.round(CH*sc)), N=w*h;
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const cx2=c.getContext('2d',{willReadFrequently:true});
  cx2.fillStyle='#fff'; cx2.fillRect(0,0,w,h);
  cx2.drawImage(canvas,0,0,w,h);
  const px=cx2.getImageData(0,0,w,h).data;
  const g=new Uint8Array(N);
  for(let i=0,j=0;i<N;i++,j+=4) g[i]=(0.299*px[j]+0.587*px[j+1]+0.114*px[j+2])|0;
  const thr=otsu(g,N);
  let bright=0,dark=0;
  for(let y=(h*0.35)|0;y<(h*0.65)|0;y++)
    for(let x=(w*0.35)|0;x<(w*0.65)|0;x++) (g[y*w+x]>thr?bright++:dark++);
  const pageBright=bright>=dark;
  const mask=new Uint8Array(N);
  for(let i=0;i<N;i++) mask[i]=((g[i]>thr)===pageBright)?1:0;
  const cc=cca(mask,w,h,true);
  if(!cc.count) return null;
  const cxh=w>>1, cyh=h>>1;
  let L=-1,bestA=-1;
  for(let l=0;l<cc.count;l++){
    const hit=cc.bx0[l]<=cxh&&cc.bx1[l]>=cxh&&cc.by0[l]<=cyh&&cc.by1[l]>=cyh;
    if(hit && cc.area[l]>bestA){ bestA=cc.area[l]; L=l; }
  }
  if(L<0 || bestA<N*0.40) return null;

  // page corners (extreme points along the two diagonals)
  let sMin=1/0,sMax=-1/0,dMin=1/0,dMax=-1/0, tl,br,tr,bl;
  for(let y=0,i=0;y<h;y++) for(let x=0;x<w;x++,i++){
    if(cc.labels[i]!==L) continue;
    const s=x+y, d=x-y;
    if(s<sMin){sMin=s; tl={x,y};}
    if(s>sMax){sMax=s; br={x,y};}
    if(d>dMax){dMax=d; tr={x,y};}
    if(d<dMin){dMin=d; bl={x,y};}
  }
  if(!tl||!tr||!br||!bl) return null;

  // --- four page-edge point sets (central 70% of each side, cleaned) ---
  const inset=(a,b)=>[a+0.15*(b-a), b-0.15*(b-a)];
  const [txa,txb]=inset(Math.min(tl.x,tr.x),Math.max(tl.x,tr.x));
  const [bxa,bxb]=inset(Math.min(bl.x,br.x),Math.max(bl.x,br.x));
  const [lya,lyb]=inset(Math.min(tl.y,bl.y),Math.max(tl.y,bl.y));
  const [rya,ryb]=inset(Math.min(tr.y,br.y),Math.max(tr.y,br.y));
  const raw=[ vEdge(cc.labels,w,h,L,txa,txb,true),
              vEdge(cc.labels,w,h,L,bxa,bxb,false),
              hEdge(cc.labels,w,h,L,lya,lyb,true),
              hEdge(cc.labels,w,h,L,rya,ryb,false) ];
  const edges=raw.map(robustClean).filter(e=>e.length>=8);
  if(edges.length<2) return null;                  // need straight references

  // --- gate 1: are the edges actually bowed? ---
  const dcx=w/2, dcy=h/2, dnorm=0.5*Math.hypot(w,h);
  let maxBow=0;
  for(const e of edges){
    const res=perpResiduals(e,fitLine(e));
    let m=0; for(const r of res) m=Math.max(m,Math.abs(r));
    const len=Math.hypot(e[0].x-e[e.length-1].x, e[0].y-e[e.length-1].y);
    maxBow=Math.max(maxBow, m/Math.max(1,len));
  }
  if(maxBow<0.006) return null;                    // edges already straight

  // --- search the radial coefficient that straightens every edge ---
  const c0=cost(edges,0,dcx,dcy,dnorm);
  let bestK=0,bestC=c0;
  for(let k=-0.35;k<=0.3501;k+=0.01){
    const cc2=cost(edges,k,dcx,dcy,dnorm);
    if(cc2<bestC){ bestC=cc2; bestK=k; }
  }
  for(let k=bestK-0.01;k<=bestK+0.0101;k+=0.001){
    const cc2=cost(edges,k,dcx,dcy,dnorm);
    if(cc2<bestC){ bestC=cc2; bestK=k; }
  }
  // --- gate 2: a single k must genuinely (and not absurdly) straighten ---
  if(Math.abs(bestK)<0.012) return null;           // negligible distortion
  if(Math.abs(bestK)>0.34)  return null;           // hit the search bound
  if(bestC>0.55*c0)         return null;           // one k didn't straighten all edges

  // --- warp the full image with the recovered coefficient ---
  const cx=CW/2, cy=CH/2, norm=0.5*Math.hypot(CW,CH);
  const sd=canvas.getContext('2d').getImageData(0,0,CW,CH).data;
  const out=document.createElement('canvas'); out.width=CW; out.height=CH;
  const octx=out.getContext('2d',{willReadFrequently:true});
  const oImg=octx.createImageData(CW,CH), od=oImg.data;
  for(let i=0;i<od.length;i+=4){ od[i]=od[i+1]=od[i+2]=255; od[i+3]=255; }
  for(let y=0;y<CH;y++){
    for(let x=0;x<CW;x++){
      const xn=(x-cx)/norm, yn=(y-cy)/norm;        // corrected (output) coord
      const f=1+bestK*(xn*xn+yn*yn);
      const sx=cx+xn*f*norm, sy=cy+yn*f*norm;      // -> distorted source coord
      if(sx<0||sy<0||sx>=CW-1||sy>=CH-1) continue;
      const x0=sx|0, y0=sy|0, fx=sx-x0, fy=sy-y0;
      const i00=(y0*CW+x0)*4, i10=i00+4, i01=i00+CW*4, i11=i01+4, o=(y*CW+x)*4;
      for(let kk=0;kk<3;kk++){
        const a=sd[i00+kk]+(sd[i10+kk]-sd[i00+kk])*fx;
        const b=sd[i01+kk]+(sd[i11+kk]-sd[i01+kk])*fx;
        od[o+kk]=(a+(b-a)*fy)|0;
      }
    }
  }
  octx.putImageData(oImg,0,0);
  return out;
}
