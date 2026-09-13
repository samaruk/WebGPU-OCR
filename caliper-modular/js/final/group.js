/* ======================================================================
   GROUP  ·  item group names inside the table
   Why: some invoices sort their items under group headers — a manufacturer
   or a category printed on a row of its own that spans the table (RPL,
   RNL, JBL, NEVIAN on a Radiant invoice). Such a row holds one text and no
   number: it is not an item, so it must not be matched against the product
   list, checked by the row rules or joined into a neighbour; it names the
   group of every item row below it, down to the next group row.
     isGroupName(text)                  → does a lone text read like a group name
     groupNameOf(texts, sources?)       → the group name a row of cells holds, or null
     groupRowsOf(rowTexts, rowSources?) → [{index, name}] for rows given as [[cell texts …]]
   A second kind of group row carries a code — "Products of General-A:
   Territory: BABB4-Jahidul Islam[PE13935]" on an Opsonin invoice — so its
   text is not a bare name. It is known by what it lacks: in a table with
   two or more number columns (columns whose filled cells are numbers) it
   has nothing numeric in any of them, its filled cells run on from the
   left, and it holds at least two real words of three letters or more
   (form, descriptor, pack and qualifier words left out, so the wrapped
   tail of an item name — "Tablet 500mg", "(60s)" — never qualifies).
   A group name is letters (with & - / . , ' and parentheses), no digit, not
   a totals or page word, and not merely a form, descriptor, pack or
   qualifier word (Tab, Sach, Forte: the tail of a wrapped item name on a
   row of its own). It sits in the row's leftmost filled cell — or in two or
   three neighbouring ones, when a long name spans the columns' gutters.
   Every other filled cell must be a STRAY: a pen stroke or a tick crossing
   the row that one engine read as "L.", "A", "2" or "0.35" — four
   characters at most, no two letters, and, when the cell's source is
   known, not a text PaddleOCR read or two engines agreed on. A group row
   fills at most half the columns of a table of three or more, and at least
   one item row follows it before any totals row.
   ====================================================================== */
import { FORM_WORDS, DESCRIPTOR_WORDS } from '../products/matcher.js';

const NOT_GROUP=/\b(sub\s*total|grand\s*total|total|amount|net\s*payable|payable|round(ed)?|discount|less|in\s*words|carried|brought|forward|continued|page|signature|prepared|authori[sz]ed|received|warranty|remarks?)\b/i;
const PACK_WORDS=new Set(['PCS','PC','PIECES','VIAL','VIALS','TUBE','BOTTLE','BOT','STRIP','STRIPS','BOX','PACK','POT','JAR','SACHET','SACHETS','AMP','AMPOULE']);
// the qualifiers a wrapped item name ends with, beyond the matcher's descriptors: DS, SR, Forte, Plus, Junior …
const QUALIFIERS=new Set(['DS','SR','XR','ER','CR','MR','XL','LA','IR','DR','EC','OD','HP','FC','DT','ODT','MD','TR','LP','HD','PLUS','FORTE','FORT','MAX','EXTRA','STRONG','MINI','MICRO','NANO','DUO','TRIO','CO','JUNIOR','JR','KID','KIDS','INFANT','BABY','MEN','WOMEN','GOLD','SILVER','PLATINUM','ACTIVE','TOTAL','RAPID','FAST','SOFT','HARD','LITE','LIGHT']);
const FRAGMENT=new Set([...FORM_WORDS, ...DESCRIPTOR_WORDS, ...PACK_WORDS, ...QUALIFIERS]);
const TOTAL_ROW=/\b(sub\s*total|grand\s*total|total)\b/i;
const SURE=new Set(['agreed','vote','api','manual','name']);   // a cell read by PaddleOCR, agreed on, or typed: never a stray

/* a numbered category: "05 INJECTION", "06 LIQUID", "01. TABLET" — a number of up to three digits, then one or more
   words, the first of four letters or more; the word may be a form or descriptor word (that is what a category is
   called), but not a pack word: "10 Tabs", "30 PCS", "100ml" are the tail of an item, not a heading */
