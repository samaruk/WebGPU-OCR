/* ======================================================================
   NUMBER CHECK  ·  the arithmetic of an invoice item table
   Why: the number columns of an item row are not independent readings —
   they are one computation printed several times:

       unit gross  = unit TP + unit VAT              (per pack)
       unit VAT    = unit TP × VAT% / 100
       total TP    = qty × unit TP
       total VAT   = qty × unit VAT   = total TP × VAT% / 100
       discount    = total TP × disc% / 100          (or of TP + VAT)
       net         = total TP + total VAT − discount (or qty × gross − discount,
                                                     or total TP − discount)

   So a cell the OCR misread ("172.86" for "112.86"), dropped, or split by a
   pen tick can be checked against the others and put right. Which of these
   columns a template prints varies (VAT as unit VAT, VAT %, or total VAT;
   discount as %, as an amount, or both; "TP+VAT per pack" or not), so the
   rules are written over ROLES, every table is first mapped onto the roles
   its columns play, and the relation variants that its complete rows
   satisfy become that table's model. Then, row by row:
     · a relation with exactly one value missing FILLS it;
     · a violated relation names the value to change: the candidate whose
       change satisfies the most relations (and breaks none) is applied when
       the corrected number is a plausible misread of the printed text — one
       digit off, a shifted decimal point, a dropped digit, or what another
       OCR engine read there; two independent relations agreeing is accepted
       on its own;
     · a sub-total row checks the columns' sums and settles a lone unverified
       cell by the difference.
   Every cell comes back with a status: verified, filled, fixed, conflict,
   unverified (no relation reaches it), or blank.

   analyseNumbers(table) takes the finalTableJson shape:
     { header:{keys,labels}, rows:[{cells:{key:text}, readings:{key:{engine:text}}}] }
   and returns { roles, model, rows:[{cells:{key:{text,value,status,…}}, isTotal}], summary }.
   ====================================================================== */

/* ---- roles ------------------------------------------------------------ */
export const ROLES = {
  qty:'qty', bonus:'bonus',
  unitTp:'unit TP', unitVat:'unit VAT', vatPct:'VAT %', unitGross:'unit TP+VAT',
  unitSp:'unit SP', totalSp:'total SP',
  totalTp:'total TP', totalVat:'total VAT',
  discPct:'discount %', discAmt:'discount amount', unitDisc:'unit discount',
  net:'net amount',
  mrp:'MRP'
};

/* header-rule keys → roles ('vat' and 'discountValue' are ambiguous and are
   settled by the relations the table satisfies). Keys are read without case
   or punctuation, so a rule may say tp / unittp / unit_tp, tpValue / totaltp,
   discountValue / totaldiscount … for the same column. */
const KEY_ROLE = {
  qty:'qty', quantity:'qty', bonus:'bonus',
  tp:'unitTp', unittp:'unitTp', tradeprice:'unitTp', unitprice:'unitTp',
  vat:'vat?', unitvat:'unitVat', vatpct:'vatPct',
  tpvat:'unitGross', unitgross:'unitGross',
  tpvalue:'totalTp', totaltp:'totalTp', vatvalue:'totalVat', totalvat:'totalVat',
  discountpct:'discPct', discpct:'discPct', discountvalue:'disc?', totaldiscount:'discAmt', discountamount:'discAmt', discamt:'discAmt', unitdiscount:'unitDisc', unitdisc:'unitDisc',
  net:'net', netamount:'net', netvalue:'net', sp:'unitSp', unitsp:'unitSp', spvalue:'totalSp', totalsp:'totalSp', mrp:'mrp'
};
const roleOfRuleKey=k=>KEY_ROLE[String(k||'').toLowerCase().replace(/[^a-z0-9]/g,'')]||null;

/* ---- relations a header rule writes itself ---------------------------------
   A rule column may carry `relation:'{qty}*{unittp}'` — its value from other
   columns, keys in braces. Such a relation is the template's own word and
   REPLACES the built-in variants for that column's role: it is scored,
   verified, and used to fill or fix cells exactly like them. Solving for one
   of the other columns is numeric (the formulas are affine in each column:
   two evaluations give the value, a secant step or two confirm it).      */
