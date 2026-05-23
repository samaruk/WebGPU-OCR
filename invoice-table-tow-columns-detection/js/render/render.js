/* ======================================================================
   STAGE RENDERING
   Why: each of the 21 pipeline stages is drawn here, by one descriptor-driven
   routine, into an offscreen full-resolution canvas. Centralising it means
   the viewport blitter and the gallery show identical pixels and every
   export is full size.
   ====================================================================== */
import { $ } from '../dom/dom.js';
import { S } from '../state/state.js';
import { STAGES } from '../config/config.js';

/* =====================================================================
   RENDERING  —  draw the active stage to an offscreen canvas
   ===================================================================== */
export function hsl(h,s,l){
  s/=100;l/=100;
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
  let r,g,b;
  if(h<60){r=c;g=x;b=0;}else if(h<120){r=x;g=c;b=0;}
  else if(h<180){r=0;g=c;b=x;}else if(h<240){r=0;g=x;b=c;}
  else if(h<300){r=x;g=0;b=c;}else{r=c;g=0;b=x;}
  return [(r+m)*255|0,(g+m)*255|0,(b+m)*255|0];
}
export const labColor=l=>hsl((l*137.508)%360,68,58);

export function getStageCanvas(){
  if(!S.stageCv || S.stageCv.width!==S.W || S.stageCv.height!==S.H){
    S.stageCv=document.createElement('canvas');
    S.stageCv.width=S.W; S.stageCv.height=S.H;
  }
  return S.stageCv;
}

export function renderStage(idx){
  S.stage=idx;
  const cv=getStageCanvas();
  renderStageInto(STAGES[idx], cv.getContext('2d'), S.W, S.H);
}

