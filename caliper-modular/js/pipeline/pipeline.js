/* ======================================================================
   PIPELINE DRIVER
   Why: something has to be the conductor. readParams snapshots every
   control into one structured object; runPipeline sequences the stages:
     1 · lens distortion         (section 00b, optional)
     2 · perspective rectification
     3 · borders: rules → layout → rules-erased image   (section 02)
     4 · text-line clean         (section 03)
     5 · columns                 (section 04)
     6 · characters              (section 05)
     7 · recognition             (section 06, Tesseract.js on first use)
     8 · footer split by keywords (the table ends before "Sub Total" …)
     8b · header rule            (a known title layout fixes the columns)
     9 · final                   (best of local + API, see final.js)
   and then renders the gallery. Step 2b, between rectification and the
   borders, POSTs the rectified image to the PaddleOCR API without waiting.
   ====================================================================== */
import { $, overlay, runBtn, stepLabel, savePng, saveJson, showError } from '../dom/dom.js';
import { S } from '../state/state.js';
import { gpuSauvola, gpuMorph } from '../webgpu/webgpu.js';
import { correctLensDistortion } from '../lens/lens.js';
import { rectifyPerspective } from '../rectify/rectify.js';
import { detectBorders } from '../borders/borders.js';
import { analyseBorders, inpaintRules } from '../borderlayout/borderlayout.js';
import { detectTextLines } from '../textlines/textlines.js';
import { detectColumns } from '../columns/columns.js';
import { segmentCharacters, assignCells } from '../characters/characters.js';
import { recognizeText, buildCellTexts, refineCellsByColumn } from '../recognition/recognition.js';
import { buildGallery, showStage, refreshStages } from '../gallery/gallery.js';
import { startApiAnalysis } from '../api/api.js';
import { buildFinal } from '../final/final.js';
import { matchHeaderRule, applyHeaderRule } from '../headerrule/headerrule.js';
import { updateFinalJson } from '../ui/ui.js';
import { fitView } from '../viewport/viewport.js';

export const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>resolve()));
const num=id=>+$(id).value, on=id=>$(id).checked;

/* Snapshot of every control, grouped by the stage that consumes it. */
export function readParams(){
  const window=num('sauvolaWindow');
  return {
    rectify:on('rectify'),
    sauvola:{ radius:(window-1)>>1, k:num('sauvolaK'), R:num('sauvolaR'), invert:on('invert') },
    components:{ minArea:num('minArea'), connectivity8:$('connectivity').querySelector('.on').dataset.c==='8' },
    rules:{ k:num('rulesK'), minLengthFrac:num('rulesMinLength'),
            maxGapH:num('rulesGapH'), maxGapV:num('rulesGapV'), openKernelH:num('rulesOpenH'), openKernelV:num('rulesOpenV'),
            maxThickness:num('rulesMaxThickness'), minCoverage:num('rulesMinCoverage'), smoothingRadius:num('rulesSmoothing'),
            detectDashed:on('rulesDashed'), dotMaxSize:num('rulesDotMaxSize'), dotMinCount:num('rulesDotMinCount'),
            dotStrideRatio:num('rulesDotStride'), dashedMinLengthFrac:num('rulesDashedMinLength') },
    borders:{ enabled:on('bordersEnable'), longRuleFrac:num('bordersLongRule'), sectionRuleFrac:num('bordersSectionRule'),
              erase:on('bordersErase'), feedColumns:on('bordersFeedColumns') },
    textLines:{ enabled:on('tlEnable'), minGlyphHeight:num('tlMinGlyphHeight'), maxGlyphHeight:num('tlMaxGlyphHeight'),
                maxGlyphAspect:num('tlMaxGlyphAspect'), chainGap:num('tlChainGap'), minOverlap:num('tlMinOverlap'), minGlyphs:num('tlMinGlyphs') },
    columns:{ enabled:on('clEnable'), headerRules:on('clHeaderRules'), minPieces:num('clMinPieces'), rowGap:num('clRowGap'), mergeGap:num('clMergeGap'),
              minGutterWidth:num('clGutterWidth'), maxGutterCoverage:num('clGutterCoverage') },
    characters:{ enabled:on('chEnable'), joinOverlap:num('chJoinOverlap'), splitRatio:num('chSplitRatio'),
                 valleyDepth:num('chValleyDepth'), minCharWidth:num('chMinWidth') },
    api:{ enabled:on('apiEnable'), url:$('apiUrl').value.trim(), depth:$('apiDepth').value },
    recognition:{ enabled:on('rcEnable'), language:$('rcLanguage').value, targetHeight:num('rcTargetHeight'), cropStyle:$('rcCrop').value, cellPass:on('rcCellPass') }
  };
}

/* Rule detection on the working image: Sauvola at the border k, the
   bridge → erode → dilate opening chains on the GPU, then detectBorders. */
