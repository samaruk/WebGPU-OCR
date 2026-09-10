/* ======================================================================
   RESPACE  ·  the word gaps a reading lost
   Why: an engine that reads a cell from its character boxes joins words
   whose gap is narrow — "E-GELCAP200MG10X10'S" for "E-GEL CAP 200MG
   10X10'S" — and the vote keeps that spelling when it wins. The spaces are
   put back in two ways:
     · from another reading of the same cell that carries them: when its
       letters and digits are the chosen text's (or a prefix of it), its
       spaces go into the chosen text at the same characters;
     · from the words themselves: a space before a number that follows a
       word of three letters or more, or that follows a unit (200MG|10 …),
       or that is followed by a unit (…-L|60ML); a space after a unit that
       is followed by a word (15ML|DROPS); and a space before a form or
       descriptor word glued to the end of a longer word (GEL|CAP,
       PAEDIATRIC|DROPS) — the matcher's own word lists.
   Numbers, codes and pack sizes are left alone: B12, 10X10'S, L0361040
   and 1x15gm keep their shape.
   ====================================================================== */
import { FORM_WORDS, DESCRIPTOR_WORDS } from '../products/matcher.js';

const UNIT='(?:MCG|MGM|MGS|MLS|MG|ML|GM|IU|KG|G)';
const SUFFIXES=[...new Set([...FORM_WORDS, ...DESCRIPTOR_WORDS])].filter(w=>/^[A-Z]{3,}$/.test(w) && w!=='GEL').sort((a,b)=>b.length-a.length);
/* A brand may itself END in a form-like syllable — Dermasol, Coraltab,
   Gemitab — so a short suffix (TAB, CAP, INJ, SYP, SUSP, CRM …, up to four
   letters) is cut only off a QUALIFIER (DS, SR, XR, Plus, Forte …) or off
   another form or descriptor word (GEL|CAP); a long one (TABLET, CAPSULE,
   DROPS, PAEDIATRIC …, five letters or more) is cut off any word of four
   letters or more, no brand ends in those. */
const QUALIFIERS=new Set(['DS','SR','XR','ER','CR','MR','LA','XL','HD','DT','MD','OD','SL','IR','PR','TR','XT','LP','AF','HS','MPS','FORTE','PLUS','MAX','EXTRA','JUNIOR','JR','KID','KIDS','BABY','ADULT','MINI','MEGA','ULTRA','SUPER','GOLD','SILVER','DUO','TRIO','ONE','NEO','NEW','ORIGINAL','REGULAR','STRONG','LIGHT','ACTIVE','TOTAL','COLD','HOT','MAXX']);
const WORDS=new Set([...FORM_WORDS, ...DESCRIPTOR_WORDS]);
const cutOk=(rest,suf)=>suf.length>=5 ? rest.length>=4 : (QUALIFIERS.has(rest) || WORDS.has(rest));

/* the chosen text with the spaces of a donor reading whose letters and digits agree */
export function spacesFrom(chosen, donors){
  const strip=s=>String(s||'').replace(/\s+/g,'');
  const a=strip(chosen); if(!a) return chosen;
  let best=null;
  for(const d of donors||[]){ if(!d || d===chosen) continue; const b=strip(d); if(!b) continue;
    const n=Math.min(a.length,b.length); let k=0; while(k<n && a[k]===b[k]) k++;
    if(k<Math.max(3,0.6*Math.min(a.length,b.length))) continue;                  // not the same reading
    const spaces=(String(d).match(/\s/g)||[]).length; if(!spaces) continue;
    if(!best || k>best.k || (k===best.k && spaces>best.spaces)) best={d, k, spaces}; }
  if(!best) return chosen;
  // over the part the donor covers, the donor's spacing REPLACES the chosen text's — a gap
  // the donor does not have ("Foli ta") goes, one it has comes; beyond it the chosen text keeps its own
  const spacesOf=txt=>{ const at=new Set(); let i=0; for(const ch of String(txt)){ if(/\s/.test(ch)) at.add(i); else i++; } return at; };
  const atD=spacesOf(best.d), atC=spacesOf(chosen);
  let out=''; for(let j=0;j<a.length;j++){ if(j && (j<best.k ? atD.has(j) : atC.has(j))) out+=' '; out+=a[j]; }
  return out;
}