/* draw any stage descriptor into a W×H 2D context */
export function renderStageInto(st,ctx,W,H){
  const sw=Math.max(1.4,Math.round(Math.min(W,H)/520));   // stroke width scaled to image
  ctx.fillStyle='#0a0e0f'; ctx.fillRect(0,0,W,H);

  if(st.kind==='source'){   if(S.origCanvas)   ctx.drawImage(S.origCanvas,0,0);   return; }
  if(st.kind==='lens'){ if(S.lensCanvas) ctx.drawImage(S.lensCanvas,0,0); else if(S.origCanvas) ctx.drawImage(S.origCanvas,0,0); return; }
  if(st.kind==='rectified'){ if(S.workCanvas) ctx.drawImage(S.workCanvas,0,0); else if(S.origCanvas) ctx.drawImage(S.origCanvas,0,0); return; }
  if(st.kind==='deskewed'){ if(S.deskewCanvas) ctx.drawImage(S.deskewCanvas,0,0); return; }
  if(st.kind==='dewarped'){ if(S.dewarpCanvas) ctx.drawImage(S.dewarpCanvas,0,0); else if(S.deskewCanvas) ctx.drawImage(S.deskewCanvas,0,0); return; }

  const pass = st.pass==='A' ? S.passes.A : S.passes.B;
  if(!pass) return;
  const base = st.pass==='A' ? S.origCanvas : S.deskewCanvas;
  const k=st.kind, N=W*H;

  if(k==='binary' || k==='dilated'){              // ---- raster mask ----
    const mask = k==='binary' ? pass.binary : pass.dilated;
    const id=ctx.createImageData(W,H), d=id.data;
    for(let i=0,j=0;i<N;i++,j+=4){
      const v=mask[i]?22:244; d[j]=d[j+1]=d[j+2]=v; d[j+3]=255;
    }
    ctx.putImageData(id,0,0); return;
  }

  if(k==='cca' || k==='blobs'){                   // ---- labelled raster ----
    const id=ctx.createImageData(W,H), d=id.data;
    for(let i=0,j=0;i<N;i++,j+=4){
      const l=pass.labels[i];
      const idx = k==='cca' ? l : (l>=0?pass.lab2blob[l]:-1);
      if(idx<0){d[j]=8;d[j+1]=12;d[j+2]=13;}
      else{const c=labColor(idx);d[j]=c[0];d[j+1]=c[1];d[j+2]=c[2];}
      d[j+3]=255;
    }
    ctx.putImageData(id,0,0);
    if(k==='blobs'){
      ctx.lineWidth=sw; ctx.strokeStyle='rgba(166,255,63,.55)';
      for(const b of pass.blobs)
        ctx.strokeRect(b.bb.x0+.5,b.bb.y0+.5,b.bb.x1-b.bb.x0+1,b.bb.y1-b.bb.y0+1);
    }
    return;
  }

  if(k==='contours'){
    ctx.lineWidth=sw; ctx.strokeStyle='rgba(166,255,63,.92)'; ctx.lineJoin='round';
    for(const b of pass.blobs){
      const ct=b.contour;
      if(ct.length<2){
        ctx.fillStyle='rgba(166,255,63,.92)';
        ctx.fillRect(ct[0].x,ct[0].y,sw,sw); continue;
      }
      ctx.beginPath(); ctx.moveTo(ct[0].x+.5,ct[0].y+.5);
      for(let i=1;i<ct.length;i++) ctx.lineTo(ct[i].x+.5,ct[i].y+.5);
      ctx.closePath(); ctx.stroke();
    }
    return;
  }

  if(k==='hull'){
    for(const b of pass.blobs){
      const ct=b.contour;
      if(ct.length>=2){
        ctx.lineWidth=sw*.7; ctx.strokeStyle='rgba(70,215,232,.22)';
        ctx.beginPath(); ctx.moveTo(ct[0].x+.5,ct[0].y+.5);
        for(let i=1;i<ct.length;i++) ctx.lineTo(ct[i].x+.5,ct[i].y+.5);
        ctx.closePath(); ctx.stroke();
      }
      const h=b.hull;
      ctx.lineWidth=sw; ctx.strokeStyle='rgba(255,157,61,.95)';
      ctx.fillStyle='rgba(255,157,61,.10)';
      ctx.beginPath(); ctx.moveTo(h[0].x+.5,h[0].y+.5);
      for(let i=1;i<h.length;i++) ctx.lineTo(h[i].x+.5,h[i].y+.5);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    return;
  }

  if(k==='calipers'){
    const dot=Math.max(2,sw*1.6);
    for(const b of pass.blobs){
      const h=b.hull;
      ctx.lineWidth=sw*.7; ctx.strokeStyle='rgba(70,215,232,.30)';
      ctx.beginPath(); ctx.moveTo(h[0].x+.5,h[0].y+.5);
      for(let i=1;i<h.length;i++) ctx.lineTo(h[i].x+.5,h[i].y+.5);
      ctx.closePath(); ctx.stroke();
      const c=b.obb.corners;
      ctx.lineWidth=sw; ctx.strokeStyle='rgba(166,255,63,.95)';
      ctx.fillStyle='rgba(166,255,63,.09)';
      ctx.beginPath(); ctx.moveTo(c[0].x,c[0].y);
      for(let i=1;i<4;i++) ctx.lineTo(c[i].x,c[i].y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#ff9d3d';
      for(const pt of b.obb.contacts){
        ctx.beginPath(); ctx.arc(pt.x,pt.y,dot,0,7); ctx.fill();
      }
    }
    return;
  }

  if(k==='obb'){                                  // final word boxes (post-split)
    if(base) ctx.drawImage(base,0,0);
    ctx.fillStyle='rgba(8,11,12,.42)'; ctx.fillRect(0,0,W,H);
    const showRej=$('showRej').checked;
    ctx.lineWidth=sw; ctx.lineJoin='round';
    for(const b of pass.blobs){
      for(const part of b.parts){
        if(!part.accepted && !showRej) continue;
        const c=part.corners;
        ctx.beginPath(); ctx.moveTo(c[0].x,c[0].y);
        for(let i=1;i<4;i++) ctx.lineTo(c[i].x,c[i].y);
        ctx.closePath();
        if(part.accepted){ctx.strokeStyle='rgba(84,221,126,.95)';ctx.fillStyle='rgba(84,221,126,.13)';}
        else{ctx.strokeStyle='rgba(255,93,108,.92)';ctx.fillStyle='rgba(255,93,108,.10)';}
        ctx.fill(); ctx.stroke();
      }
    }
    return;
  }

  if(k==='borders'){                                // ---- detected rules ----
    if(base) ctx.drawImage(base,0,0);
    ctx.fillStyle='rgba(8,11,12,.45)'; ctx.fillRect(0,0,W,H);
    const b=pass.borders;
    const fs=Math.max(11,Math.round(Math.min(W,H)/90));
    ctx.font=`600 ${fs}px "JetBrains Mono", monospace`;
    if(!b){
      ctx.fillStyle='rgba(230,240,235,.85)'; ctx.textAlign='center';
      ctx.fillText('borders not computed',W/2,H/2); ctx.textAlign='left';
      return;
    }
    // horizontal rules in cyan, vertical rules in lime — same colours
    // used elsewhere for row/column visualisations so the meaning carries
    const lw=Math.max(2,sw*1.6);
    ctx.lineWidth=lw; ctx.lineCap='round';
    ctx.strokeStyle='rgba(110,200,255,.95)';
    for(const h of b.hLines){
      ctx.beginPath();
      ctx.moveTo(h.x0,h.y+0.5); ctx.lineTo(h.x1,h.y+0.5);
      ctx.stroke();
    }
    ctx.strokeStyle='rgba(166,255,63,.95)';
    for(const v of b.vLines){
      ctx.beginPath();
      ctx.moveTo(v.x+0.5,v.y0); ctx.lineTo(v.x+0.5,v.y1);
      ctx.stroke();
    }
    // count badge in the top-left
    const txt='H: '+b.hLines.length+'   V: '+b.vLines.length;
    const pad=fs*0.5, tw=ctx.measureText(txt).width;
    ctx.fillStyle='rgba(8,11,12,.85)';
    ctx.fillRect(pad,pad,tw+pad*1.6,fs+pad*1.2);
    ctx.fillStyle='rgba(220,235,240,.97)';
    ctx.fillText(txt,pad+pad*0.8,pad+fs*0.7+pad*0.1);
    return;
  }

  if(k==='rows'||k==='cols'||k==='table'){          // ---- table layout ----
    if(base) ctx.drawImage(base,0,0);
    ctx.fillStyle='rgba(8,11,12,.55)'; ctx.fillRect(0,0,W,H);
    const L=pass.layout;
    const fs=Math.max(11,Math.round(Math.min(W,H)/90));
    ctx.font=`600 ${fs}px "JetBrains Mono", monospace`;
    ctx.textBaseline='middle'; ctx.lineJoin='round';
    const msg=t=>{ ctx.fillStyle='rgba(230,240,235,.85)'; ctx.textAlign='center';
      ctx.fillText(t,W/2,H/2); ctx.textAlign='left'; };
    // multi-line diagnostic when detection failed
    const msgDiag=(headline,diag)=>{
      ctx.textAlign='center';
      const lines=[headline];
      if(diag){
        lines.push('');
        lines.push(`boxes:${diag.boxes}   rows:${diag.rows}   medH:${diag.medH}`);
        lines.push(`rlsa cols:${diag.rlsaCols}   detect cols:${diag.detectCols}   by-centers:${diag.byCenters}`);
        lines.push(`band tries: ${diag.band1}   ${diag.band2}   ${diag.band3}`);
        lines.push(`source: ${diag.source}`);
      }
      const lh=fs*1.6, top=H/2-((lines.length-1)*lh)/2;
      ctx.fillStyle='rgba(230,240,235,.88)';
      lines.forEach((t,i)=>{
        if(i===0){ ctx.fillStyle='rgba(255,205,120,.95)'; ctx.fillText(t,W/2,top+i*lh); }
        else     { ctx.fillStyle='rgba(220,230,235,.78)'; ctx.fillText(t,W/2,top+i*lh); }
      });
      ctx.textAlign='left';
    };
    if(!L || !L.allRows.length){ msgDiag('table detection produced no layout', L&&L.diag); return; }
    const tag=(x,y,t,col)=>{
      const pad=fs*0.34, tw=ctx.measureText(t).width;
      y=Math.max(fs,y);
      ctx.fillStyle='rgba(8,11,12,.85)';
      ctx.fillRect(x,y-fs*0.6-pad,tw+pad*2,fs+pad*1.6);
      ctx.fillStyle=col; ctx.fillText(t,x+pad,y);
    };
    const rect=b=>{ ctx.beginPath(); ctx.rect(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0); };
    const [bT,bB]=L.tRange;

    if(k==='rows'){
      L.allRows.forEach((r,i)=>{                    // non-table text lines, dim
        if(i>=bT && i<=bB) return;
        rect(r); ctx.fillStyle='rgba(150,165,170,.09)'; ctx.fill();
        ctx.lineWidth=sw; ctx.strokeStyle='rgba(150,165,170,.5)'; ctx.stroke();
      });
      L.rows.forEach((r,i)=>{                       // table rows as tiled cells
        rect(r); ctx.fillStyle='rgba(84,221,126,.14)'; ctx.fill();
        ctx.lineWidth=sw; ctx.strokeStyle='rgba(84,221,126,.9)'; ctx.stroke();
        tag(r.x0+sw*2,(r.y0+r.y1)/2,i===L.colHeader?'HDR':'R'+(i+1),'rgba(166,255,63,.96)');
      });
      return;
    }
    const tb=L.table;
    if(!tb){ msgDiag('no multi-column table found', L.diag); return; }

    if(k==='cols'){
      L.cols.forEach((c,i)=>{                       // tiled column cells
        rect(c);
        ctx.fillStyle=i%2?'rgba(110,200,255,.15)':'rgba(166,255,63,.12)'; ctx.fill();
        ctx.lineWidth=sw; ctx.strokeStyle='rgba(110,200,255,.85)'; ctx.stroke();
        tag((c.x0+c.x1)/2-fs,tb.y0+fs*1.1,'C'+(i+1),'rgba(120,205,255,.97)');
      });
      return;
    }
    // k==='table'
    if(L.header){ rect(L.header);
      ctx.fillStyle='rgba(110,160,255,.16)'; ctx.fill();
      ctx.lineWidth=sw; ctx.strokeStyle='rgba(110,160,255,.7)'; ctx.stroke();
      tag(L.header.x0+sw*2,L.header.y0+fs,'HEADER','rgba(155,190,255,.97)'); }
    if(L.footer){ rect(L.footer);
      ctx.fillStyle='rgba(255,170,70,.15)'; ctx.fill();
      ctx.lineWidth=sw; ctx.strokeStyle='rgba(255,170,70,.7)'; ctx.stroke();
      tag(L.footer.x0+sw*2,L.footer.y0+fs,'FOOTER','rgba(255,193,115,.97)'); }
    rect(tb); ctx.fillStyle='rgba(84,221,126,.08)'; ctx.fill();
    if(L.colHeader>=0 && L.rows[L.colHeader]){       // column-header row band
      const hr=L.rows[L.colHeader];
      ctx.beginPath(); ctx.rect(hr.x0,hr.y0,hr.x1-hr.x0,hr.y1-hr.y0);
      ctx.fillStyle='rgba(166,255,63,.18)'; ctx.fill();
    }
    ctx.lineWidth=sw*0.7; ctx.strokeStyle='rgba(166,255,63,.5)';
    for(let i=1;i<L.cols.length;i++){                // shared column edges
      const x=L.cols[i].x0;
      ctx.beginPath(); ctx.moveTo(x,tb.y0); ctx.lineTo(x,tb.y1); ctx.stroke();
    }
    ctx.strokeStyle='rgba(84,221,126,.45)';
    for(let i=1;i<L.rows.length;i++){                // shared row edges
      const y=L.rows[i].y0;
      ctx.beginPath(); ctx.moveTo(tb.x0,y); ctx.lineTo(tb.x1,y); ctx.stroke();
    }
    ctx.lineWidth=sw*1.9; ctx.strokeStyle='rgba(84,221,126,.97)';
    rect(tb); ctx.stroke();
    tag(tb.x0+sw*2,tb.y0+fs,'TABLE · '+L.rows.length+'R × '+L.cols.length+'C',
        'rgba(84,221,126,.98)');
    return;
  }
}
