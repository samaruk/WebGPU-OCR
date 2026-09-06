/* ======================================================================
   STAGE RENDERING
   Why: every gallery stage is drawn here, by one descriptor-driven routine,
   into an offscreen full-resolution canvas. Centralising it means the
   viewport and the gallery show identical pixels and every export is full
   size. Each `kind` in config.js maps to one block below.
   ====================================================================== */
import { S } from '../state/state.js';
import { STAGES } from '../config/config.js';
import { HF_KEPT, HF_TALL, HF_SMALL, HF_RULE, HF_SPLIT, HF_PARENT } from '../heightfilter/heightfilter.js';

/* ---- colour helpers --------------------------------------------------- */
export function hsl(h,s,l){
  s/=100;l/=100;
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
  let r,g,b;
  if(h<60){r=c;g=x;b=0;}else if(h<120){r=x;g=c;b=0;}
  else if(h<180){r=0;g=c;b=x;}else if(h<240){r=0;g=x;b=c;}
  else if(h<300){r=x;g=0;b=c;}else{r=c;g=0;b=x;}
  return [(r+m)*255|0,(g+m)*255|0,(b+m)*255|0];
}
export const labelColor=i=>hsl((i*137.508)%360,68,58);   // one distinct hue per index

/* ---- offscreen target -------------------------------------------------- */
export function getStageCanvas(){
  if(!S.stageCv || S.stageCv.width!==S.W || S.stageCv.height!==S.H){
    S.stageCv=document.createElement('canvas');
    S.stageCv.width=S.W; S.stageCv.height=S.H;
  }
  return S.stageCv;
}
export function renderStage(index){
  S.stage=index;
  renderStageInto(STAGES[index], getStageCanvas().getContext('2d'), S.W, S.H);
}

/* ---- small drawing helpers shared by the stage blocks ------------------ */
function makeTools(ctx,W,H,strokeW){
  const fontSize=Math.max(11,Math.round(Math.min(W,H)/90)), pad=fontSize*0.5;
  ctx.font=`600 ${fontSize}px "JetBrains Mono", monospace`; ctx.lineJoin='round';
  return {
    fontSize, pad, strokeW,
    darken(base,alpha){ if(base) ctx.drawImage(base,0,0); ctx.fillStyle=`rgba(8,11,12,${alpha})`; ctx.fillRect(0,0,W,H); },
    message(text){ ctx.fillStyle='rgba(230,240,235,.85)'; ctx.textAlign='center'; ctx.fillText(text,W/2,H/2); ctx.textAlign='left'; },
    badge(text){ const tw=ctx.measureText(text).width;
      ctx.fillStyle='rgba(8,11,12,.85)'; ctx.fillRect(pad,pad,tw+pad*1.6,fontSize+pad*1.2);
      ctx.fillStyle='rgba(220,235,240,.97)'; ctx.fillText(text,pad+pad*0.8,pad+fontSize*0.7+pad*0.1); },
    tag(x,y,text,color){ const tp=fontSize*0.3, tw=ctx.measureText(text).width; y=Math.max(fontSize,y);
      ctx.fillStyle='rgba(8,11,12,.85)'; ctx.fillRect(x,y-fontSize*0.6-tp,tw+tp*2,fontSize+tp*1.6);
      ctx.fillStyle=color; ctx.fillText(text,x+tp,y); },
    poly(points){ ctx.beginPath(); ctx.moveTo(points[0].x,points[0].y); for(let i=1;i<points.length;i++) ctx.lineTo(points[i].x,points[i].y); ctx.closePath(); },
    rect(b){ ctx.strokeRect(b.x0+.5,b.y0+.5,b.x1-b.x0+1,b.y1-b.y0+1); }
  };
}

/* 0/1 mask → dark-on-light raster */
function drawMask(ctx,mask,W,H){
  const img=ctx.createImageData(W,H), d=img.data;
  for(let i=0,j=0;i<W*H;i++,j+=4){ const v=mask[i]?22:244; d[j]=d[j+1]=d[j+2]=v; d[j+3]=255; }
  ctx.putImageData(img,0,0);
}

