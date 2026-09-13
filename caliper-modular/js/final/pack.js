/* ======================================================================
   PACK  ·  the pack size as a unit conversion
   Why: the product list prices a unit (UnitPurchasePrice) and says how many
   units a pack holds (UnitConversion); the invoice prices a pack and prints
   its size. The pack size read from the invoice gives the conversion:
     4X10'S   → 40      (4 strips of 10)
     1X3X10   → 30      (pieces × pieces per strip × strips: 1 × 3 × 10)
     1X1X1    → 1
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
  if((m=/^(\d+)\s*X\s*(\d+)\s*X\s*(\d+)\s*'?S?\b/.exec(t))) return {value:+m[1]*+m[2]*+m[3], rule:m[1]+' × '+m[2]+' × '+m[3]};   // 1X3X10: pieces × per strip × strips
  if((m=/^(\d+)\s*X\s*(\d+)\s*'?S?\b/.exec(t))) return {value:+m[1]*+m[2], rule:m[1]+' × '+m[2]};       // 4X10'S, 5X10S, 10x10
  if((m=/^(\d+)\s*'?S\b/.exec(t))) return {value:+m[1], rule:m[1]+"'S"};                                 // 30's, 30S
  if((m=/^(\d+)\s*(PCS|PC|PIECES|PIECE|TAB|TABS|CAP|CAPS|SACHETS?|STRIPS?)\b/.exec(t))) return {value:+m[1], rule:m[1]+' '+m[2].toLowerCase()};
  if(/^\d+(\.\d+)?\s*(ML|MG|MCG|GM|G|KG|L|LTR|IU)\b/.test(t)) return {value:1, rule:'one of a size'};   // 100ml, 15 gm
  if(/^\d+$/.test(t)) return {value:+t, rule:'a count'};                                                // 30
  return {value:1, rule:'a word'};                                                                      // VIAL, TUBE, BOTTLE
}

/* does a text read like a pack size at all: N X M, N's, N pcs, a size with its unit, a bare count, or a word
   of three letters or more (VIAL, TUBE, BOTTLE) — not a blank, a stray mark, or a single character */
