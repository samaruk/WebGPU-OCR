/* ======================================================================
   TITLE ROW  ·  the column titles printed again inside the table
   Why: an invoice that sorts its items into groups prints the column
   titles again at the head of every group ("Sl.No · Product Code ·
   Product Name · Pack Size …" under "MSD Product"). Inside the table such
   a row is not an item: it is dropped, and the group header above it is
   what names the rows that follow.
     isTitleRow(cellTexts, labels, vocab) → true when the row's cells are the titles
   A row is a title row when it holds no number and, of its filled cells,
   at least three and three fifths read like their own column's label (a
   token in common, or one a prefix of the other for tokens of four letters
   or more) — or, when the columns carry no labels, like any label of the
   vocabulary of every rule.
   ====================================================================== */
import { tokensOf, LABEL_VOCAB } from '../headerrule/headerrule.js';

const NUMERIC=/^[\d.,%\-()\/\s]+$/;
const near=(a,b)=>a===b || (a.length>=4 && b.length>=4 && (a.startsWith(b) || b.startsWith(a)));
const VOCAB_TOKENS=[...new Set(LABEL_VOCAB.flatMap(v=>tokensOf(v.label)).filter(t=>t.length>=2 && !/^\d+$/.test(t)))];

export function isTitleRow(cellTexts, labels){
  let filled=0, hit=0;
  for(let ci=0; ci<cellTexts.length; ci++){
    const s=String(cellTexts[ci]||'').trim(); if(!s) continue;
    if(NUMERIC.test(s)) return false;                               // a number: an item row, a total row
    filled++;
    const ct=tokensOf(s); if(!ct.length) continue;
    const lab=labels && labels[ci];
    const lt=lab ? tokensOf(lab) : VOCAB_TOKENS;
    if(ct.some(x=>lt.some(y=>near(x,y)))) hit++;
  }
  return filled>=3 && hit>=Math.max(3, Math.ceil(0.6*filled));
}