/* draw any stage descriptor into a W×H 2D context */
export function renderStageInto(stage,ctx,W,H){
  const strokeW=Math.max(1.4,Math.round(Math.min(W,H)/520));
  ctx.fillStyle='#0a0e0f'; ctx.fillRect(0,0,W,H);
  const kind=stage.kind;

  /* ---- source images ---------------------------------------------------- */
  if(kind==='source'){ if(S.origCanvas) ctx.drawImage(S.origCanvas,0,0); return; }
  if(kind==='lens'){ ctx.drawImage(S.lensCanvas||S.origCanvas,0,0); return; }
  if(kind==='rectified'){ ctx.drawImage(S.workCanvas||S.origCanvas,0,0); return; }

  const result = stage.pass==='BR' ? S.borders : stage.pass==='TL' ? S.textLines : stage.pass==='CL' ? S.columns
               : stage.pass==='CH' ? S.characters : S.recognition;
  const base = S.workCanvas || S.origCanvas;                 // every result lives in the working-image frame
  const T=makeTools(ctx,W,H,strokeW);
  if(!result){
    T.message(stage.pass==='BR' ? 'border stage disabled (section 02)'
            : stage.pass==='TL' ? 'text-line clean disabled (section 03)'
            : stage.pass==='CL' ? 'columns disabled (section 04) or text-line clean off'
            : stage.pass==='CH' ? 'characters disabled (section 05) or text-line clean off'
            : 'recognition disabled (section 06) or characters off');
    return;
  }
  if(stage.pass==='RC' && !result.available){ T.message('recognition unavailable: '+result.error); return; }
  ctx.textBaseline='middle';
  switch(kind){
    case 'border-binary':   drawMask(ctx, result.binary||result.rawBinary, W,H); break;
    case 'clean-binary':    drawMask(ctx, result.cleanBinary, W,H); break;
    case 'border-h-opened': drawMask(ctx, result.rules.debug.hOpened, W,H); break;
    case 'border-v-opened': drawMask(ctx, result.rules.debug.vOpened, W,H); break;
    case 'rules':           renderRules(result,ctx,W,H,base,T); break;
    case 'rules-erased':    if(result.cleanCanvas) ctx.drawImage(result.cleanCanvas,0,0);
                            else { T.darken(base,0); T.badge('erase is off (section 02) — original shown'); } break;
    case 'border-layout':   renderBorderLayout(result,ctx,W,H,base,T); break;
    case 'glyph-filter':    renderGlyphFilter(result,ctx,W,H,T); break;
    case 'text-lines':      renderTextLines(result,ctx,W,H,base,T); break;
    case 'full-lines':      renderFullLines(result,ctx,W,H,base,T); break;
    case 'row-bands': case 'coverage': case 'columns': case 'cells': case 'table':
                            renderColumns(kind,result,ctx,W,H,base,T); break;
    case 'characters':      renderCharacters(result,ctx,W,H,base,T); break;
    case 'char-splits':     renderSplits(result,ctx,W,H,base,T); break;
    case 'char-sheet':      renderContactSheet(result,ctx,W,H,T); break;
    case 'rec-characters':  renderRecognisedCharacters(result,ctx,W,H,base,T); break;
    case 'rec-lines':       renderLineText(result,ctx,W,H,base,T); break;
    case 'rec-table':       renderTableText(result,ctx,W,H,base,T); break;
  }
  ctx.textBaseline='alphabetic';
}

/* ======================================================================
   BORDERS · rules
   ====================================================================== */