async function detectRules(imageData,p){
  const binary=await gpuSauvola(imageData,{...p.sauvola, k:p.rules.k});
  const opening=axis=>gpuMorph(binary,S.W,S.H,[
    {op:'bridge',axis,radius:axis==='h'?p.rules.maxGapH:p.rules.maxGapV},
    {op:'erode', axis,radius:axis==='h'?p.rules.openKernelH:p.rules.openKernelV},
    {op:'dilate',axis,radius:axis==='h'?p.rules.openKernelH:p.rules.openKernelV}]);
  const hOpened=await opening('h'), vOpened=await opening('v');
  const rules=detectBorders(binary,S.W,S.H,{
    maxGapH:p.rules.maxGapH, maxGapV:p.rules.maxGapV, openKernelH:p.rules.openKernelH, openKernelV:p.rules.openKernelV,
    maxThickness:p.rules.maxThickness, minCoverage:p.rules.minCoverage, smoothingRadius:p.rules.smoothingRadius,
    minLenFrac:p.rules.minLengthFrac, hOpenedPrecomputed:hOpened, vOpenedPrecomputed:vOpened,
    detectDashed:p.rules.detectDashed, maxDotSize:p.rules.dotMaxSize, minDots:p.rules.dotMinCount,
    minStrideToSizeRatio:p.rules.dotStrideRatio, minLenFracDashed:p.rules.dashedMinLengthFrac });
  return {binary, rules};
}

