/* ======================================================================
   SUMMARY  ·  every page of the invoice in one table
   Why: the pages are read one at a time, but the invoice is one document.
   The summary card, pinned at the foot of the pages strip, opens a panel
   over the viewport with every page's final table in turn — the page's
   item rows after the number check's repair, its group rows and sub-total
   rows as they are, the matched product beside each item — with the sums
   per page and for the whole invoice, and a Copy JSON of it all.
   The columns are the union of the pages' keys in the order they first
   appear (the pages of one invoice share a layout, so this is the first
   page's order); a page read later still lines up by key.
     showSummary(pageStates) / hideSummary()
   ====================================================================== */
import { viewport } from '../dom/dom.js';
import { columnType } from '../config/columntypes.js';
import { summaryData } from './summarydata.js';
import { profitRange, profitColor } from '../products/mrp.js';
export { summaryData };

const panel=document.createElement('div');
panel.id='summaryPanel';
panel.style.cssText='position:absolute;inset:0;display:none;overflow:auto;background:#0a0e0f;color:#e6f0eb;font:12px "JetBrains Mono",monospace;padding:10px 12px;z-index:7;';
viewport.appendChild(panel);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cell='border:1px solid #2a3a3a;padding:3px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px;';
const fmt=v=>v===null||v===undefined||!isFinite(v)?'':(Math.round(v*100)/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});

/* the MRP sum (Σ qty × pack MRP) and the profit on TP of the rows that have one, in the profit range's colour */
function mrpNote(m){ if(!m || !m.rows) return ''; const R=profitRange();
  return ' · <span style="color:#e6f0eb">MRP sum '+fmt(m.value)+'</span> <span style="color:#8fa39a">('+m.rows+' rows)</span>'+(m.profit!==null?' · profit <span style="color:'+profitColor(m.profit,R)+'">'+m.profit.toFixed(1)+'%</span>':''); }