function strokeRule(ctx,poly,fallback){
  ctx.beginPath();
  if(poly&&poly.length){ ctx.moveTo(poly[0].x+.5,poly[0].y+.5); for(let i=1;i<poly.length;i++) ctx.lineTo(poly[i].x+.5,poly[i].y+.5); }
  else { ctx.moveTo(fallback[0],fallback[1]); ctx.lineTo(fallback[2],fallback[3]); }
  ctx.stroke();
}
function renderRules(B,ctx,W,H,base,T){
  T.darken(base,0.45);
  ctx.lineCap='round';
  const dots=(poly,fill)=>{ if(!poly) return; ctx.fillStyle=fill; const r=Math.max(2.5,T.strokeW*1.4);
    for(const p of poly){ ctx.beginPath(); ctx.arc(p.x+.5,p.y+.5,r,0,Math.PI*2); ctx.fill(); } };
  for(const h of B.rules.hLines){
    ctx.lineWidth=h.isDashed?Math.max(1,T.strokeW*0.8):Math.max(2,T.strokeW*1.6);
    ctx.strokeStyle=h.isDashed?'rgba(110,200,255,.45)':'rgba(110,200,255,.95)';
    strokeRule(ctx,h.polyline,[h.x0,h.y+.5,h.x1,h.y+.5]);
    if(h.isDashed) dots(h.polyline,'rgba(110,200,255,.95)');
  }
  for(const v of B.rules.vLines){
    ctx.lineWidth=v.isDashed?Math.max(1,T.strokeW*0.8):Math.max(2,T.strokeW*1.6);
    ctx.strokeStyle=v.isDashed?'rgba(166,255,63,.45)':'rgba(166,255,63,.95)';
    strokeRule(ctx,v.polyline,[v.x+.5,v.y0,v.x+.5,v.y1]);
    if(v.isDashed) dots(v.polyline,'rgba(166,255,63,.95)');
  }
  ctx.textBaseline='alphabetic';
  T.badge('H: '+B.rules.hLines.length+'   V: '+B.rules.vLines.length+'   (dashed: '+B.rules.dashedHCount+' h, '+B.rules.dashedVCount+' v)');
}
function renderBorderLayout(B,ctx,W,H,base,T){
  T.darken(base,0.55); ctx.lineCap='round';
  const L=B.layout, fs=T.fontSize, sw=T.strokeW;
  for(const h of B.horizontalRules){ ctx.lineWidth=h.long?sw*1.2:sw*0.7; ctx.strokeStyle=h.long?'rgba(110,200,255,.55)':'rgba(110,200,255,.25)'; strokeRule(ctx,h.polyline,[h.x0,h.y,h.x1,h.y]); }
  for(const v of B.verticalRules){ ctx.lineWidth=v.long?sw*1.2:sw*0.7; ctx.strokeStyle=v.long?'rgba(166,255,63,.55)':'rgba(166,255,63,.25)'; strokeRule(ctx,v.polyline,[v.x,v.y0,v.x,v.y1]); }
  for(const s of L.sections){ ctx.lineWidth=sw*1.6; ctx.strokeStyle='rgba(255,170,70,.9)';
    ctx.beginPath(); ctx.moveTo(s.x0,s.y+.5); ctx.lineTo(s.x1,s.y+.5); ctx.stroke(); T.tag(s.x0+sw*2,s.y-fs,'SECTION','rgba(255,193,115,.97)'); }
  if(L.grid){ ctx.lineWidth=sw*1.8;
    for(const h of L.grid.hs){ ctx.strokeStyle='rgba(84,221,126,.95)'; strokeRule(ctx,h.polyline,[h.x0,h.y,h.x1,h.y]); }
    for(const v of L.grid.vs){ ctx.strokeStyle='rgba(110,220,255,.95)'; strokeRule(ctx,v.polyline,[v.x,v.y0,v.x,v.y1]); }
    ctx.fillStyle='rgba(255,220,120,.9)'; for(const q of L.grid.intersections){ ctx.beginPath(); ctx.arc(q.x,q.y,Math.max(2,sw*1.4),0,7); ctx.fill(); } }
  const box=(b,stroke,fill)=>{ ctx.beginPath(); ctx.rect(b.x0+.5,b.y0+.5,b.x1-b.x0,b.y1-b.y0); ctx.fillStyle=fill; ctx.fill(); ctx.lineWidth=sw*1.9; ctx.strokeStyle=stroke; ctx.stroke(); };
  if(L.table){ box(L.table,'rgba(84,221,126,.97)','rgba(84,221,126,.08)');
    T.tag(L.table.x0+sw*2,L.table.y0+fs,'TABLE FROM BORDERS · '+L.kind+(L.rowsY.length?' · '+Math.max(0,L.rowsY.length-1)+' row bands':'')+(L.colsX.length?' · '+Math.max(0,L.colsX.length-1)+' columns':''),'rgba(84,221,126,.98)'); }
  if(L.headerBox){ box(L.headerBox,'rgba(110,160,255,.95)','rgba(110,160,255,.14)');
    T.tag(L.headerBox.x0+sw*2,L.headerBox.y0-fs,'HEADER BOX · '+Math.max(0,L.colsX.length-1)+' columns','rgba(155,190,255,.97)');
    let yEnd=L.table?L.table.y1:H; for(const s of L.sections) if(s.y>L.headerBox.y1 && s.y<yEnd) yEnd=s.y;
    ctx.setLineDash([sw*4,sw*3]); ctx.lineWidth=sw*1.2; ctx.strokeStyle='rgba(110,220,255,.8)';
    for(const c of L.colsX){ ctx.beginPath(); ctx.moveTo(c.x+.5,L.headerBox.y1); ctx.lineTo(c.x+.5,yEnd); ctx.stroke(); }
    ctx.setLineDash([]); }
  if(L.kind==='row-rules'){ ctx.lineWidth=sw*1.4; ctx.strokeStyle='rgba(84,221,126,.8)';
    for(const r of L.rowsY){ ctx.beginPath(); ctx.moveTo(r.x0,r.y+.5); ctx.lineTo(r.x1,r.y+.5); ctx.stroke(); } }
  ctx.textBaseline='alphabetic';
  T.badge('rules: '+B.horizontalRules.length+' h / '+B.verticalRules.length+' v   long: '+B.longCounts.h+' h / '+B.longCounts.v+' v   layout: '+L.kind+'   sections: '+L.sections.length+'   erased: '+B.erasedPixels.toLocaleString()+' px');
}

/* ======================================================================
   TEXT LINES · clean
   ====================================================================== */
