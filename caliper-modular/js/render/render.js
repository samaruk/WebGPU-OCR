/* ======================================================================
   STAGE RENDERING
   Why: every gallery stage is drawn here, by one descriptor-driven routine,
   into an offscreen full-resolution canvas. Centralising it means the
   viewport and the gallery show identical pixels and every export is full
   size. Each `kind` in config.js maps to one block below.
   ====================================================================== */
import { S } from '../state/state.js';
import { STAGES } from '../config/config.js';
import { apiEngineList } from '../api/api.js';
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
  if(kind==='source'){ if(S.rawCanvas||S.origCanvas) ctx.drawImage(S.rawCanvas||S.origCanvas,0,0); return; }
  if(kind==='watermark'){ if(S.origCanvas) ctx.drawImage(S.origCanvas,0,0);
    const T0=makeTools(ctx,W,H,strokeW);
    T0.badge(S.watermark ? 'watermark removed · '+S.watermark.watermarkPixels.toLocaleString()+' px returned to paper · contrast ≤ '+S.watermark.contrast.toFixed(2)+' · '+Math.round(S.watermark.ms)+' ms'
                         : 'watermark not removed — identical to the source (button in section 00)');
    return; }
  if(kind==='lens'){ ctx.drawImage(S.lensCanvas||S.origCanvas,0,0); return; }
  if(kind==='rectified'){ ctx.drawImage(S.workCanvas||S.origCanvas,0,0); return; }

  const result = stage.pass==='BR' ? S.borders : stage.pass==='TL' ? S.textLines : stage.pass==='CL' ? S.columns
               : stage.pass==='CH' ? S.characters : stage.pass==='AP' ? S.api : stage.pass==='FN' ? S.final : S.recognition;
  const base = S.workCanvas || S.origCanvas;                 // every result lives in the working-image frame
  const T=makeTools(ctx,W,H,strokeW);
  if(!result){
    T.message(stage.pass==='AP' ? 'OCR API disabled (section 00c)'
            : stage.pass==='FN' ? 'final needs a run'
            : stage.pass==='BR' ? 'border stage disabled (section 02)'
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
    case 'api-ocr':         renderApi(result,ctx,W,H,base,T); break;
    case 'api-engine':      renderApiEngine(result,stage.engine,ctx,W,H,base,T); break;
    case 'final-compare':   renderFinalCompare(result,ctx,W,H,base,T); break;
    case 'final-table':     renderFinalTable(result,ctx,W,H,base,T); break;
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
    T.tag(L.table.x0+sw*2,L.table.y0+fs,'TABLE FROM BORDERS · '+L.kind+(L.rowsY.length?' · '+(L.rowRuled?L.rowsY.length+' ruled rows (pitch '+Math.round(L.rowPitch)+' px)':Math.max(0,L.rowsY.length-1)+' row bands'):'')+(L.colsX.length?' · '+Math.max(0,L.colsX.length-1)+' columns':''),'rgba(84,221,126,.98)'); }
  if(L.headerBox){ box(L.headerBox,'rgba(110,160,255,.95)','rgba(110,160,255,.14)');
    T.tag(L.headerBox.x0+sw*2,L.headerBox.y0-fs,'HEADER BOX · '+Math.max(0,L.colsX.length-1)+' columns','rgba(155,190,255,.97)');
    let yEnd=L.table?L.table.y1:H; for(const s of L.sections) if(s.y>L.headerBox.y1 && s.y<yEnd) yEnd=s.y;
    ctx.setLineDash([sw*4,sw*3]); ctx.lineWidth=sw*1.2; ctx.strokeStyle='rgba(110,220,255,.8)';
    for(const c of L.colsX){ ctx.beginPath(); ctx.moveTo(c.x+.5,L.headerBox.y1); ctx.lineTo(c.x+.5,yEnd); ctx.stroke(); }
    ctx.setLineDash([]); }
  if(L.kind==='row-rules'){ ctx.lineWidth=sw*1.4; ctx.strokeStyle='rgba(84,221,126,.8)';
    for(const r of L.rowsY){ ctx.beginPath(); ctx.moveTo(r.x0,r.y+.5); ctx.lineTo(r.x1,r.y+.5); ctx.stroke(); }
    if(L.rowRuled){ ctx.fillStyle='rgba(84,221,126,.07)';                  // the row bands between the rules
      for(let i=1;i<L.rowsY.length;i+=2){ const a=L.rowsY[i-1], b=L.rowsY[i]; ctx.fillRect(Math.min(a.x0,b.x0),a.y+1,Math.max(a.x1,b.x1)-Math.min(a.x0,b.x0),b.y-a.y-1); } } }
  if(L.box){ box(L.box,'rgba(110,160,255,.95)','rgba(110,160,255,.10)');
    T.tag(L.box.x0+sw*2,L.box.y0-fs,'BOXED BLOCK - not the table','rgba(155,190,255,.97)'); }
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
  T.badge('recognised: '+RC.recognised+' / '+RC.characters+' characters   language: '+RC.language+'   '+(RC.cropStyle||'grayscale')+' crops, no dictionary, upscale ×'+RC.scale+'   green ≥ 80, amber ≥ 50, red < 50 confidence');
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
  T.badge('table text: '+C.band.rows.length+' rows × '+C.columns.length+' columns'+(RC.cellPass?'   cell pass: '+RC.cellPass.changed+' of '+RC.cellPass.tried+' cells re-read with a whitelist ('+RC.cellPass.calls+' calls)':''));
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
    return finish('table band: rows '+(C.band.first+1)+'–'+(C.band.last+1)+' ('+C.band.rows.length+', '+C.band.parts+(C.band.parts>1?' parts merged':' part')+(C.band.fromBorders?', border box folded in':'')+(C.band.foreignRows?', '+C.band.foreignRows+' foreign rows dropped':'')+(C.band.footerCut?', footer cut by '+C.band.footerCut:'')+(C.fragmentsMerged?', '+C.fragmentsMerged+' row fragments joined':'')+')   header rows: '+C.band.first+'   footer rows: '+(C.rows.length-1-C.band.last)+'   page tilt: '+tilt);
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
      T.tag(q.x-fs*1.5,q.y-fs*0.9,'C'+(i+1)+(c.key?' '+c.key+(c.found===false?'?':''):'')+' '+c.align+' '+c.cells+'c',c.key?(c.found===false?'rgba(255,200,120,.97)':'rgba(166,255,63,.97)'):'rgba(120,205,255,.97)'); });
    return finish('columns: '+C.columns.length+(C.headerRule?' · '+C.headerRule.mode+(C.headerRule.name&&C.headerRule.mode.startsWith('exact')?' "'+C.headerRule.name+'"':'')+' ('+C.headerRule.found+' of '+C.headerRule.total+(C.headerRule.mode.startsWith('exact')?' titles found, '+C.headerRule.boundariesFromGutters+' boundaries on gutters':' columns named')+')':' from the coverage profile (no title words to name them)')+'   gutters: '+C.gutters.length+(C.guttersFromBorders?' ('+C.guttersFromBorders+' from borders)':'')+'   pieces split across columns: '+C.spanningPieces);
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
    return finish('grid: '+B.rows.length+' rows × '+C.columns.length+' columns'+(C.headerRule?' (rule "'+C.headerRule.name+'")':'')+'   filled cells: '+filled+'   empty: '+empty+(B.rescuedPieces||B.mergedRows?'   rescued: '+(B.rescuedPieces||0)+' pieces, '+(B.mergedRows||0)+' thin rows merged':''));
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