export function showSummary(entries){
  const D=summaryData(entries);
  const K=D.keys; const numeric=k=>{ const t=columnType(k); return !!(t&&t.numeric) || !!D.roles[k]; };
  let h='<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:8px;color:#8fa39a"><b style="color:#e6f0eb">ALL PAGES · summary</b><span>'+entries.length+' page'+(entries.length!==1?'s':'')+' · '+D.grand.items+' items · <span style="color:#54dd7e">'+D.grand.match+' matched</span> · <span style="color:#ffc85a">'+D.grand.uncertain+' uncertain</span> · <span style="color:#ff5a5a">'+D.grand.none+' no match</span></span>'
    +'<button id="sumCopy" style="margin-left:auto;font:inherit;font-size:11px;padding:3px 10px;background:transparent;color:#8fa39a;border:1px solid #2a3a3a;border-radius:3px;cursor:pointer">Copy JSON (all pages)</button></div>';
  if(!K.length){ h+='<div style="color:#8fa39a;padding:20px">no page has a final table yet — the summary fills in as the pages are processed</div>'; panel.innerHTML=h; return; }
  h+='<table style="border-collapse:collapse;font-size:11px"><thead><tr><th style="'+cell+'color:#e6f0eb" title="the item\'s number over every page of the invoice">No.</th><th style="'+cell+'color:#8fa39a">page</th><th style="'+cell+'color:#8fa39a" title="the row on its page">#</th>';
  for(const k of K) h+='<th style="'+cell+'color:#ffe68c;text-align:left" title="'+esc(k)+'">'+esc(D.labels[k]||k)+'<div style="color:#8fa39a;font-weight:normal;font-size:9px">'+esc(k)+'</div></th>';
  h+='<th style="'+cell+'color:#6edcff;text-align:left">Product (list)</th></tr></thead><tbody>';
  let itemNo=0;                                                             // the item's number over every page: totals and group rows take none
  D.pages.forEach(pg=>{
    h+='<tr style="background:rgba(110,220,255,.08)"><td colspan="'+(K.length+4)+'" style="'+cell+'color:#6edcff;font-weight:600">page '+(pg.index+1)+' · '+esc(pg.name)+' · '+esc(pg.status)+(pg.items?' · '+pg.items+' items, '+pg.match+' matched':'')+(pg.rows.length&&pg.rows[0].kind!=='group'&&pg.rows[0].group?' · continues '+esc(pg.rows[0].group):'')+'</td></tr>';
    let n=0;
    for(const r of pg.rows){
      if(r.kind==='group'){ h+='<tr style="background:rgba(255,225,130,.10)"><td style="'+cell+'"></td><td style="'+cell+'color:#8fa39a">'+(pg.index+1)+'</td><td style="'+cell+'"></td><td colspan="'+(K.length+1)+'" style="'+cell+'color:#ffe182;font-weight:600">▸ '+esc(r.group||r.cells[K[0]]||'')+' <span style="color:#8fa39a;font-weight:normal;font-size:10px">item group</span></td></tr>'; continue; }
      n++; if(r.kind!=='total') itemNo++; r.no=r.kind!=='total'?itemNo:null;
      h+='<tr style="background:'+(r.kind==='total'?'rgba(110,160,255,.14)':(n%2?'transparent':'rgba(255,255,255,.025)'))+'"><td style="'+cell+'color:#e6f0eb;font-weight:600;text-align:right">'+(r.no!==null?r.no:'')+'</td><td style="'+cell+'color:#8fa39a">'+(pg.index+1)+'</td><td style="'+cell+'color:#8fa39a">'+n+'</td>';
      for(const k of K){ const v=r.cells[k]||''; const ck=r.kind==='total'&&r.check&&r.check[k]; const under=ck?'border-bottom:3px solid '+(ck.ok?'#54dd7e':'#ff5a5a')+';':'';
        h+='<td style="'+cell+under+(numeric(k)?'text-align:right;':'')+'" title="'+esc(ck?(ck.ok?'agrees with the sum of the group\'s items ':'differs from the sum of the group\'s items ')+ck.sum+' (wherever they were printed)':v)+'">'+esc(v)+'</td>'; }
      const col=r.match==='match'?'#54dd7e':r.match==='uncertain'?'#ffc85a':r.kind==='total'?'#6ea0ff':'#ff5a5a';
      const totalNote=r.kind==='total'?'sub-total of '+esc(r.group||'')+(r.check&&Object.keys(r.check).length?(Object.values(r.check).every(c=>c.ok)?' <span style="color:#54dd7e">✓ adds up</span>':' <span style="color:#ff5a5a">differs</span>'):''):'';
      h+='<td style="'+cell+'color:'+col+'">'+(r.kind==='total'?totalNote:r.product?esc(r.product)+(r.retry?' ↻':''):'no match')+'</td></tr>';
    }
    if(Object.keys(pg.sums).length){ h+='<tr style="background:rgba(84,221,126,.08)"><td style="'+cell+'"></td><td style="'+cell+'color:#8fa39a">'+(pg.index+1)+'</td><td style="'+cell+'color:#8fa39a">Σ</td>';
      for(const k of K) h+='<td style="'+cell+'text-align:right;color:#54dd7e">'+(pg.sums[k]!==undefined?fmt(pg.sums[k]):'')+'</td>';
      h+='<td style="'+cell+'color:#8fa39a">sum of the page\'s item rows'+mrpNote(pg.mrp)+'</td></tr>'; }
  });
  if(Object.keys(D.grand.sums).length){ h+='<tr style="background:rgba(84,221,126,.16)"><td style="'+cell+'color:#e6f0eb;font-weight:600" colspan="3">ALL · '+itemNo+' items</td>';
    for(const k of K) h+='<td style="'+cell+'text-align:right;color:#54dd7e;font-weight:600">'+(D.grand.sums[k]!==undefined?fmt(D.grand.sums[k]):'')+'</td>';
    h+='<td style="'+cell+'color:#8fa39a">sum of every page\'s item rows'+mrpNote(D.grand.mrp)+'</td></tr>'; }
  h+='</tbody></table>';
  // the groups across the pages, and the invoice's own totals against the items
  const I=D.invoice;
  h+='<div style="display:flex;gap:28px;flex-wrap:wrap;align-items:flex-start;margin-top:14px">';
  if(D.groups.length){ h+='<div><div style="color:#ffe182;margin-bottom:4px">Item groups across the pages</div><table style="border-collapse:collapse;font-size:11px"><thead><tr>'+['group','pages','items','sub-total'].map(t=>'<th style="'+cell+'color:#8fa39a;font-weight:normal;text-align:left">'+t+'</th>').join('')+'</tr></thead><tbody>'
    +D.groups.map(g=>'<tr><td style="'+cell+'">'+esc(g.name)+'</td><td style="'+cell+'">'+g.pages.join(', ')+'</td><td style="'+cell+'text-align:right">'+g.items+'</td><td style="'+cell+'">'+(g.check?(Object.values(g.check).every(c=>c.ok)?'<span style="color:#54dd7e">✓ adds up</span>':'<span style="color:#ff5a5a">differs: '+esc(Object.entries(g.check).filter(([k,c])=>!c.ok).map(([k,c])=>k+' printed '+c.printed+', items '+c.sum).join('; '))+'</span>'):'<span style="color:#8fa39a">no sub-total read</span>')+'</td></tr>').join('')+'</tbody></table></div>'; }
  h+='<div><div style="color:#6edcff;margin-bottom:4px">Invoice totals'+(I.page?' <span style="color:#8fa39a">(page '+I.page+(I.closedOnPage?' · the invoice closes on page '+I.closedOnPage:'')+')</span>':'')+'</div><table style="border-collapse:collapse;font-size:11px"><tbody>'
    +(I.tradeTotal!==null?'<tr><td style="'+cell+'">Total Trade Price</td><td style="'+cell+'text-align:right">'+fmt(I.tradeTotal)+'</td><td style="'+cell+'">'+(I.tradeOk===undefined?'':I.tradeOk?'<span style="color:#54dd7e">✓ = sum of every item\'s '+esc(D.labels[I.tradeKey]||I.tradeKey)+'</span>':'<span style="color:#ff5a5a">differs from the items\' sum '+fmt(I.tradeSum)+'</span>')+'</td></tr>':'')
    +(I.vatTotal!==null?'<tr><td style="'+cell+'">Total VAT</td><td style="'+cell+'text-align:right">'+fmt(I.vatTotal)+'</td><td style="'+cell+'">'+(I.vatOk===undefined?'':I.vatOk?'<span style="color:#54dd7e">✓ = sum of every item\'s '+esc(D.labels[I.vatKey]||I.vatKey)+'</span>':'<span style="color:#ff5a5a">differs from the items\' sum '+fmt(I.vatSum)+'</span>')+'</td></tr>':'')
    +'<tr><td style="'+cell+'">Grand Total</td><td style="'+cell+'text-align:right">'+(I.grandTotal!==null?fmt(I.grandTotal):'<span style="color:#8fa39a">'+(I.tradeTotal!==null?'—':'not read')+'</span>')+'</td><td style="'+cell+'">'+(I.grandOk===undefined?'':I.grandOk?'<span style="color:#54dd7e">✓ = sum of every item\'s '+esc(D.labels[I.itemsKey]||I.itemsKey)+'</span>':'<span style="color:#ff5a5a">differs from the items\' sum '+fmt(I.itemsSum)+'</span>')+'</td></tr>'
    +'<tr><td style="'+cell+'">Less Discount</td><td style="'+cell+'text-align:right">'+(I.discount!==null?fmt(I.discount):'')+'</td><td style="'+cell+'"></td></tr>'
    +'<tr><td style="'+cell+'">'+(I.grandTotal===null&&I.tradeTotal!==null?'Net Invoice Amount':'Total Payable')+'</td><td style="'+cell+'text-align:right">'+(I.payable!==null?fmt(I.payable):'<span style="color:#8fa39a">not read</span>')+'</td><td style="'+cell+'">'+(I.payableOk===undefined?'':I.payableOk?'<span style="color:#54dd7e">✓ = '+(I.grandTotal!==null?'Grand Total':'Trade Price + VAT')+' − discount</span>':'<span style="color:#ff5a5a">≠ '+(I.grandTotal!==null?'Grand Total':'Trade Price + VAT')+' − discount ('+fmt(I.payableBase-(I.discount||0))+')</span>')+'</td></tr>'
    +'</tbody></table></div></div>';
  panel.innerHTML=h;
  const btn=panel.querySelector('#sumCopy'); if(btn) btn.onclick=()=>{ const json={pages:D.pages.map(pg=>({page:pg.index+1, name:pg.name, status:pg.status, items:pg.items, matched:pg.match, sums:pg.sums, rows:pg.rows.map(r=>({no:r.no!==undefined?r.no:null, kind:r.kind, group:r.group, product:r.product, match:r.match, cells:r.cells, mrp:r.mrp, check:r.check||undefined})), mrp:pg.mrp})), groups:D.groups, invoice:D.invoice, keys:K, labels:D.labels, totals:D.grand, profitRange:profitRange()};
    navigator.clipboard.writeText(JSON.stringify(json,null,1)).then(()=>{ btn.textContent='Copied'; setTimeout(()=>btn.textContent='Copy JSON (all pages)',1200); }); };
  panel.style.display='block';
}
export function hideSummary(){ panel.style.display='none'; }
export const summaryShown=()=>panel.style.display!=='none';