function renderGlyphFilter(TL,ctx,W,H,T){
  // raster colour per label status: kept green, split child cyan, too-tall
  // red, too-short grey, rule-shaped orange, dropped bridge rows dark grey
  const PAL={[HF_KEPT]:[84,221,126],[HF_SPLIT]:[110,220,255],[HF_TALL]:[255,93,108],
             [HF_SMALL]:[150,150,150],[HF_RULE]:[255,160,40],[HF_PARENT]:[70,70,70]};
  const STROKE={[HF_KEPT]:'rgba(84,221,126,.55)',[HF_SPLIT]:'rgba(110,220,255,.95)',[HF_TALL]:'rgba(255,93,108,.9)',
                [HF_SMALL]:'rgba(170,170,170,.6)',[HF_RULE]:'rgba(255,160,40,.9)',[HF_PARENT]:'rgba(255,255,255,.35)'};
  const hf=TL.heightFilter, status=hf.labelStatus, labelToComponent=TL.labelToComponent, labels=TL.labels;
  const img=ctx.createImageData(W,H), d=img.data;
  for(let i=0,j=0;i<W*H;i++,j+=4){
    const l=labels[i];
    if(l<0 || labelToComponent[l]<0){ d[j]=8;d[j+1]=12;d[j+2]=13; }
    else { const c=PAL[status[l]]||PAL[HF_KEPT]; d[j]=c[0];d[j+1]=c[1];d[j+2]=c[2]; }
    d[j+3]=255;
  }
  ctx.putImageData(img,0,0);
  ctx.lineWidth=T.strokeW;
  for(const it of hf.items){ if(it.status!==HF_PARENT) continue;           // parents first (dashed) so children draw on top
    ctx.setLineDash([T.strokeW*4,T.strokeW*3]); ctx.strokeStyle=STROKE[HF_PARENT]; T.rect(it.bb); }
  ctx.setLineDash([]);
  for(const it of hf.items){ if(it.status===HF_PARENT) continue; ctx.strokeStyle=STROKE[it.status]||STROKE[HF_KEPT]; T.rect(it.bb); }
  ctx.textBaseline='alphabetic';
  const lines=['reference h: '+Math.round(hf.reference)+' px   one glyph = ['+Math.round(hf.minHeight)+', '+Math.round(hf.maxHeight)+'] px',
               'kept: '+hf.kept+' / '+hf.total+'   split: '+hf.splitParents+' components → '+hf.splitChildren+' pieces (cyan)',
               'dropped: '+hf.small+' short (grey)   '+hf.tall+' multi-line, not cuttable (red)   '+hf.rule+' rule-shaped (orange)'];
  const lh=T.fontSize*1.35, boxW=Math.max(...lines.map(t=>ctx.measureText(t).width))+T.pad*2;
  ctx.fillStyle='rgba(8,11,12,.85)'; ctx.fillRect(T.pad,T.pad,boxW,lines.length*lh+T.pad*0.6);
  ctx.fillStyle='rgba(220,235,240,.97)'; lines.forEach((t,i)=>ctx.fillText(t,T.pad*1.4,T.pad+T.fontSize*0.8+i*lh));
}
function renderTextLines(TL,ctx,W,H,base,T){
  T.darken(base,0.55);
  let acceptedIndex=0, rejected=0, labelled=0;
  for(const chain of TL.chains){
    if(chain.accepted){
      const c=labelColor(acceptedIndex++), rgb=c[0]+','+c[1]+','+c[2];
      ctx.lineWidth=T.strokeW*0.7; ctx.strokeStyle=`rgba(${rgb},.55)`; ctx.fillStyle=`rgba(${rgb},.18)`;
      for(const m of chain.members){ const b=m.bb; ctx.fillRect(b.x0,b.y0,b.x1-b.x0+1,b.y1-b.y0+1); T.rect(b); }
      ctx.lineWidth=T.strokeW*1.3; ctx.strokeStyle=`rgba(${rgb},.95)`; T.rect(chain.bb);
    } else {
      rejected++;
      const b=chain.bb; ctx.lineWidth=T.strokeW; ctx.strokeStyle='rgba(255,93,108,.9)'; ctx.fillStyle='rgba(255,93,108,.10)';
      ctx.fillRect(b.x0,b.y0,b.x1-b.x0+1,b.y1-b.y0+1); T.rect(b);
      if(labelled<40){ labelled++; const tp=T.fontSize*0.3, tw=ctx.measureText(chain.reason).width;
        ctx.fillStyle='rgba(8,11,12,.85)'; ctx.fillRect(b.x1+tp,(b.y0+b.y1)/2-T.fontSize*0.6-tp,tw+tp*2,T.fontSize+tp*1.6);
        ctx.fillStyle='rgba(255,160,160,.97)'; ctx.fillText(chain.reason,b.x1+tp*2,(b.y0+b.y1)/2); }
    }
  }
  ctx.textBaseline='alphabetic';
  const s=TL.stats;
  T.badge('glyphs: '+s.glyphs+' / '+s.components+'   lines: '+s.accepted+' accepted, '+rejected+' rejected   reference glyph h: '+Math.round(s.reference)+' px');
}
function renderFullLines(TL,ctx,W,H,base,T){
  T.darken(base,0.55);
  const F=TL.fullLines, fs=T.fontSize, sw=T.strokeW;
  let words=0, pieces=0;
  F.rows.forEach((row,i)=>{
    ctx.lineWidth=sw*0.7; ctx.strokeStyle='rgba(110,200,255,.35)';
    for(const piece of row.lines) T.rect(piece.ink);
    words+=row.words; pieces+=row.lines.length;
    if(row.poly&&row.poly.length){ T.poly(row.poly);
      ctx.fillStyle=i%2?'rgba(84,221,126,.14)':'rgba(166,255,63,.12)'; ctx.fill();
      ctx.lineWidth=sw*1.4; ctx.strokeStyle='rgba(84,221,126,.95)'; ctx.stroke(); }
    if(row.centerline&&row.centerline.length){ const C=row.centerline;
      ctx.beginPath(); ctx.moveTo(C[0].x,C[0].y); for(let k=1;k<C.length;k++) ctx.lineTo(C[k].x,C[k].y);
      ctx.lineWidth=Math.max(1,sw*0.6); ctx.strokeStyle='rgba(255,255,255,.45)'; ctx.stroke(); }
    const first=row.lines[0].ink, text='R'+(i+1)+' · '+row.lines.length+'p · '+row.words+'w';
    const tw=ctx.measureText(text).width, tp=fs*0.3;
    T.tag(Math.max(0,first.x0-tw-tp*3),(first.y0+first.y1)/2,text,'rgba(166,255,63,.97)');
  });
  ctx.textBaseline='alphabetic';
  T.badge('full lines: '+F.rows.length+'   pieces: '+pieces+'   words: '+words+'   max line h: '+Math.round(F.maxHeight)+' px   page tilt: '+(Math.atan(F.slope)*180/Math.PI).toFixed(2)+'°');
}

