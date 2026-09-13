/* ======================================================================
   SUMMARY DATA  ·  the invoice across its pages
   Why: an invoice's groups run across pages — "Rx Product" opens on page
   1 with its keeper, its items fill pages 2 and 3, its sub-total heads
   page 4, where "MSD Product" and "Credence Product" open in turn — and
   the last page ends with the invoice's own totals. The pages are read
   one by one; this puts them back together: every row of every page in
   order, the group each row belongs to carried across page ends, every
   sub-total checked against the items of its group wherever they were
   printed, and the invoice's Grand Total, discount and payable read from
   the pages' text and checked against the items.
     summaryData(entries) → {keys, labels, roles, pages, groups, invoice, grand}
   entries: [{name, status, F, P, texts}] in page order — F the page's
   final table, P its product match, texts its recognised lines.
   ====================================================================== */
import { rowPackMrp } from '../products/mrp.js';
const SUMMED=['qty','totalTp','totalVat','discAmt','net','totalSp','unitGross'];
const num=s=>{ const m=String(s||'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/); return m?+m[0]:null; };
/* the text of a cell as the editable table shows it: the number check's repair over the reading */
const shown=(g,c)=>c && (c.status==='fixed'||c.status==='filled') && c.fixedText!==undefined ? c.fixedText : (g&&g.text||'');

/* the invoice's own totals in the pages' text: Grand Total, Less Discount, Total / Net Payable — the last page first */
/* Healthcare: Grand Total · Less Discount · Total Payable. Square: Total Trade Price · Total VAT · Less Discount
   Amount · Net Invoice Amount. Read from the last page that prints any of them. */
export function invoiceTotals(entries){
  const out={grandTotal:null, tradeTotal:null, vatTotal:null, discount:null, payable:null, page:null, closedOnPage:null};
  const N='\\s*[:.\\-]?\\s*(?:tk\\.?|taka|bdt)?\\s*([\\d,]+(?:\\.\\d+)?)';
  const re=head=>new RegExp(head+N,'i');
  const find=(texts, re)=>{ for(const t of texts){ const m=re.exec(String(t||'').replace(/[|]/g,'1')); if(m){ const v=num(m[1]); if(v!==null) return v; } } return null; };
  for(let i=entries.length-1;i>=0;i--){ const texts=entries[i].texts||[]; if(!texts.length) continue;
    const g=find(texts,re('grand\\s*total'));
    const tt=find(texts,re('total\\s*trade\\s*price'));
    const tv=find(texts,re('total\\s*vat\\b(?!\\s*\\/)'));
    const d=find(texts,re('(?:less\\s*)?discount(?:\\s*amount)?'));
    const p=find(texts,re('(?:(?:total|net|amount)\\s*payable|net\\s*invoice\\s*amount|total\\s*invoice\\s*amount)'));
    if(g!==null || p!==null || tt!==null){ out.grandTotal=g; out.tradeTotal=tt; out.vatTotal=tv; out.discount=d; out.payable=p; out.page=i+1; break; } }
  entries.forEach((e,i)=>{ if(e.F && e.F.invoiceClosed && out.closedOnPage===null) out.closedOnPage=i+1; });
  return out;
}

export function summaryData(entries){
  const keys=[]; const labels={};
  for(const e of entries){ const F=e.F; if(!F||!F.grid) continue; (F.keys||[]).forEach((k,i)=>{ if(!keys.includes(k)) keys.push(k); if(!labels[k] && F.header&&F.header.labels&&F.header.labels[i]) labels[k]=F.header.labels[i]; }); }
  const roles={}; for(const e of entries){ const N=e.F&&e.F.numbers; if(N&&N.roles) for(const k in N.roles) if(!roles[k]) roles[k]=N.roles[k]; }
  const summedKeys=keys.filter(k=>SUMMED.includes(roles[k]));
  const pages=[]; const grand={items:0, match:0, uncertain:0, none:0, sums:{}, mrp:{value:0, rows:0, cost:0}};
  const qtyKey=keys.find(k=>roles[k]==='qty'), tpKey=keys.find(k=>roles[k]==='unitTp');
  // the groups, carried across pages: the group open when a page ends is the group of the next page's first rows
  const groups=[]; let group=null; const openGroup=name=>{ group={name, items:0, sums:{}, pages:new Set(), total:null, check:null}; groups.push(group); return group; };
  const add=(sums,k,v)=>{ sums[k]=(sums[k]||0)+v; };
  entries.forEach((e,pi)=>{
    const F=e.F, out={index:pi, name:e.name, status:e.status, rows:[], items:0, match:0, uncertain:0, none:0, sums:{}, mrp:{value:0, rows:0, cost:0}};
    if(F&&F.grid){ const N=F.numbers, P=e.P; const kOf=F.keys||[];
      F.grid.forEach((row,ri)=>{ const fr=F.rows&&F.rows[ri], nr=N&&N.rows?N.rows[ri]:null; const kind=fr&&fr.kind==='group'?'group':nr&&nr.isTotal?'total':'item';
        const cells={}; row.forEach((g,ci)=>{ const k=kOf[ci]; cells[k]=shown(g, nr&&nr.cells?nr.cells[k]:null); });
        const values={}; if(nr&&nr.cells) for(const k of summedKeys){ const c=nr.cells[k]; if(c && c.value!==null && c.value!==undefined && isFinite(c.value)) values[k]=c.value; }
        const r=P&&P.results?P.results[ri]:null; const product=r&&r.product?[r.product.name,r.product.strength,r.product.category].filter(Boolean).join(' '):null;
        const st=r?r.status:null;
        const entry={kind, group:null, cells, product, match:st, retry:!!(r&&r.retry&&r.retry.by), check:null};
        if(kind==='group'){ openGroup(fr.groupName||cells[kOf[0]]||'group'); entry.group=group.name; }
        else if(kind==='total'){
          // a group's sub-total: its items may lie on the pages before — checked against the group's own sums
          if(!group) openGroup('(items before the first group header)');
          const check={}; for(const k of summedKeys){ if(values[k]===undefined) continue; const sum=group.sums[k]||0; const ok=Math.abs(values[k]-sum)<=0.02+0.001*Math.abs(sum); check[k]={printed:values[k], sum:Math.round(sum*100)/100, ok}; }
          entry.group=group.name; entry.check=check; group.total=values; group.check=check; group.closed=true; }
        else {
          if(!group || group.closed) openGroup(group&&group.closed?group.name+' (continued)':'(items before the first group header)');
          entry.group=group.name; out.items++; group.items++; group.pages.add(pi+1);
          if(st==='match') out.match++; else if(st==='uncertain') out.uncertain++; else if(st==='none'||!st) out.none++;
          for(const k in values){ add(out.sums,k,values[k]); add(group.sums,k,values[k]); }
          // the MRP sum: the row's quantity × its pack MRP (typed, else the list's UnitSalePrice × units per pack); the
          // TP value of the same rows gives the page's profit
          { const pm=rowPackMrp(F,P,ri).value; const q=qtyKey && nr && nr.cells && nr.cells[qtyKey] ? nr.cells[qtyKey].value : null; const tp=tpKey && nr && nr.cells && nr.cells[tpKey] ? nr.cells[tpKey].value : null;
            if(pm!==null && q!==null && q!==undefined && isFinite(q)){ entry.mrp=q*pm; out.mrp.value+=q*pm; out.mrp.rows++; if(tp!==null && tp!==undefined && isFinite(tp)) out.mrp.cost+=q*tp; } } }
        out.rows.push(entry); }); }
    for(const k in out.sums) grand.sums[k]=(grand.sums[k]||0)+out.sums[k];
    out.mrp.profit=out.mrp.cost>0?(out.mrp.value-out.mrp.cost)/out.mrp.cost*100:null;
    grand.mrp.value+=out.mrp.value; grand.mrp.rows+=out.mrp.rows; grand.mrp.cost+=out.mrp.cost;
    grand.items+=out.items; grand.match+=out.match; grand.uncertain+=out.uncertain; grand.none+=out.none;
    pages.push(out); });
  grand.mrp.profit=grand.mrp.cost>0?(grand.mrp.value-grand.mrp.cost)/grand.mrp.cost*100:null;
  const invoice=invoiceTotals(entries);
  // the Grand Total against the items: the net column when the roles name one, else the largest summed column
  const netKey=summedKeys.find(k=>roles[k]==='net') || summedKeys.filter(k=>roles[k]!=='qty').sort((a,b)=>(grand.sums[b]||0)-(grand.sums[a]||0))[0] || null;
  if(invoice.grandTotal!==null && netKey && grand.sums[netKey]!==undefined){ const sum=Math.round(grand.sums[netKey]*100)/100; invoice.itemsKey=netKey; invoice.itemsSum=sum; invoice.grandOk=Math.abs(invoice.grandTotal-sum)<=0.02+0.001*Math.abs(sum); }
  // the Total Trade Price and Total VAT against the items' TP and VAT columns
  const sumOf=role=>{ const k=summedKeys.find(k=>roles[k]===role); return k && grand.sums[k]!==undefined ? {k, sum:Math.round(grand.sums[k]*100)/100} : null; };
  const near=(a,b)=>Math.abs(a-b)<=0.02+0.001*Math.abs(b);
  if(invoice.tradeTotal!==null){ const t=sumOf('totalTp'); if(t){ invoice.tradeKey=t.k; invoice.tradeSum=t.sum; invoice.tradeOk=near(invoice.tradeTotal,t.sum); } }
  if(invoice.vatTotal!==null){ const t=sumOf('totalVat'); if(t){ invoice.vatKey=t.k; invoice.vatSum=t.sum; invoice.vatOk=near(invoice.vatTotal,t.sum); } }
  // the payable: the Grand Total less the discount — or, Square's way, Total Trade Price plus Total VAT less the discount
  const base=invoice.grandTotal!==null ? invoice.grandTotal : (invoice.tradeTotal!==null ? invoice.tradeTotal+(invoice.vatTotal||0) : null);
  if(base!==null && invoice.payable!==null){ invoice.payableBase=base; invoice.payableOk=Math.abs(base-(invoice.discount||0)-invoice.payable)<=0.02; }
  return {keys, labels, roles, pages, groups:groups.map(g=>({...g, pages:[...g.pages]})), invoice, grand};
}
