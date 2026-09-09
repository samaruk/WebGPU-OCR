/* ======================================================================
   HEADER RULES  ·  columns from a known column-title layout
   Why: the profile finds columns wherever the glyphs leave a gap; it
   cannot tell a real gutter from the space inside "TP+VAT Per Pack",
   and it never knows which column is the batch number. The title row is
   printed, so its words identify the template. When the recognised
   title words match one of config/headerrules.js the rule fixes the
   columns: how many, in what order, what each means — and the detected
   gutters snap each boundary onto the real gap.
     1. title words: the recognised words of the rows around the top of
        the band that hold hardly any numbers (local recognition; the
        API's regions when that is unavailable), sorted left to right in
        the de-skewed frame;
     2. every rule's label tokens are aligned to those words in order
        (dynamic programming, fuzzy token equality, skips allowed); the
        rule with the most columns found is the closest rule;
     3. the closest rule drives the columns only when it matches EXACTLY:
        every title found, in the rule's order, and its boundaries on the
        page's own gutters when the profile shows as many. Then the
        fraction → x map is fitted on the titles and every boundary goes
        to the nearest unused gutter (else the mapped position);
     4. otherwise the columns found from the coverage profile stand, and
        each is only NAMED: the title words above it are matched against
        the vocabulary of every rule's labels, and the column takes the
        key of the label it carries. A page no rule knows still gets
        Batch, Qty, VAT … as keys wherever those words are printed.
   ====================================================================== */
import { HEADER_RULES } from '../config/headerrules.js';
import { finishColumns } from '../columns/columns.js';
import { apiRegions } from '../api/api.js';

/* every label of every rule, once: the vocabulary used to name columns
   when no rule matches exactly (the first rule to use a label sets its key) */
export const LABEL_VOCAB=(()=>{ const seen=new Map();
  for(const r of HEADER_RULES) for(const c of r.columns){ const k=c.label.toLowerCase().replace(/[^a-z0-9%]+/g,' ').trim(); if(!seen.has(k)) seen.set(k,{label:c.label, key:c.key, rule:r.id}); }
  return [...seen.values()]; })();

/* "Batch No." → ['batch','no'];  "%" → ['pct'];  "TP(TK) /PACK" → ['tp','tk','pack'] */
export const tokensOf=s=>(s||'').toLowerCase().replace(/%/g,' pct ').split(/[^a-z0-9]+/).filter(t=>t.length);
const weightOf=t=>t.length>=4?1:t.length===3?0.7:0.4;

function levenshtein(a,b){
  if(a===b) return 0; const m=a.length,n=b.length; if(!m) return n; if(!n) return m;
  let prev=new Array(n+1); for(let j=0;j<=n;j++) prev[j]=j;
  for(let i=1;i<=m;i++){ const cur=[i];
    for(let j=1;j<=n;j++) cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+(a[i-1]===b[j-1]?0:1));
    prev=cur; }
  return prev[n];
}
/* token similarity 0–1: exact 1; one edit on a word of 4+, two on 7+ */
function sim(a,b){
  if(a===b) return 1;
  const L=Math.max(a.length,b.length), d=levenshtein(a,b);
  if(L>=7 && d<=2) return 1-d/L; if(L>=4 && d<=1) return 1-d/L;
  return 0;
}

/* ---- 1 · title words ---------------------------------------------------- */
const numericWord=t=>/^[\d.,%\-()/]+$/.test(t);
export function titleWords(C,recognition,api){
  const band=C.band, rowsAll=C.rows;
  const firstIdx=band.rows[0].index;                              // index into C.rows of the band's top row
  // two rows above the band's top down to six rows into it: a key-value
  // row glued to the band top and a two-line title both fit; item rows
  // in the window are dropped by their numbers below
  const candidates=[];
  for(let k=Math.max(0,firstIdx-2);k<=Math.min(rowsAll.length-1,firstIdx+6);k++) candidates.push(rowsAll[k]);
  const words=[];
  const takeRow=(r,ws)=>{ if(ws.length<2) return; let numeric=0; for(const w of ws) if(numericWord(w.text)) numeric++;
    if(numeric>0.3*ws.length) return;                              // an item row, not a title row
    for(const w of ws){ const cx=(w.bb.x0+w.bb.x1)/2, cy=(w.bb.y0+w.bb.y1)/2;
      for(const t of tokensOf(w.text)) words.push({t, x:C.toDeskewedX(cx,cy), y:cy, row:r.index, text:w.text}); } };
  if(recognition && recognition.available){
    for(const r of candidates){ const res=recognition.lines.find(l=>l.rowIndex===r.index); if(res && res.words) takeRow(r,res.words.filter(w=>w.text&&w.bb)); }
  }
  const response=api&&api.status==='done'?api.response:null;       // S.api is the request entry; the regions live in its response
  if(!words.length && response){                                   // API regions in the same rows: split each region into words along its box
    const regions=apiRegions(response);
    for(const r of candidates){ const d=r.row.dy; const ws=[];
      for(const rg of regions){ const b=rg.bbox; if(!b) continue; const cy=(b.y0+b.y1)/2, cx=(b.x0+b.x1)/2, yp=cy-C.slope*cx;
        if(yp<d.y0-2||yp>d.y1+2) continue;
        const parts=(rg.text||'').split(/\s+/).filter(Boolean); const total=parts.reduce((s,p)=>s+p.length,0)||1; let acc=0;
        for(const p of parts){ const x0=b.x0+(b.x1-b.x0)*acc/total, x1=b.x0+(b.x1-b.x0)*(acc+p.length)/total; acc+=p.length+1;
          ws.push({text:p, bb:{x0,y0:b.y0,x1,y1:b.y1}}); } }
      takeRow(r,ws); }
  }
  // a region that straddles two rows' extents is taken once
  const seen=new Set();
  const unique=words.filter(w=>{ const k=w.t+'@'+Math.round(w.x/4); if(seen.has(k)) return false; seen.add(k); return true; });
  unique.sort((a,b)=>a.x-b.x);
  return unique;
}