export async function runPipeline(){
  if(!S.device || !S.origImageData) return;
  const p=readParams();
  overlay.classList.add('show'); runBtn.disabled=true;
  S.pipelineDone=false; S.api=null; S.final=null;
  const timing={};
  const step=async(label)=>{ stepLabel.textContent=label; await nextFrame(); };
  const timed=async(name,fn)=>{ const t0=performance.now(); const r=await fn(); timing[name]=performance.now()-t0; return r; };
  try{
    /* 1–2 · geometric correction (both skipped when Rectify image is off) */
    await timed('lens', async()=>{
      let lens=null;
      if(p.rectify){ await step('1 · lens distortion'); try{ lens=correctLensDistortion(S.origCanvas); }catch(e){ lens=null; } }
      S.lensCanvas=lens||S.origCanvas; });
    await timed('rectify', async()=>{
      let rectified=null;
      if(p.rectify){ await step('2 · perspective rectification'); try{ rectified=rectifyPerspective(S.lensCanvas); }catch(e){ rectified=null; } }
      S.workCanvas=rectified||S.lensCanvas;
      S.workImageData=(S.workCanvas===S.origCanvas)?S.origImageData:S.workCanvas.getContext('2d').getImageData(0,0,S.W,S.H); });

    /* 2b · PaddleOCR API — fire and forget: the rectified image goes out
          now; the stage and the FINAL stages fill in whenever the answer
          arrives, whether the pipeline is still running or long done */
    if(p.api.enabled && p.api.url){
      const url=p.api.url+(p.api.url.includes('?')?'&':'?')+'depth='+encodeURIComponent(p.api.depth);
      const entry=startApiAnalysis(S.workCanvas,url);
      S.api=entry;
      entry.promise.then(async()=>{
        if(S.api!==entry) return;                          // a newer run replaced this request
        if(S.galleryPromise) await S.galleryPromise;       // never race the gallery build
        if(S.api!==entry) return;
        if(S.pipelineDone){ S.final=buildFinal(); updateFinalJson(); }   // both sides are in: finalise
        $('statApi').textContent = entry.status==='done' ? Math.round(entry.ms)+' ms' : 'failed';
        refreshStages(['api-engine','api-ocr','final-compare','final-table']);
      });
    }

    /* 3 · borders → layout → rules-erased image */
    await timed('borders', async()=>{
      S.borders=null;
      if(p.borders.enabled){
        await step('3 · borders · rules');
        const {binary,rules}=await detectRules(S.workImageData,p);
        S.borders=Object.assign({binary,rules}, analyseBorders(rules,S.W,S.H,p.borders,binary));
      }
      if(S.borders && p.borders.erase){
        const r=inpaintRules(S.workImageData,S.borders.eraseMask,S.W,S.H);
        S.cleanCanvas=r.canvas; S.cleanImageData=r.imageData; S.borders.cleanCanvas=r.canvas;
      } else { S.cleanCanvas=S.workCanvas; S.cleanImageData=S.workImageData; if(S.borders) S.borders.cleanCanvas=null; } });

    /* 4 · text-line clean */
    await timed('textLines', async()=>{
      S.textLines=null;
      if(p.textLines.enabled){
        await step('4 · text lines · clean');
        S.textLines=await detectTextLines(S.cleanImageData,p,(p.borders.erase&&S.borders)?S.borders.eraseMask:null);
      } });

    /* 5 · columns */
    await timed('columns', async()=>{
      S.columns=null;
      if(p.columns.enabled && S.textLines){
        await step('5 · columns');
        S.columns=detectColumns(S.textLines,p.columns,(p.borders.feedColumns&&S.borders)?S.borders.layout:null);
      } });

    /* 6 · characters */
    await timed('characters', async()=>{
      S.characters=null;
      if(p.characters.enabled && S.textLines){
        await step('6 · characters');
        S.characters=segmentCharacters(S.textLines,S.columns,S.W,S.H,p.characters);
      } });

    /* 7 · recognition (Tesseract.js, loaded on first use) */
    await timed('recognition', async()=>{
      S.recognition=null;
      if(p.recognition.enabled && S.characters){
        await step('7 · recognition');
        S.recognition=await recognizeText(S.textLines,S.characters,S.columns,S.W,S.H,p.recognition,
          label=>{ stepLabel.textContent='7 · '+label; });
        await nextFrame();
      } });

    /* 8 · footer split by keywords — the recognised text names the
          totals: band rows reading Sub Total / Grand Total / Total /
          Amount in words / Free Product are handed to the column stage,
          which ends the table before the first one that is not a
          sub-total inside the table. The characters' cells and cell
          texts follow. */
    if(S.recognition && S.recognition.available && S.columns && S.columns.band){
      const FOOTER=/\b(sub\s*total|grand\s*total|net\s*total|total\s*(amount|payable|value)?\s*:|amount\s+in\s+(tk|taka|words|figures)|in\s+words|free\s+product)/i;
      const band=S.columns.band;
      const footerRows=[];
      for(const res of S.recognition.lines){
        if(res.rowIndex<0) continue;
        const rowInfo=S.columns.rows[res.rowIndex];
        if(!rowInfo || rowInfo.kind!=='table' || res.rowIndex<=band.first) continue;
        if(FOOTER.test(res.text||'')) footerRows.push(res.rowIndex);
      }
      if(footerRows.length){
        S.columns=detectColumns(S.textLines,p.columns,(p.borders.feedColumns&&S.borders)?S.borders.layout:null,{footerRows});
        if(S.characters){ S.characters.stats.inCells=assignCells(S.characters.characters,S.columns);
          S.recognition.cells=buildCellTexts(S.characters,S.columns,S.textLines.stats.reference||20); }
      }
    }

    /* 8b · header rule — the recognised title words name the template:
          when one of config/headerrules.js matches, its columns replace
          the profile's (number, order, meaning; boundaries snapped to the
          detected gutters) and the cells follow. No match: the arbitrary
          columns stand. */
    S.headerRuleMatch=null;
    if(p.columns.headerRules && S.columns && S.columns.band){
      const m=matchHeaderRule(S.columns,S.recognition,S.api);
      if(m && applyHeaderRule(S.columns,m)){
        S.headerRuleMatch=m;
        if(S.characters){ S.characters.stats.inCells=assignCells(S.characters.characters,S.columns);
          if(S.recognition && S.recognition.available) S.recognition.cells=buildCellTexts(S.characters,S.columns,S.textLines.stats.reference||20); }
      }
    }

    /* 8c · cell pass — numeric and code columns read again cell by cell
          with a character whitelist, now that the columns are named */
    if(p.recognition.enabled && p.recognition.cellPass && S.recognition && S.recognition.available && S.columns && S.columns.band && S.characters){
      await step('7 · recognition · cells');
      await refineCellsByColumn(S.recognition,S.textLines,S.characters,S.columns,S.W,S.H,p.recognition,label=>{ stepLabel.textContent='7 · '+label; });
    }

    /* 9 · final — the best of the local analysis and the API answer (the
          local reading alone, with a note, while the answer is pending) */
    S.pipelineDone=true; S.final=buildFinal(); updateFinalJson();

    /* readout */
    const B=S.borders, TL=S.textLines, C=S.columns, CH=S.characters, RC=S.recognition;
    $('statApi').textContent = !S.api ? 'off' : S.api.status==='done' ? Math.round(S.api.ms)+' ms' : S.api.status==='error' ? 'failed' : 'pending';
    $('statChars').textContent = CH ? CH.stats.characters.toLocaleString() : '—';
    $('statRecognised').textContent = (RC&&RC.available) ? RC.recognised.toLocaleString() : '—';
    $('statRules').textContent = B ? B.horizontalRules.length+' / '+B.verticalRules.length : '—';
    $('statLines').textContent = TL ? TL.stats.accepted.toLocaleString() : '—';
    $('statFullLines').textContent = TL ? TL.stats.fullLines.toLocaleString() : '—';
    $('statTable').textContent = (C&&C.band) ? C.band.rows.length+' × '+C.columns.length : '—';
    $('statTilt').textContent = TL ? (Math.atan(TL.stats.slope)*180/Math.PI).toFixed(2)+'°' : '—';
    $('timing').innerHTML=Object.entries(timing).map(([k,v])=>`<span class="k">${k}</span> <span class="v">${v.toFixed(0)}ms</span>`).join(' · ');

    await step('6 · rendering stage outputs');
    S.galleryPromise=buildGallery(); await S.galleryPromise;
    savePng.disabled=false; saveJson.disabled=false;
    showStage(S.stage); fitView();
  }catch(e){
    console.error(e);
    showError('Pipeline error: '+e.message);
  }finally{
    overlay.classList.remove('show'); runBtn.disabled=false;
  }
}
