/* ======================================================================
   COLUMN KEYS · recheck  ·  name the columns the rule did not key
   Why: a column with no key is invisible to the number check, and the one
   that goes missing most is Quantity — its title is a short word in a
   narrow column, easily handed to the gutter or a neighbour by the OCR
   word placement. So every title source is tried at once for an unnamed
   column, quantity spellings are matched loosely, and quantity is insisted
   on: every invoice has one, and when no title names it the column of small
   whole numbers that is not a serial, a code or a bonus column is Qty.
     resolveColumnKeys({keys, labels, titleCands, columnValues}) ->
       {keys, labels, renamed}
     keys         – per column, the key the rule gave or null
     labels       – per column, the header label found so far ('' when none)
     titleCands   – per column, every title text seen for it (label, local
                    title text, every engine's title words, the API title row)
     columnValues – per column, the cell texts of the item rows
   ====================================================================== */
import { HEADER_RULES } from '../config/headerrules.js';

/* every label of every rule, once (the first rule to use a label sets its key) */
const VOCAB=(()=>{ const seen=new Map();
  for(const r of HEADER_RULES) for(const c of r.columns){ const k=c.label.toLowerCase().replace(/[^a-z0-9%]+/g,' ').trim(); if(!seen.has(k)) seen.set(k,{label:c.label, key:c.key}); }
  return [...seen.values()]; })();
export const tokensOf=s=>(s||'').toLowerCase().replace(/%/g,' pct ').split(/[^a-z0-9]+/).filter(t=>t.length);
const lev=(a,b)=>{ if(a===b) return 0; const m=a.length,n=b.length; let prev=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){ const cur=[i]; for(let j=1;j<=n;j++) cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1)); prev=cur; } return prev[n]; };

/* quantity spellings; one letter off is allowed on words of three or more */
export const QTY_WORDS=['qty','qnt','qnty','qtty','quantity','quan','qte','invqty','qy'];
export const isQtyToken=t=>QTY_WORDS.some(q=>t===q || (t.length>=3 && q.length>=3 && lev(t,q)<=1));

/* the key a title text names: quantity first, else the rules' vocabulary
   (the longest label whose every token appears in the text, fuzzily) */
export function keyFromTitle(text){
  const toks=tokensOf(text); if(!toks.length) return null;
  if(toks.some(isQtyToken)) return {key:'qty', label:'Qty'};
  let best=null;
  for(const v of VOCAB){ const lt=tokensOf(v.label); if(!lt.length) continue;
    const hit=lt.filter(a=>toks.some(b=>a===b || (a.length>=4 && lev(a,b)<=1))).length;
    if(hit===lt.length && (!best || lt.length>best.n)) best={key:v.key, label:v.label, n:lt.length}; }
  return best;
}

/* how well a title text agrees with the rules' vocabulary: for the best label
   whose every token the text carries (one letter off allowed on four or
   more), the number of tokens matched EXACTLY and the label's length —
   "Category & Product Name" beats "Category & Produdt Name" by one exact
   token. {exact:0, n:0} when no label fits. Used to choose between the
   API's and the local reading of a header cell. */
export function titleAgreement(text){
  const toks=tokensOf(text); let best={exact:0, n:0};
  if(!toks.length) return best;
  for(const v of VOCAB){ const lt=tokensOf(v.label); if(!lt.length) continue;
    let exact=0, ok=true;
    for(const a of lt){ if(toks.includes(a)) exact++; else if(!toks.some(b=>a.length>=4 && lev(a,b)<=1)){ ok=false; break; } }
    if(ok && (lt.length>best.n || (lt.length===best.n && exact>best.exact))) best={exact, n:lt.length}; }
  return best;
}

/* the quantity column by its numbers: whole numbers on 80 % of the filled
   cells, not mostly zeros (bonus), not mostly 4+ digits (codes), not counting
   up by one (serial numbers), the smallest typical value wins */