/* ---- 2 · align one rule to the words ------------------------------------ */
export function alignRule(rule,words){
  const toks=[]; rule.columns.forEach((c,ci)=>{ for(const t of tokensOf(c.label)) toks.push({t,ci,w:weightOf(t)}); });
  const m=toks.length, n=words.length;
  if(!m||!n) return null;
  const dp=[], back=[];
  for(let i=0;i<=m;i++){ dp.push(new Float64Array(n+1)); back.push(new Int8Array(n+1)); }
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++){
    let best=dp[i-1][j], b=1;                                    // 1 = skip token
    if(dp[i][j-1]>best){ best=dp[i][j-1]; b=2; }                  // 2 = skip word
    const s=sim(toks[i-1].t,words[j-1].t);
    if(s>=0.75){ const v=dp[i-1][j-1]+s*toks[i-1].w; if(v>best){ best=v; b=3; } }   // 3 = match
    dp[i][j]=best; back[i][j]=b;
  }
  const matched=rule.columns.map(()=>({score:0,total:0,xs:[],words:[],rows:[]}));
  toks.forEach(k=>{ matched[k.ci].total+=k.w; });
  let i=m,j=n;
  while(i>0&&j>0){ const b=back[i][j];
    if(b===3){ const k=toks[i-1]; matched[k.ci].score+=sim(k.t,words[j-1].t)*k.w; matched[k.ci].xs.push(words[j-1].x); matched[k.ci].words.push(words[j-1].text); matched[k.ci].rows.push(words[j-1].row); i--; j--; }
    else if(b===1) i--; else j--; }
  const cols=matched.map((mm,ci)=>({ci, found:mm.total>0 && mm.score>=0.5*mm.total, x:mm.xs.length?mm.xs.reduce((s,x)=>s+x,0)/mm.xs.length:null, words:mm.words, rows:mm.rows}));
  const found=cols.filter(c=>c.found).length;
  return {rule, cols, found, total:rule.columns.length, tokenScore:dp[m][n]};
}

/* C           : the column stage result (S.columns)
   recognition : S.recognition (may be null / unavailable)
   api         : S.api (used for title words when recognition is off)
   Returns the best match {rule, cols, found, total, tokenScore, words} or null */
export function matchHeaderRule(C,recognition,api,rules=HEADER_RULES){
  if(!C||!C.band||!C.band.rows.length) return null;
  const words=titleWords(C,recognition,api);
  if(words.length<3) return null;
  let best=null;
  for(const rule of rules){
    const a=alignRule(rule,words); if(!a) continue;
    if(a.found<3) continue;
    if(!best || a.found/a.total>best.found/best.total || (a.found/a.total===best.found/best.total && a.tokenScore>best.tokenScore)) best=a;
  }
  // no rule comes close: the columns are still named from the vocabulary
  if(!best) return {rule:null, cols:[], found:0, total:0, tokenScore:0, words};
  best.words=words;
  return best;
}

/* ---- 3 · columns from the rule + the detected gutters -------------------- */

/* fraction → x map through the found anchors: Theil–Sen (median of the
   pairwise slopes, then the median intercept) — one wrong anchor cannot
   tilt it the way least squares would                                    */
