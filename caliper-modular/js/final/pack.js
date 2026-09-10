/* ======================================================================
   PACK  ·  the pack size as a unit conversion
   Why: the product list prices a unit (UnitPurchasePrice) and says how many
   units a pack holds (UnitConversion); the invoice prices a pack and prints
   its size. The pack size read from the invoice gives the conversion:
     4X10'S   → 40      (4 strips of 10)
     1X1'S    → 1
     4X1 0S   → 40      (a gap the engine put inside a number is ignored)
     30's, 30S, 30 PCS  → 30
     1x15gm, 100ml, 5 ML → 1   (one bottle or tube; the size is not a count)
     VIAL, TUBE, a word  → 1
   and UnitConversion × UnitPurchasePrice is the invoice's unit TP.
     unitConversionOf(text) -> {value, rule}
   ====================================================================== */
const UNIT=/^(ML|MG|MCG|GM|G|KG|L|LTR|IU)$/i;
export function unitConversionOf(text){
  let t=String(text||'').toUpperCase().replace(/[’`´]/g,"'").trim();
  if(!t) return {value:1, rule:'empty'};
  t=t.replace(/(\d)\s+(?=\d)/g,'$1');                                   // "1 0S" → "10S"
  t=t.replace(/[OoIl|]/g,c=>({O:'0',o:'0',I:'1',l:'1','|':'1'}[c])).replace(/×/g,'X');   // a letter for a digit
  let m;
  if((m=/^(\d+)\s*X\s*(\d+(?:\.\d+)?)\s*([A-Z]+)/.exec(t)) && UNIT.test(m[3])) return {value:+m[1], rule:'packs of a size: '+m[1]+' × '+m[2]+m[3]};   // 1x15gm, 2X100ML
  if((m=/^(\d+)\s*X\s*(\d+)\s*'?S?\b/.exec(t))) return {value:+m[1]*+m[2], rule:m[1]+' × '+m[2]};       // 4X10'S, 5X10S, 10x10
  if((m=/^(\d+)\s*'?S\b/.exec(t))) return {value:+m[1], rule:m[1]+"'S"};                                 // 30's, 30S
  if((m=/^(\d+)\s*(PCS|PC|PIECES|PIECE|TAB|TABS|CAP|CAPS|SACHETS?|STRIPS?)\b/.exec(t))) return {value:+m[1], rule:m[1]+' '+m[2].toLowerCase()};
  if(/^\d+(\.\d+)?\s*(ML|MG|MCG|GM|G|KG|L|LTR|IU)\b/.test(t)) return {value:1, rule:'one of a size'};   // 100ml, 15 gm
  if(/^\d+$/.test(t)) return {value:+t, rule:'a count'};                                                // 30
  return {value:1, rule:'a word'};                                                                      // VIAL, TUBE, BOTTLE
}

/* does a text read like a pack size at all: N X M, N's, N pcs, a size with its unit, a bare count, or a word
   of three letters or more (VIAL, TUBE, BOTTLE) — not a blank, a stray mark, or a single character */
export function looksLikePack(text){
  const t=String(text||'').toUpperCase().replace(/[’`´]/g,"'").replace(/(\d)\s+(?=\d)/g,'$1').trim();
  if(!t) return false;
  if(/^\d+\s*X\s*\d+/.test(t) || /^\d+\s*'?S\b/.test(t) || /^\d+\s*(PCS|PC|PIECES?|TABS?|CAPS?|SACHETS?|STRIPS?)\b/.test(t)) return true;
  if(/^\d+(\.\d+)?\s*(ML|MG|MCG|GM|G|KG|L|LTR|IU)\b/.test(t) || /^\d+$/.test(t)) return true;
  return /^[A-Z]{3,}$/.test(t);
}
/* the pack size an item name ends with — "Adovas Syp 200ml", "Napa Tab 10x10's", "Seclo Cap 30's" — as printed; null when none */
export function packFromName(name){
  // a count (30's, 10x10's, 30 pcs) or a size in ml / g / kg — not a dose (200 mg) and not a form (200 Cap)
  // a letter the engine put for a digit inside the pack (3XI0'S, 1OS) is allowed — the token must still hold a real digit — and is a digit again in the result
  const D='[0-9OoIl|]';
  const m=new RegExp("(?:^|\\s|\\()((?:\\d"+D+"*\\s*[xX×]\\s*"+D+"+\\s*['’]?[sS]?)|(?:\\d"+D+"*\\s*['’][sS])|(?:\\d"+D+"*[sS])|(?:\\d+\\s*pcs)|(?:\\d+(?:\\.\\d+)?\\s*(?:ml|gm|g|kg|ltr|l)))\\)?\\s*$",'i').exec(String(name||''));
  if(!m) return null;
  const tok=m[1].trim();
  // digits again, but only inside the number parts (the trailing S and the unit stay)
  return tok.replace(/^([0-9OoIl|]+)(\s*[xX×]\s*)?([0-9OoIl|]*)/,(all,a,x,b)=>a.replace(/[OoIl|]/g,c=>({O:'0',o:'0',I:'1',l:'1','|':'1'}[c]))+(x||'')+(b||'').replace(/[OoIl|]/g,c=>({O:'0',o:'0',I:'1',l:'1','|':'1'}[c])));
}

/* Which column holds the pack sizes: the one keyed pack; else a column keyed
   unit whose cells mostly read like pack counts (30S, 3X10'S — some templates
   print the pack under "Unit"); -1 when neither. keys and the cell texts
   (grid[ri][ci].text) are what the final table has. */
export function packColumnIndex(keys, grid){
  const pi=keys.indexOf('pack'); if(pi>=0) return pi;
  const ui=keys.indexOf('unit'); if(ui<0) return -1;
  const vals=grid.map(r=>(r[ui]&&r[ui].text)||'').map(t=>t.trim()).filter(Boolean); if(!vals.length) return -1;
  const counts=vals.filter(t=>/^\d+\s*[xX×]\s*\d/.test(t) || /^\d+\s*['’]?[sS]\b/.test(t) || /^\d+\s*(PCS|PC)\b/i.test(t)).length;
  return counts>=Math.max(1,0.5*vals.length) ? ui : -1;
}
/* the row's pack size text: its pack column when the cell reads like a pack, else the pack the name ends with, else '' */
export function rowPackText(keys, grid, ri){
  const pi=packColumnIndex(keys, grid), ni=keys.indexOf('name');
  const cell=pi>=0?((grid[ri][pi]&&grid[ri][pi].text)||'').trim():'';
  if(cell && looksLikePack(cell)) return {text:cell, source:'pack column'};
  if(ni>=0){ const fromName=packFromName((grid[ri][ni]&&grid[ri][ni].text)||''); if(fromName) return {text:fromName, source:'name'}; }
  return {text:cell, source:cell?'pack column':'none'};
}

/* How well a text fits the shape of a pack size: 5 for N X M ('S), 4 for N's / NS
   and a size with its unit, 3 for a word (VIAL), 2 for N pcs, 1 for a bare
   small count, 0 for anything else. A pack cell the engines read differently
   ("30S", "308", "308") is settled by the best-fitting reading rather than by
   the vote: three engines agreeing on 308 are three engines reading the S as
   an 8. */
export function packShapeScore(text){
  const t=String(text||'').toUpperCase().replace(/[’`´]/g,"'").replace(/(\d)\s+(?=\d)/g,'$1').trim();
  if(!t) return 0;
  if(/^\d+\s*X\s*\d+\s*'?S?$/.test(t)) return 5;
  if(/^\d+\s*'?S$/.test(t)) return 4;
  if(/^\d+(\.\d+)?\s*(ML|MG|MCG|GM|G|KG|L|LTR|IU)$/.test(t)) return 4;
  if(/^[A-Z]{3,}$/.test(t)) return 3;
  if(/^\d+\s*(PCS|PC)$/.test(t)) return 2;
  if(/^\d{1,3}$/.test(t)) return 1;
  return 0;
}
/* a bare number that is a pack count with its S read as a digit: 308 → 30S, 305 → 30S, 105 → 10S
   (the count before the S a multiple of 5 of ten or more — 128 is left alone) */
export function repairPackCount(text){
  const m=/^(\d{2,4})([58])$/.exec(String(text||'').trim()); if(!m) return null;
  const n=+m[1]; if(n<10 || n%5!==0) return null;
  return m[1]+'S';
}
/* The pack cell settled from everything read for it: every engine's reading
   scored by shape (the chosen text among them), the best kept when it fits
   (3 or more); else the pack the name ends with; else a bare count repaired
   (308 → 30S); else nothing. cell: {text, api, others:[{name,text}], local};
   returns {text, source} or null when the text stands. */
export function resolvePackCell(cell, nameText){
  const readings=[{name:'paddle', text:cell.api}].concat((cell.others||[]).map(o=>({name:o.name, text:o.text})), [{name:'local', text:cell.local}], [{name:'chosen', text:cell.text}]).filter(r=>r.text && r.text.trim());
  let best=null; for(const r of readings){ const sc=packShapeScore(r.text); if(!best || sc>best.sc) best={...r, sc}; }
  const cur=packShapeScore(cell.text);
  if(best && best.sc>=3 && best.sc>cur) return {text:best.text.trim(), source:best.name};
  if(cur>=3) return null;
  const fromName=packFromName(nameText); if(fromName) return {text:fromName, source:'name'};
  const rep=repairPackCount(cell.text); if(rep) return {text:rep, source:'repair'};
  return null;
}