const digitsFor=t=>t.replace(/[OI|]/g,c=>({O:'0',I:'1','|':'1'}[c])).replace(/×/g,'X');   // IXIXIO → 1X1X10: a letter the engine put for a digit
/* the words a pack column prints for one piece: a garbage reading of letters (pixxr, ioxxa) is not one of them */
const PACK_WORD=/^(VIAL|VIALS|TUBE|TUBES|BOTTLE|BOTTLES|BOT|BOX|BOXES|PCS|PC|PIECE|PIECES|POT|POTS|JAR|JARS|SACHET|SACHETS|STRIP|STRIPS|PACK|PACKS|PACKET|PACKETS|AMP|AMPS|AMPOULE|AMPOULES|CAN|CANS|TIN|TINS|KIT|KITS|SET|SETS|ROLL|ROLLS|PAIR|PAIRS|UNIT|UNITS|EACH|NOS|BAG|BAGS|CARTON|CARTONS|DOZEN|PKT|BTL|CTN)$/;
export function looksLikePack(text){
  const t=String(text||'').toUpperCase().replace(/[’`´]/g,"'").replace(/(\d)\s+(?=\d)/g,'$1').trim();
  if(!t) return false;
  const d=digitsFor(t);
  if(/^\d+\s*X\s*\d+/.test(d) || /^\d+\s*'?S\b/.test(d) || /^\d+\s*(PCS|PC|PIECES?|TABS?|CAPS?|SACHETS?|STRIPS?)\b/.test(t)) return true;
  if(/^\d+(\.\d+)?\s*(ML|MG|MCG|GM|G|KG|L|LTR|IU)\b/.test(t) || /^\d+$/.test(t)) return true;
  return PACK_WORD.test(t);
}
/* the pack size an item name ends with — "Adovas Syp 200ml", "Napa Tab 10x10's", "Seclo Cap 30's" — as printed; null when none */
export function packFromName(name){
  // a count (30's, 10x10's, 30 pcs) or a size in ml / g / kg — not a dose (200 mg) and not a form (200 Cap)
  // a letter the engine put for a digit inside the pack (3XI0'S, 1OS) is allowed — the token must still hold a real digit — and is a digit again in the result
  const D='[0-9OoIl|]';
  const m=new RegExp("(?:^|\\s|\\()((?:\\d"+D+"*\\s*[xX×]\\s*"+D+"+(?:\\s*[xX×]\\s*"+D+"+)?\\s*['’]?[sS]?)|(?:\\d"+D+"*\\s*['’][sS])|(?:\\d"+D+"*[sS])|(?:\\d+\\s*pcs)|(?:\\d+(?:\\.\\d+)?\\s*(?:ml|gm|g|kg|ltr|l)))\\)?\\s*$",'i').exec(String(name||''));
  if(!m) return null;
  const tok=m[1].trim();
  // digits again, but only inside the number parts (the trailing S and the unit stay)
  const dg=v=>v.replace(/[OoIl|]/g,c=>({O:'0',o:'0',I:'1',l:'1','|':'1'}[c]));
  return tok.replace(/^([0-9OoIl|]+)(\s*[xX×]\s*)?([0-9OoIl|]*)(\s*[xX×]\s*)?([0-9OoIl|]*)/,(all,a,x,b,x2,c)=>dg(a)+(x||'')+dg(b||'')+(x2||'')+dg(c||''));
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
  const d=digitsFor(t);                                               // IXIXIO reads as 1X1X10 for the numeric shapes
  if(/^\d+\s*X\s*\d+(\s*X\s*\d+)?\s*'?S?$/.test(d)) return 5;       // 4X10'S, 1X3X10 (pieces × per strip × strips)
  if(/^\d+\s*'?S$/.test(d)) return 4;
  if(/^\d+(\.\d+)?\s*(ML|MG|MCG|GM|G|KG|L|LTR|IU)$/.test(t)) return 4;
  if(PACK_WORD.test(t)) return 3;                                     // VIAL, TUBE, BOTTLE — a known word, not any run of letters
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
/* ---- the S the engines read as a digit ----------------------------------------
   The S of 30'S or 5X9'S is often read as an 8 or a 5 (5X98, 308, 305): the
   glyphs are alike and a column of numbers lures the engine. Three ways to
   tell: another engine read the S at the same place (sConfusion, in
   resolvePackCell); the other pack cells of the column end with an S
   (repairPacksByColumn); and, once the row's product is known, the MRP —
   UnitSalePrice × units per pack against the invoice's TP — is absurd
   under one reading and ordinary under the other (packByMrp). */
const normS=t=>String(t||'').toUpperCase().replace(/[’`´']/g,'').replace(/\s+/g,'');
/* does `reading` read like `chosen` with the trailing 8 / 5 as an S: "5X98" ~ "5X9'S", "308" ~ "30S" */
export function sConfusion(chosen, reading){
  const a=normS(chosen), b=normS(reading);
  if(!/^\d+(X\d+){0,2}[85]$/.test(a) || !/^\d+(X\d+){0,2}S$/.test(b)) return false;
  return a.slice(0,-1)===b.slice(0,-1);
}
/* the text with its trailing 8 / 5 written as an S in the given style ("'S" or "S"); null when it has no such shape.
   N X M8 always (5X98 → 5X9'S, 10X108 → 10X10'S); N X M5 only past 30 (10X15 and 2X25 are packs of 15 and 25, 5X95 is not
   a pack of 95); a bare count of two digits or more (308 → 30S, 128 → 12S, 1005 → 100S). */
export function packWithS(text, style="'S"){
  const t=String(text||'').toUpperCase().replace(/(\d)\s+(?=\d)/g,'$1').replace(/\s*X\s*/,'X').trim();
  let m;
  if((m=/^(\d+X\d+(?:X\d+)?)8$/.exec(t))) return m[1]+style;
  if((m=/^(\d+X(?:\d+X)?)(\d+)5$/.exec(t)) && +(m[2]+'5')>30) return m[1]+m[2]+style;
  if((m=/^(\d{2,4})[85]$/.exec(t))) return m[1]+style;
  return null;
}
/* the pack column as a whole: when the cells that end with an S are at least as many as those that end with an 8 or a
   5 and carry none, the latter get the S too, in the column's own style ('S or S); returns [{index, text}] */
export function repairPacksByColumn(texts){
  const withS=[], cand=[];
  texts.forEach((t,i)=>{ const n=normS(t); if(!n) return;
    if(/^\d+(X\d+){0,2}S$/.test(n)) withS.push(i); else if(packWithS(t)) cand.push(i); });
  if(!withS.length || !cand.length || withS.length<cand.length) return [];
  const apos=withS.filter(i=>/['’`´]\s*S\s*$/i.test(String(texts[i]))).length;
  const style=apos*2>=withS.length?"'S":'S';
  return cand.map(i=>({index:i, text:packWithS(texts[i],style)}));
}
/* the pack size checked against the product's MRP: the pack's MRP is UnitSalePrice × units per pack, and its profit
   on the invoice's TP is ordinary (−25 % … +120 %) — a pack read as 5X98 (490 units) makes it absurd. When it is
   absurd (over +200 % or under −40 %) and another reading of the pack makes it ordinary, that reading stands: the
   trailing 8 / 5 as an S first, then the other engines' readings that look like a pack, then the pack the name ends
   with. {packText, readings:[{name,text}], nameText, mrp, tp} → {text, by, profitWas, profitNow} | null */
export const PROFIT_ODD=v=>v>2.0||v<-0.4, PROFIT_FINE=v=>v>=-0.25&&v<=1.2;
export function packByMrp({packText, readings, nameText, mrp, tp}){
  if(mrp===null || mrp===undefined || !(tp>0) || !(+mrp>0)) return null;
  const profit=t=>(+mrp*unitConversionOf(t).value-tp)/tp;
  const was=profit(packText); if(!PROFIT_ODD(was)) return null;
  const cands=[]; const add=(t,by)=>{ if(t && t.trim() && t.trim()!==String(packText||'').trim() && !cands.some(c=>c.text===t.trim())) cands.push({text:t.trim(), by}); };
  add(packWithS(packText), 'the S read as a digit');
  for(const r of readings||[]) if(r.text && packShapeScore(r.text)>=3) add(r.text, r.name);
  add(packFromName(nameText), 'the name');
  const pick=cands.find(c=>PROFIT_FINE(profit(c.text)));
  if(!pick) return null;
  return {text:pick.text, by:pick.by, profitWas:Math.round(was*1000)/10, profitNow:Math.round(profit(pick.text)*1000)/10};
}

/* The pack cell settled from everything read for it: every engine's reading
   scored by shape (the chosen text among them), a reading with the S where
   the chosen text has an 8 or a 5 ("5X9'S" against "5X98") first, else the
   best kept when it fits (3 or more); else the pack the name ends with; else
   a bare count repaired (308 → 30S); else nothing. cell: {text, api,
   others:[{name,text}], local}; returns {text, source} or null when the
   text stands. */
export function resolvePackCell(cell, nameText){
  const readings=[{name:'paddle', text:cell.api}].concat((cell.others||[]).map(o=>({name:o.name, text:o.text})), [{name:'local', text:cell.local}], [{name:'chosen', text:cell.text}]).filter(r=>r.text && r.text.trim());
  const withS=readings.find(r=>r.name!=='chosen' && sConfusion(cell.text, r.text));
  if(withS) return {text:withS.text.trim(), source:withS.name};
  let best=null; for(const r of readings){ const sc=packShapeScore(r.text); if(!best || sc>best.sc) best={...r, sc}; }
  const cur=packShapeScore(cell.text);
  // a pack read with letters for digits (IXIXIO for 1X1X10): an engine's reading of the same shape with the digits, else the digits put in
  const U=t=>String(t||'').toUpperCase().replace(/[’`´]/g,"'").replace(/\s+/g,''); const cleanDigits=t=>digitsFor(U(t))===U(t);
  if(cur>=4 && !cleanDigits(cell.text)){
    const rd=readings.find(r=>r.name!=='chosen' && packShapeScore(r.text)>=cur && cleanDigits(r.text));
    return rd ? {text:rd.text.trim(), source:rd.name} : {text:digitsFor(U(cell.text)), source:'repair'}; }
  if(best && best.sc>=3 && best.sc>cur) return {text:best.text.trim(), source:best.name};
  if(cur>=3) return null;
  const fromName=packFromName(nameText); if(fromName) return {text:fromName, source:'name'};
  const rep=repairPackCount(cell.text); if(rep) return {text:rep, source:'repair'};
  return null;
}