function fitMap(pts,X0,X1){
  if(pts.length<2) return {a:X0, b:X1-X0};
  const slopes=[]; for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){ const df=pts[j].f-pts[i].f; if(Math.abs(df)>1e-6) slopes.push((pts[j].x-pts[i].x)/df); }
  if(!slopes.length) return {a:X0, b:X1-X0};
  slopes.sort((p,q)=>p-q); const b=slopes[slopes.length>>1];
  const inter=pts.map(p=>p.x-b*p.f).sort((p,q)=>p-q); const a=inter[inter.length>>1];
  return b>0 ? {a,b} : {a:X0, b:X1-X0};
}

/* second pass, column by column: the words inside the column's mapped
   x-range (widened by a fifth on each side) are matched against its
   label tokens, each word once. The global alignment of pass one is
   fooled by a two-line title ("Unit" over "(T.P)" — the second line sits
   a little left, so "Unit" comes after "(T.P)" in x order and is handed
   to the next column); a local match is not.                             */
function refineAnchors(rule,words,map){
  return rule.columns.map((rc,ci)=>{
    const x0=map.a+map.b*rc.x0, x1=map.a+map.b*rc.x1, pad=0.2*(x1-x0);
    const inside=words.filter(w=>w.x>=x0-pad && w.x<=x1+pad);
    const toks=tokensOf(rc.label); const used=new Set(); let score=0,total=0; const xs=[],ws=[],rows=[];
    for(const t of toks){ const wt=weightOf(t); total+=wt; let best=-1,bs=0;
      inside.forEach((w,i)=>{ if(used.has(i)) return; const sc=sim(t,w.t); if(sc>bs){ bs=sc; best=i; } });
      if(best>=0 && bs>=0.75){ used.add(best); score+=bs*wt; xs.push(inside[best].x); ws.push(inside[best].text); rows.push(inside[best].row); } }
    const found=total>0 && score>=0.5*total;
    return {ci, found, x:xs.length?xs.reduce((p,q)=>p+q,0)/xs.length:null, words:ws, rows};
  });
}

export function applyHeaderRule(C,match){
  const P=C.profile; if(!P) return false;
  if(!match.rule) return nameColumns(C,match.words,null);
  const rule=match.rule;
  const X0=P.X0, X1=P.X1, N=rule.columns.length;
  const centre=c=>(rule.columns[c.ci].x0+rule.columns[c.ci].x1)/2;
  // pass one anchors → rough map → pass two anchors → final map
  let cols=match.cols;
  let map=fitMap(cols.filter(c=>c.found&&c.x!==null).map(c=>({f:centre(c),x:c.x})),X0,X1);
  if(match.words){ const refined=refineAnchors(rule,match.words,map);
    if(refined.filter(c=>c.found).length>=cols.filter(c=>c.found).length){ cols=refined; match.cols=refined; match.found=refined.filter(c=>c.found).length; } }
  map=fitMap(cols.filter(c=>c.found&&c.x!==null).map(c=>({f:centre(c),x:c.x})),X0,X1);
  const mapX=fr=>map.a+map.b*fr;

  /* Does the rule fit THIS page? Its found titles must sit left to right in
     the rule's order (a page with the same titles in another order — Qty
     before Pack Size, Invoice No where SBU Inv. was — is a different
     layout), and when the page's own profile already shows exactly N − 1
     gutters, the rule's boundaries must land on them. Otherwise the
     profile's columns stand and the rule only NAMES them: each column
     takes the key of the rule column whose label is written above it.  */
  const anchorsInOrder=(()=>{ let prev=-1/0; for(const c of cols){ if(!c.found||c.x===null) continue; if(c.x<prev) return false; prev=c.x; } return true; })();
  const profileGutters=(C.gutters||[]).length;
  const titleRows=[...new Set(cols.filter(c=>c.found).flatMap(c=>c.rows||[]))].sort((p,q)=>p-q);
  const exact=match.found===match.total && anchorsInOrder;
  if(!exact) return nameColumns(C,match.words,{rule, titleRows});

  /* boundaries, left to right: each goes to the nearest unused detected
     gutter right of the previous boundary, within half the two columns'
     width (a deep-but-not-clear valley — a word gap that lines up — costs
     a fifth of that width extra, so the clear gutter beside it wins);
     with no such gutter the mapped position is used. A boundary never
     steps back: every column keeps at least a glyph of width.           */
  const gutters=(C.gutters||[]).slice().sort((p,q)=>p.x0-q.x0);
  const minCol=Math.max(4,0.8*(C.glyphHeight||10));
  const bounds=[]; let usedUpTo=-1, prevX=X0;
  for(let k=0;k<N-1;k++){
    const xb=mapX(rule.columns[k].x1), width=map.b*(rule.columns[k+1].x1-rule.columns[k].x0);
    const leftAnchor=cols[k].found?cols[k].x:-1/0, rightAnchor=cols[k+1].found?cols[k+1].x:1/0;
    let best=-1, bestCost=1/0;
    for(let g=usedUpTo+1; g<gutters.length; g++){
      const gt=gutters[g], gm=(gt.x0+gt.x1)/2;
      if(gm<=prevX+minCol) continue;
      if(gm<=leftAnchor || gm>=rightAnchor) continue;                       // a boundary lies between the two titles
      const cost=Math.abs(gm-xb)+(gt.relative?0.2*width:0);
      if(cost>0.5*width) continue;
      if(cost<bestCost){ bestCost=cost; best=g; }
    }
    if(best>=0){ const gt=gutters[best]; bounds.push({x0:gt.x0,x1:gt.x1,fromGutter:true}); usedUpTo=best; prevX=gt.x1; }
    else { const x=Math.max(prevX+minCol,xb); bounds.push({x0:x-1,x1:x+1,fromGutter:false}); prevX=x+1; }
  }
  if(profileGutters===N-1 && bounds.filter(x=>x.fromGutter).length<N-2) return nameColumns(C,match.words,{rule, titleRows});   // the page's own gutters disagree with the rule
  const columns=rule.columns.map((rc,k)=>{
    const gx0=k===0?X0:bounds[k-1].x1+1, gx1=k===N-1?X1:bounds[k].x0-1;
    return {x0:gx0, x1:Math.max(gx0+1,gx1), gutterX0:gx0, gutterX1:Math.max(gx0+1,gx1), glyphs:0, key:rc.key, label:rc.label, group:rc.group||null,
            found:cols[k].found, title:cols[k].words.join(' ')};
  });
  finishColumns(C,columns);
  C.headerRule={id:rule.id, name:rule.name, found:match.found, total:match.total, boundariesFromGutters:bounds.filter(x=>x.fromGutter).length, mode:'exact match: rule columns on the gutters', titleRows};
  return true;
}