/* ======================================================================
   API · PaddleOCR
   ====================================================================== */
const confColor=c=>c>=80?'rgba(84,221,126,.97)':c>=50?'rgba(255,200,80,.97)':'rgba(255,110,110,.97)';
/* text drawn inside a box: font from the box height, shrunk to the width */
function fitText(ctx,text,b,maxFrac=0.85){
  const h=b.y1-b.y0+1, w=b.x1-b.x0+1; let fs=Math.max(8,Math.round(h*maxFrac));
  ctx.font=`700 ${fs}px "JetBrains Mono", monospace`;
  const tw=ctx.measureText(text).width; if(tw>w && tw>0){ fs=Math.max(7,Math.floor(fs*w/tw)); ctx.font=`700 ${fs}px "JetBrains Mono", monospace`; }
  return fs;
}
/* one engine's regions on their own: its boxes, text coloured by confidence */
function renderApiEngine(A,engine,ctx,W,H,base,T){
  T.darken(base,0.55); ctx.textBaseline='alphabetic';
  const names={paddle:'PaddleOCR', tesseract5:'Tesseract 5', easyocr:'EasyOCR'};
  if(A.status==='pending'){ T.badge('API · '+names[engine]+' · request in flight → '+A.url); T.message('waiting for the API — this stage fills in when the answer arrives'); return; }
  if(A.status==='error'){ T.badge('API · '+names[engine]+' · failed after '+Math.round(A.ms)+' ms → '+A.url); T.message(A.error); return; }
  const E=apiEngineList(A.response).find(e=>e.name===engine);
  if(!E){ T.badge('API · '+names[engine]+' · not in the answer'); T.message('the service did not report this engine — an older build of api/InvoiceOcrApi?'); return; }
  if(E.status!=='ok'){ T.badge('API · '+E.label+' · '+E.status); T.message(names[engine]+' '+E.status+(E.error?': '+E.error:'')); return; }
  const sw=T.strokeW; ctx.textBaseline='middle';
  const edge={paddle:'rgba(255,170,70,.6)', tesseract5:'rgba(255,130,190,.6)', easyocr:'rgba(200,150,255,.6)'}[engine]||'rgba(255,170,70,.6)';
  let confSum=0;
  for(const l of E.regions){
    const b=l.bbox; if(!b) continue; const c=100*(l.confidence||0); confSum+=c;
    if(l.polygon && l.polygon.length>=3){ ctx.beginPath(); ctx.moveTo(l.polygon[0][0],l.polygon[0][1]); for(let i=1;i<l.polygon.length;i++) ctx.lineTo(l.polygon[i][0],l.polygon[i][1]); ctx.closePath(); }
    else { ctx.beginPath(); ctx.rect(b.x0,b.y0,b.x1-b.x0+1,b.y1-b.y0+1); }
    ctx.fillStyle='rgba(8,11,12,.55)'; ctx.fill(); ctx.lineWidth=sw*0.7; ctx.strokeStyle=edge; ctx.stroke();
    fitText(ctx,l.text,b); ctx.fillStyle=confColor(c); ctx.fillText(l.text,b.x0+2,(b.y0+b.y1)/2);
  }
  ctx.textBaseline='alphabetic'; ctx.font=`600 ${T.fontSize}px "JetBrains Mono", monospace`;
  const mean=E.regions.length?confSum/E.regions.length:0;
  T.badge('API · '+E.label+' · '+E.regions.length+(engine==='paddle'?' regions':engine==='tesseract5'?' words':' fragments')+' · mean confidence '+mean.toFixed(1)+' · '+Math.round(E.ms)+' ms on the server'+(engine==='paddle'?' · its regions give the layout of the combined stage':''));
}

