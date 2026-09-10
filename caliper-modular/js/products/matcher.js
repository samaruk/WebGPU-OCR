/* ======================================================================
   PRODUCT MATCHER  ·  invoice item names → the pharmacy's product list
   Why: the same product is written many ways — "SECLO 20MG Capsule
   (Delayed Release)", "SECLO 20MG Cap", "SECLO Caps 20MG", "Seclo 20 mg
   capsule"; forms are abbreviated (Tab, Tabs, Cap, Syp, Susp, Inj, Oint,
   Crm), the strength sits in the name or in its own field, and the OCR
   adds a wrong letter now and then. So both sides are reduced to the same
   three parts before they are compared:
     brand     – the words that are neither a strength, a form, a pack size
                 nor a descriptor ("EYE & EAR", "delayed release"): the
                 first is the brand proper, the rest are qualifiers (D,
                 PLUS, DS, XR, FORTE …) that make a different product;
     strength  – every number with its unit (20 MG, 5 ML, 1.70, 5/40),
                 grams turned into milligrams;
     form      – tablet, capsule, syrup, suspension, injection, drops … from
                 the name or the product's category, synonyms folded.
   A candidate scores  brand similarity × qualifier agreement × strength
   agreement × form agreement (+ a little for the invoice's manufacturer):
   a brand read one letter wrong still matches, a different strength or
   form nearly rules a product out, a missing part costs a little. Score
   ≥ 0.85 is a match, ≥ 0.6 uncertain, else no match; two candidates
   within 0.02 of each other make the answer uncertain too.
   Speed: an index on the first brand token (exact, 3-letter prefix and
   trigrams for a token the OCR damaged) keeps every query to a few hundred
   candidates out of 42 000 products; the index is built once, in the
   worker (js/products/worker.js) so the page never waits.
   ====================================================================== */

/* ---- vocabulary ---------------------------------------------------------- */
const FORMS={
  TABLET:['TAB','TABS','TABLET','TABLETS','TABLE','TABL','TB'],
  CAPSULE:['CAP','CAPS','CAPSULE','CAPSULES','CAPSU','CAPSUL','LICAP','SOFTGEL','SOFTGELS'],
  SYRUP:['SYP','SYR','SYRUP','SYRP','SYRUPS'],
  SUSPENSION:['SUSP','SUS','SUSPENSION','SUSPN','SUSPENSN','PFS','P/S','DRYSYRUP'],   // PFS: powder for suspension (an invoice's abbreviation)
  INJECTION:['INJ','INJECTION','INJECTIONS','AMP','AMPOULE','VIAL','VIALS','IV','IM'],
  DROPS:['DROP','DROPS','DRP','DRPS'],
  OINTMENT:['OINT','OINTMENT','OIN','OINTM'],
  CREAM:['CRM','CREAM','CREM'],
  GEL:['GEL','GELS','JELLY'],
  SOLUTION:['SOL','SOLN','SOLUTION'],
  LOTION:['LOTION','LOT'],
  POWDER:['POWDER','PWD','PDR','POW'],
  SACHET:['SACHET','SACH','SACHETS'],
  SPRAY:['SPRAY','SPRY'],
  INHALER:['INHALER','INH','MDI','ACCUHALER','HALER','INHALATION','INHELAR'],
  SUPPOSITORY:['SUPP','SUPPOSITORY','SUPPO'],
  ELIXIR:['ELIXIR','ELX'],
  PESSARY:['PESSARY','PESS'],
  MOUTHWASH:['MOUTHWASH','M/W','MW','MOUTH'],
  SHAMPOO:['SHAMPOO'],
  SOAP:['SOAP','BAR'],
  CARTRIDGE:['CARTRIDGE','PEN','PENFILL'],
  EMULSION:['EMULSION'],
  PASTE:['PASTE'],
  PATCH:['PATCH'],
};
const FORM_OF=new Map(); for(const [f,ws] of Object.entries(FORMS)) for(const w of ws) FORM_OF.set(w,f);
const NEAR_FORMS=[...FORM_OF.keys()].filter(w=>/^[A-Z]{4,}$/.test(w));   // the form words a misread may be one letter off
export const FORM_WORDS=[...FORM_OF.keys()];
/* words that describe but do not name: dropped on both sides */
const DESCRIPTORS=new Set(['EYE','EAR','NASAL','NOSE','ORAL','EXTERNAL','TOPICAL','FOR','OF','AND','THE','WITH','PER','PACK','BOX','STRIP','PCS','PC','PIECE','PIECES',
  'DELAYED','RELEASE','EXTENDED','SUSTAINED','MODIFIED','PROLONGED','FILM','COATED','ENTERIC','SUGAR','FREE','ADULT','DRY','POWDER','FORMULA','USP','BP','IP','LIQUID','DISPERSIBLE','CHEWABLE','EFFERVESCENT','ORODISPERSIBLE',
  'NEW','ORIGINAL','REGULAR','COMBI','KIT','SET','UNIT','UNITS','BOTTLE','BOTTLES','TUBE','SINGLE','DOUBLE','HUMAN',
  'PAED','PAEDIATRIC','PEDIATRIC','PED','SKIN','BODY','FACE','HAIR','POT','JAR','CONTAINER','SACHET','SACHETS','IVIM',
  'RESP','RESPIRATORY','RESPIROTY','RESPIRATOR','NEBULISER','NEBULIZER','NEB','NEBULE','NEBULES','INHALER','INHALATION','INH','REFILL','SPRAY','PUMP']);