export function ruleRelations(list, roleOfKey){
  const out=[];
  // a key in braces is the table's own key, else any key of the same meaning
  // ('{unittp}' on a table a rule keyed tp): the role is what the formula reads
  const present=new Set(Object.values(roleOfKey));
  const roleOf=k=>{ if(roleOfKey[k]) return roleOfKey[k]; const r=roleOfRuleKey(k); return r && present.has(r) ? r : null; };
  for(const {key, formula, source} of list||[]){
    const target=roleOfKey[key]; if(!target || target.endsWith('?')) continue;
    const refs=[...String(formula).matchAll(/\{([^}]+)\}/g)].map(m=>m[1].trim());
    if(!refs.length || refs.includes(key)) continue;
    const vars=refs.map(roleOf); if(vars.some(v=>!v || v.endsWith('?'))) continue;
    const body=String(formula).replace(/\{([^}]+)\}/g,(m,k)=>'v.'+roleOf(k.trim()));
    if(!/^[\sA-Za-z0-9_.+\-*/()]+$/.test(body)) continue;                 // numbers, operators, brackets and role names only
    let f; try{ f=new Function('v','return ('+body+');'); }catch(e){ continue; }
    const num=x=>(typeof x==='number' && isFinite(x))?x:null;
    const solve=(r,v)=>{
      if(r===target) return num(f(v));
      const ev=x=>num(f({...v,[r]:x}));
      const want=v[target]; if(want===undefined) return null;
      let x0=1, x1=2, f0=ev(x0), f1=ev(x1); if(f0===null || f1===null || Math.abs(f1-f0)<1e-12) return null;
      let x=x0+(want-f0)*(x1-x0)/(f1-f0);
      for(let it=0; it<6; it++){ const fx=ev(x); if(fx===null) return null; if(Math.abs(fx-want)<=1e-9) break;
        const h=Math.max(1e-3,Math.abs(x)*1e-3), fh=ev(x+h); if(fh===null || Math.abs(fh-fx)<1e-12) return null; x=x+(want-fx)*h/(fh-fx); }
      return num(x); };
    const shown=String(formula).replace(/\{([^}]+)\}/g,'$1').replace(/\*/g,' × ').replace(/\s+/g,' ');
    const uniq=[target].concat(vars.filter((v,i)=>v!==target && vars.indexOf(v)===i));
    out.push(rel((source==='catalogue'?'type:':'rule:')+key, key+' = '+shown, uniq, solve, {rule:true, source:source||'rule', perUnit:vars.includes('qty') && /\*/.test(formula)}));
  }
  return out;
}

/* label vocabulary for columns no rule named (keys c1, c2 …) */
function roleFromLabel(label){
  const l=(label||'').toLowerCase().replace(/%/g,' pct ').replace(/[^a-z0-9]+/g,' ').trim();
  if(!l) return null;
  const has=re=>re.test(l);
  const money=has(/\b(total|value|amount|amt)\b/);
  if(has(/\b(qty|quantity|inv qty|invoice qty)\b/) && !has(/\b(bonus|free|batch|btch)\b/)) return 'qty';
  if(has(/\b(bonus|free|bq|bon us)\b/)) return 'bonus';
  if(has(/\bmrp\b/)) return 'mrp';
  if(has(/\b(net|payable|grand)\b/)) return 'net';
  if(has(/\b(disc|discount|dis)\b/)) return has(/\bpct\b/) ? 'discPct' : 'disc?';
  if(has(/\bvat\b/) && has(/\b(tp|trade|price)\b/) && has(/\+|plus|per pack/)) return 'unitGross';
  if(has(/\bgross\b/)) return 'unitGross';
  if(has(/\bvat\b/)) return has(/\bpct\b/) ? 'vatPct' : money ? 'totalVat' : 'vat?';
  if(has(/\bsp\b/)) return money ? 'totalSp' : 'unitSp';
  if(has(/\b(tp|trade|t price|tprice|price|rate)\b/)) return money ? 'totalTp' : 'unitTp';
  if(money && has(/\btotal\b/)) return 'net';                     // "Total Amount", "Total Value" with no TP/VAT word
  return null;
}

/* ---- numbers ------------------------------------------------------------ */
/* Parse one cell into a number, tolerating the usual OCR slips. Returns
   {value, pct, clean:boolean} or null when the text is not a number. */
export function parseNumber(text){
  if(text===null || text===undefined) return null;
  let t=String(text).trim();
  if(!t) return null;
  const pct=/%\s*$/.test(t);
  t=t.replace(/%/g,'');
  // a word is not a number: at most two letters, and fewer letters than digits
  const letters=(t.match(/[A-Za-z]/g)||[]).length, digitCount=(t.match(/\d/g)||[]).length;
  if(letters>2 || (letters && letters>=digitCount)) return null;
  // letters that are digits in a numeric column
  const fixed=t.replace(/[Oo]/g,'0').replace(/[lI|]/g,'1').replace(/S/g,'5').replace(/B/g,'8').replace(/Z/g,'2');
  const clean=fixed===t;
  t=fixed.replace(/\s+/g,'').replace(/[^\d.,\-+]/g,'');
  if(!t || !/\d/.test(t)) return null;
  // thousands separators: "1,259.44" / "1.259,44" (rare) / "2,575.84"
  if(/^\-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t=t.replace(/,/g,'');
  else if(/^\-?\d+,\d{1,2}$/.test(t)) t=t.replace(',','.');          // decimal comma
  else t=t.replace(/,/g,'');
  t=t.replace(/\.(?=.*\.)/g,'');                                       // "337..20", "1.259.44" → keep the last point
  if(t.endsWith('.')) t=t.slice(0,-1);
  const v=Number(t);
  if(!isFinite(v)) return null;
  return {value:v, pct, clean};
}

/* the printed number with the same decimals as the text it replaces */
function fmtLike(v, text){
  const m=/\.(\d+)\s*%?$/.exec(String(text||''));
  const d=m?m[1].length:(Number.isInteger(v)?0:2);
  return v.toFixed(d);
}
const digits=s=>String(s).replace(/[^\d]/g,'');

/* is `v` a plausible misread of `text`?  one digit substituted, one digit
   dropped or added, or the decimal point shifted (same digits) */
export function plausibleMisread(v, text){
  if(!text) return false;
  const a=digits(text), b=digits(fmtLike(v,text)), b2=digits(v.toFixed(2)).replace(/0+$/,''), a2=a.replace(/0+$/,'');
  if(!a) return false;
  if(a2===b2 && a2.length) return true;                                // decimal shift / dropped trailing zeros
  const lev=(x,y)=>{ if(x===y) return 0; const m=x.length,n=y.length; let prev=Array.from({length:n+1},(_,j)=>j);
    for(let i=1;i<=m;i++){ const cur=[i]; for(let j=1;j<=n;j++) cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(x[i-1]===y[j-1]?0:1)); prev=cur; } return prev[n]; };
  return lev(a,b)<=1 || (a.length>=5 && lev(a,b)<=2);
}