/* the combined stage: outside the table PaddleOCR's regions in grey; inside
   it the service's vote per cell, coloured by who agreed (VOTE_COLORS), a
   legend along the bottom of the image */
const VOTE_COLORS=[
  {key:'paddle+easyocr+tesseract5', label:'all 3 agree',             color:'rgba(240,245,245,.98)'},
  {key:'paddle+tesseract5',         label:'PaddleOCR + Tesseract',   color:'rgba(255,225,130,.98)'},
  {key:'paddle+easyocr',            label:'PaddleOCR + EasyOCR',     color:'rgba(110,220,255,.98)'},
  {key:'easyocr+tesseract5',        label:'Tesseract + EasyOCR',     color:'rgba(120,230,140,.98)'},
  {key:'paddle',                    label:'PaddleOCR only (most confident)', color:'rgba(255,170,70,.98)'},
  {key:'easyocr',                   label:'EasyOCR only (most confident)',   color:'rgba(200,150,255,.98)'},
  {key:'tesseract5',                label:'Tesseract only (most confident)', color:'rgba(255,130,190,.98)'},
];
const voteKey=src=>{ if(!src) return ''; const names=(src.startsWith('vote:')?src.slice(5):src).split('+'); const order=['paddle','easyocr','tesseract5']; return names.slice().sort((a,b)=>order.indexOf(a)-order.indexOf(b)).join('+'); };
function drawLegend(ctx,T,W,H,items){
  const fs=T.fontSize*1.15, pad=fs*0.6, sw=fs*0.9, gap=fs*1.4;
  ctx.font=`600 ${fs}px "JetBrains Mono", monospace`; ctx.textBaseline='middle';
  const widths=items.map(it=>sw+fs*0.4+ctx.measureText(it.label).width);
  const rows=[[]]; let x=pad;
  items.forEach((it,i)=>{ if(x+widths[i]>W-pad && rows[rows.length-1].length){ rows.push([]); x=pad; } rows[rows.length-1].push(i); x+=widths[i]+gap; });
  const rowH=fs*1.7, h=rows.length*rowH+pad;
  ctx.fillStyle='rgba(8,11,12,.88)'; ctx.fillRect(0,H-h,W,h);
  ctx.fillStyle='rgba(110,200,255,.5)'; ctx.fillRect(0,H-h,W,Math.max(1,T.strokeW*0.6));
  rows.forEach((row,r)=>{ let xx=pad; const y=H-h+pad/2+rowH*(r+0.5);
    for(const i of row){ const it=items[i]; ctx.fillStyle=it.color; ctx.fillRect(xx,y-sw/2,sw,sw); ctx.fillStyle='rgba(235,240,240,.95)'; ctx.fillText(it.label,xx+sw+fs*0.4,y); xx+=widths[i]+gap; } });
  ctx.textBaseline='alphabetic';
  return h;
}
function renderApi(A,ctx,W,H,base,T){
  T.darken(base,0.55); ctx.textBaseline='alphabetic';
  if(A.status==='pending'){ T.badge('API · combined · request in flight → '+A.url); T.message('waiting for the API — this stage fills in when the answer arrives'); return; }
  if(A.status==='error'){ T.badge('API · combined · failed after '+Math.round(A.ms)+' ms → '+A.url); T.message(A.error); return; }
  const R=A.response, sw=T.strokeW;
  const regions=R.brief&&R.brief.lines ? R.brief.lines : [];
  const D=R.deep, t=D&&D.table, voted=!!(t&&t.consensus);
  const s=D?Math.tan(D.columnTiltDeg*Math.PI/180):0;
  const inTable=b=>voted && (b.y0+b.y1)/2>=t.bbox.y0 && (b.y0+b.y1)/2<=t.bbox.y1 && (b.x0+b.x1)/2>=t.bbox.x0 && (b.x0+b.x1)/2<=t.bbox.x1;
  ctx.textBaseline='middle';
  if(regions.length){
    for(const l of regions){
      const b=l.bbox, c=100*(l.confidence||0);
      if(inTable(b)) continue;                                    // the table is drawn from the vote below
      if(l.polygon){ ctx.beginPath(); ctx.moveTo(l.polygon[0][0],l.polygon[0][1]); for(let i=1;i<l.polygon.length;i++) ctx.lineTo(l.polygon[i][0],l.polygon[i][1]); ctx.closePath();
        ctx.fillStyle='rgba(8,11,12,.55)'; ctx.fill(); ctx.lineWidth=sw*0.7; ctx.strokeStyle='rgba(150,165,170,.5)'; ctx.stroke(); }
      fitText(ctx,l.text,b); ctx.fillStyle=voted?'rgba(200,210,215,.9)':confColor(c); ctx.fillText(l.text,b.x0+2,(b.y0+b.y1)/2);
    }
  } else if(D){                           // depth = deep: rows only
    for(const r of D.rows){ const b=r.bbox; if(inTable(b)) continue; ctx.lineWidth=sw*0.7; ctx.strokeStyle='rgba(255,170,70,.6)'; T.rect(b);
      fitText(ctx,r.text,b); ctx.fillStyle='rgba(255,200,120,.95)'; ctx.fillText(r.text,b.x0+2,(b.y0+b.y1)/2); }
  }
  let tableNote='no table'; const counts={};
  if(D){
    const rowColor={header:'rgba(110,160,255,.9)', table:'rgba(84,221,126,.9)', footer:'rgba(255,170,70,.9)'};
    ctx.lineWidth=sw*0.6;
    for(const r of D.rows){ ctx.strokeStyle=rowColor[r.kind]||'rgba(150,165,170,.6)'; ctx.setLineDash([sw*3,sw*3]); T.rect(r.bbox); }
    ctx.setLineDash([]);
    if(t){
      ctx.lineWidth=sw*1.4; ctx.strokeStyle='rgba(84,221,126,.98)'; T.rect(t.bbox);
      ctx.lineWidth=sw*0.8; ctx.strokeStyle='rgba(110,200,255,.85)';
      for(const c of t.columns.slice(1)){ const xTop=c.x0-0.5-s*t.bbox.y0, xBot=c.x0-0.5-s*t.bbox.y1; ctx.beginPath(); ctx.moveTo(xTop,t.bbox.y0); ctx.lineTo(xBot,t.bbox.y1); ctx.stroke(); }
      if(voted){
        /* every table cell, CHARACTER by character: the engine that supplied
           the cell's voted text is the anchor; each of its symbols is drawn
           in its own box and coloured by which engines read the same symbol
           at the same place (a symbol of another engine whose centre lies
           within the anchor symbol's x span on the same row). So a cell that
           two engines spell differently shows exactly which characters they
           dispute, instead of one colour for the whole label. The anchor
           symbol's box is the engine's own (Tesseract) or interpolated along
           its region (PaddleOCR, EasyOCR). */
        const engines=apiEngineList(A.response), byName={}; for(const e of engines) byName[e.name]=e;
        const order=['paddle','easyocr','tesseract5'];
        const inRow=(c,row)=>{ const cy=(c.bbox.y0+c.bbox.y1)/2; return cy>=row.bbox.y0-2 && cy<=row.bbox.y1+2; };
        for(let ri=0;ri<t.rowCount;ri++){
          const row=D.rows[t.firstRow+ri]; if(!row) continue;
          const cy=(row.bbox.y0+row.bbox.y1)/2;
          // the symbols of every engine on this row, sorted by x
          const rowChars={}; for(const e of engines) rowChars[e.name]=(e.characters||[]).filter(c=>c.bbox&&inRow(c,row)).sort((a,b)=>a.bbox.x0-b.bbox.x0);
          t.consensus[ri].forEach((text,ci)=>{
            if(!text) return;
            const src=t.consensusSource[ri][ci]||'', names=(src.startsWith('vote:')?src.slice(5):src).split('+').filter(Boolean);
            const cell=row.cells&&row.cells[ci], col=t.columns[ci];
            const b=cell&&cell.bbox?cell.bbox:{x0:Math.round(col.x0-s*cy), y0:row.bbox.y0, x1:Math.round(col.x1-s*cy), y1:row.bbox.y1};
            ctx.fillStyle='rgba(8,11,12,.6)'; ctx.fillRect(b.x0,b.y0,b.x1-b.x0+1,b.y1-b.y0+1);
            // the anchor: the engine that supplied the text, first in vote order, that has symbols in this cell
            const inCell=c=>{ const cx=(c.bbox.x0+c.bbox.x1)/2; return cx>=b.x0-2 && cx<=b.x1+2; };
            const anchorName=order.filter(n=>names.includes(n)).concat(order).find(n=>byName[n] && rowChars[n].some(inCell));
            const anchor=anchorName?rowChars[anchorName].filter(inCell):[];
            if(!anchor.length){                              // no symbols: the voted text as one label
              const k=voteKey(src), vc=VOTE_COLORS.find(v=>v.key===k); counts[k]=(counts[k]||0)+text.length;
              fitText(ctx,text,b); ctx.fillStyle=vc?vc.color:'rgba(200,210,215,.9)'; ctx.fillText(text,b.x0+2,(b.y0+b.y1)/2); return; }
            for(const ch of anchor){
              const cb=ch.bbox, cw=Math.max(3,cb.x1-cb.x0+1), cxm=(cb.x0+cb.x1)/2;
              const agree=[anchorName];
              for(const n of order){ if(n===anchorName || !byName[n] || byName[n].status!=='ok') continue;
                // the other engine's symbol nearest in x within 0.6 of the anchor symbol's width
                let best=null, bd=1/0; for(const o of rowChars[n]){ const d=Math.abs((o.bbox.x0+o.bbox.x1)/2-cxm); if(d<bd){ bd=d; best=o; } }
                if(best && bd<=0.6*cw && best.text===ch.text) agree.push(n); }
              const k=agree.slice().sort((a,b)=>order.indexOf(a)-order.indexOf(b)).join('+'), vc=VOTE_COLORS.find(v=>v.key===k);
              counts[k]=(counts[k]||0)+1;
              const h=cb.y1-cb.y0+1; ctx.font=`600 ${Math.max(6,Math.min(h*0.9,cw*1.6))}px "JetBrains Mono", monospace`;
              ctx.fillStyle=vc?vc.color:'rgba(200,210,215,.9)'; ctx.textAlign='center'; ctx.fillText(ch.text,cxm,(cb.y0+cb.y1)/2); ctx.textAlign='left';
              if(!ch.estimated){ ctx.lineWidth=Math.max(0.5,sw*0.3); ctx.strokeStyle='rgba(255,130,190,.35)'; ctx.strokeRect(cb.x0,cb.y0,cw,h); }
            }
          });
        }
      }
      ctx.font=`600 ${T.fontSize}px "JetBrains Mono", monospace`;
      T.tag(t.bbox.x0+sw*2,t.bbox.y0+T.fontSize,'API TABLE · '+t.rowCount+'R × '+t.columnCount+'C'+(t.footerCut?' · footer cut by '+t.footerCut:''),'rgba(84,221,126,.98)');
      tableNote=t.rowCount+' rows × '+t.columnCount+' columns'+(t.footerCut?' (footer cut by '+t.footerCut+')':'');
    }
  }
  if(voted) drawLegend(ctx,T,W,H,VOTE_COLORS.map(v=>({label:v.label.replace(' (most confident)','')+(counts[v.key]?' '+counts[v.key]:''), color:v.color})).concat([{label:'per character · pink box = engine-reported symbol box', color:'rgba(255,130,190,.35)'}]));
  ctx.textBaseline='alphabetic'; ctx.font=`600 ${T.fontSize}px "JetBrains Mono", monospace`;
  const engines=(R.engines||[]).map(e=>e.name+' '+e.status+(e.characters?' '+e.characters.length+'ch':e.lines?' '+e.lines.length+'w':'')+(e.ms?' '+e.ms+'ms':'')).join(', ');
  const totalCh=Object.values(counts).reduce((a,b)=>a+b,0), agreedCh=Object.keys(counts).filter(k=>k.includes('+')).reduce((a,k)=>a+counts[k],0);
  const votedN=voted?agreedCh+' of '+totalCh+' table characters read alike by two or more engines':'';
  T.badge('API · combined · '+R.depth+' · '+regions.length+' PaddleOCR regions · server '+R.timing.totalMs+' ms (ocr '+R.timing.ocrMs+'), round trip '+Math.round(A.ms)+' ms · table: '+tableNote+(engines?' · engines: '+engines:'')+(votedN?' · '+votedN:'')+(D?' · fields: '+D.fields.map(f=>f.key).join(', '):''));
}

