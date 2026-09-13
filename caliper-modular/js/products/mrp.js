/* ======================================================================
   MRP  ·  the row's units per pack, its pack MRP, and the profit range
   Why: the editable table, the page summary and the all-pages summary
   all price a row the same way — the product's UnitSalePrice times the
   invoice's units per pack, against the invoice's unit TP — and the
   operator may type over any of it: the units per pack (F.rowMeta[ri]
   .unitConversion) or the pack's MRP itself (F.rowMeta[ri].mrp). One
   place computes it, with nothing of the page in it, so the summaries
   can be tested in node.
     rowConversion(F, ri)        → {value, source}   units per pack: typed · the invoice's column · the pack rule
     rowPackMrp(F, P, ri)        → {value, source, unit, conv}   the pack MRP: typed · UnitSalePrice × units per pack · null
     profitRange()               → {min, max}   the Options' min / max profit (%, default 10 / 30)
     profitOk(pct, range)        → the profit lies inside the range
     profitColor(pct, range)     → green inside, danger outside, grey when unknown
   ====================================================================== */
import { unitConversionOf, rowPackText } from '../final/pack.js';

export function rowConversion(F, ri){
  const keys=F.keys||[]; const meta=F.rowMeta&&F.rowMeta[ri];
  if(meta && meta.unitConversion!==undefined && meta.unitConversion!==null && isFinite(meta.unitConversion)) return {value:+meta.unitConversion, source:'typed'};
  const ci=keys.indexOf('unitconversion'); if(ci>=0){ const v=parseFloat(String((F.grid[ri][ci]&&F.grid[ri][ci].text)||'').replace(/,/g,'')); if(isFinite(v) && v>0) return {value:v, source:'column'}; }
  const pk=rowPackText(keys, F.grid, ri); const r=unitConversionOf(pk.text);
  return {value:r.value, source:(pk.source==='name'?'pack from the name: ':'pack: ')+r.rule+(pk.text?' ('+pk.text+')':'')};
}

export function rowPackMrp(F, P, ri){
  const meta=F&&F.rowMeta&&F.rowMeta[ri];
  if(meta && meta.mrp!==undefined && meta.mrp!==null && isFinite(meta.mrp)) return {value:+meta.mrp, source:'typed'};
  const r=P&&P.results?P.results[ri]:null;
  if(!r || !r.product || r.product.mrp===null || r.product.mrp===undefined || !isFinite(+r.product.mrp)) return {value:null, source:'none'};
  const conv=rowConversion(F,ri).value||1;
  return {value:+r.product.mrp*conv, source:'list', unit:+r.product.mrp, conv};
}

export const DEFAULT_PROFIT={min:10, max:30};
export function profitRange(){
  if(typeof document==='undefined') return {...DEFAULT_PROFIT};
  const read=(id,dflt)=>{ const el=document.getElementById(id); const v=el?parseFloat(el.value):NaN; return isFinite(v)?v:dflt; };
  const min=read('profitMin',DEFAULT_PROFIT.min), max=read('profitMax',DEFAULT_PROFIT.max);
  return min<=max ? {min,max} : {min:max,max:min};
}
export const profitOk=(pct,range)=>pct!==null && pct!==undefined && isFinite(pct) && pct>=range.min && pct<=range.max;
export const profitColor=(pct,range)=>pct===null||pct===undefined||!isFinite(pct) ? '#8fa39a' : profitOk(pct,range) ? '#54dd7e' : '#ff5a5a';