/* ---- relations ---------------------------------------------------------- */
/* Each relation ties a target to other roles; solve(role, v) gives that
   role's value from the others (null when it cannot). Variants of the same
   target compete; the table's complete rows pick the winner. */
const rel=(id, formula, vars, solve, opts={})=>({id, formula, vars, solve, ...opts});
const div=(a,b)=>Math.abs(b)>1e-9?a/b:null;
export const RELATIONS=[
  rel('gross',   'unitGross = unitTp + unitVat', ['unitGross','unitTp','unitVat'],
      (r,v)=>r==='unitGross'?v.unitTp+v.unitVat : r==='unitTp'?v.unitGross-v.unitVat : v.unitGross-v.unitTp),
  rel('uvat',    'unitVat = unitTp × vatPct/100', ['unitVat','unitTp','vatPct'],
      (r,v)=>r==='unitVat'?v.unitTp*v.vatPct/100 : r==='unitTp'?div(v.unitVat*100,v.vatPct) : div(v.unitVat*100,v.unitTp), {pct:'vatPct'}),
  rel('ttp',     'totalTp = qty × unitTp', ['totalTp','qty','unitTp'],
      (r,v)=>r==='totalTp'?v.qty*v.unitTp : r==='qty'?div(v.totalTp,v.unitTp) : div(v.totalTp,v.qty), {perUnit:true}),
  rel('tvat',    'totalVat = qty × unitVat', ['totalVat','qty','unitVat'],
      (r,v)=>r==='totalVat'?v.qty*v.unitVat : r==='qty'?div(v.totalVat,v.unitVat) : div(v.totalVat,v.qty), {perUnit:true}),
  rel('tvatpct', 'totalVat = totalTp × vatPct/100', ['totalVat','totalTp','vatPct'],
      (r,v)=>r==='totalVat'?v.totalTp*v.vatPct/100 : r==='totalTp'?div(v.totalVat*100,v.vatPct) : div(v.totalVat*100,v.totalTp), {pct:'vatPct'}),
  rel('spGross', 'unitSp = unitTp + unitVat', ['unitSp','unitTp','unitVat'],
      (r,v)=>r==='unitSp'?v.unitTp+v.unitVat : r==='unitTp'?v.unitSp-v.unitVat : v.unitSp-v.unitTp),
  rel('tsp',     'totalSp = qty × unitSp', ['totalSp','qty','unitSp'],
      (r,v)=>r==='totalSp'?v.qty*v.unitSp : r==='qty'?div(v.totalSp,v.unitSp) : div(v.totalSp,v.qty), {perUnit:true}),
  rel('udisc',   'discAmt = qty × unitDisc', ['discAmt','qty','unitDisc'],
      (r,v)=>r==='discAmt'?v.qty*v.unitDisc : r==='qty'?div(v.discAmt,v.unitDisc) : div(v.discAmt,v.qty), {perUnit:true}),
  // discount variants (same target)
  rel('discA',   'discAmt = totalTp × discPct/100', ['discAmt','totalTp','discPct'],
      (r,v)=>r==='discAmt'?v.totalTp*v.discPct/100 : r==='totalTp'?div(v.discAmt*100,v.discPct) : div(v.discAmt*100,v.totalTp), {group:'disc', pct:'discPct'}),
  rel('discB',   'discAmt = (totalTp + totalVat) × discPct/100', ['discAmt','totalTp','totalVat','discPct'],
      (r,v)=>{ const g=v.totalTp+v.totalVat; return r==='discAmt'?g*v.discPct/100 : r==='discPct'?div(v.discAmt*100,g) : r==='totalTp'?div(v.discAmt*100,v.discPct)-v.totalVat : div(v.discAmt*100,v.discPct)-v.totalTp; }, {group:'disc', pct:'discPct'}),
  // net variants (same target)
  rel('net1',    'net = totalTp + totalVat − discAmt', ['net','totalTp','totalVat','discAmt'],
      (r,v)=>r==='net'?v.totalTp+v.totalVat-v.discAmt : r==='totalTp'?v.net-v.totalVat+v.discAmt : r==='totalVat'?v.net-v.totalTp+v.discAmt : v.totalTp+v.totalVat-v.net, {group:'net', optional:['discAmt']}),
  rel('net2',    'net = qty × unitGross − discAmt', ['net','qty','unitGross','discAmt'],
      (r,v)=>r==='net'?v.qty*v.unitGross-v.discAmt : r==='qty'?div(v.net+v.discAmt,v.unitGross) : r==='unitGross'?div(v.net+v.discAmt,v.qty) : v.qty*v.unitGross-v.net, {group:'net', optional:['discAmt'], perUnit:true}),
  rel('net3',    'net = totalTp − discAmt', ['net','totalTp','discAmt'],
      (r,v)=>r==='net'?v.totalTp-v.discAmt : r==='totalTp'?v.net+v.discAmt : v.totalTp-v.net, {group:'net', optional:['discAmt']}),
  rel('net4',    'net = totalSp − discAmt', ['net','totalSp','discAmt'],
      (r,v)=>r==='net'?v.totalSp-v.discAmt : r==='totalSp'?v.net+v.discAmt : v.totalSp-v.net, {group:'net', optional:['discAmt']}),
  rel('net5',    'net = qty × (unitTp + unitVat) − discAmt', ['net','qty','unitTp','unitVat','discAmt'],
      (r,v)=>{ const g=v.unitTp+v.unitVat; return r==='net'?v.qty*g-v.discAmt : r==='qty'?div(v.net+v.discAmt,g) : r==='unitTp'?div(v.net+v.discAmt,v.qty)-v.unitVat : r==='unitVat'?div(v.net+v.discAmt,v.qty)-v.unitTp : v.qty*g-v.net; }, {group:'net', optional:['discAmt'], perUnit:true}),
];