/* The profile's columns stand; each is named from the header vocabulary.
   Every title word goes to the column under its centre (else the nearest:
   a title wider than a narrow column overhangs the gutter); the column
   takes the key of the vocabulary label its words match best — at least
   60 % of the label's tokens, with a token of three letters or the whole
   label, so a lone "no" names nothing while "Sl.No" read whole does.
   Each label names one column. `closest` is the nearest rule, for the
   badge only.                                                          */
export function nameColumns(C,words,closest){
  words=words||[];
  const profileCols=C.columns.slice();
  if(!profileCols.length) return false;
  const colOf=x=>{ let ci=-1,bd=1/0; profileCols.forEach((pc,i)=>{ const d=x<pc.gutterX0?pc.gutterX0-x:x>pc.gutterX1?x-pc.gutterX1:0; if(d<bd){ bd=d; ci=i; } }); return ci; };
  const taken=new Set();
  const named=profileCols.map((pc,pi)=>{
    const inside=words.filter(w=>colOf(w.x)===pi);
    let best=-1,bs=0,bn=0;
    LABEL_VOCAB.forEach((v,vi)=>{ if(taken.has(vi)) return; const toks=tokensOf(v.label); let score=0,total=0,strong=false,n=0; const used=new Set();
      for(const t of toks){ const wt=weightOf(t); total+=wt; let bi=-1,bsim=0; inside.forEach((w,i)=>{ if(used.has(i)) return; const sc=sim(t,w.t); if(sc>bsim){ bsim=sc; bi=i; } }); if(bi>=0&&bsim>=0.75){ used.add(bi); score+=bsim*wt; n++; if(t.length>=3||toks.length===1) strong=true; } }
      const frac=total?score/total:0;
      // the label that explains the most words wins: "Unit (T.P)" over "Unit" when "(T.P)" is printed below
      if((strong || frac>=0.95) && frac>=0.6 && (n>bn || (n===bn && frac>bs))){ bs=frac; bn=n; best=vi; } });
    if(best>=0) taken.add(best);
    return {...pc, key:best>=0?LABEL_VOCAB[best].key:null, label:best>=0?LABEL_VOCAB[best].label:null, found:best>=0, title:inside.map(w=>w.text).join(' ')};
  });
  finishColumns(C,named);
  const rows=[...new Set(words.map(w=>w.row))].sort((p,q)=>p-q);
  C.headerRule={id:closest&&closest.rule?closest.rule.id:null, name:closest&&closest.rule?closest.rule.name:null, found:named.filter(c=>c.key).length, total:named.length,
                boundariesFromGutters:(C.gutters||[]).length, mode:'profile columns, named from the header vocabulary'+(closest&&closest.rule?' (closest rule: '+closest.rule.name+')':''),
                titleRows:(closest&&closest.titleRows&&closest.titleRows.length)?closest.titleRows:rows};
  return true;
}