/* ======================================================================
   CHARACTERS
   ====================================================================== */
const KIND_COLOR={single:'rgba(84,221,126,.95)', joined:'rgba(255,110,220,.95)', split:'rgba(110,220,255,.95)',
                  'engine-split':'rgba(255,220,120,.95)', 'engine-merged':'rgba(255,160,60,.95)', 'engine-resegmented':'rgba(255,220,120,.95)'};
function renderCharacters(CH,ctx,W,H,base,T){
  T.darken(base,0.55);
  ctx.lineWidth=T.strokeW;
  for(const ch of CH.characters){ ctx.strokeStyle=KIND_COLOR[ch.kind]||KIND_COLOR.single; T.rect(ch.bb); }
  for(const line of CH.lines){ const first=line.characters[0]; if(!first) continue;
    T.tag(Math.max(0,first.bb.x0-T.fontSize*4.5),(first.bb.y0+first.bb.y1)/2,'cw '+Math.round(line.charWidth)+'px','rgba(220,235,240,.9)'); }
  ctx.textBaseline='alphabetic';
  const s=CH.stats;
  T.badge('characters: '+s.characters+'   lines: '+s.lines+'   joined parts: '+s.joined+' (magenta)   merged components cut: '+s.split+' (cyan)'+(s.engineSplit!==undefined?'   reconciled with the engine: '+(s.engineResegmented||0)+' words re-segmented, '+s.engineSplit+' split (yellow), '+s.engineMerged+' merged (orange)':'')+'   in table cells: '+s.inCells);
}
function renderSplits(CH,ctx,W,H,base,T){
  T.darken(base,0.55);
  const sw=T.strokeW;
  for(const sp of CH.splits){
    const b=sp.bb, w=b.x1-b.x0+1, h=b.y1-b.y0+1, barH=Math.max(8,h*0.8);
    ctx.lineWidth=sw; ctx.strokeStyle='rgba(110,220,255,.9)'; T.rect(b);
    // profile under the component
    let peak=1; for(const v of sp.profile) if(v>peak) peak=v;
    ctx.fillStyle='rgba(8,11,12,.8)'; ctx.fillRect(b.x0,b.y1+2,w,barH+2);
    ctx.fillStyle='rgba(110,200,255,.9)';
    for(let i=0;i<w;i++){ const hh=sp.profile[i]/peak*barH; ctx.fillRect(b.x0+i,b.y1+2+barH-hh,1,hh); }
    const yMean=b.y1+2+barH-sp.mean/peak*barH;
    ctx.strokeStyle='rgba(255,220,120,.9)'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(b.x0,yMean+.5); ctx.lineTo(b.x1+1,yMean+.5); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle='rgba(255,93,108,.95)'; ctx.lineWidth=Math.max(1,sw);
    for(const cx of sp.cuts){ ctx.beginPath(); ctx.moveTo(cx+.5,b.y0); ctx.lineTo(cx+.5,b.y1+2+barH); ctx.stroke(); }
  }
  ctx.textBaseline='alphabetic';
  T.badge('merged components cut: '+CH.splits.length+'   pieces: '+CH.splits.reduce((n,s)=>n+s.pieces,0));
}
function renderContactSheet(CH,ctx,W,H,T){
  const ink=S.textLines.cleanBinary, labels=S.textLines.labels;
  const cell=Math.max(24,Math.min(64,Math.round(W/60))), perRow=Math.max(1,Math.floor(W/cell));
  let col=0, row=0;
  const place=()=>{ const x=col*cell, y=row*cell; col++; if(col>=perRow){ col=0; row++; } return {x,y}; };
  for(const line of CH.lines){
    if(col>0){ col=0; row++; }                     // new sheet row per text line
    for(const ch of line.characters){
      const {x,y}=place(); if(y+cell>H) break;
      ctx.fillStyle='#f2f2ee'; ctx.fillRect(x+1,y+1,cell-2,cell-2);
      const b=ch.bb, bw=b.x1-b.x0+1, bh=b.y1-b.y0+1, s=Math.min((cell-6)/bw,(cell-6)/bh);
      const ox=x+3+((cell-6)-bw*s)/2, oy=y+3+((cell-6)-bh*s)/2;
      const members=new Set(ch.members.map(m=>m.label));
      ctx.fillStyle='#111';
      for(let yy=b.y0;yy<=b.y1;yy++) for(let xx=b.x0;xx<=b.x1;xx++){ const i=yy*W+xx; if(ink[i] && members.has(labels[i])) ctx.fillRect(ox+(xx-b.x0)*s,oy+(yy-b.y0)*s,Math.max(1,s),Math.max(1,s)); }
      ctx.lineWidth=1.5; ctx.strokeStyle=KIND_COLOR[ch.kind]||KIND_COLOR.single; ctx.strokeRect(x+1.5,y+1.5,cell-3,cell-3);
    }
  }
  ctx.textBaseline='alphabetic';
  T.badge('contact sheet: '+CH.characters.length+' characters, one sheet row per text line');
}

