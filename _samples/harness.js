/* CPU replica of the CALIPER pipeline for testing without WebGPU */
import { readParams } from '/caliper-modular/js/pipeline/pipeline.js';
import { correctLensDistortion } from '/caliper-modular/js/lens/lens.js';
import { rectifyPerspective } from '/caliper-modular/js/rectify/rectify.js';
import { detectBorders } from '/caliper-modular/js/borders/borders.js';
import { analyseBorders, inpaintRules } from '/caliper-modular/js/borderlayout/borderlayout.js';
import { analyseTextLines } from '/caliper-modular/js/textlines/textlines.js';
import { detectColumns } from '/caliper-modular/js/columns/columns.js';
import { dilateCPU } from '/caliper-modular/js/morph/morph.js';

export function sauvolaCPU(img,{radius,k,R,invert}){
  const W=img.width,H=img.height,N=W*H,d=img.data;
  const gray=new Float32Array(N);
  for(let i=0,j=0;i<N;i++,j+=4){ let l=(0.299*d[j]+0.587*d[j+1]+0.114*d[j+2])/255; if(invert) l=1-l; gray[i]=l; }
  const sumH=new Float32Array(N), sqH=new Float32Array(N);
  for(let y=0;y<H;y++){ const b=y*W; let s=0,q=0;
    for(let x=0;x<=Math.min(W-1,radius);x++){ const v=gray[b+x]; s+=v; q+=v*v; }
    for(let x=0;x<W;x++){ sumH[b+x]=s; sqH[b+x]=q;
      const add=x+radius+1, rem=x-radius; if(add<W){ const v=gray[b+add]; s+=v; q+=v*v; } if(rem>=0){ const v=gray[b+rem]; s-=v; q-=v*v; } } }
  const sumV=new Float32Array(N), sqV=new Float32Array(N);
  for(let x=0;x<W;x++){ let s=0,q=0;
    for(let y=0;y<=Math.min(H-1,radius);y++){ s+=sumH[y*W+x]; q+=sqH[y*W+x]; }
    for(let y=0;y<H;y++){ sumV[y*W+x]=s; sqV[y*W+x]=q;
      const add=y+radius+1, rem=y-radius; if(add<H){ s+=sumH[add*W+x]; q+=sqH[add*W+x]; } if(rem>=0){ s-=sumH[rem*W+x]; q-=sqH[rem*W+x]; } } }
  const out=new Uint8Array(N);
  for(let y=0;y<H;y++){ const ch=Math.min(H-1,y+radius)-Math.max(0,y-radius)+1;
    for(let x=0;x<W;x++){ const cw=Math.min(W-1,x+radius)-Math.max(0,x-radius)+1, cnt=cw*ch, i=y*W+x;
      const mean=sumV[i]/cnt, meanSq=sqV[i]/cnt, sd=Math.sqrt(Math.max(0,meanSq-mean*mean));
      const T=mean*(1+k*(sd/R-1)); out[i]=gray[i]<T?1:0; } }
  return out;
}

export async function loadImage(url,maxPixels=32e6){
  const blob=await (await fetch(url,{cache:'reload'})).blob(); const im=await createImageBitmap(blob);   // Image.decode() never settles in the test pane
  let W=im.width,H=im.height; const s=Math.min(1,Math.sqrt(maxPixels/(W*H))); W=Math.round(W*s); H=Math.round(H*s);
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H; cv.getContext('2d').drawImage(im,0,0,W,H); return cv;
}

export async function runCPU(url,opts={}){
  const p=readParams(); Object.assign(p,opts.params||{});
  let cv=await loadImage(url,opts.maxPixels);
  const t={}; const T=(n,f)=>{ const a=performance.now(); const r=f(); t[n]=Math.round(performance.now()-a); return r; };
  if(p.rectify && opts.rectify!==false){ try{ cv=T('lens',()=>correctLensDistortion(cv))||cv; }catch(e){ t.lensErr=e.message; } try{ cv=T('rectify',()=>rectifyPerspective(cv))||cv; }catch(e){ t.rectErr=e.message; } }
  const W=cv.width,H=cv.height; const work=cv.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H);
  let borders=null, clean=work, eraseMask=null;
  if(p.borders.enabled){
    const binary=T('sauvolaRules',()=>sauvolaCPU(work,{...p.sauvola,k:p.rules.k}));
    const rules=T('rules',()=>detectBorders(binary,W,H,{maxGapH:p.rules.maxGapH,maxGapV:p.rules.maxGapV,openKernelH:p.rules.openKernelH,openKernelV:p.rules.openKernelV,maxThickness:p.rules.maxThickness,minCoverage:p.rules.minCoverage,smoothingRadius:p.rules.smoothingRadius,minLenFrac:p.rules.minLengthFrac,detectDashed:p.rules.detectDashed,maxDotSize:p.rules.dotMaxSize,minDots:p.rules.dotMinCount,minStrideToSizeRatio:p.rules.dotStrideRatio,minLenFracDashed:p.rules.dashedMinLengthFrac}));
    borders=Object.assign({binary,rules},T('layout',()=>analyseBorders(rules,W,H,p.borders,binary)));
    if(p.borders.erase){ const r=T('inpaint',()=>inpaintRules(work,borders.eraseMask,W,H)); clean=r.imageData; eraseMask=borders.eraseMask; }
  }
  const raw=T('sauvola',()=>sauvolaCPU(clean,p.sauvola));
  const luma=new Uint8Array(W*H); for(let i=0,j=0;i<W*H;i++,j+=4) luma[i]=(0.299*clean.data[j]+0.587*clean.data[j+1]+0.114*clean.data[j+2])|0;
  if(eraseMask) for(let i=0;i<raw.length;i++) if(eraseMask[i]) raw[i]=0;
  const healed=T('dilate',()=>dilateCPU(raw,W,H,1,1));
  const TL=T('textLines',()=>analyseTextLines(raw,healed,W,H,p,luma));
  const C=T('columns',()=>detectColumns(TL,p.columns,(p.borders.feedColumns&&borders)?borders.layout:null));
  return {W,H,p,borders,TL,C,timing:t,canvas:cv};
}

export function summarise(C){
  const B=C.band;
  return {band:B?B.first+'-'+B.last:null, rows:B?B.rows.length:0, columns:C.columns.length, seed:B&&B.seed, parts:B&&B.parts, foreign:B&&B.foreignRows, footerCut:B&&B.footerCut, fromBorders:B&&B.fromBorders, priorKind:C.priorKind,
    runs:C.runs.map(r=>r.first+'-'+r.last+' n'+r.count+' g'+r.gutters+' s'+r.score+(r.rejected?' ✗'+r.rejected:'')+(r.mergedIn?' ✓':'')),
    rowList:C.rows.map(r=>r.index+':'+Math.round(r.row.ink.y0)+' p'+r.pieces+' '+r.kind[0]).join(' | ')};
}
