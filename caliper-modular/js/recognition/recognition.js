/* ======================================================================
   CHARACTER RECOGNITION  ·  Tesseract.js over the clean text lines
   Why: the earlier stages know exactly where every symbol is; what they
   do not know is which symbol it is. Recognising each full line with a
   trained LSTM engine is far more accurate than classifying isolated
   characters, so this stage:
     1. loads Tesseract.js from the jsDelivr CDN on first use (the WASM
        core and the language data are fetched once and cached by the
        browser) and starts one worker in single-line mode (PSM 7) with
        the dictionaries OFF — invoices are codes and amounts, and a
        dictionary "corrects" 6D02865 into a word;
     2. builds a crop for every full line from the binary ink of the row's
        OWN glyphs (punctuation-sized members drawn 1 px fatter so the
        engine's noise filter keeps a decimal point), sheared level with
        the page slope and upscaled to the target glyph height; optionally
        a 2 px ring of normalised grayscale from the rules-erased image is
        added around the ink (off by default — it helped clean scans in
        testing but blurred tight bold digits together);
     3. reconciles the character boxes with what was read, word by word:
        the engine's WORD text is the reliable signal (its symbol boxes are
        not on touching glyphs). As many boxes under a word as it has
        characters → one to one in reading order; otherwise the word's
        region is re-segmented into exactly that many boxes at the best ink
        valleys. Words without boxes fall back to a symbol alignment.
     4. keeps the engine's line and word text, and builds the text of
        every table cell from the characters inside it.
   The stage covers the WHOLE page: every full line is recognised, and any
   accepted piece the full-line join or the table band did not cover is
   recognised on its own afterwards, so no text on the page is skipped.
   ====================================================================== */
import { dilateCPU } from '../morph/morph.js';

const CDN='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let libraryPromise=null, workerPromise=null, workerLanguage='';

function loadLibrary(){
  if(window.Tesseract) return Promise.resolve(window.Tesseract);
  if(!libraryPromise) libraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script'); script.src=CDN;
    script.onload=()=>resolve(window.Tesseract);
    script.onerror=()=>{ libraryPromise=null; reject(new Error('could not load Tesseract.js from the CDN (network?)')); };
    document.head.appendChild(script);
  });
  return libraryPromise;
}
async function getWorker(language,onProgress){
  const Tesseract=await loadLibrary();
  if(workerPromise && workerLanguage===language) return workerPromise;
  if(workerPromise){ const old=await workerPromise; try{ await old.terminate(); }catch(e){} }
  workerLanguage=language;
  workerPromise=(async()=>{
    const worker=await Tesseract.createWorker(language,1,{logger:m=>{ if(onProgress && m.status) onProgress(m.status, m.progress||0); }},
      {load_system_dawg:'0', load_freq_dawg:'0'});          // init-time: no dictionary bias on codes and amounts
    await worker.setParameters({tessedit_pageseg_mode:'7', preserve_interword_spaces:'1', user_defined_dpi:'300'});
    return worker;
  })();
  return workerPromise;
}

/* collect symbols / words from a v5 result whatever its shape */
function collectSymbols(data){
  if(Array.isArray(data.symbols) && data.symbols.length) return data.symbols;
  const out=[];
  for(const block of data.blocks||[]) for(const para of block.paragraphs||[]) for(const line of para.lines||[]) for(const word of line.words||[]) for(const sym of word.symbols||[]) out.push(sym);
  return out;
}
function collectWords(data){
  if(Array.isArray(data.words) && data.words.length) return data.words;
  const out=[];
  for(const block of data.blocks||[]) for(const para of block.paragraphs||[]) for(const line of para.lines||[]) for(const word of line.words||[]) out.push(word);
  return out;
}

/* textLines  : S.textLines (cleanBinary, fullLines)
   characters : S.characters (characters with bb, line, cell)
   W,H        : image size
   params     : {language, targetHeight}
   onProgress : (label) => void
   Returns {lines:[{rowIndex, text, confidence, symbols, words}], characters:n,
            recognised:n, cells:[[text]], available:true} or {available:false, error} */