/* ======================================================================
   FINAL · best analysis
   ====================================================================== */
const SRC_COLOR={agreed:'rgba(240,245,245,.97)', vote:'rgba(255,225,130,.97)', local:'rgba(84,221,126,.97)', api:'rgba(255,170,70,.97)', easyocr:'rgba(200,150,255,.97)', tesseract5:'rgba(255,130,190,.97)', 'local-only':'rgba(110,200,255,.97)', empty:'rgba(150,165,170,.5)'};
function finalHeader(F){
  const lt=F.localTable?F.localTable.rows+'×'+F.localTable.cols:'none', at=F.apiTable?F.apiTable.rows+'×'+F.apiTable.cols:'none';
  const st=F.stats||{};
  return 'rows: '+(st.localRows||0)+' local + '+(st.apiRows||0)+' API'+(st.droppedTop?' ('+st.droppedTop+' above the title dropped)':'')+' · local table '+lt+' · API table '+at+(F.header&&F.header.rule?' · header from rule "'+F.header.rule+'"':'')+(F.note?' · '+F.note:'');
}
/* the title row: the rule's labels (or the best title words) in the header cells */
function drawFinalHeader(F,ctx,T){
  if(!F.header || !F.header.cells) return;
  F.header.cells.forEach((b,ci)=>{ const label=F.header.labels[ci]||'';
    ctx.lineWidth=T.strokeW; ctx.strokeStyle='rgba(255,220,120,.9)'; ctx.fillStyle='rgba(8,11,12,.55)'; ctx.fillRect(b.x0,b.y0,b.x1-b.x0+1,b.y1-b.y0+1); T.rect(b);
    if(label){ fitText(ctx,label,b,0.6); ctx.fillStyle='rgba(255,230,140,.98)'; ctx.fillText(label,b.x0+2,(b.y0+b.y1)/2); } });
}
function renderFinalCompare(F,ctx,W,H,base,T){
  T.darken(base,0.65); ctx.textBaseline='alphabetic';
  if(!F.grid){ T.badge('FINAL · compare · '+finalHeader(F)); return T.message('no table to compare'); }
  const sw=T.strokeW; ctx.textBaseline='middle';
  drawFinalHeader(F,ctx,T);
  let disagree=0;
  for(const row of F.grid) for(const g of row){ const b=g.bb; if(!b) continue;
    const h=b.y1-b.y0+1;
    const both=g.local&&g.api, differ=both&&g.source!=='agreed'; if(differ) disagree++;
    ctx.lineWidth=differ?sw*1.2:sw*0.6; ctx.strokeStyle=differ?'rgba(255,90,90,.95)':both?'rgba(110,200,255,.45)':g.local?'rgba(84,221,126,.7)':g.api?'rgba(255,170,70,.7)':'rgba(150,165,170,.25)'; T.rect(b);
    if(g.local){ fitText(ctx,g.local,{x0:b.x0,y0:b.y0,x1:b.x1,y1:b.y0+h/2},0.9); ctx.fillStyle='rgba(84,221,126,.97)'; ctx.fillText(g.local,b.x0+1,b.y0+h*0.27); }
    if(g.api){ fitText(ctx,g.api,{x0:b.x0,y0:b.y0,x1:b.x1,y1:b.y0+h/2},0.9); ctx.fillStyle='rgba(255,170,70,.97)'; ctx.fillText(g.api,b.x0+1,b.y0+h*0.75); }
  }
  ctx.textBaseline='alphabetic'; ctx.font=`600 ${T.fontSize}px "JetBrains Mono", monospace`;
  const st=F.stats;
  T.badge('FINAL · compare · local (green) over PaddleOCR (orange) · '+finalHeader(F)+' · both read '+st.both+' cells, agree '+st.agreed+' ('+Math.round(100*st.agreement)+'%), differ '+disagree+(st.vote?' · '+st.vote+' cells settled by the other engines\' vote':''));
}
function renderFinalTable(F,ctx,W,H,base,T){
  T.darken(base,0.65); ctx.textBaseline='alphabetic';
  if(!F.grid){ T.badge('FINAL · '+finalHeader(F)); return T.message('no table from either side'); }
  const sw=T.strokeW; ctx.textBaseline='middle';
  // a real table: the header row, then every row as a band of full cells
  // (row extent × column span) with shared borders; text inside each cell
  const rows=F.grid.map(r=>r.map(g=>g.box||g.bb));
  const bands=(F.header&&F.header.cells?[F.header.cells]:[]).concat(rows);
  ctx.fillStyle='rgba(8,11,12,.45)';
  for(const band of bands){ const x0=Math.min(...band.map(b=>b.x0)), x1=Math.max(...band.map(b=>b.x1)), y0=Math.min(...band.map(b=>b.y0)), y1=Math.max(...band.map(b=>b.y1)); ctx.fillRect(x0,y0,x1-x0+1,y1-y0+1); }
  ctx.lineWidth=sw*0.9; ctx.strokeStyle='rgba(110,200,255,.75)';
  for(const band of bands) for(const b of band) T.rect(b);
  if(F.header && F.header.cells){ ctx.lineWidth=sw*1.4; ctx.strokeStyle='rgba(255,220,120,.95)';
    F.header.cells.forEach((b,ci)=>{ T.rect(b); const label=F.header.labels[ci]||''; if(label){ fitText(ctx,label,b,0.6); ctx.fillStyle='rgba(255,230,140,.98)'; ctx.fillText(label,b.x0+3,(b.y0+b.y1)/2); } }); }
  F.grid.forEach((row,ri)=>row.forEach((g,ci)=>{ const b=rows[ri][ci]; if(!b || !g.text) return;
    fitText(ctx,g.text,{x0:b.x0+2,y0:b.y0,x1:b.x1-2,y1:b.y1},0.7); ctx.fillStyle=SRC_COLOR[g.source]||SRC_COLOR.agreed; ctx.fillText(g.text,b.x0+3,(b.y0+b.y1)/2); }));
  ctx.textBaseline='alphabetic'; ctx.font=`600 ${T.fontSize}px "JetBrains Mono", monospace`;
  const st=F.stats;
  const eng=(F.engines||[]).map(e=>e.name+' '+e.status).join(', ');
  T.badge('FINAL · '+F.grid.length+' rows × '+(F.grid[0]?F.grid[0].length:0)+' columns from the '+F.source+' structure · local+PaddleOCR agree '+st.agreed+', engines vote '+(st.vote||0)+', PaddleOCR '+st.api+(st.easyocr?', EasyOCR '+st.easyocr:'')+(st.tesseract5?', Tesseract 5 '+st.tesseract5:'')+', local '+st.local+', one side only '+st.localOnly+', empty '+st.empty+(eng?' · engines: '+eng+', local':'')+' · '+finalHeader(F));
}
