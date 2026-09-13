/* ======================================================================
   TABLE TOP  ·  where the item table begins on a page whose column titles
   sit in the middle
   Why: an invoice whose groups run across pages prints a page like this
   (Healthcare, page 5): the items of a group begun on the page before,
   their SubTotal, then a new group's header, the column titles printed
   again, and its items. The title row is found in the middle of the page
   — and everything above it used to be thrown away as page header. Here
   the rows above the first title block are walked upward and kept while
   they look like rows of the table: an item row (a number, filling the
   columns like the rows below), a total row (SubTotal … with a number),
   an item group's header. A wrapped name line between two such rows is
   kept with them; two rows in a row that look like neither end the walk
   — the page header stands there.
     tableTop(rowTexts, titleRows) → {keepFrom, titleEnd, kinds, above}
   rowTexts: every band row's cell texts in column order; titleRows: the
   band indexes of the title rows (all of them: repeated title blocks too).
   keepFrom: the first band row of the table; titleEnd: the last row of the
   first title block; kinds[bi]: 'item' | 'total' | 'group' | '' for the rows
   walked; above: how many rows above the titles are kept.
   ====================================================================== */
import { groupNameOf } from './group.js';

export const TOTAL_RE=/\b(sub\s*-?\s*total|grand\s*total|total|net\s*total)\b/i;
const fillOf=t=>t.filter(s=>s && String(s).trim()).length;
const median=a=>{ const s=a.slice().sort((p,q)=>p-q); return s.length?s[s.length>>1]:0; };

/* the first block of title rows: contiguous rows, the block with the most rows (a lone "Name" row in the customer
   block above, taken for a title, loses to the two-line titles), the earliest among equals */
export function firstTitleBlock(titleRows){
  const rows=[...new Set(titleRows)].sort((a,b)=>a-b); if(!rows.length) return null;
  const blocks=[]; let cur=null; for(const r of rows){ if(cur && r===cur.end+1){ cur.end=r; continue; } cur={start:r,end:r}; blocks.push(cur); }
  let best=blocks[0]; for(const b of blocks) if(b.end-b.start>best.end-best.start) best=b;
  return best;
}

/* a cell that is a number, a code or a pack size (180.00 · 3162002535 · 0A02769 · 6X10'S) — not a date after a colon */
const NUMBERISH=/^[\s(]*[-+]?(?:[\d,]*\.?\d+%?|\d+[A-Z]\d{3,}|[\dA-Z]?\d+X\d+(?:X\d+)?['’]?S?)[)\s]*$/i;
export function rowKind(texts, itemFill){
  const t=texts.map(s=>String(s||'').trim()); const joined=t.join(' ');
  if(groupNameOf(t)) return 'group';
  if(TOTAL_RE.test(joined) && /\d/.test(joined)) return 'total';
  // an item row fills the columns like the rows below AND is made of numbers (serial, code, prices); the invoice
  // header's "Customer : 259268 - Lazz Pharma  Printing Date : 06.02.2020" fills a few columns with words and dates
  const numbers=t.filter(s=>s && NUMBERISH.test(s)).length;
  if(fillOf(t)>=Math.max(2, 0.6*itemFill) && numbers>=Math.min(3, Math.max(2, Math.floor(0.3*itemFill)))) return 'item';
  return '';
}

export function tableTop(rowTexts, titleRows){
  const titleSet=new Set(titleRows);
  const block=firstTitleBlock(titleRows);
  if(!block) return {keepFrom:0, titleEnd:-1, kinds:[], above:0};
  // how full an item row is: the median over the rows below the titles that carry a number
  const below=[]; for(let bi=block.end+1; bi<rowTexts.length; bi++){ if(titleSet.has(bi)) continue; const t=rowTexts[bi]; if(/\d/.test(t.join(' '))) below.push(fillOf(t)); }
  const itemFill=median(below);
  const kinds=[]; let keepFrom=block.start, miss=0;
  for(let bi=block.start-1; bi>=0; bi--){
    const k=rowKind(rowTexts[bi], itemFill); kinds[bi]=k;
    if(k){ keepFrom=bi; miss=0; } else if(++miss>=2) break;
  }
  return {keepFrom, titleEnd:block.end, kinds, above:block.start-keepFrom};
}