// the number may carry the engines' look-alikes ("0S INJECTION" for 05, "O6 LIQUID" for 06): a digit among them, or
// a bare O / S pair, is enough; the name is written with the digits (categoryName)
const NUMBERED=/^([0-9OoIl|SsBbZz]{1,3})\s*[-.:)]?\s+([A-Za-z][A-Za-z &\/\-']{3,})$/;
const DIGIT_OF={O:'0',o:'0',I:'1',l:'1','|':'1',S:'5',s:'5',B:'8',b:'8',Z:'2',z:'2'};
const NOT_CATEGORY=new Set([...PACK_WORDS,'TABS','TAB','CAPS','CAP','PIECE','AMPS','TUBES','BOXES','PACKS','DOSE','DOSES','UNIT','UNITS','NOS','EACH']);
export function isNumberedCategory(text){
  const t=String(text||'').replace(/\s+/g,' ').trim();
  const m=NUMBERED.exec(t); if(!m) return false;
  const tok=m[1]; if(!/\d/.test(tok) && !/^[OS]{1,2}$/i.test(tok)) return false;
  const rest=m[2].trim(); if(NOT_GROUP.test(rest)) return false;
  const words=rest.toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  return words.length>0 && !NOT_CATEGORY.has(words[0]);
}
/* the numbered category with its number in digits: "0S INJECTION" → "05 INJECTION" */
export function categoryName(text){
  const t=String(text||'').replace(/\s+/g,' ').trim();
  const m=NUMBERED.exec(t); if(!m) return t;
  return m[1].replace(/[OoIl|SsBbZz]/g,c=>DIGIT_OF[c]||c)+' '+m[2].trim();
}

export function isGroupName(text){
  const t=String(text||'').replace(/\s+/g,' ').trim();
  if(isNumberedCategory(t)) return true;
  if(!t || /\d/.test(t)) return false;
  if(!/^[A-Za-z&\-\/.,'’()\s]+$/.test(t)) return false;
  if((t.match(/[A-Za-z]/g)||[]).length<2) return false;
  if(NOT_GROUP.test(t)) return false;
  const words=t.toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  if(!words.length || words.every(w=>FRAGMENT.has(w))) return false;
  return true;
}

/* a stray mark in a cell: what a pen stroke or a tick across the row reads as */
export function isStray(text, source){
  const s=String(text||'').trim();
  if(!s) return true;
  if(s.length>4) return false;
  if(source && SURE.has(source)) return false;
  return !/[A-Za-z]{2}/.test(s);
}

/* texts: the row's cell texts in column order; sources: their sources (optional).
   The leftmost filled cell starts the name; every other filled cell that reads like a name is part of it (three
   at most) — neighbours are one text cut at a gutter ("Square Pharmaceuticals" | "Ltd."), cells apart are the group
   and its keeper ("Rx Product" … "MD JAKARIA HABIB", joined with " · "); every other filled cell must be a stray.
   Returns {name, cells:[ci…]} or null. */
export function groupNameOf(texts, sources){
  const f=texts.map((t,ci)=>t&&String(t).trim()?ci:-1).filter(ci=>ci>=0);
  if(!f.length) return null;
  const cells=f.filter(ci=>isGroupName(texts[ci]));
  if(!cells.length || cells[0]!==f[0] || cells.length>3) return null;
  for(const k of f) if(!cells.includes(k) && !isStray(texts[k], sources?sources[k]:null)) return null;
  const parts=[]; let cur=[]; cells.forEach((ci,i)=>{ if(i>0 && ci!==cells[i-1]+1){ parts.push(cur); cur=[]; } cur.push(ci); }); parts.push(cur);
  const name=parts.map(p=>p.map(ci=>String(texts[ci]).trim()).join(' ')).join(' · ');
  return isGroupName(name.replace(/ · /g,' ')) ? {name, cells} : null;
}

const isNumber=t=>/^[\s(]*[-+]?[\d,]*\.?\d+\s*%?[)\s]*$/.test(String(t||''));
/* the columns whose filled cells are numbers at least 60 % of the time (two or more filled cells) */
export function numericColumnsOf(rowTexts){
  const n=Math.max(0,...rowTexts.map(r=>r.length)); const out=[];
  for(let ci=0;ci<n;ci++){ let filled=0, num=0; for(const r of rowTexts){ const t=r[ci]; if(t&&String(t).trim()){ filled++; if(isNumber(t)) num++; } }
    if(filled>=2 && num>=0.6*filled) out.push(ci); }
  return out;
}
/* a group row that carries a code: nothing numeric in any number column, the filled cells running on from the left,
   two real words at least — {name} or null */
function codedGroupNameOf(texts, numericCols){
  if(numericCols.length<2) return null;
  const f=texts.map((t,ci)=>t&&String(t).trim()?ci:-1).filter(ci=>ci>=0);
  if(!f.length || f[0]>1) return null;
  if(f.some((ci,k)=>k>0 && ci!==f[k-1]+1)) return null;
  if(numericCols.some(ci=>texts[ci] && String(texts[ci]).trim() && isNumber(texts[ci]))) return null;
  const name=f.map(ci=>String(texts[ci]).trim()).join(' ').replace(/\s+/g,' ');
  if(NOT_GROUP.test(name)) return null;
  if(isNumberedCategory(name)) return {name};
  const words=name.toUpperCase().split(/[^A-Z]+/).filter(w=>w.length>=3 && !FRAGMENT.has(w));
  if(words.length<2) return null;
  return {name};
}

/* rowTexts: one array of cell texts per row, in column order; rowSources: the sources alongside (optional) */
export function groupRowsOf(rowTexts, rowSources){
  const filled=rowTexts.map(r=>r.map((t,ci)=>t&&String(t).trim()?ci:-1).filter(ci=>ci>=0));
  const sizes=filled.map(f=>f.length).filter(n=>n>0).sort((a,b)=>a-b);
  if(!sizes.length) return [];
  const itemCols=sizes[sizes.length>>1];
  if(itemCols<3) return [];
  const numericCols=numericColumnsOf(rowTexts);
  const isItem=i=>filled[i].length>=0.6*itemCols && !TOTAL_ROW.test(rowTexts[i].join(' '));   // a totals row under a group name is not the group's item
  const out=[];
  rowTexts.forEach((row,i)=>{
    const f=filled[i]; if(!f.length) return;
    let g=null;
    // with the sources known every stray is vetted on its own; without them the row as a whole must stay sparse
    if(rowSources || f.length<=0.5*itemCols){ g=groupNameOf(row, rowSources?rowSources[i]:null); if(g && g.cells.length>=0.5*itemCols) g=null; }
    if(!g) g=codedGroupNameOf(row, numericCols);
    if(!g) return;
    let follows=false; for(let j=i+1;j<rowTexts.length;j++) if(isItem(j)){ follows=true; break; }
    if(!follows) return;
    out.push({index:i, name:isNumberedCategory(g.name)?categoryName(g.name):g.name});
  });
  return out;
}

/* ---- a group name inside a total row ---------------------------------------------
   "MSD Product" printed under the SubTotal box, read into the SubTotal's row by a region that spanned both lines:
   the cells left of the first cell holding the total word, when they read as a group name, are the next group's
   header. Returns {name, cells} or null. */
const TOTAL_WORD=/\b(sub\s*-?\s*total|grand\s*total|total)\b/i;
export function groupInsideTotal(texts, sources){
  const ti=texts.findIndex(t=>TOTAL_WORD.test(String(t||'')));
  if(ti<=0) return null;
  const lead=texts.map((t,ci)=>ci<ti?t:'');
  if(!lead.some(t=>t&&String(t).trim())) return null;
  const g=groupNameOf(lead, sources?sources.map((s,ci)=>ci<ti?s:null):null);
  return g && g.cells.every(ci=>ci<ti) ? g : null;
}
