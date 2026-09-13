/* ======================================================================
   HEADER ROWS  ·  the invoice header taken for items
   Why: a page that prints no column titles (the middle pages of a long
   invoice) has nothing above its table to cut the page header off at, and
   the address block, the MIO, the mobile number and the delivery line —
   printed in the same columns' x-range — reach the table as leading rows.
   Two tests tell them from items, both page-wide facts an item never
   shows: the row's values do not fit their columns (letters where the
   column holds numbers), or the row's words are the words other pages
   printed ABOVE their table, in the invoice header.
     wordsOf(text)                    → the words that identify a line: letters of three or more, digits of four or more
     headerVocabulary(texts)          → a Set of those words over many lines
     leadingHeaderRows(rowTexts, numericCols, vocab, opts) → how many leading rows are header rows
   opts: isGroup(texts), isTotal(texts) — rows that end the walk (a group
   name, a sub-total, are the table's); itemFill — how many columns an
   item row fills, for the thin-row test.
   ====================================================================== */
const NUM=/^[\s(]*[-+]?[\d,]*\.?\d+\s*%?[)\s]*$/;
export const wordsOf=t=>String(t||'').toUpperCase().split(/[^A-Z0-9]+/).filter(w=>/[A-Z]{3,}/.test(w) || /^\d{4,}$/.test(w));
export function headerVocabulary(texts){ const v=new Set(); for(const t of texts||[]) for(const w of wordsOf(t)) v.add(w); return v; }

export function leadingHeaderRows(rowTexts, numericCols, vocab, opts={}){
  const isGroup=opts.isGroup||(()=>false), isTotal=opts.isTotal||(()=>false), itemFill=opts.itemFill||0;
  const V=vocab||new Set();
  let n=0;
  for(let i=0;i<rowTexts.length;i++){
    const t=rowTexts[i].map(s=>String(s||'').trim());
    if(isGroup(t) || isTotal(t)) break;
    const filled=t.map((s,ci)=>s?ci:-1).filter(ci=>ci>=0);
    if(!filled.length){ n++; continue; }
    const misfit=filled.filter(ci=>numericCols[ci] && !NUM.test(t[ci])).length;
    const numericOk=filled.filter(ci=>numericCols[ci] && NUM.test(t[ci])).length;
    const ws=filled.flatMap(ci=>wordsOf(t[ci])); const inVocab=ws.filter(w=>V.has(w) || (w.length>=5 && [...V].some(v=>v.length>=5 && (v.startsWith(w) || w.startsWith(v))))).length;   // a word cut short (Deliver…) still matches
    const byMisfit=misfit>=2 && misfit>=0.5*filled.length;                                  // letters where the columns hold numbers
    const byVocab=ws.length>=1 && inVocab>=Math.max(1,Math.ceil(0.6*ws.length)) && (ws.length>=2 || filled.length<=2);   // the other pages' header words
    const thin=filled.length<=2 && numericOk===0 && (!itemFill || filled.length<0.4*itemFill);   // a lone "Bangladesh" between header lines
    const noNumbers=numericCols.some(Boolean) && numericOk===0;                               // an item always has a number where the columns hold numbers (a price, a total); "MIO :60000849-MD JAKARIA HABIB" has none
    if(byMisfit || byVocab || thin || noNumbers) n++; else break;
  }
  return n;
}