export function qtyByNumbers(keys, columnValues){
  let best=null;
  columnValues.forEach((vals,ci)=>{ if(keys[ci]) return;
    const filled=(vals||[]).map(t=>String(t||'').trim()).filter(Boolean); if(filled.length<3) return;
    const nums=filled.map(t=>t.replace(/,/g,'')).filter(t=>/^\d+$/.test(t)).map(Number);
    if(nums.length<0.8*filled.length) return;
    if(nums.filter(n=>n===0).length>0.5*nums.length) return;
    if(filled.filter(t=>/^\d{4,}$/.test(t)).length>0.5*filled.length) return;
    let steps=0; for(let i=1;i<nums.length;i++) if(nums[i]-nums[i-1]===1) steps++; if(nums.length>=4 && steps>=0.8*(nums.length-1)) return;
    const med=nums.slice().sort((a,b)=>a-b)[nums.length>>1]; if(med>9999) return;
    if(!best || med<best.med) best={ci,med}; });
  return best?best.ci:-1;
}

/* one rule laid over the page's columns IN ORDER: walking left to right, an
   unnamed column takes the next rule column whose label tokens all appear in
   the column's titles ("Trade" under "Per pack", then "Trade" under "Value":
   the same word twice, told apart by their order, as on the ACME invoice
   where the vocabulary alone named the first "TP+VAT Per Pack"). A column
   the rule already keyed moves the pointer past that rule column. Returns
   the assignments; the caller keeps the rule that explains the most columns. */
const labelHit=(lt,toks)=>lt.length && lt.every(a=>toks.some(b=>a===b || (a.length>=4 && lev(a,b)<=1)));
export function ruleInOrder(rule, K, titleCands){
  const out=[]; let j=0;
  for(let ci=0; ci<K.length; ci++){
    if(K[ci]){ const at=rule.columns.findIndex((c,jj)=>jj>=j && c.key===K[ci]); if(at>=0) j=at+1; continue; }
    const toks=(titleCands[ci]||[]).flatMap(tokensOf); if(!toks.length) continue;
    for(let jj=j; jj<rule.columns.length; jj++){ const c=rule.columns[jj], lt=tokensOf(c.label);
      if(labelHit(lt,toks)){ const withGroup=c.group && labelHit(tokensOf(c.group),toks);
        out.push({column:ci, key:c.key, label:c.group?c.group+' '+c.label:c.label, withGroup:!!withGroup}); j=jj+1; break; } }
  }
  return out;
}

export function resolveColumnKeys({keys, labels, titleCands, columnValues, locked}){
  const K=keys.map(k=>k||null), L=labels.map(l=>l||''), renamed=[];
  // the rule that explains the most unnamed columns in order (three at least) names them first
  let bestRule=null;
  for(const r of HEADER_RULES){ const a=ruleInOrder(r,K,titleCands); const n=a.length+0.5*a.filter(x=>x.withGroup).length; if(a.length>=3 && (!bestRule || n>bestRule.n)) bestRule={rule:r, a, n}; }
  if(bestRule) for(const x of bestRule.a){ if(K[x.column] || K.includes(x.key)) continue; K[x.column]=x.key; if(!L[x.column]) L[x.column]=x.label; renamed.push({column:x.column, key:x.key, by:'rule '+bestRule.rule.id+' in order'}); }
  K.forEach((k,ci)=>{ if(k) return;
    for(const t of titleCands[ci]||[]){ const r=keyFromTitle(t); if(r && !K.includes(r.key)){ K[ci]=r.key; if(!L[ci] || r.key==='qty') L[ci]=r.label; renamed.push({column:ci, key:r.key, by:'title "'+t+'"'}); break; } } });
  if(!K.includes('qty')){
    // a column the vocabulary keyed otherwise but whose title also says quantity ("Inv. Qty" keyed as invoiceNo) is set right
    K.forEach((k,ci)=>{ if(!k || k==='qty' || K.includes('qty') || (locked&&locked[ci])) return; if((titleCands[ci]||[]).some(t=>tokensOf(t).some(isQtyToken))){ renamed.push({column:ci, key:'qty', by:'title over '+k}); K[ci]='qty'; if(!/qty|quantity/i.test(L[ci])) L[ci]='Qty'; } });
  }
  if(!K.includes('qty')){
    const ci=qtyByNumbers(K, columnValues||[]);
    if(ci>=0){ K[ci]='qty'; L[ci]='Qty'; renamed.push({column:ci, key:'qty', by:'its numbers'}); }
  }
  K.forEach((k,ci)=>{ if(k==='qty' && !/qty|quantity/i.test(L[ci])) L[ci]='Qty'; });
  return {keys:K, labels:L, renamed};
}