export async function recognizeText(textLines,characters,columns,W,H,params,onProgress){
  let worker;
  try{ worker=await getWorker(params.language||'eng',(status,progress)=>onProgress&&onProgress('loading engine · '+status+' '+Math.round(progress*100)+'%')); }
  catch(e){ return {available:false, error:e.message, lines:[], recognised:0}; }

  const ink=textLines.cleanBinary, labels=textLines.labels, rows=textLines.fullLines.rows, luma=textLines.luma||null;
  const slope=textLines.fullLines.slope||0;
  const reference=textLines.stats.reference||20;
  const scale=Math.max(1,Math.min(4,Math.round((params.targetHeight||30)/Math.max(8,reference))));
  const byLine=new Map();                          // chainIndex → characters
  for(const ch of characters.characters){ if(!byLine.has(ch.line)) byLine.set(ch.line,[]); byLine.get(ch.line).push(ch); }
  const chainRowIndex=new Map();                   // piece (chain) → full-line row index
  rows.forEach((row,ri)=>{ for(const piece of row.lines) chainRowIndex.set(piece,ri); });

  const results=[]; let recognised=0;
  const done=new Set();
  const replacements=new Map(), removed=new Set();  // reconciliation: char → split pieces, merged-away chars                            // pieces already recognised (a rescued piece can sit in two rows)
  /* recognise one row-like object {lines:[pieces], ink, dy}; returns the result record */
  const recogniseRow=async(row,ri,label)=>{
    if(onProgress) onProgress(label);
    /* the row's own pixels, sheared level: a pixel (x,y) of the page goes
       to (x - x0, y - slope·(x - xc) - yTop) so the drifting baseline is
       flat; yTop/yBottom are the de-skewed extent of the row's members */
    const memberLabels=new Set(); for(const piece of row.lines) for(const m of piece.words) memberLabels.add(m.label);
    const xc=(row.ink.x0+row.ink.x1)/2;
    const pad=Math.round(0.5*reference);
    const x0=Math.max(0,row.ink.x0-pad), x1=Math.min(W-1,row.ink.x1+pad);
    const yTop=Math.floor(row.dy.y0+slope*xc)-pad, yBottom=Math.ceil(row.dy.y1+slope*xc)+pad;   // de-skewed extent, referred to xc
    const cw=x1-x0+1, chh=yBottom-yTop+1;
    if(cw<2||chh<2||cw*chh>16e6) return {rowIndex:ri, text:'', confidence:0, symbols:[], words:[]};
    /* crop: the row's own glyph pixels (member labels), grown by a small
       margin so the anti-aliased edges survive, filled from the grayscale
       image and normalised (ink → 0, paper → 255); everything else white */
    const mask=new Uint8Array(cw*chh), smallMask=new Uint8Array(cw*chh);
    // punctuation-sized members (periods, commas, the dot of an i) are
    // drawn 1 px fatter: the engine discards specks below its noise size,
    // and a decimal point the threshold barely caught would vanish
    const smallLabels=new Set(); for(const piece of row.lines) for(const m of piece.words) if((m.bb.y1-m.bb.y0+1)<0.45*reference) smallLabels.add(m.label);
    for(let x=row.ink.x0;x<=row.ink.x1;x++){
      const shift=slope*(x-xc);
      for(let y=row.ink.y0;y<=row.ink.y1;y++){ const i=y*W+x;
        if(!ink[i] || !memberLabels.has(labels[i])) continue;
        const yy=Math.round(y-shift)-yTop, xx=x-x0;
        if(yy<0||yy>=chh) continue;
        mask[yy*cw+xx]=1; if(smallLabels.has(labels[i])) smallMask[yy*cw+xx]=1;
      }
    }
    if(smallLabels.size){ const fat=dilateCPU(smallMask,cw,chh,1,1); for(let k=0;k<mask.length;k++) if(fat[k]) mask[k]=1; }
    let inkCount=0; for(let i=0;i<mask.length;i++) inkCount+=mask[i];
    if(!inkCount) return {rowIndex:ri, text:'', confidence:0, symbols:[], words:[]};
    const grown=dilateCPU(mask,cw,chh,2,2);
    const img=new ImageData(cw,chh), d=img.data; d.fill(255);
    if(luma && params.grayscaleEdges){
      // contrast levels from the row's own pixels: ink = 5th percentile of
      // masked luma, paper = 90th percentile of the unmasked neighbourhood
      const inkVals=[], paperVals=[];
      for(let yy=0;yy<chh;yy++){ const shiftBack=y=>y; for(let xx=0;xx<cw;xx++){
        const x=x0+xx, shift=slope*(x-xc), y=Math.round(yy+yTop+shift); if(y<0||y>=H||x>=W) continue;
        const v=luma[y*W+x]; if(mask[yy*cw+xx]) inkVals.push(v); else if((xx+yy)%7===0) paperVals.push(v); } }
      inkVals.sort((a,b)=>a-b); paperVals.sort((a,b)=>a-b);
      const inkLevel=inkVals.length?inkVals[Math.floor(inkVals.length*0.05)]:0;
      const paperLevel=paperVals.length?paperVals[Math.floor(paperVals.length*0.9)]:255;
      const span=Math.max(24,paperLevel-inkLevel);
      // binary core + soft edges: every pixel the binary calls ink is
      // solid black (the engine never sees less than the binary had — a
      // period the threshold barely caught stays a period), and only the
      // 2 px ring around the ink keeps the anti-aliased grayscale, with a
      // steep gamma so mid-greys read as ink rather than paper
      for(let yy=0;yy<chh;yy++) for(let xx=0;xx<cw;xx++){
        const k=yy*cw+xx; if(!grown[k]) continue;
        const o=k*4;
        if(mask[k]){ d[o]=d[o+1]=d[o+2]=0; continue; }
        const x=x0+xx, shift=slope*(x-xc), y=Math.round(yy+yTop+shift); if(y<0||y>=H||x>=W) continue;
        const t=Math.max(0,Math.min(1,(luma[y*W+x]-inkLevel)/span));
        d[o]=d[o+1]=d[o+2]=Math.round(Math.pow(t,2.2)*255);
      }
    } else {
      for(let k=0;k<mask.length;k++) if(mask[k]){ const o=k*4; d[o]=d[o+1]=d[o+2]=0; }
    }
    const small=document.createElement('canvas'); small.width=cw; small.height=chh; small.getContext('2d').putImageData(img,0,0);
    const crop=document.createElement('canvas'); crop.width=cw*scale; crop.height=chh*scale;
    const cctx=crop.getContext('2d'); cctx.fillStyle='#fff'; cctx.fillRect(0,0,crop.width,crop.height);
    cctx.imageSmoothingEnabled=true; cctx.drawImage(small,0,0,crop.width,crop.height);
    let data;
    try{ ({data}=await worker.recognize(crop,{},{text:true,blocks:true})); }
    catch(e){ return {rowIndex:ri, text:'', confidence:0, symbols:[], words:[], error:e.message}; }
    // engine boxes → page coordinates, undoing the scale and the shear at the box's own x
    const toPage=s=>{ const sx0=x0+s.bbox.x0/scale, sx1=x0+s.bbox.x1/scale, shift=slope*((sx0+sx1)/2-xc);
      return {text:s.text, confidence:s.confidence, bb:{x0:sx0, y0:yTop+s.bbox.y0/scale+shift, x1:sx1, y1:yTop+s.bbox.y1/scale+shift}}; };
    const symbols=collectSymbols(data).map(toPage);
    const words=collectWords(data).map(toPage).filter(w=>w.text&&w.text.trim());
    // assign each symbol to the character box it overlaps most
    const lineChars=[]; for(const piece of row.lines){ const idx=textLines.chains.indexOf(piece); if(byLine.has(idx)) lineChars.push(...byLine.get(idx)); }
    /* sequence alignment (dynamic programming) between the engine's
       symbols and our character boxes, both in reading order, maximising
       the total box overlap with free skips on either side. Greedy
       matching slips by one whenever the two counts differ (a touching
       "ei" is one box for us and two symbols for the engine); alignment
       does not. A symbol left unmatched whose box lies mostly inside an
       already matched character is appended to that character's text, so
       an under-segmented box still carries every symbol it contains.    */
    const score=(ch,sym)=>{
      const ox=Math.min(ch.bb.x1+1,sym.bb.x1)-Math.max(ch.bb.x0,sym.bb.x0);
      const oy=Math.min(ch.bb.y1+1,sym.bb.y1)-Math.max(ch.bb.y0,sym.bb.y0);
      if(ox<=0||oy<=0) return 0;
      let overlap=ox*oy/((ch.bb.x1-ch.bb.x0+1)*(ch.bb.y1-ch.bb.y0+1));
      const cx=(ch.bb.x0+ch.bb.x1)/2, cy=(ch.bb.y0+ch.bb.y1)/2;
      if(cx>=sym.bb.x0 && cx<=sym.bb.x1 && cy>=sym.bb.y0 && cy<=sym.bb.y1) overlap=Math.max(overlap,0.5);
      return overlap; };
    const symsAll=symbols.filter(sy=>sy.text&&sy.text.trim()).sort((u,v)=>u.bb.x0-v.bb.x0);
    const charsAll=lineChars.slice().sort((u,v)=>u.bb.x0-v.bb.x0);
    const matchedSym=new Set(), matchedChar=new Set();
    /* per WORD, the engine's word text is the reliable signal; its symbol
       boxes are not (touching bold glyphs give it boxes that overlap and
       span neighbours). So: as many character boxes under the word as the
       word has characters → one to one in reading order; otherwise the
       word's region is RE-SEGMENTED into exactly that many boxes at the
       best ink valleys, and the characters are assigned in order. */
    for(const wd of words){
      const text=(wd.text||'').replace(/\s+/g,''); const N=text.length; if(!N) continue;
      const inWord=charsAll.filter(ch=>{ const cx=(ch.bb.x0+ch.bb.x1)/2; return cx>=wd.bb.x0-2 && cx<=wd.bb.x1+2 && !matchedChar.has(ch); });
      const wsyms=symsAll.filter(sy=>{ const sx=(sy.bb.x0+sy.bb.x1)/2; return sx>=wd.bb.x0-2 && sx<=wd.bb.x1+2 && !matchedSym.has(sy); });
      if(!inWord.length) continue;
      if(inWord.length===N){
        inWord.forEach((ch,k)=>{ const sy=wsyms[k]; if(!ch.text) recognised++;
          ch.text=text[k]; ch.confidence=sy?sy.confidence:wd.confidence; ch.symBox=sy?sy.bb:null; matchedChar.add(ch); if(sy) matchedSym.add(sy); });
        continue;
      }
      // re-segment the union of the boxes under the word into N pieces
      const memberSet=new Set(); const members=[]; let ux0=1/0,uy0=1/0,ux1=-1/0,uy1=-1/0;
      for(const ch of inWord){ for(const m of ch.members){ if(!memberSet.has(m)){ memberSet.add(m); members.push(m); } }
        ux0=Math.min(ux0,ch.bb.x0); uy0=Math.min(uy0,ch.bb.y0); ux1=Math.max(ux1,ch.bb.x1); uy1=Math.max(uy1,ch.bb.y1); }
      const memberLabelSet=new Set(members.map(m=>m.label));
      const w=ux1-ux0+1, profile=new Uint16Array(w);
      for(let x=ux0;x<=ux1;x++){ let n=0; for(let y=uy0;y<=uy1;y++){ const i=y*W+x; if(ink[i] && memberLabelSet.has(labels[i])) n++; } profile[x-ux0]=n; }
      let mean=0; for(const v of profile) mean+=v; mean/=w;
      const minPiece=Math.max(2,Math.round(0.4*w/N));
      const candidates=[];
      for(let x=minPiece;x<w-minPiece;x++) if(profile[x]<=profile[x-1] && profile[x]<=profile[x+1] && profile[x]<=0.6*mean) candidates.push(x);
      candidates.sort((a,b)=>profile[a]-profile[b]);
      const cuts=[];
      for(const x of candidates){ if(cuts.length>=N-1) break; if(cuts.every(cx=>Math.abs(cx-x)>=minPiece)) cuts.push(x); }
      while(cuts.length<N-1){                        // fill the widest remaining segment at its midpoint
        const bounds=[0,...cuts.slice().sort((a,b)=>a-b),w]; let bi=0,bw=-1;
        for(let k=0;k<bounds.length-1;k++){ const seg=bounds[k+1]-bounds[k]; if(seg>bw){ bw=seg; bi=k; } }
        if(bw<2*minPiece) break;
        cuts.push(Math.round((bounds[bi]+bounds[bi+1])/2));
      }
      cuts.sort((a,b)=>a-b);
      if(cuts.length!==N-1){ /* cannot honour the count: fall back to the alignment below */ continue; }
      const template=inWord[0];
      const pieces=[]; let start=0;
      for(const cut of cuts.concat([w])){
        let a=start,b=cut-1; while(a<b && !profile[a]) a++; while(b>a && !profile[b]) b--;
        pieces.push({a,b}); start=cut;
      }
      pieces.forEach((pc,k)=>{
        let y0=uy1,y1=uy0; for(let x=ux0+pc.a;x<=ux0+pc.b;x++) for(let y=uy0;y<=uy1;y++){ const i=y*W+x; if(ink[i] && memberLabelSet.has(labels[i])){ if(y<y0)y0=y; if(y>y1)y1=y; } }
        if(y0>y1){ y0=uy0; y1=uy1; }
        const bb={x0:ux0+pc.a,y0,x1:ux0+pc.b,y1};
        const nc={...template, bb, width:bb.x1-bb.x0+1, height:bb.y1-bb.y0+1, members, kind:'engine-resegmented', text:text[k], confidence:wd.confidence, symBox:null};
        pieces[k]=nc;
      });
      recognised+=N-inWord.filter(ch=>ch.text).length;
      replacements.set(inWord[0],pieces); for(let k=1;k<inWord.length;k++){ inWord[k].resegmented=true; removed.add(inWord[k]); }
      for(const ch of inWord) matchedChar.add(ch);
      for(const sy of wsyms) matchedSym.add(sy);
    }
    const syms=symsAll.filter(sy=>!matchedSym.has(sy));
    const chars=charsAll.filter(ch=>!matchedChar.has(ch));
    const nS=syms.length, nC=chars.length;
    const dp=Array.from({length:nS+1},()=>new Float64Array(nC+1));   // 64-bit: the backtrack compares exact sums
    for(let i=1;i<=nS;i++) for(let j=1;j<=nC;j++){
      const sc=score(chars[j-1],syms[i-1]);
      dp[i][j]=Math.max(dp[i-1][j], dp[i][j-1], sc>0.05?dp[i-1][j-1]+sc:-1);
    }
    for(let i=nS,j=nC;i>0&&j>0;){
      const sc=score(chars[j-1],syms[i-1]);
      if(sc>0.05 && Math.abs(dp[i][j]-(dp[i-1][j-1]+sc))<1e-6){
        const ch=chars[j-1], sym=syms[i-1];
        if(!ch.text) recognised++;
        ch.text=sym.text; ch.confidence=sym.confidence; ch.symBox=sym.bb; matchedSym.add(sym); i--; j--;
      } else if(dp[i-1][j]>=dp[i][j-1]) i--; else j--;
    }
    /* reconciliation: symbols the alignment left over that lie inside a
       character box → that box holds several symbols and is SPLIT at the
       symbol boundaries; a matched symbol whose box also covers empty
       neighbouring boxes → those were over-segmented and are MERGED */
    const extras=new Map();                                  // char → [unmatched symbols inside it]
    for(const sym of symsAll){
      if(matchedSym.has(sym)) continue;
      const sw=(sym.bb.x1-sym.bb.x0)||1;
      for(const ch of charsAll){
        const inside=(Math.min(ch.bb.x1+1,sym.bb.x1)-Math.max(ch.bb.x0,sym.bb.x0))/sw;
        if(inside>=0.6){ if(!extras.has(ch)) extras.set(ch,[]); extras.get(ch).push(sym); break; } }
    }
    for(const [ch,list] of extras){
      const all=list.concat(ch.text?[{text:ch.text,confidence:ch.confidence,bb:ch.symBox||ch.bb}]:[]).sort((a,b)=>a.bb.x0-b.bb.x0);
      if(all.length<2){ if(!ch.text){ ch.text=all[0].text; ch.confidence=all[0].confidence; recognised++; } continue; }
      // split the box at the symbol boundaries
      const pieces=all.map((sy,k)=>{
        const x0p=k===0?ch.bb.x0:Math.round((all[k-1].bb.x1+sy.bb.x0)/2), x1p=k===all.length-1?ch.bb.x1:Math.round((sy.bb.x1+all[k+1].bb.x0)/2)-1;
        return {...ch, bb:{x0:Math.max(ch.bb.x0,x0p),y0:ch.bb.y0,x1:Math.min(ch.bb.x1,Math.max(x0p,x1p)),y1:ch.bb.y1}, width:0, text:sy.text, confidence:sy.confidence, kind:'engine-split', members:ch.members}; });
      pieces.forEach(pc=>{ pc.width=pc.bb.x1-pc.bb.x0+1; });
      if(!ch.text) recognised+=pieces.length; else recognised+=pieces.length-1;
      replacements.set(ch,pieces);
    }
    // merges: a matched symbol covering ≥ 60 % of an empty neighbour
    for(const ch of charsAll){
      if(!ch.text || replacements.has(ch)) continue;
      const sym=ch.symBox; if(!sym) continue;
      for(const other of charsAll){
        if(other===ch || other.text || replacements.has(other) || removed.has(other)) continue;
        const ow=(other.bb.x1-other.bb.x0+1);
        const inside=(Math.min(other.bb.x1+1,sym.x1)-Math.max(other.bb.x0,sym.x0))/ow;
        if(inside>=0.6){ ch.bb={x0:Math.min(ch.bb.x0,other.bb.x0),y0:Math.min(ch.bb.y0,other.bb.y0),x1:Math.max(ch.bb.x1,other.bb.x1),y1:Math.max(ch.bb.y1,other.bb.y1)};
          ch.width=ch.bb.x1-ch.bb.x0+1; ch.members=ch.members.concat(other.members); ch.kind='engine-merged'; removed.add(other); }
      }
    }
    for(const piece of row.lines) done.add(piece);
    return {rowIndex:ri, text:(data.text||'').trim(), confidence:data.confidence||0, symbols, words, crop:params.keepCrops?crop:undefined};
  };

  /* pass 1 · every full line of the page */
  for(let ri=0;ri<rows.length;ri++){
    const row=rows[ri];
    if(!row.lines.some(p=>!done.has(p))) continue;          // all of its pieces were covered by a merged row
    results.push(await recogniseRow(row,ri,'recognising line '+(ri+1)+' / '+rows.length));
  }
  /* pass 2 · WHOLE-PAGE guarantee: any accepted piece not covered by a
     row (whatever the full-line join or the table band did with it) is
     recognised on its own */
  let extra=0;
  for(const piece of textLines.accepted||[]){
    if(done.has(piece) || !piece.words || !piece.words.length) continue;
    extra++;
    const cxp=(piece.ink.x0+piece.ink.x1)/2;
    const res=await recogniseRow({lines:[piece], ink:piece.ink, dy:piece.dy||{y0:piece.ink.y0-slope*cxp, y1:piece.ink.y1-slope*cxp}}, -1, 'recognising loose piece '+extra);
    res.loosePiece=true; results.push(res);
  }

  /* apply the reconciliation to the character stage's lists */
  let engineSplit=0, engineMerged=0, engineResegmented=0;
  const rebuild=list=>{ const out=[];
    for(const ch of list){ if(removed.has(ch)){ if(!ch.resegmented) engineMerged++; continue; }
      if(replacements.has(ch)){ const pcs=replacements.get(ch); if(pcs[0]&&pcs[0].kind==='engine-resegmented') engineResegmented++; else engineSplit++; out.push(...pcs); } else out.push(ch); }
    out.sort((a,b)=>a.bb.x0-b.bb.x0); out.forEach((c,i)=>c.index=i); return out; };
  for(const line of characters.lines) line.characters=rebuild(line.characters);
  characters.characters=characters.lines.flatMap(l=>l.characters);
  characters.stats.characters=characters.characters.length;
  characters.stats.engineSplit=engineSplit; characters.stats.engineMerged=engineMerged; characters.stats.engineResegmented=engineResegmented;
  recognised=characters.characters.filter(c=>c.text).length;

  const cells=buildCellTexts(characters,columns,reference);
  return {available:true, language:params.language||'eng', scale, lines:results, recognised, loosePieces:extra,
          characters:characters.characters.length, cells};
}

/* Text of every table cell from the characters inside it, in reading
   order (a space where the gap exceeds 0.4 glyph height, a middle dot for
   a character with no symbol). Re-run after the table is refined.       */
export function buildCellTexts(characters,columns,reference){
  if(!columns || !columns.band) return null;
  const cells=columns.band.rows.map(()=>columns.columns.map(()=>''));
  const perCell=new Map();
  for(const ch of characters.characters){ if(!ch.cell) continue; const key=ch.cell.row+','+ch.cell.col;
    if(!perCell.has(key)) perCell.set(key,[]); perCell.get(key).push(ch); }
  for(const [key,chars] of perCell){
    chars.sort((a,b)=>a.bb.x0-b.bb.x0);
    let text='', prev=null;
    for(const ch of chars){
      if(prev && ch.bb.x0-prev.bb.x1-1>0.4*reference) text+=' ';
      text+=ch.text||'\u00b7'; prev=ch;
    }
    const [r,c]=key.split(',').map(Number); cells[r][c]=text;
  }
  return cells;
}
