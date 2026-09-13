/* ======================================================================
   PDF LOADING  ·  a supplier's PDF invoice, page by page
   Why: some suppliers send the invoice as a PDF — a digital one with a
   text layer, or a scan wrapped in a PDF. Either way each page is rendered
   to an image (pdf.js, vendored in js/vendor) and takes the same road as a
   photo: borders, text lines, columns, the API. A digital page also gives
   up its text layer — every word with its box — and those words stand in
   for the OCR reading of that page (js/pdf/pdftext.js), so the cells are
   the page's own text, exact.
     openPdf(file)                      → {doc, numPages}
     renderPdfPage(doc, n, targetWidth) → {canvas, words:[{text, bb}], hasText}
     pdfThumbnail(doc, n, width)        → a data URL
   Pages are rendered when they are needed (a forty-page invoice would not
   fit in memory as forty full canvases); the document stays open.
   ====================================================================== */
import * as pdfjs from '../vendor/pdf.min.js';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('../vendor/pdf.worker.min.js', import.meta.url).href;

export const isPdfFile=f=>!!f && (f.type==='application/pdf' || /\.pdf$/i.test(f.name||''));

export async function openPdf(file){
  const data=new Uint8Array(await file.arrayBuffer());
  const doc=await pdfjs.getDocument({data}).promise;
  return {doc, numPages:doc.numPages};
}

/* the text items of a page as words with boxes in canvas pixels: an item that holds spaces ("AREDS Softgel Capsule
   28's") is cut at them, each word taking its share of the item's width by character count; the box spans the
   font's ascent above the baseline and a little below it */
export function wordsOfTextContent(items, pageHeight, scale){
  const words=[];
  for(const it of items){
    if(!it.str || !it.str.trim() || !it.transform) continue;
    const [a,b,c,d,e,f]=it.transform; const h=(Math.hypot(b,d)||it.height||10);
    const x=e, base=pageHeight-f, w=it.width||0;
    const parts=it.str.split(/(\s+)/); let acc=0; const total=it.str.length||1;
    for(const part of parts){ if(!part.trim()){ acc+=part.length; continue; }
      const x0=x+w*acc/total, x1=x+w*(acc+part.length)/total; acc+=part.length;
      words.push({text:part, bb:{x0:x0*scale, y0:(base-0.82*h)*scale, x1:x1*scale, y1:(base+0.22*h)*scale}}); }
  }
  return words;
}

export async function renderPdfPage(doc, n, targetWidth=1800){
  const page=await doc.getPage(n);
  const vp1=page.getViewport({scale:1});
  const scale=Math.max(1, Math.min(targetWidth/vp1.width, 4));
  const vp=page.getViewport({scale});
  const canvas=document.createElement('canvas'); canvas.width=Math.round(vp.width); canvas.height=Math.round(vp.height);
  const ctx=canvas.getContext('2d',{willReadFrequently:true}); ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  await page.render({canvasContext:ctx, viewport:vp, intent:'print'}).promise;
  const tc=await page.getTextContent();
  const words=wordsOfTextContent(tc.items, vp1.height, scale);
  const letters=words.reduce((s,w)=>s+(w.text.match(/[A-Za-z0-9]/g)||[]).length,0);
  return {canvas, words, hasText:words.length>=10 && letters>=40};
}

export async function pdfThumbnail(doc, n, width=200){
  const page=await doc.getPage(n);
  const vp1=page.getViewport({scale:1}); const vp=page.getViewport({scale:width/vp1.width});
  const c=document.createElement('canvas'); c.width=Math.round(vp.width); c.height=Math.round(vp.height);
  const ctx=c.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height);
  await page.render({canvasContext:ctx, viewport:vp, intent:'print'}).promise;
  return c.toDataURL('image/jpeg',0.8);
}