/* ======================================================================
   RECOGNITION
   ====================================================================== */
const confidenceColor=c=>c>=80?'rgba(84,221,126,.97)':c>=50?'rgba(255,190,60,.97)':'rgba(255,93,108,.97)';
function renderRecognisedCharacters(RC,ctx,W,H,base,T){
  T.darken(base,0.6);
  const CH=S.characters; if(!CH) return;
  ctx.lineWidth=T.strokeW*0.7;
  for(const ch of CH.characters){
    const b=ch.bb, h=b.y1-b.y0+1;
    if(ch.text){ const col=confidenceColor(ch.confidence);
      ctx.strokeStyle=col; T.rect(b);
      ctx.font=`700 ${Math.max(8,Math.round(h*0.9))}px "JetBrains Mono", monospace`; ctx.fillStyle=col; ctx.textAlign='center';
      ctx.fillText(ch.text,(b.x0+b.x1)/2,(b.y0+b.y1)/2); ctx.textAlign='left'; }
    else { ctx.strokeStyle='rgba(170,170,170,.6)'; T.rect(b); }
  }
  ctx.font=`600 ${T.fontSize}px "JetBrains Mono", monospace`; ctx.textBaseline='alphabetic';
  T.badge('recognised: '+RC.recognised+' / '+RC.characters+' characters   language: '+RC.language+'   grayscale crops, no dictionary, upscale ×'+RC.scale+'   green ≥ 80, amber ≥ 50, red < 50 confidence');
}
function renderLineText(RC,ctx,W,H,base,T){
  T.darken(base,0.65);
  const rows=S.textLines.fullLines.rows, glyph=S.textLines.stats.reference||20;
  const rowOf=res=>res.rowIndex>=0?rows[res.rowIndex]:null;
  // every recognised WORD is drawn inside the engine's own box for it —
  // same place and same size as the original word, squeezed to the box
  // width — so the overlay reads against the source glyph by glyph
  // the engine's word box sometimes spans the whole line (ascender to
  // descender); cap the font by the glyph height so the overlay never
  // grows past the original text
  const drawFitted=(text,b,color)=>{ const h=b.y1-b.y0, w=b.x1-b.x0; if(h<3||w<2) return;
    ctx.font=`600 ${Math.max(6,Math.round(Math.min(h,1.15*glyph)*0.95))}px "JetBrains Mono", monospace`;
    ctx.fillStyle='rgba(8,11,12,.55)'; ctx.fillRect(b.x0,b.y0,w,h);
    ctx.fillStyle=color; ctx.fillText(text,b.x0,(b.y0+b.y1)/2,w); };
  let words=0;
  for(const res of RC.lines){ const row=rowOf(res);
    if(row&&row.poly&&row.poly.length){ T.poly(row.poly); ctx.lineWidth=T.strokeW*0.7; ctx.strokeStyle='rgba(110,200,255,.35)'; ctx.stroke(); }
    if(res.words&&res.words.length){ for(const wd of res.words){ drawFitted(wd.text,wd.bb,confidenceColor(wd.confidence)); words++; } }
    else if(res.text && row){ const first=row.lines[0].ink;                // no word boxes: fall back to the line string at the row start
      ctx.font=`600 ${Math.max(9,Math.round(glyph*0.85))}px "JetBrains Mono", monospace`; ctx.fillStyle=confidenceColor(res.confidence);
      ctx.fillText(res.text, first.x0, (first.y0+first.y1)/2); }
  }
  ctx.font=`600 ${T.fontSize}px "JetBrains Mono", monospace`; ctx.textBaseline='alphabetic';
  const mean=RC.lines.length?RC.lines.reduce((s,l)=>s+l.confidence,0)/RC.lines.length:0;
  T.badge('lines recognised: '+RC.lines.length+(RC.loosePieces?' (incl. '+RC.loosePieces+' loose pieces)':'')+'   words placed: '+words+'   mean line confidence: '+mean.toFixed(1)+'   whole page; each word drawn in its own box, at the original size');
}
function renderTableText(RC,ctx,W,H,base,T){
  T.darken(base,0.65);
  const C=S.columns;
  if(!RC.cells || !C || !C.band){ ctx.textBaseline='alphabetic'; return T.message('no table to fill'); }
  C.band.rows.forEach((r,ri)=>{ C.columns.forEach((c,ci)=>{
    const cell=C.cells[ri][ci]; const text=RC.cells[ri][ci]; if(!cell) return;
    const b=cell.bb, h=b.y1-b.y0+1;
    ctx.lineWidth=T.strokeW*0.7; ctx.strokeStyle='rgba(110,200,255,.5)'; T.rect(b);
    ctx.font=`700 ${Math.max(9,Math.round(h*0.85))}px "JetBrains Mono", monospace`; ctx.fillStyle='rgba(166,255,63,.97)';
    ctx.fillText(text, b.x0, (b.y0+b.y1)/2);
  }); });
  ctx.font=`600 ${T.fontSize}px "JetBrains Mono", monospace`; ctx.textBaseline='alphabetic';
  T.badge('table text: '+C.band.rows.length+' rows × '+C.columns.length+' columns');
}

