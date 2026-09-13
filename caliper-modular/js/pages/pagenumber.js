/* ======================================================================
   PAGE NUMBER  ·  the number a page prints on itself
   Why: the pages of an invoice are photographed in whatever order they
   come to hand. Once a page is read, the "Page No. 3 of 10" it prints
   says where it belongs, and the strip is put in that order.
     pageNumberOf(texts) → {page, of} | null
   texts: the recognised lines of the page (the local reading, the PDF's
   words, the API's regions), in any order. The first line that names a
   page wins; "of" may be missing ("Page 3", "Pg. 3", "Page :4/1" — the
   figure before a slash is the page).
   ====================================================================== */
const PATTERNS=[
  /\bp(?:age|g)\.?\s*(?:no\.?|number|#)?\s*[:.\-]?\s*(\d{1,3})\s*(?:of|\/|\\|out of)\s*(\d{1,3})\b/i,   // Page No. 3 of 10 · Page 1/15 · Page :4/1
  /\bp(?:age|g)\.?\s*(?:no\.?|number|#)?\s*[:.\-]?\s*(\d{1,3})\b/i,                                    // Page 3 · Pg. 3 · Page No: 3
  /\b(\d{1,3})\s*(?:of|\/)\s*(\d{1,3})\s*p(?:age|g)s?\b/i                                              // 3 of 10 pages
];
export function pageNumberOf(texts){
  for(const raw of texts||[]){
    const t=String(raw||'').replace(/[|]/g,'1').replace(/\s+/g,' ');
    if(!/p(?:age|g)/i.test(t)) continue;
    for(const re of PATTERNS){ const m=re.exec(t); if(!m) continue;
      const page=+m[1], of=m[2]!==undefined?+m[2]:null;
      if(!(page>=1)) continue;
      return {page, of:of!==null && of>=page ? of : null}; }
  }
  return null;
}
/* the serial numbers the page's items carry (Sl.No, SN, SL, Sr …): the item rows' figures in the column keyed sl,
   the OCR look-alikes read as digits, the figures far from the rest (a product code in the wrong cell) dropped —
   {first, last, n} or null when fewer than two items number themselves */
const LOOKALIKE={O:'0',o:'0',I:'1',l:'1',i:'1','|':'1',S:'5',s:'5',B:'8',Z:'2',z:'2'};
export function serialRangeOf(F){
  if(!F || !F.grid || !F.keys) return null;
  const ci=F.keys.indexOf('sl'); if(ci<0) return null;
  const vals=[];
  F.grid.forEach((row,ri)=>{ const r=F.rows&&F.rows[ri]; if(r && r.kind==='group') return;
    const N=F.numbers&&F.numbers.rows&&F.numbers.rows[ri]; if(N && N.isTotal) return;
    const raw=String(row[ci]&&row[ci].text||'').trim(); if(!raw) return;
    const t=raw.replace(/[OoIli|SsBZz]/g,c=>LOOKALIKE[c]).replace(/[.,:;)\-\s]+$/,'');
    if(!/^\d{1,4}$/.test(t)) return; vals.push(+t); });
  if(vals.length<2) return null;
  const sorted=vals.slice().sort((a,b)=>a-b), median=sorted[sorted.length>>1];
  const kept=sorted.filter(v=>Math.abs(v-median)<=Math.max(50, 5*vals.length));   // a figure far from the rest (a product code 1018 among 1…20) is not a serial number
  if(kept.length<2) return null;
  return {first:kept[0], last:kept[kept.length-1], n:kept.length};
}
/* the order of the pages: within each group (one PDF file, or all the loose images together) by the number the pages
   print when every page that knows anything knows its number; else by the serial numbers their items carry — a page
   whose number is unclear or missing falls into line by its first serial; a page that knows neither stays after them
   in the order it came; the groups in the order they came */
export function orderPages(pages, groupOf){
  const groups=[]; const byGroup=new Map();
  pages.forEach((p,i)=>{ const g=groupOf(p); if(!byGroup.has(g)){ byGroup.set(g,[]); groups.push(g); } byGroup.get(g).push({p,i}); });
  const out=[];
  for(const g of groups){ const list=byGroup.get(g);
    const hasNo=x=>x.p.pageNo!=null, hasSl=x=>!!(x.p.serial && x.p.serial.first!=null);
    const known=list.filter(x=>hasNo(x)||hasSl(x));
    const numbers=known.map(x=>x.p.pageNo).filter(v=>v!=null);
    const byNumber=known.length && known.every(hasNo) && new Set(numbers).size===numbers.length;
    let ordered;
    if(byNumber) ordered=known.sort((a,b)=>(a.p.pageNo-b.p.pageNo)||(a.i-b.i));
    else if(known.filter(hasSl).length>=2){
      const bySerial=known.filter(hasSl).sort((a,b)=>(a.p.serial.first-b.p.serial.first)||((a.p.pageNo||0)-(b.p.pageNo||0))||(a.i-b.i));
      const numberOnly=known.filter(x=>!hasSl(x)).sort((a,b)=>(a.p.pageNo-b.p.pageNo)||(a.i-b.i));
      ordered=bySerial.concat(numberOnly); }
    else ordered=known.sort((a,b)=>((a.p.pageNo??1e9)-(b.p.pageNo??1e9))||(a.i-b.i));
    const rest=list.filter(x=>!known.includes(x));
    out.push(...ordered.map(x=>x.p), ...rest.map(x=>x.p)); }
  return out;
}