export const DESCRIPTOR_WORDS=[...DESCRIPTORS];
/* a bare number after one of these is a count of pieces ("POT 30", "BOX 100"), not a strength */
const CONTAINERS=new Set(['POT','JAR','BOTTLE','BOTTLES','PACK','BOX','STRIP','STRIPS','CONTAINER','PCS','PC','PIECES']);
/* unit words of a strength or a volume; grams and litres are scaled to mg / ml */
const UNITS={MG:['MG','MGM','MGS'], MCG:['MCG','UG','µG','MICROGRAM','MICROGRAMS'], GM:['G','GM','GMS','GRAM','GRAMS'], ML:['ML','MLS'], L:['L','LTR','LITRE','LITER'], IU:['IU','I.U','U','UNIT'], PCT:['%','PCT','PERCENT'], MMOL:['MMOL'], MEQ:['MEQ']};
const UNIT_OF=new Map(); for(const [u,ws] of Object.entries(UNITS)) for(const w of ws) UNIT_OF.set(w,u);

/* ---- text → parts --------------------------------------------------------- */
/* pack sizes are taken out first, before letters and digits are split:
   30's, 150s, 10x10, 5X10'S, 1x1's — a count of pieces, never a strength */
const PACK_RE=/(?<![\d.])\d+\s*X\s*\d+\s*['’`]?S?\b|(?<![\d.])\d+['’`]S\b|\b(\d+)S\b/g;   // CAP20'S, TABLET30'S: the pack may be glued to the word before it
/* a leading serial number of the invoice line: "8 CEFIXIM…", "12CORALTAB", "17.FEXOMIN" */
const SERIAL_RE=/^\s*\d{1,3}\s*[.)\-]?\s*(?=[A-Z]{3})/;
const OCR_DIGIT={S:'5',O:'0',I:'1',L:'1',B:'8',Z:'2'};
const up=s=>String(s||'').toUpperCase().replace(/µ/g,'U')
  .replace(/(\d)\s+([O0]{1,2})(ML|MG|MCG|GM)\b/g,'$1$2$3')                    // "5 Oml": a zero read as O and cut off its digit
  .replace(/(^|[\s(])O(?=\.\d)/g,'$10').replace(/(\d\.)O(\d|\b)/g,'$10$2')     // "O.05", "0.O5": a zero read as O in a decimal
  .replace(/%(?=[A-Z])/g,'% ')                                                 // "0.05%CRM": the form glued to the percentage
  .replace(/%\s*\//g,'% /')                                                    // "5%/5GM": the percentage, then the size it is given per
  .replace(/(^|[\s(])([SOILBZ\d.]{1,4})(ML|MG|MCG|GM)\b/g,(m,a,d,u)=>/[SOILBZ]/.test(d)&&(/\d/.test(d)||/^[SOILBZ]{1,2}$/.test(d))?a+d.replace(/[SOILBZ]/g,c=>OCR_DIGIT[c])+u:m)   // Sml → 5ML, l0ml → 10ML
  .replace(/([A-Z]{2,})(\d+(?:\.\d+)?)(MG|MCG|ML|GM|G|IU|%)\b/g,'$1 $2 $3')   // OTEZOL150MG → OTEZOL 150 MG
  .replace(/([A-Z]{3,})(\d{2,}(?:\.\d+)?)\b/g,'$1 $2')                        // FEXO120 → FEXO 120 (a single trailing digit stays: SECL0 is an OCR'd SECLO)
  .replace(/([A-Z]{3,})(\d+(?:\.\d+)?)([A-Z]{2,})/g,'$1 $2 $3')                // CEFIXIM200CAP → CEFIXIM 200 CAP
  .replace(/(\d)([A-Z%])/g,'$1 $2')                                            // 20MG → 20 MG
  .replace(/(\d) (MG|MCG|ML|GM|IU)([A-Z]{2,})\b/g,'$1 $2 $3')                    // 20 MGCAP → 20 MG CAP
  .replace(/\.(?!\d)/g,' ')                                                    // PAED. → PAED (a decimal point stays)
  .replace(/\b(P|PD|PED|PAED)[-\/ ]?(DROPS?|DRPS?)\b/g,'PAED $2').replace(/\bP\/D\b/g,'PAED DROP')   // P-Drop, P/D, PD Drops: paediatric drops
  .replace(/\bE[-\/.](DROPS?|DRPS?)\b/g,'EYE $1').replace(/\b(EE|E\/E)[-\/.]?(DROPS?|DRPS?)\b/g,'EYE EAR $2').replace(/\bN[-\/.](DROPS?|DRPS?)\b/g,'NASAL $1')   // E-Drop, E/E Drop, N-Drop: eye, eye/ear, nasal drops
  .replace(/\bO[-\/.](PASTE|GEL|SOLN?|SOLUTION|SUSP|SUSPENSION|DROPS?|DRPS?|SPRAY|RINSE)\b/g,'ORAL $1')   // O-Paste, O-Gel, O-Soln: oral
  .replace(/([A-Z]{3,})(IV\/IM|IM\/IV)\b/g,'$1 IVIM').replace(/\b(IV\/IM|IM\/IV)\b/g,'IVIM')   // CEFAZIDIV/IM, Cefazid iv/im: the route, one descriptor
  .replace(/\bM[\s\-\/]?WASH\b/g,'MOUTHWASH').replace(/\bMOUTH[\s\-]WASH\b/g,'MOUTHWASH')   // M-Wash, M/Wash, Mouth Wash
  .replace(/(^|\s)\.(?=\d)/g,'$1').replace(/(?<!%)\s*\/\s*/g,'/')                     // ".20/40" → "20/40"; "5 /40" → "5/40" 
  .replace(/[()\[\],;:+&|]+/g,' ').replace(/[^A-Z0-9./%\- ]+/g,' ')
  .replace(/\s*-\s*/g,'-')
  .replace(/([A-Z])-(\d)/g,'$1 $2').replace(/(\d)-([A-Z])/g,'$1 $2')            // ESOLOK-20, PLUS-2.5/500, TAB-15S: a hyphen between letters and digits is a space
  .replace(/\s+/g,' ').trim();

/* parse one text into {brand:[first,...qualifiers], strength:[{v,u}], form, pack} */
export function parseName(text, extra, opts={}){
  let raw=String(text||'').toUpperCase().replace(/µ/g,'U');
  if(opts.serial) raw=raw.replace(SERIAL_RE,'');                       // an invoice line: the serial number in front is not the name
  const packs=[]; const noPack=raw.replace(PACK_RE,m=>{ packs.push(m.replace(/\s+/g,'')); return ' '; });
  const s=up(noPack), toks=s.split(' ').filter(Boolean);
  const brand=[], strength=[], forms=[]; let form=null, tail=false;   // tail: past the form word or the pack — a lone letter there is a fragment, not a qualifier
  // a weight or volume (10 g, 200 ml) is the SIZE of a tube or bottle, not a dose: it is soft — it counts only
  // against a product that names a size, so "Togent Crm 10g" agrees with a cream filed by its 2%+0.1%
  const pushStrength=(v,u)=>{ let val=+v; if(!isFinite(val)) return; u=u||''; const size=u==='GM'||u==='L'||u==='ML'; if(u==='GM'){ val*=1000; u='MG'; } if(u==='L'){ val*=1000; u='ML'; }
    strength.push(size?{v:Math.round(val*1000)/1000, u, size:true, soft:true}:{v:Math.round(val*1000)/1000, u}); };
  for(let i=0;i<toks.length;i++){
    let t=toks[i];
    // pack sizes: 10X10, 5X10S, 30S, 1X1S — not a strength
    if(/^\d+X\d+S?$/.test(t) || /^\d+S$/.test(t)){ packs.push(t); tail=true; continue; }
    if(tail && /^[A-Z]$/.test(t)) continue;                             // "Maganta Plus Tab 100's T": the T is a scrap of the next column
    // DSCAP, SRTAB: a form word glued to a qualifier of two letters or more — the qualifier stays, the form is read
    if(/^[A-Z]{5,}$/.test(t) && !FORM_OF.has(t) && !DESCRIPTORS.has(t)){ const suf=GLUED_FORMS.find(sf=>t.length>=sf.length+2 && t.endsWith(sf));
      if(suf){ brand.push(t.slice(0,-suf.length)); const f2=FORM_OF.get(suf); if(f2){ forms.push(f2); if(!form) form=f2; } tail=true; continue; } }
    // "/5 ML", "/ML": the volume a dose is given per — not a strength, not a brand word
    if(/^\/\d*(\.\d+)?$/.test(t)){ if(UNIT_OF.has(toks[i+1])) i++; continue; }
    // a/b strengths: 5/40, 5/500 (two numbers, unit may follow)
    let m=/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(t);
    if(m){ const u=UNIT_OF.get(toks[i+1])||''; if(u){ i++; } pushStrength(m[1],u); pushStrength(m[2],u); continue; }
    // 20MG already split to "20 MG"; a bare number followed by a unit, or a bare number
    m=/^(\d+(?:\.\d+)?)$/.exec(t);
    if(m && i>0 && CONTAINERS.has(toks[i-1]) && !UNIT_OF.has(toks[i+1]||'')){ packs.push(t+'S'); continue; }   // "POT 30": a pot of 30
    if(m){ const nxt=toks[i+1]; const u=UNIT_OF.get(nxt);
      if(u){ i++; pushStrength(m[1],u); continue; }
      if(nxt && /^(MG|MCG|ML|GM)\/(ML|GM|L)$/.test(nxt)){ i++; pushStrength(m[1],nxt.split('/')[0]==='G'?'GM':nxt.split('/')[0]); continue; }
      pushStrength(m[1],''); continue; }
    // "MG" on its own after a number that was already taken, or stray units
    if(UNIT_OF.has(t)) continue;
    const f=FORM_OF.get(t); if(f){ forms.push(f); if(!form) form=f; tail=true; continue; }
    if(/^[A-Z]{4,}$/.test(t) && !DESCRIPTORS.has(t)){ const near=NEAR_FORMS.find(w=>w.length===t.length && lev(t,w)===1); if(near){ const nf=FORM_OF.get(near); forms.push(nf); if(!form) form=nf; tail=true; continue; } }   // SALN read for SOLN
    if(DESCRIPTORS.has(t)) continue;
    { let glued=null; for(let k=3;k<t.length-2 && !glued;k++) if(DESCRIPTORS.has(t.slice(0,k)) && FORM_OF.has(t.slice(k))) glued=FORM_OF.get(t.slice(k));   // EYEDROPS → EYE DROPS
      if(glued){ if(!form) form=glued; continue; } }
    if(t.includes('/') && !/\d/.test(t)) continue;                    // M/W, W/V, P/D and the like: descriptors, not brand words
    // hyphenated brand parts: FUNGIN-B → FUNGIN B, BACTIN-D → BACTIN D; SECLO-20 handled by the split above
    const parts=t.split('-').filter(Boolean), shortPart=parts.some(x=>/^[A-Z]{1,2}$/.test(x));
    for(const part of parts){ if(UNIT_OF.has(part) || DESCRIPTORS.has(part)) continue; /* TOMYCIN-EYE: EYE is a descriptor here too */
      const pf=FORM_OF.get(part);
      if(pf){ if(shortPart && parts.length>=2){ brand.push(part); continue; }   // E-GEL, V-GEL, E-CAP: the form word IS the brand's second half
              if(!form) form=pf; continue; }
      if(/^\d+(\.\d+)?$/.test(part)){ pushStrength(part,''); continue; } if(part.length===1 && /\d/.test(part)) continue;
      // E-GELCAP: a form word glued to the end of a part (three letters or more on either side; GEL itself is left, it is a brand's half too often)
      const suf=GLUED_FORMS.find(sf=>part.length>=sf.length+2 && part.endsWith(sf));
      if(suf){ brand.push(part.slice(0,-suf.length)); const f2=FORM_OF.get(suf); if(f2 && !form) form=f2; continue; }
      brand.push(part); }
  }
  if(forms.includes('CAPSULE') && form==='GEL') form='CAPSULE';        // "Soft Gel Cap": a capsule, not a gel
  // "E-GEL 200GM" on a capsule: no capsule weighs 200 g — a gram figure over 5 g on a tablet or capsule is a milligram dose misprinted
  if(form==='TABLET' || form==='CAPSULE') for(let k=0;k<strength.length;k++){ const st=strength[k]; if(st.size && st.u==='MG' && st.v>5000) strength[k]={v:Math.round(st.v/1000*1000)/1000, u:'MG'}; }
  // the pack column (200ml, 3gm): a soft volume or weight beside whatever the name says, unless the name gives one in that unit already
  if(extra){ const e=parseName(extra); for(const x of e.strength) if((x.u==='ML'||x.u==='MG') && !strength.some(y=>y.u===x.u)) strength.push({...x, soft:true}); if(!form && e.form) form=e.form; }
  const packCount=packs.map(pk=>{ const m=/^(\d+)X(\d+)/.exec(pk); if(m) return +m[1]*+m[2]; const n=/^(\d+)/.exec(pk); return n?+n[1]:0; }).find(n=>n>0)||0;
  return {brand, strength, form, packs, packCount, text:s};
}

/* ---- similarity ------------------------------------------------------------ */
function lev(a,b){ if(a===b) return 0; const m=a.length,n=b.length; if(!m) return n; if(!n) return m; let prev=new Array(n+1); for(let j=0;j<=n;j++) prev[j]=j;
  for(let i=1;i<=m;i++){ const cur=[i]; for(let j=1;j<=n;j++) cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1)); prev=cur; } return prev[n]; }
/* OCR confusions cost half an edit: 0/O, 1/I/L, 5/S, 8/B, 2/Z, 6/G */
/* OCR look-alike classes: 0/O, 1/I/L, 5/S, 8/B, 2/Z, 6/G — a substitution inside one class counts half an edit (CL for CI, SECL0 for SECLO) */
const CONF={'0':'O','O':'O','1':'I','I':'I','L':'I','5':'S','S':'S','8':'B','B':'B','2':'Z','Z':'Z','6':'G','G':'G'};
export function tokenSim(a,b){
  if(a===b) return 1; if(!a||!b) return 0;
  const L=Math.max(a.length,b.length); let d=lev(a,b);
  // a substitution between OCR look-alikes counts half
  if(a.length===b.length){ let confusions=0, others=0; for(let i=0;i<a.length;i++) if(a[i]!==b[i]){ if(CONF[a[i]] && CONF[a[i]]===CONF[b[i]]) confusions++; else others++; } if(!others) d=confusions*0.5; }
  return Math.max(0, 1-d/L);
}
const strengthEq=(a,b)=>Math.abs(a.v-b.v)<=0.001*Math.max(1,a.v) && (!a.u || !b.u || a.u===b.u);
function strengthFactor(qIn,p){
  // a soft strength (the pack column's 200 ml) only counts against a product that names a volume in that unit:
  // "ANTANIL SUS" + pack 200ml against "(200 mg+125 mg)/5 ml" is not a disagreement
  // a percentage (0.3 %) likewise: the list often files a tube by its weight (3 GM), and the two do not disagree
  const q=qIn.filter(s=>(!s.soft && s.u!=='PCT') || p.some(b=>b.u===s.u && (!s.size || b.size)));
  if(!q.length && !p.length) return 0.95;
  if(!q.length || !p.length) return 0.8;
  const hit=q.filter(a=>p.some(b=>strengthEq(a,b))).length;
  if(hit===q.length && hit===p.length) return 1;
  if(hit===Math.min(q.length,p.length)) return 0.9;     // one side names an extra number (a volume beside the dose)
  return 0.35;
}
/* forms of one family (a syrup written as solution, a cream as ointment) are
   close; a tablet against a capsule or a liquid is a different product */
const FAMILY={SYRUP:'LIQUID',SUSPENSION:'LIQUID',SOLUTION:'LIQUID',ELIXIR:'LIQUID',MOUTHWASH:'LIQUID',DROPS:'LIQUID',EMULSION:'LIQUID',POWDER:'LIQUID',
              TABLET:'SOLID',CAPSULE:'SOLID', CREAM:'TOPICAL',OINTMENT:'TOPICAL',GEL:'TOPICAL',LOTION:'TOPICAL',PASTE:'TOPICAL', INJECTION:'INJ',CARTRIDGE:'INJ'};
function formFactor(q,p){ if(!q || !p) return 0.9; if(q===p) return 1; return FAMILY[q] && FAMILY[q]===FAMILY[p] ? 0.7 : 0.45; }
function qualifierFactor(q,p){
  const a=q.slice(1), b=p.slice(1);
  if(!a.length && !b.length) return 1;
  const same=a.filter(x=>b.some(y=>{ const s=tokenSim(x,y); return s>=0.8 || (x.length<=4 && y.length<=4 && s>=0.74); })).length;   // CL ≈ CI, COAL ≈ COOL: one letter off in a short qualifier
  const extra=a.length+b.length-2*same;
  return same===a.length && same===b.length ? 1 : Math.max(0.35, 1-0.35*extra);
}

/* ---- the index -------------------------------------------------------------- */
const trigrams=t=>{ const s='^'+t+'$', out=new Set(); for(let i=0;i<s.length-2;i++) out.add(s.slice(i,i+3)); return out; };
export function buildIndex(PRODUCTS, COLUMNS){
  const col=Object.fromEntries(COLUMNS.map((c,i)=>[c,i]));
  const items=[], byFirst=new Map(), byPrefix=new Map(), byTrigram=new Map();
  const add=(map,k,i)=>{ let a=map.get(k); if(!a){ a=[]; map.set(k,a); } a.push(i); };
  PRODUCTS.forEach((r,i)=>{
    const name=r[col.Name]||''; if(!name) return;
    const p=parseName(name);
    const st=parseName(r[col.Strength]||'');                       // the strength field, on top of any strength in the name
    for(const s of st.strength) if(!p.strength.some(x=>strengthEq(x,s))) p.strength.push(s);
    // the form from the category when the name gives none — or names a POWDER, which the category
    // says what it is for ("ZOX 30 ml POWDER" / "Powder For Suspension" is a suspension)
    const cat=up(r[col.Category]||''); if(!p.form || p.form==='POWDER'){ for(const w of cat.split(/[ -]/)){ const f=FORM_OF.get(w); if(f && f!=='POWDER'){ p.form=f; break; } if(f && !p.form) p.form=f; } }
    if(p.form==='TABLET' || p.form==='CAPSULE') p.strength=p.strength.map(st=>st.size && st.u==='MG' && st.v>5000 ? {v:Math.round(st.v/1000*1000)/1000, u:'MG'} : st);   // "200GM" on a capsule: milligrams
    const generic=up(r[col.GenericName]||'').split(' ').filter(w=>w.length>2);
    const mfr=up(r[col.Manufacturer]||'');
    if(!p.brand.length){ if(generic.length) p.brand=generic.slice(0,1); else return; }
    const it={i, brand:p.brand, strength:p.strength, form:p.form, generic, mfr, name, first:p.brand[0], conv:+r[col.UnitConversion]||0};
    items.push(it);
    add(byFirst,it.first,items.length-1);
    add(byPrefix,it.first.slice(0,3),items.length-1);
    for(const g of trigrams(it.first)) add(byTrigram,g,items.length-1);
  });
  // the vocabulary: every word of every product name, the form and descriptor
  // words — what a run-together reading ("FILWELTEEN HRTAB") is cut back into
  const vocab=new Set([...FORM_OF.keys(), ...DESCRIPTORS]);
  for(const it of items) for(const w of it.brand) if(w.length>=2) vocab.add(w);
  return {items, byFirst, byPrefix, byTrigram, col, PRODUCTS, vocab};
}

/* the product record the caller sees */
export function productOf(index, it){
  const r=index.PRODUCTS[it.i], c=index.col;
  return {id:r[c.Id], code:r[c.Code], name:r[c.Name], strength:r[c.Strength], generic:r[c.GenericName], category:r[c.Category], manufacturer:r[c.Manufacturer],
          mrp:r[c.UnitSalePrice], tradePrice:r[c.UnitTradePrice], purchasePrice:r[c.UnitPurchasePrice], vat:r[c.Vat], purchaseVat:r[c.PurchaseVat], discount:r[c.Discount], unitConversion:r[c.UnitConversion],
          salesUnit:r[c.SalesUnitType], purchaseUnit:r[c.PurchaseUnitType]};
}

/* form words that may be glued to the end of a hyphenated part (E-GELCAP): the short, common ones */
const GLUED_FORMS=['CAPSULE','TABLET','CAPS','TABS','CAP','TAB','INJ','SYP','SUSP','CRM'];
/* descriptors and form words a brand may be glued to, longest first */
const GLUED_SUFFIXES=[...new Set([...DESCRIPTORS, ...FORM_OF.keys()])].filter(w=>/^[A-Z]{3,}$/.test(w)).sort((a,b)=>b.length-a.length);

/* A word the reading ran together — "FILWELTEEN", "HRTAB" — cut back into
   words of the vocabulary: the fewest pieces, every piece two letters or
   more, the first piece a product's first word when one such cut exists.
   null when the word is a word already, or no cut fits. */
export function segmentToken(index, tok){
  const V=index.vocab; if(!V || tok.length<5 || V.has(tok) || !/^[A-Z]+$/.test(tok)) return null;
  const n=tok.length, best=new Array(n+1).fill(null); best[0]={pieces:[], n:0};
  for(let i=1;i<=n;i++){
    for(let j=Math.max(0,i-16); j<=i-2; j++){ if(!best[j]) continue; const w=tok.slice(j,i); if(!V.has(w)) continue;
      const cand={pieces:best[j].pieces.concat([w]), n:best[j].n+1};
      const better=!best[i] || cand.n<best[i].n || (cand.n===best[i].n && (index.byFirst.has(cand.pieces[0])?1:0)>(index.byFirst.has(best[i].pieces[0])?1:0)) || (cand.n===best[i].n && cand.pieces[0].length>best[i].pieces[0].length);
      if(better) best[i]=cand; } }
  const r=best[n]; if(!r || r.n<2 || r.n>4) return null;
  return r.pieces;
}

/* ---- one query ------------------------------------------------------------- */
/* query: {name, pack, tp}; opts: {manufacturer (hint text), limit} */
export function matchItem(index, query, opts={}){
  // an invoice line often starts with its serial number ("8 CEFIXIM…"), but
  // a name may start with a number too: score both readings, keep the better
  const qs=[parseName(query.name, query.pack, {serial:true})];
  const plain=parseName(query.name, query.pack);
  const tp=query.tp!==undefined && query.tp!==null && isFinite(+query.tp) ? +query.tp : null;   // the invoice's unit TP: a candidate whose price on file agrees is confirmed
  if(plain.text!==qs[0].text) qs.push(plain);
  // a descriptor or form glued to the brand (CLORAMEYE DROPS, SECLOCAP): when the
  // word is no product's first word, the reading with the suffix cut off is tried too
  for(let k=0;k<qs.length && qs.length<8;k++){ const q=qs[k], f=q.brand[0]; if(!f || index.byFirst.has(f)) continue;   // ISOLONEYEDROP: DROP, then EYE
    for(const suf of GLUED_SUFFIXES){ if(f.length>=suf.length+4 && f.endsWith(suf)){
      const form=FORM_OF.get(suf)||null; qs.push({...q, brand:[f.slice(0,-suf.length), ...q.brand.slice(1)], form:q.form||form, text:q.text+' ('+suf+' cut)'}); break; } } }
  // a run-together word cut into vocabulary words is another reading of the line
  for(const q of qs.slice()){ const toks=q.text.split(' '); let changed=false;
    const cut=toks.map(t=>{ const pieces=segmentToken(index,t); if(pieces){ changed=true; return pieces.join(' '); } return t; });
    if(changed && qs.length<12){ const q2=parseName(cut.join(' '), '', {}); q2.text=q2.text+' (words cut)'; if(q.packs&&q.packs.length&&!q2.packs.length){ q2.packs=q.packs; q2.packCount=q.packCount; } qs.push(q2); } }
  let best=null;
  for(const q of qs){ q.tp=tp; const r=matchParsed(index,q,opts); if(!best || r.score>best.score) best=r; }
  return best;
}
function matchParsed(index, q, opts){
  const out={query:q, status:'none', score:0, product:null, candidates:[]};
  if(!q.brand.length) return out;
  const first=q.brand[0];
  // candidates: same first token, same 3-letter prefix, or two shared trigrams (an OCR-damaged token)
  const cand=new Set();
  for(const i of index.byFirst.get(first)||[]) cand.add(i);
  for(const i of index.byPrefix.get(first.slice(0,3))||[]) cand.add(i);
  if(first.length>=4){ const count=new Map(); for(const g of trigrams(first)) for(const i of index.byTrigram.get(g)||[]) count.set(i,(count.get(i)||0)+1);
    const need=Math.max(2, Math.ceil((first.length-1)*0.5)); for(const [i,n] of count) if(n>=need) cand.add(i); }
  const mfrHint=up(opts.manufacturer||'').split(' ').filter(w=>w.length>3);
  const scored=[];
  for(const i of cand){
    const it=index.items[i];
    const bs=tokenSim(first,it.first); if(bs<0.72) continue;
    // qualifiers the invoice took from the generic name are not disagreements
    const qBrand=q.brand.filter((t,k)=>k===0 || !it.generic.some(g=>tokenSim(t,g)>=0.85));
    let score=bs*qualifierFactor(qBrand,it.brand)*strengthFactor(q.strength,it.strength)*formFactor(q.form,it.form);
    if(mfrHint.length && mfrHint.some(w=>it.mfr.includes(w))) score=Math.min(1, score+0.03);
    // the invoice's TP equal to the product's trade or purchase price on file (per unit or per pack): a confirmation
    if(q.tp!==null && q.tp!==undefined && bs>=0.85){ const pr=priceOf(productOf(index,it), q.tp); if(pr && pr.differs===false) score=Math.min(1, score+0.05); }
    if(q.packCount && it.conv===q.packCount) score=Math.min(1, score+0.03);   // the invoice's 30's is the product's pack of 30
    scored.push({i, score, brandSim:bs});
  }
  // an invoice line that names no strength is not penalised when the brand
  // comes in one strength only (nothing to tell apart)
  if(!q.strength.some(s=>!s.soft)){                                   // no strength of its own (the pack column's volume aside)
    const exact=scored.filter(c=>c.brandSim>=0.95 && qualifierFactor(q.brand.filter((t,k)=>k===0 || !index.items[c.i].generic.some(g=>tokenSim(t,g)>=0.85)),index.items[c.i].brand)===1);
    // FEXOMIN SUS: the tablets come in two strengths, the suspension in one — only the products of the named form count
    const ofForm=q.form ? exact.filter(c=>index.items[c.i].form===q.form) : [];
    const pool=ofForm.length ? ofForm : exact;
    const sameSet=(a,b)=>a.length===b.length && a.every(x=>b.some(y=>strengthEq(x,y))) && b.every(y=>a.some(x=>strengthEq(x,y)));
    const groups=[]; for(const c of pool){ const st=index.items[c.i].strength; if(!groups.some(g=>sameSet(g,st))) groups.push(st); }
    if(pool.length && groups.length===1) for(const c of pool) c.score=Math.min(1, c.score/0.8);
  }
  scored.sort((a,b)=>b.score-a.score);
  const top=scored.slice(0, opts.limit||5);
  out.candidates=top.map(c=>({score:Math.round(c.score*1000)/1000, brandSim:Math.round(c.brandSim*100)/100, product:productOf(index,index.items[c.i])}));
  if(!top.length) return out;
  const best=top[0];
  out.score=Math.round(best.score*1000)/1000;
  out.product=out.candidates[0].product;
  // a second product of a DIFFERENT name within 0.02 makes the answer uncertain (two pack sizes of one product do not)
  const rival=top.find(c=>c!==best && best.score-c.score<=0.02 && index.items[c.i].name.toUpperCase()!==index.items[best.i].name.toUpperCase() && strengthFactor(index.items[c.i].strength,index.items[best.i].strength)<1);
  out.status = best.score>=0.85 && !rival ? 'match' : best.score>=0.6 ? 'uncertain' : 'none';
  if(out.status==='none') out.product=null;   // the nearest candidate stays in `candidates`, but a row with no match names no product
  return out;
}

/* many rows; each row {name, pack, tp} → the match with the price comparison */
/* the invoice's unit TP against the product's purchase and trade prices, per
   unit or per pack (UnitConversion); differs when the nearest is over 2 % off */
export function priceOf(p, tp, conv){
  if(!p || tp===undefined || tp===null || !isFinite(tp)) return null;
  const up1=p.purchasePrice, pconv=p.unitConversion||1;
  // the invoice's own conversion (from its pack size) first: UnitConversion × UnitPurchasePrice is the invoice's unit TP;
  // the product's conversion and the bare unit prices stand in when the invoice gives none
  const own=conv!==undefined && conv!==null && isFinite(conv) && conv>0 ? conv : null;
  const cands=(own?[up1*own, (p.tradePrice||0)*own]:[]).concat([up1, up1*pconv, p.tradePrice, (p.tradePrice||0)*pconv]).filter(v=>v!==null && v!==undefined && isFinite(v) && v>0);
  let bestDiff=null; for(const v of cands){ const d=Math.abs(tp-v)/Math.max(v,0.01); if(bestDiff===null || d<bestDiff.rel-1e-9) bestDiff={rel:d, against:v}; }
  const expected=own && up1 ? Math.round(up1*own*10000)/10000 : null;
  return {invoiceTp:tp, purchasePrice:up1, tradePrice:p.tradePrice, unitConversion:own||pconv, invoiceConversion:own, expected, nearest:bestDiff?bestDiff.against:null, relDiff:bestDiff?Math.round(bestDiff.rel*1000)/1000:null, differs:bestDiff?bestDiff.rel>0.02:null};
}
export function matchRows(index, rows, opts={}){
  return rows.map(row=>{
    const m=matchItem(index, row, opts);
    if(m.product){ const pr=priceOf(m.product, row.tp, row.conv); if(pr) m.price=pr; }
    return m;
  });
}

/* the product list ranked for a free text (the popup behind a Product cell):
   the matcher's own candidates first, by score, then every product whose
   name, generic name or manufacturer holds each word of the text, by name —
   an operator's search reaches any product, the best matches on top */
export function searchProducts(index, text, limit=200){
  const q=String(text||'').trim(); const out=[]; const seen=new Set();
  if(q){
    const m=matchItem(index, {name:q}, {limit});
    for(const c of m.candidates){ if(seen.has(c.product.id)) continue; seen.add(c.product.id); out.push({score:c.score, product:c.product, by:'match'}); }
    const words=up(q).split(' ').filter(w=>w.length>=2);
    if(words.length){
      const hits=[];
      for(const it of index.items){ const r=index.PRODUCTS[it.i], hay=up(String(r[index.col.Name]||'')+' '+String(r[index.col.GenericName]||'')+' '+String(r[index.col.Manufacturer]||''));
        if(words.every(w=>hay.includes(w))){ const pr=productOf(index,it); if(!seen.has(pr.id)){ seen.add(pr.id); hits.push({score:0, product:pr, by:'text'}); } } }
      hits.sort((a,b)=>String(a.product.name).localeCompare(String(b.product.name)));
      out.push(...hits);
    }
  } else {
    for(const it of index.items){ if(out.length>=limit) break; out.push({score:0, product:productOf(index,it), by:'list'}); }
  }
  return out.slice(0,limit);
}