/* ======================================================================
   COLUMNS
   ====================================================================== */
function renderColumns(kind,C,ctx,W,H,base,T){
  T.darken(base,0.55);
  const fs=T.fontSize, sw=T.strokeW;
  const quad=(xa,xb,ya,yb)=>[C.toImage(xa,ya),C.toImage(xb,ya),C.toImage(xb,yb),C.toImage(xa,yb)];   // slanted quad in de-skewed coords
  const rowColor={table:['rgba(84,221,126,.95)','rgba(84,221,126,.12)'], header:['rgba(110,160,255,.9)','rgba(110,160,255,.12)'],
                  footer:['rgba(255,170,70,.9)','rgba(255,170,70,.12)'], other:['rgba(150,165,170,.6)','rgba(150,165,170,.08)']};
  const tilt=(Math.atan(C.slope)*180/Math.PI).toFixed(2)+'° rows, '+(Math.atan(C.columnSlope)*180/Math.PI).toFixed(2)+'° columns';
  const finish=text=>{ ctx.textBaseline='alphabetic'; T.badge(text); };

  if(kind==='row-bands'){
    C.rows.forEach((r,i)=>{ const P=r.row.poly; if(!P||!P.length) return;
      const [stroke,fill]=rowColor[r.kind]||rowColor.other;
      T.poly(P); ctx.fillStyle=fill; ctx.fill(); ctx.lineWidth=sw; ctx.strokeStyle=stroke; ctx.stroke();
      const f=r.row.lines[0].ink;
      T.tag(Math.max(0,f.x0-fs*4.2),(f.y0+f.y1)/2,(r.kind==='table'?'T':r.kind==='header'?'H':'F')+(i+1)+'·'+r.pieces+'p',stroke); });
    if(!C.band) return finish('no table band — '+C.reason);
    return finish('table band: rows '+(C.band.first+1)+'–'+(C.band.last+1)+' ('+C.band.rows.length+', '+C.band.parts+(C.band.parts>1?' parts merged':' part')+(C.band.fromBorders?', border box folded in':'')+(C.band.foreignRows?', '+C.band.foreignRows+' foreign rows dropped':'')+(C.band.footerCut?', footer cut by '+C.band.footerCut:'')+')   header rows: '+C.band.first+'   footer rows: '+(C.rows.length-1-C.band.last)+'   page tilt: '+tilt);
  }
  if(!C.band){ ctx.textBaseline='alphabetic'; return T.message('no table band — '+C.reason); }
  const B=C.band, P=C.profile;

  if(kind==='coverage'){
    for(const g of C.gutters){ T.poly(quad(g.x0,g.x1+1,B.yTop,B.yBottom));
      ctx.fillStyle=g.relative?'rgba(255,190,60,.20)':'rgba(255,93,108,.18)'; ctx.fill();
      ctx.lineWidth=sw*0.8; ctx.strokeStyle=g.relative?'rgba(255,190,60,.85)':'rgba(255,93,108,.8)'; ctx.stroke(); }
    const barH=Math.max(30,Math.min(H*0.12,160)), yBase=Math.min(H-2, C.toImage(P.X0,B.yBottom).y+barH+fs);
    ctx.fillStyle='rgba(8,11,12,.7)'; ctx.fillRect(0,yBase-barH-fs*0.4,W,barH+fs*0.8);
    for(let i=0;i<P.X1-P.X0+1;i++){ const v=P.coverage[i]; if(!v) continue;
      const x=C.toImage(P.X0+i,B.yBottom).x, h=v/P.rowCount*barH;
      ctx.fillStyle = v<=P.clearMax ? 'rgba(255,93,108,.9)' : 'rgba(110,200,255,.85)';
      ctx.fillRect(x,yBase-h,1,h); }
    const yThr=yBase-(P.clearMax/P.rowCount)*barH;
    ctx.strokeStyle='rgba(255,220,120,.9)'; ctx.lineWidth=1; ctx.setLineDash([sw*3,sw*3]);
    ctx.beginPath(); ctx.moveTo(0,yThr+.5); ctx.lineTo(W,yThr+.5); ctx.stroke(); ctx.setLineDash([]);
    return finish('band rows: '+P.rowCount+'   gutters: '+C.gutters.length+' ('+C.gutters.filter(g=>!g.relative).length+' clear, '+C.gutters.filter(g=>g.relative).length+' deep valleys; min width '+Math.round(P.minWidth)+' px, clear ≤ '+P.clearMax.toFixed(1)+' rows, valley ≤ 42 % of its peaks)   glyph h: '+Math.round(C.glyphHeight)+' px');
  }
  if(kind==='columns'){
    for(const g of C.gutters){ T.poly(quad(g.x0,g.x1+1,B.yTop,B.yBottom)); ctx.setLineDash([sw*3,sw*3]);
      ctx.lineWidth=sw*0.7; ctx.strokeStyle='rgba(255,93,108,.6)'; ctx.stroke(); ctx.setLineDash([]); }
    C.columns.forEach((c,i)=>{ T.poly(quad(c.x0,c.x1,B.yTop,B.yBottom));
      ctx.fillStyle=i%2?'rgba(110,200,255,.15)':'rgba(166,255,63,.12)'; ctx.fill();
      ctx.lineWidth=sw; ctx.strokeStyle='rgba(110,200,255,.9)'; ctx.stroke();
      const q=C.toImage((c.x0+c.x1)/2,B.yTop);
      T.tag(q.x-fs*1.5,q.y-fs*0.9,'C'+(i+1)+' '+c.align+' '+c.cells+'c','rgba(120,205,255,.97)'); });
    return finish('columns: '+C.columns.length+'   gutters: '+C.gutters.length+(C.guttersFromBorders?' ('+C.guttersFromBorders+' from borders)':'')+'   pieces split across columns: '+C.spanningPieces);
  }
  if(kind==='cells'){
    let filled=0, empty=0;
    B.rows.forEach((r,ri)=>{ C.columns.forEach((c,ci)=>{
      const cell=C.cells[ri][ci];
      if(cell){ filled++; const b=cell.bb, col=labelColor(ci);
        ctx.fillStyle=`rgba(${col[0]},${col[1]},${col[2]},.22)`; ctx.fillRect(b.x0,b.y0,b.x1-b.x0+1,b.y1-b.y0+1);
        ctx.lineWidth=sw; ctx.strokeStyle=`rgba(${col[0]},${col[1]},${col[2]},.95)`; T.rect(b); }
      else { empty++; T.poly(quad(c.x0,c.x1,r.row.dy.y0,r.row.dy.y1)); ctx.setLineDash([sw*2,sw*2]);
        ctx.lineWidth=sw*0.6; ctx.strokeStyle='rgba(170,170,170,.45)'; ctx.stroke(); ctx.setLineDash([]); }
    }); });
    return finish('grid: '+B.rows.length+' rows × '+C.columns.length+' columns   filled cells: '+filled+'   empty: '+empty+(B.rescuedPieces||B.mergedRows?'   rescued: '+(B.rescuedPieces||0)+' pieces, '+(B.mergedRows||0)+' thin rows merged':''));
  }
  if(kind==='table'){
    const header=C.rows.filter(r=>r.kind==='header'), footer=C.rows.filter(r=>r.kind==='footer');
    const region=(rs,stroke,fill,label)=>{ if(!rs.length) return;
      let x0=1/0,x1=-1/0; for(const r of rs) for(const piece of r.row.lines){ const cy=(piece.ink.y0+piece.ink.y1)/2;
        x0=Math.min(x0,C.toDeskewedX(piece.ink.x0,cy)); x1=Math.max(x1,C.toDeskewedX(piece.ink.x1+1,cy)); }
      const ya=Math.min(...rs.map(r=>r.row.dy.y0)), yb=Math.max(...rs.map(r=>r.row.dy.y1));
      T.poly(quad(x0,x1,ya,yb)); ctx.fillStyle=fill; ctx.fill(); ctx.lineWidth=sw; ctx.strokeStyle=stroke; ctx.stroke();
      const q=C.toImage(x0,ya); T.tag(q.x+sw*2,q.y+fs,label,stroke); };
    region(header,'rgba(110,160,255,.8)','rgba(110,160,255,.12)','HEADER · '+header.length+' rows');
    region(footer,'rgba(255,170,70,.8)','rgba(255,170,70,.12)','FOOTER · '+footer.length+' rows');
    const tx0=Math.min(...C.columns.map(c=>c.x0)), tx1=Math.max(...C.columns.map(c=>c.x1));
    T.poly(quad(tx0,tx1,B.yTop,B.yBottom)); ctx.fillStyle='rgba(84,221,126,.08)'; ctx.fill();
    ctx.lineWidth=sw*0.8; ctx.strokeStyle='rgba(166,255,63,.6)';
    for(const g of C.gutters){ const xm=(g.x0+g.x1+1)/2, a=C.toImage(xm,B.yTop), b=C.toImage(xm,B.yBottom);
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
    ctx.strokeStyle='rgba(84,221,126,.5)';
    for(let i=1;i<B.rows.length;i++){ const ym=(B.rows[i-1].row.dy.y1+B.rows[i].row.dy.y0)/2;
      const a=C.toImage(tx0,ym), b=C.toImage(tx1,ym); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }
    ctx.lineWidth=sw*1.9; ctx.strokeStyle='rgba(84,221,126,.97)'; T.poly(quad(tx0,tx1,B.yTop,B.yBottom)); ctx.stroke();
    const q=C.toImage(tx0,B.yTop); T.tag(q.x+sw*2,q.y+fs,'TABLE · '+B.rows.length+'R × '+C.columns.length+'C','rgba(84,221,126,.98)');
    return finish('table: '+B.rows.length+' rows × '+C.columns.length+' columns   header: '+header.length+'   footer: '+footer.length+'   tilt: '+tilt);
  }
}