/* the spaces the words themselves ask for */
export function spaceWords(text){
  let t=String(text||'');
  if(!/[A-Za-z]/.test(t) || /^\s*[\d.,%\-+/]+\s*$/.test(t)) return t;
  const isX=(s,i)=>/[xX]/.test(s[i]) && /\d/.test(s[i-1]||'') && /\d/.test(s[i+1]||'');
  // 5Oml, l0ml, 2S0mg: a letter the engine put for a digit inside a number that ends in a unit — the number
  // must hold a real digit; the letters O, I, l, |, S, B become 0, 1, 1, 1, 5, 8 (the matcher's look-alikes)
  const LOOK={O:'0',o:'0',I:'1',l:'1','|':'1',S:'5',s:'5',B:'8'};
  // O.05, 0.O5: a zero read as O in a decimal; 0.05%Crm: a word glued to a percentage
  t=t.replace(/(^|[\s(])[Oo](?=\.\d)/g,'$10').replace(/(\d\.)[Oo](?=\d|\b)/g,'$10').replace(/%(?=[A-Za-z])/g,'% ');
  t=t.replace(new RegExp('(^|[^A-Za-z0-9])([0-9OoIl|SsB]{1,5}(?:\\.[0-9OoIl|SsB]{1,3})?)('+UNIT+')(?![A-Za-z])','gi'),(m,pre,num,unit)=>/\d/.test(num)&&/[OoIl|SsB]/.test(num)?pre+num.replace(/[OoIl|SsB]/g,c=>LOOK[c]||c)+unit:m);
  // …WORD|123 (a word of three letters or more), …MG|10, …-L|60ML (digits with a unit)
  t=t.replace(/([A-Za-z]{3,})(\d)/g,(m,w,d,off,s)=>isX(s,off+w.length-1)?m:w+' '+d);
  t=t.replace(new RegExp('(\\d'+UNIT+')(\\d)','gi'),'$1 $2');
  t=t.replace(new RegExp('(^|[^A-Za-z])([A-Za-z])(\\d+(?:\\.\\d+)?'+UNIT+')\\b','g'),'$1$2 $3');
  // 15ML|DROPS
  t=t.replace(new RegExp('(\\d'+UNIT+')([A-Za-z]{3,})','gi'),'$1 $2');
  // 0.5|Tab, 10|Tablet: a number followed by a word that is not a unit
  t=t.replace(new RegExp('(\\d)((?!'+UNIT+'(?![A-Za-z]))[A-Za-z]{3,})','gi'),'$1 $2');
  // GEL|CAP, PAEDIATRIC|DROPS: a form or descriptor glued to a longer word, cut again while it fits
  // Dermasol-SScalp, DSTab, XRCap: a capital letter followed by a Capitalised word is two words;
  // FilwelTeen, hrTab: so is a small letter followed by a capital (print has no camel case)
  t=t.replace(/([A-Z])([A-Z][a-z]{2,})/g,'$1 $2').replace(/([a-z])([A-Z])/g,'$1 $2');
  t=t.replace(/[A-Za-z]{5,}/g,w=>{ let parts=[], cur=w.toUpperCase(), orig=w; let guard=0;
    while(guard++<4){ const suf=SUFFIXES.find(sf=>cur.length>=sf.length+2 && cur.endsWith(sf) && cutOk(cur.slice(0,cur.length-sf.length),sf)); if(!suf) break; parts.unshift(orig.slice(cur.length-suf.length)); orig=orig.slice(0,cur.length-suf.length); cur=cur.slice(0,cur.length-suf.length); }
    return [orig,...parts].join(' '); });
  return t.replace(/\s+/g,' ').trim();
}

export function respace(chosen, donors){ return spaceWords(spacesFrom(chosen, donors)); }