/* an "optional" role counts as 0 only when the TABLE has no such column;
   a blank cell in a column the table does print is a missing value */
function optAbsent(R, presentRoles){ return (R.optional||[]).filter(x=>!presentRoles.has(x)); }

/* tolerance: 2-dp rounding of every printed term, per-unit rounding scaled
   by the quantity, and a little drift on large amounts */
function tolerance(R, v, target){
  const q=R.perUnit && v.qty ? Math.abs(v.qty) : 1;
  return 0.0151 + 0.0051*q + 0.0006*Math.abs(target||0);
}

/* ---- the analysis --------------------------------------------------------- */
export function analyseNumbers(table, opts={}){
  const o=Object.assign({vatRateHint:15, weakBelow:60}, opts);   // weakBelow: OCR confidence (0-100) under which a cell is "weak"
  const empty={roles:{}, model:{relations:[], vatRate:null}, rows:[], summary:{rows:0, itemRows:0, cells:0, verified:0, filled:0, fixed:0, conflicts:0, unverified:0}, note:''};
  if(!table || !table.rows || !table.rows.length) return Object.assign(empty,{note:'no table'});
  const keys=(table.header&&table.header.keys)||Object.keys(table.rows[0].cells||{});
  const labels=(table.header&&table.header.labels)||keys;

  /* 1 · roles from keys / labels, then the numeric evidence ------------- */
  const roleOfKey={};
  keys.forEach((k,i)=>{ const r=roleOfRuleKey(k) || roleFromLabel(labels[i]) || roleFromLabel(k); if(r) roleOfKey[k]=r; });
  // a column whose values are numbers at least 60% of the time is numeric
  const parsedRows=table.rows.map(row=>{ const cells={}; for(const k of keys){ const txt=(row.cells&&row.cells[k])||''; cells[k]={text:txt, parsed:parseNumber(txt)}; } return cells; });
  const numericKey={}; for(const k of keys){ let n=0,t=0; for(const pr of parsedRows){ if(pr[k].text){ t++; if(pr[k].parsed) n++; } } numericKey[k]=t>0 && n>=0.6*t; }
  for(const k of Object.keys(roleOfKey)) if(!numericKey[k] && roleOfKey[k]!=='qty') delete roleOfKey[k];
  // percent evidence: a column of values written with % is a percentage
  for(const k of keys){ const vals=parsedRows.map(pr=>pr[k].parsed).filter(Boolean); if(!vals.length) continue;
    const pctShare=vals.filter(p=>p.pct).length/vals.length;
    if(roleOfKey[k]==='vat?' && pctShare>=0.5) roleOfKey[k]='vatPct';
    if(roleOfKey[k]==='disc?' && pctShare>=0.5) roleOfKey[k]='discPct'; }

  // the rule's (and the column catalogue's) own relations: each competes with
  // the built-in variants of its target in one group per target and wins the
  // group whenever it holds on the rows — a written relation that does not
  // fit a table yields to the check's own guesses instead of silencing them
  // (built per role assignment: a written relation may name a column whose role is still ambiguous)
  const relsFor=map=>{ const rr=ruleRelations(table.relations, map); if(!rr.length) return RELATIONS;
    const tg=new Set(rr.map(R=>R.vars[0])); return RELATIONS.map(R=>tg.has(R.vars[0])?{...R, group:'tgt:'+R.vars[0]}:R).concat(rr.map(R=>({...R, group:'tgt:'+R.vars[0]}))); };

  /* 2 · total rows (a sub-total line inside the table) --------------------- */
  const isTotalRow=[];
  const textKeys=keys.filter(k=>!numericKey[k]);
  table.rows.forEach((row,ri)=>{
    const txt=Object.values(row.cells||{}).join(' ').toLowerCase();
    if(/\b(sub\s*total|grand total|total)\b/.test(txt)){ isTotalRow.push(true); return; }
    // no label: a row with its text columns (name, batch …) mostly blank whose
    // numbers equal the sums of at least two non-zero numeric columns over
    // the item rows above it (back to the previous total)
    const blankText=textKeys.filter(k=>!parsedRows[ri][k].text).length;
    if(textKeys.length && blankText<0.5*textKeys.length){ isTotalRow.push(false); return; }
    let start=ri-1; while(start>=0 && !isTotalRow[start]) start--;
    let hits=0, tests=0;
    for(const k of keys){ const p0=parsedRows[ri][k].parsed; if(!numericKey[k] || !p0) continue; let s=0,n=0;
      for(let j=start+1;j<ri;j++){ const p=parsedRows[j][k].parsed; if(p){ s+=p.value; n++; } }
      if(n>=2 && Math.abs(s)>0.5){ tests++; if(Math.abs(s-p0.value)<=0.02+0.001*Math.abs(s)) hits++; } }
    isTotalRow.push(tests>=2 && hits>=2);
  });

  /* 3 · resolve the ambiguous roles and pick relation variants ------------- */
  const itemIdx=table.rows.map((_,i)=>i).filter(i=>!isTotalRow[i]);
  const rowVals=ri=>{ const v={}; for(const k of keys){ const r=roleOfKey[k]; if(!r) continue; const p=parsedRows[ri][k].parsed; if(p) v[r]=p.value; } return v; };
  const ambiguous=Object.keys(roleOfKey).filter(k=>roleOfKey[k].endsWith('?'));
  const options={ 'vat?':['unitVat','vatPct','totalVat'], 'disc?':['discAmt','unitDisc','discPct'] };
  const assignments=[{}];                                              // every combination of the ambiguous columns' options
  for(const k of ambiguous){ const next=[]; for(const a of assignments) for(const opt of options[roleOfKey[k]]) next.push({...a,[k]:opt}); assignments.splice(0,assignments.length,...next); }
  const scoreAssignment=asg=>{ const map={...roleOfKey}; for(const k in asg) map[k]=asg[k];
    const used=new Set(Object.values(map)); if(used.size<Object.values(map).length) return {score:-1};  // two columns, one role: impossible
    let score=0; const stats={};
    for(const R of relsFor(map)){ if(!R.vars.every(v=>used.has(v) || (R.optional||[]).includes(v))) continue; let n=0,k=0; const abs=optAbsent(R,used);
      for(const ri of itemIdx){ const v=valsWith(ri,map); if(!R.vars.every(x=>v[x]!==undefined || abs.includes(x))) continue; for(const x of abs) v[x]=0;
        const t=R.solve(R.vars[0],v); if(t===null) continue; n++; if(Math.abs(t-v[R.vars[0]])<=tolerance(R,v,t)) k++; }
      stats[R.id]={n,k}; if(n) score+=k-0.5*(n-k); }
    return {score, stats, map}; };
  const valsWith=(ri,map)=>{ const v={}; for(const k of keys){ const r=map[k]; if(!r || r.endsWith('?')) continue; const p=parsedRows[ri][k].parsed; if(p) v[r]=p.value; } return v; };
  let best=null; for(const a of assignments){ const s=scoreAssignment(a); if(!best || s.score>best.score) best=s; }
  const roles=best&&best.map?best.map:roleOfKey; for(const k in roles) if(roles[k].endsWith('?')) delete roles[k];
  const stats=best&&best.stats?best.stats:{};

  // an implied VAT rate when the table prints unit TP and unit VAT but no VAT %
  const present=new Set(Object.values(roles));
  // (zero-VAT rows are exempt items and do not vote; a rate is only kept
  // when the rows agree on it closely — some templates compute VAT on a
  // price other than the printed TP, which still gives one steady ratio)
  let vatRate=null;
  if(!present.has('vatPct')){ const rates=[];
    for(const ri of itemIdx){ const v=valsWith(ri,roles); if(v.unitTp>0 && v.unitVat>0) rates.push(v.unitVat/v.unitTp*100); else if(v.totalTp>0 && v.totalVat>0) rates.push(v.totalVat/v.totalTp*100); }
    if(rates.length>=2){ rates.sort((a,b)=>a-b); const med=rates[rates.length>>1]; const agree=rates.filter(r=>Math.abs(r-med)<0.3).length;
      if(agree>=0.6*rates.length && med>0.5) vatRate=Math.round(med*100)/100; } }

  // active relations: all vars present (optional ones may be absent → 0),
  // and within each variant group only the best one; a relation needs to
  // hold on most of the complete rows it can be tested on
  const active=[];
  const groups={};
  const REL=relsFor(roles);
  for(const R of REL){ const ok=R.vars.every(v=>present.has(v) || (R.optional||[]).includes(v)); if(!ok) continue;
    const st=stats[R.id]||{n:0,k:0}; const rate=st.n?st.k/st.n:0;
    const entry={R, n:st.n, k:st.k, rate};
    if(R.group){ const g=groups[R.group]||(groups[R.group]=[]); g.push(entry); } else if(st.n===0 || rate>=0.5) active.push(entry); }
  const written=e=>e.R.rule && (e.n===0 || e.rate>=0.5) ? (e.R.source==='rule'?2:1) : 0;   // a template's own relation first, then the catalogue's, when it holds
  for(const g of Object.values(groups)){ g.sort((a,b)=>written(b)-written(a) || b.rate-a.rate || b.k-a.k); const top=g[0]; if(top && (top.n===0 || top.rate>=0.5)) active.push(top); }
  // reserve: the variants that hold on the rows (tested, half or more) but lost their group
  // — not used to judge a row, but to COMPUTE a missing value when the winner cannot
  const activeSet=new Set(active.map(e=>e.R));
  const reserve=[]; for(const g of Object.values(groups)) for(const e of g) if(!activeSet.has(e.R) && e.n>0 && e.rate>=0.5) reserve.push(e);
  // the implied VAT rate turns unit/total TP into unit/total VAT checks
  if(vatRate!==null){
    if(present.has('unitTp') && present.has('unitVat')) active.push({R:rel('uvat*',`unitVat = unitTp × ${vatRate}%`,['unitVat','unitTp'],(r,v)=>r==='unitVat'?v.unitTp*vatRate/100:div(v.unitVat*100,vatRate),{skipZero:['unitVat']}), n:0, k:0, rate:1, derived:true});
    if(present.has('totalTp') && present.has('totalVat')) active.push({R:rel('tvatpct*',`totalVat = totalTp × ${vatRate}%`,['totalVat','totalTp'],(r,v)=>r==='totalVat'?v.totalTp*vatRate/100:div(v.totalVat*100,vatRate),{perUnit:true, skipZero:['totalVat']}), n:0, k:0, rate:1, derived:true});
  }
  // a relation does not apply to a row where one of its skipZero values is
  // exactly 0 (a VAT-exempt item has no rate to check) or missing
  const applies=(R,m)=>!(R.skipZero||[]).some(x=>m[x]===0 || m[x]===undefined);
  // the derived relations were not part of the model search: count their rows now
  for(const e of active) if(e.derived){ let n=0,k=0; for(const ri of itemIdx){ const m=valsWith(ri,roles); if(!e.R.vars.every(x=>m[x]!==undefined) || !applies(e.R,m)) continue; const t=e.R.solve(e.R.vars[0],m); if(t===null) continue; n++; if(Math.abs(t-m[e.R.vars[0]])<=tolerance(e.R,m,t)) k++; } e.n=n; e.k=k; e.rate=n?k/n:0; }
  // roles no active relation reaches (bonus, MRP …) are reported as unchecked
  const covered=new Set(); for(const e of active) for(const x of e.R.vars) covered.add(x);

  /* 4 · row by row: fill, fix, verify ------------------------------------- */
  const keyOfRole={}; for(const k in roles) keyOfRole[roles[k]]=k;
  const outRows=table.rows.map((row,ri)=>{
    // a cell read with low confidence (table.rows[].confidence[key], 0-100,
    // from the OCR vote) is "weak": its value may be replaced by what the
    // relations compute without the misread test the others need
    const conf=row.confidence||{};
    // value: the working value (replaced when filled or fixed); raw: the number as read, kept for the record
    const cells={}; for(const k of keys){ const c=parsedRows[ri][k]; cells[k]={text:c.text, value:c.parsed?c.parsed.value:null, raw:c.parsed?c.parsed.value:null, status:c.text?(roles[k]?(covered.has(roles[k])?'unverified':'unchecked'):'text'):'blank',
      weak:!!(roles[k] && c.text && conf[k]!==undefined && conf[k]<o.weakBelow), confidence:conf[k]}; }
    if(isTotalRow[ri]) return {row:row.row||ri+1, isTotal:true, cells, issues:[], rules:{before:[], after:[]}};
    const issues=[];
    const v=()=>{ const m={}; for(const r in keyOfRole){ const c=cells[keyOfRole[r]]; if(c.value!==null) m[r]=c.value; } return m; };
    // every active relation on the row's current values: pass | fail | skip
    const evalRules=()=>{ const m=v(); return active.map(e=>{ const R=e.R, abs=optAbsent(R,present);
      if(!R.vars.every(x=>m[x]!==undefined || abs.includes(x)) || !applies(R,m)) return {id:R.id, formula:R.formula, status:'skip'};
      const mm={...m}; for(const x of abs) mm[x]=0; const t=R.solve(R.vars[0],mm); if(t===null) return {id:R.id, formula:R.formula, status:'skip'};
      return {id:R.id, formula:R.formula, status:Math.abs(t-mm[R.vars[0]])<=tolerance(R,mm,t)?'pass':'fail', expected:Math.round(t*100)/100, actual:mm[R.vars[0]], cells:R.vars.filter(x=>keyOfRole[x]).map(x=>keyOfRole[x])}; }); };
    const rulesBefore=evalRules();
    const readingsOf=r=>{ const k=keyOfRole[r]; const rd=(row.readings&&row.readings[k])||{}; return Object.values(rd).map(parseNumber).filter(Boolean).map(p=>p.value); };
    const setVal=(r,val,status,note)=>{ const k=keyOfRole[r]; const c=cells[k]; c.value=val; c.status=status; c.fixedText=fmtLike(val,c.text||(r==='qty'?'0':'0.00')); if(note) c.note=note; };
    const eachRel=fn=>{ for(const e of active){ const R=e.R, m=v(); if(R.skipZero && R.skipZero.some(x=>m[x]===0)) continue; const abs=optAbsent(R,present); const missing=R.vars.filter(x=>m[x]===undefined && !abs.includes(x)); for(const x of abs) m[x]=0; fn(R,m,missing); } };
    for(let iter=0; iter<4; iter++){
      let changed=false;
      /* fill: a value no relation can see — a blank cell, or a reading that is
         not a number ("Z", "2l", "~") — is computed by EVERY relation that has
         all its other values (the active ones and the reserve variants), in
         as many ways as the row allows: a quantity from total TP / unit TP,
         from total VAT / unit VAT, from the net …; the value the most of
         them agree on is written (two agreeing ways beat one), an even
         split between different values is left alone and noted */
      const fillCand=new Map();                                     // role -> [{val, R, active}]
      for(const e of active.concat(reserve)){ const R=e.R, m=v(); if(R.skipZero && R.skipZero.some(x=>m[x]===0)) continue; const abs=optAbsent(R,present);
        const missing=R.vars.filter(x=>m[x]===undefined && !abs.includes(x)); if(missing.length!==1) continue; for(const x of abs) m[x]=0;
        const x=missing[0]; if(!keyOfRole[x]) continue; const val=R.solve(x,m); if(val===null || !isFinite(val) || val<-1e-9) continue;
        const rounded=x==='qty'||x==='bonus'?Math.round(val):Math.round(val*100)/100; if((x==='qty'||x==='bonus') && Math.abs(val-rounded)>0.05) continue;
        (fillCand.get(x)||fillCand.set(x,[]).get(x)).push({val:rounded, R, active:activeSet.has(R)}); }
      for(const [x,list] of fillCand){
        const near=(a,b)=>x==='qty'||x==='bonus' ? a===b : Math.abs(a-b)<=Math.max(0.011,0.005*Math.abs(a));
        const votes=[]; for(const c of list){ const g=votes.find(g=>near(g.val,c.val)); if(g){ g.n++; g.rels.push(c.R); g.active=g.active||c.active; } else votes.push({val:c.val, n:1, rels:[c.R], active:c.active}); }
        votes.sort((a,b)=>b.n-a.n || (b.active?1:0)-(a.active?1:0) || (b.rels.some(R=>R.rule)?1:0)-(a.rels.some(R=>R.rule)?1:0));
        let top=votes[0];
        if(votes.length>1 && votes[1].n===top.n){ const act=votes.filter(g=>g.active); if(act.length===1) top=act[0];
          else { const c=cells[keyOfRole[x]]; c.note='relations disagree: '+votes.map(g=>g.rels.map(R=>R.id).join('+')+' → '+g.val).join(', '); continue; } }
        const c=cells[keyOfRole[x]], was=c.text;
        setVal(x, top.val, 'filled', 'from '+top.rels.map(R=>R.id).join(', ')+(top.n>1?' ('+top.n+' ways agree)':'')+(was?' — was "'+was+'"':''));
        issues.push({cell:keyOfRole[x], type:'filled', by:top.rels.map(R=>R.id).join('+'), ways:top.n, was}); changed=true; }
      if(changed) continue;
      // fix: violated relations vote for the value to change
      const m=v(); const status={}; const candidates=new Map();  // role -> [{val, rel}]
      for(const e of active){ const R=e.R, abs=optAbsent(R,present); if(!R.vars.every(x=>m[x]!==undefined || abs.includes(x)) || !applies(R,m)) continue; const mm={...m}; for(const x of abs) mm[x]=0;
        const t=R.solve(R.vars[0],mm); if(t===null) continue; const ok=Math.abs(t-mm[R.vars[0]])<=tolerance(R,mm,t); status[R.id]=ok;
        if(ok) continue;
        for(const x of R.vars){ if(m[x]===undefined) continue; const val=R.solve(x,mm); if(val===null || !isFinite(val) || val<-1e-9) continue; (candidates.get(x)||candidates.set(x,[]).get(x)).push({val, R}); } }
      let bestFix=null;
      for(const [x,list] of candidates){
        for(const cand of list){
          const val=x==='qty'||x==='bonus'?Math.round(cand.val):Math.round(cand.val*100)/100;
          if((x==='qty'||x==='bonus') && Math.abs(cand.val-val)>0.05) continue;
          // how many relations does this value satisfy / break
          const mm={...m,[x]:val}; let gain=0, loss=0, agree=0;
          for(const e of active){ const R=e.R, abs=optAbsent(R,present); if(!R.vars.includes(x) || !R.vars.every(y=>mm[y]!==undefined || abs.includes(y)) || !applies(R,mm)) continue; const m2={...mm}; for(const y of abs) m2[y]=0;
            const t=R.solve(R.vars[0],m2); if(t===null) continue; const ok=Math.abs(t-m2[R.vars[0]])<=tolerance(R,m2,t);
            if(ok && !status[R.id]) { gain++; agree++; } else if(!ok && status[R.id]) loss++; }
          if(loss>0 || gain===0) continue;
          const cell=cells[keyOfRole[x]];
          // a weak (low-confidence) reading may be replaced outright by what the relations compute
          const plausible=cell.weak || plausibleMisread(val, cell.text) || readingsOf(x).some(r=>Math.abs(r-val)<=0.006) || agree>=2;
          const score=gain*10 + (plausible?5:0) - (cell.status==='fixed'?100:0);
          if(!plausible) continue;
          if(!bestFix || score>bestFix.score) bestFix={x, val, score, R:cand.R, agree}; } }
      if(bestFix){ const c=cells[keyOfRole[bestFix.x]]; const was=c.text; setVal(bestFix.x, bestFix.val, 'fixed', `was "${was}" — ${bestFix.agree} relation${bestFix.agree>1?'s':''} agree`); issues.push({cell:keyOfRole[bestFix.x], type:'fixed', was, by:bestFix.R.id}); changed=true; }
      if(!changed) break;
    }
    // verdicts: a value in a satisfied relation is verified; in a violated one a conflict
    const m=v();
    for(const e of active){ const R=e.R, abs=optAbsent(R,present); if(!R.vars.every(x=>m[x]!==undefined || abs.includes(x)) || !applies(R,m)) continue; const mm={...m}; for(const x of abs) mm[x]=0;
      const t=R.solve(R.vars[0],mm); if(t===null) continue; const ok=Math.abs(t-mm[R.vars[0]])<=tolerance(R,mm,t);
      for(const x of R.vars){ const k=keyOfRole[x]; if(!k) continue; const c=cells[k];
        if(ok){ if(c.status==='unverified') c.status='verified'; c.checks=(c.checks||0)+1; }
        else { if(c.status==='unverified' || c.status==='verified') c.status='conflict'; (c.conflicts=c.conflicts||[]).push(R.id); } } }
    for(const k of keys) if(cells[k].status==='conflict') issues.push({cell:k, type:'conflict', relations:cells[k].conflicts});
    return {row:row.row||ri+1, isTotal:false, cells, issues, rules:{before:rulesBefore, after:evalRules()}};
  });

  /* 5 · sub-total rows: sums settle a lone doubtful cell --------------------- */
  outRows.forEach((tr,ti)=>{ if(!tr.isTotal) return;
    // items above this total, back to the previous total
    let start=ti-1; while(start>=0 && !outRows[start].isTotal) start--; const items=outRows.slice(start+1,ti).filter(r=>!r.isTotal);
    for(const k of keys){ if(!roles[k] || roles[k]==='qty' && false) continue; const total=tr.cells[k]; if(total.value===null) continue;
      const vals=items.map(r=>r.cells[k]); const known=vals.filter(c=>c.value!==null); const sum=known.reduce((s,c)=>s+c.value,0);
      const tol=0.011+0.003*items.length+0.0005*Math.abs(total.value);
      if(Math.abs(sum-total.value)<=tol){ total.status='verified'; for(const c of vals) if(c.status==='unverified') c.status='verified'; continue; }
      // one value unaccounted for: a blank cell, or exactly one doubtful cell
      const blanks=vals.filter(c=>c.value===null), doubtful=vals.filter(c=>c.status==='conflict'||c.status==='unverified');
      if(blanks.length===1){ const c=blanks[0]; c.value=Math.round((total.value-sum)*100)/100; c.status='filled'; c.fixedText=fmtLike(c.value,total.text); c.note='from the sub-total'; total.status='verified'; }
      else if(!blanks.length && doubtful.length===1){ const c=doubtful[0]; const val=Math.round((total.value-(sum-c.value))*100)/100; if(val>=0 && (plausibleMisread(val,c.text) || c.status==='conflict')){ c.note=`was "${c.text}" — from the sub-total`; c.value=val; c.status='fixed'; c.fixedText=fmtLike(val,c.text); total.status='verified'; } else total.status='conflict'; }
      else total.status='conflict'; }
  });

  /* summary */
  const summary={rows:outRows.length, itemRows:outRows.filter(r=>!r.isTotal).length, cells:0, verified:0, filled:0, fixed:0, conflicts:0, unverified:0, unchecked:0, blank:0};
  for(const r of outRows) for(const k of keys){ if(!roles[k]) continue; const s=r.cells[k].status; summary.cells++; if(s==='verified') summary.verified++; else if(s==='filled') summary.filled++; else if(s==='fixed') summary.fixed++; else if(s==='conflict') summary.conflicts++; else if(s==='unverified') summary.unverified++; else if(s==='unchecked') summary.unchecked++; else if(s==='blank') summary.blank++; }
  return {
    roles, model:{ vatRate, relations:active.map(e=>({id:e.R.id, formula:e.R.formula, testedRows:e.n, satisfied:e.k, derived:!!e.derived, rule:!!e.R.rule, source:e.R.source||'builtin'})) },
    rows:outRows, summary,
    note: active.length?'':'no relation could be formed from the recognised columns'
  };
}

/* the table with every fixed or filled value written back into the cells
   (texts), for a corrected JSON export */
export function applyNumbers(table, result){
  if(!table || !result || !result.rows) return table;
  const rows=table.rows.map((row,ri)=>{ const r=result.rows[ri]; if(!r) return row; const cells={...row.cells};
    for(const k in r.cells){ const c=r.cells[k]; if((c.status==='fixed'||c.status==='filled') && c.fixedText!==undefined) cells[k]=c.fixedText; }
    return {...row, cells, numberCheck:Object.fromEntries(Object.entries(r.cells).filter(([k,c])=>result.roles[k]).map(([k,c])=>[k,c.status+(c.note?' ('+c.note+')':'')]))}; });
  return {...table, rows, numberCheck:{roles:result.roles, model:result.model, summary:result.summary}};
}
