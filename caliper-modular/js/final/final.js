/* ======================================================================
   FINAL  ·  the best of the local analysis and the OCR API answer
   Why: independent readings of the same page — the local pipeline
   (structure from glyphs, text from Tesseract.js) and the API's engines
   (PaddleOCR with its own layout, Tesseract 5, EasyOCR) — fail in
   different places: PaddleOCR keeps decimal points and reads a curled
   row whole, Tesseract 5 spells codes better, EasyOCR reads faint print.
   The final table is rebuilt from all of them:
     · HEADER: one title row. Its labels are the matched header rule's
       (the printed titles, spelled right), else the API's title words,
       else the local ones. Local band rows above the title row (a
       key-value block glued to the table) are not item rows and go.
     · ROWS: the API's item rows below the title where the API found a
       table (PaddleOCR reads a curled row as one row where the local
       join splits or swallows it), each with the local rows it covers
       attached; local rows no API row covers are rows of their own;
       leading and trailing rows that fill hardly any column (a section
       title, a reference number) go.
     · COLUMNS: the local column structure, keyed by the rule when one
       matched; every API region is split into words and each word goes
       to the column under its centre.
     · TEXT per cell by vote among the four readings — PaddleOCR, EasyOCR,
       Tesseract 5 and the local one: a reading at least two of them
       agree on wins (spelled the way the engine highest in that order
       spelled it, in a numeric column the clean spelling); when no two
       agree, PaddleOCR first: its text when it is confident, the local
       reading only where it has none (in a numeric column only a
       well-formed number) or where it is unsure and the local reading
       is clearly more confident and no less plausible (chooseText); and
       without a PaddleOCR reading the most confident other engine
       stands in for it.
   Without a local table the API table is taken as it is; while the API
   answer is pending or failed, the local reading stands with a note.
   ====================================================================== */
import { S } from '../state/state.js';
import { apiRegions, apiEngineList } from '../api/api.js';
import { analyseNumbers } from '../numcheck/numcheck.js';
import { resolveColumnKeys, titleAgreement } from './columnkeys.js';
import { HEADER_RULES } from '../config/headerrules.js';
import { catalogueRelations } from '../config/columntypes.js';
import { respace } from './respace.js';
import { rowConversion } from '../products/products.js';
import { looksLikePack, packFromName, packColumnIndex, resolvePackCell, repairPacksByColumn } from './pack.js';
import { isGroupName, groupNameOf, groupRowsOf, groupInsideTotal } from './group.js';
import { isTitleRow } from './titlerow.js';
import { tableTop, TOTAL_RE } from './tabletop.js';
import { leadingHeaderRows, headerVocabulary, wordsOf } from './headerrows.js';
import { invoiceCloseAt } from './invoiceclose.js';
import { ruleLinesY, mergeRowsByRules, readingOrder, mergeOverlappingRows } from './ruledrows.js';

const norm=s=>(s||'').replace(/\s+/g,' ').trim();
const key=s=>norm(s).toLowerCase().replace(/[\s.,:;'"`·]/g,'');
const numeric=s=>{ const t=norm(s).replace(/\s/g,''); return t.length>0 && /^[-+]?[\d,]*\.?\d+%?$/.test(t); };
const wellFormed=s=>/^[-+]?\d[\d,]*(\.\d+)?%?$/.test(norm(s).replace(/\s/g,''));
const shape=s=>norm(s).replace(/[0-9]/g,'d').replace(/[A-Za-z]/g,'a').replace(/[^da]/g,'p').replace(/(.)\1+/g,'$1');

export function buildFinal(){
  const C=S.columns, RC=S.recognition, A=S.api;
  const api=(A&&A.status==='done')?A.response:null;
  const localTable=(C&&C.band)?{rows:C.band.rows.length, cols:C.columns.length, footerCut:C.band.footerCut||'', headerRule:C.headerRule?C.headerRule.name:null}:null;
  const apiTable=(api&&api.deep&&api.deep.table)?{rows:api.deep.table.rowCount, cols:api.deep.table.columnCount, footerCut:api.deep.table.footerCut||'', first:api.deep.table.firstRow, last:api.deep.table.lastRow}:null;
  const out={apiStatus:A?A.status:'disabled', apiError:A?A.error:null, apiMs:A?A.ms:0, localTable, apiTable,
             fields:(api&&api.deep)?api.deep.fields:null, source:null, header:null, grid:null, rows:null, stats:null, note:''};
  const engines=apiEngineList(api);
  out.engines=engines.map(e=>({name:e.name, label:e.label, status:e.status, ms:Math.round(e.ms||0), regions:e.regions.length, error:e.error}));
  if(!A) out.note='API disabled (section 00c) — local reading only';
  else if(A.status==='pending') out.note='API answer pending — local reading shown';
  else if(A.status==='error') out.note='API failed: '+A.error;

  /* no local table: the API table as it is */
  if(!localTable){
    if(apiTable){
      out.source='api';
      // the API's own vote among its engines when it ran more than one
      const T=api.deep.table;
      out.grid=T.cells.map((row,ri)=>row.map((t,ci)=>{
        const layoutRow=api.deep.rows[T.firstRow+ri], cell=layoutRow&&layoutRow.cells?layoutRow.cells[ci]:null;
        const others=Object.keys(T.engineCells||{}).map(name=>({name, text:T.engineCells[name][ri][ci], conf:100*((T.engineConfidence&&T.engineConfidence[name][ri][ci])||0)})).filter(o=>o.text);
        const text=T.consensus?T.consensus[ri][ci]:t, src=T.consensusSource?T.consensusSource[ri][ci]:(t?'paddle':'');
        const source=!text?'empty':src.startsWith('vote')?'vote':src==='paddle'?'api':src;
        return {text, source, votes:src.startsWith('vote')?src.slice(5).split('+'):null, local:'', api:t, others, localConf:0, apiConf:100*(T.confidence[ri][ci]||0), bb:cell&&cell.bbox?cell.bbox:null};
      }));
      out.rows=out.grid.map((_,ri)=>({source:'api', y:api.deep.rows[api.deep.table.firstRow+ri].bbox.y0}));
      markGroups(out.grid, out.rows, out);
      out.stats=count(out.grid,out.rows);
      out.note=(out.note?out.note+' · ':'')+'no local table — the API table stands';
    } else out.note=(out.note?out.note+' · ':'')+'no table from either side';
    return out;
  }

  out.source='local';
  const cols=C.columns;
  // the column under x, else the nearest one (a word whose centre falls in
  // a gutter still belongs to the table); nothing when it is a column
  // width away from every column
  const colOf=xp=>{ let ci=-1, bd=1/0; cols.forEach((c,i)=>{ const d=xp<c.gutterX0?c.gutterX0-xp:xp>c.gutterX1+1?xp-c.gutterX1-1:0; if(d<bd){ bd=d; ci=i; } });
    return ci>=0 && bd<=Math.max(8,0.5*(cols[ci].gutterX1-cols[ci].gutterX0)) ? ci : -1; };

  /* ---- API words -------------------------------------------------------
     A PaddleOCR region often spans several columns ("2x10's T3641004 1"),
     so every region is split into its words, each placed along the box
     by character count; every WORD then goes to the column under its
     centre, and words in one cell are joined left to right.           */
  const words=[], extraWords=[];                                  // PaddleOCR's words carry the rows and fills; the other engines' only compete per cell
  const pushWord=(text,x0,x1,b,conf,engine='paddle')=>{
    const sink=engine==='paddle'?words:extraWords;
    // a word whose box straddles a column boundary ("VIALC0321007",
    // "T30610121", "124.2021.60") is cut at the character under that
    // boundary: unit | batch, batch | qty, trade | VAT
    const cy=(b.y0+b.y1)/2, xp0=C.toDeskewedX(x0,cy), xp1=C.toDeskewedX(x1,cy), w=Math.max(1,xp1-xp0);
    const hits=[]; cols.forEach((c,ci)=>{ const o=Math.min(xp1,c.gutterX1+1)-Math.max(xp0,c.gutterX0); if(o>=0.25*w && o>=3) hits.push(ci); });
    // one number with its unit or a pack size ("120ml", "0.5mg", "30's", "5X10'S")
    // is one thing: never cut, it goes whole to the column under its centre;
    // so is a word without any digit — a title over two columns ("Per pack")
    // or a name running past its column is not a glued code
    const atom=!/\d/.test(text) || /^\d+(\.\d+)?\s*(ML|MG|MCG|GM|G|L|IU|%|['’`]?S)?$/i.test(text) || /^\d+\s*X\s*\d+\s*['’`]?S?$/i.test(text);
    if(hits.length>=2 && text.length>=2 && !atom){
      // where to cut the text: the local character boxes under the region
      // count how many characters sit left of the boundary (a proportional
      // guess only when the character stage has not covered the region —
      // "VIAL" is narrower than a third of "VIALC0321007")
      // a local box twice the median width holds two touching characters
      // ("VI"): boxes count by their width, so the cut lands on the letter
      const boxes=(S.characters?S.characters.characters:[]).filter(ch=>{ const cy2=(ch.bb.y0+ch.bb.y1)/2; if(cy2<b.y0-2||cy2>b.y1+2) return false; const cxp=C.toDeskewedX((ch.bb.x0+ch.bb.x1)/2,cy2); return cxp>=xp0-2 && cxp<=xp1+2; })
        .map(ch=>({x:C.toDeskewedX((ch.bb.x0+ch.bb.x1)/2,(ch.bb.y0+ch.bb.y1)/2), w:ch.bb.x1-ch.bb.x0+1})).sort((p,q)=>p.x-q.x);
      const widths=boxes.map(c=>c.w).sort((p,q)=>p-q), medW=widths.length?widths[widths.length>>1]:1;
      const chars=boxes.map(c=>c.x), counts=boxes.map(c=>Math.max(1,Math.round(c.w/(1.4*medW))));
      const total=counts.reduce((p,q)=>p+q,0);
      const covered=total>=0.7*text.length && total<=1.3*text.length;
      let start=0, sx0=xp0;
      for(let k=0;k<hits.length-1;k++){
        const xb=(cols[hits[k]].gutterX1+cols[hits[k+1]].gutterX0)/2;
        // the cut falls in the widest gap between local characters near the
        // boundary (the space the engine dropped), scaled to the text length
        let cut;
        if(covered){
          let gi=-1, gw=-1;
          for(let i=0;i<chars.length-1;i++){ const mid=(chars[i]+chars[i+1])/2; if(Math.abs(mid-xb)>0.15*w) continue; const gap=chars[i+1]-chars[i]; if(gap>gw){ gw=gap; gi=i; } }
          let left=0; if(gi>=0){ for(let i=0;i<=gi;i++) left+=counts[i]; } else chars.forEach((x,i)=>{ if(x<xb) left+=counts[i]; });
          cut=Math.round(text.length*left/total);
        } else cut=Math.round(text.length*(xb-xp0)/w);
        cut=Math.max(start+1,Math.min(text.length-1,cut));
        if(cut<=start) continue;
        const sx1=xp0+w*cut/text.length;
        const cxp=(sx0+sx1)/2; const q=C.toImage(cxp,cy-C.slope*(x0+x1)/2);
        sink.push({engine, text:text.slice(start,cut), confidence:conf, bbox:{x0:q.x-(sx1-sx0)/2,y0:b.y0,x1:q.x+(sx1-sx0)/2,y1:b.y1}, xp:cxp, yp:cy-C.slope*((x0+x1)/2)});
        start=cut; sx0=sx1;
      }
      const cxp=(sx0+xp1)/2; const q=C.toImage(cxp,cy-C.slope*(x0+x1)/2);
      sink.push({engine, text:text.slice(start), confidence:conf, bbox:{x0:q.x-(xp1-sx0)/2,y0:b.y0,x1:q.x+(xp1-sx0)/2,y1:b.y1}, xp:cxp, yp:cy-C.slope*((x0+x1)/2)});
      return;
    }
    const cx=(x0+x1)/2;
    sink.push({engine, text, confidence:conf, bbox:{x0,y0:b.y0,x1,y1:b.y1}, xp:C.toDeskewedX(cx,cy), yp:cy-C.slope*cx});
  };
  for(const eng of engines) for(const rg of eng.regions){
    const b=rg.bbox; if(!b) continue;
    const parts=(rg.text||'').split(/\s+/).filter(Boolean); const total=(parts.reduce((s,p)=>s+p.length,0)+Math.max(0,parts.length-1))||1; let acc=0;
    for(const p of parts){ const x0=b.x0+(b.x1-b.x0)*acc/total, x1=b.x0+(b.x1-b.x0)*(acc+p.length)/total; acc+=p.length+1;
      pushWord(p,x0,x1,b,rg.confidence,eng.name); }
  }
  const wordsIn=(yp0,yp1)=>words.filter(w=>w.yp>=yp0-1 && w.yp<=yp1+1);
  const fillOf=(yp0,yp1)=>{ const hit=new Set(); for(const w of wordsIn(yp0,yp1)){ const ci=colOf(w.xp); if(ci>=0) hit.add(ci); } return hit.size; };
  const localText=(ri,ci)=>norm(RC&&RC.available&&RC.cells?RC.cells[ri][ci]:'').replace(/·/g,'');

  /* ---- title rows -------------------------------------------------------
     The header rule knows which rows its titles came from; without a
     rule, the leading band rows that carry no digit at all are titles. */
  const band=C.band.rows;
  const titleSet=new Set();
  if(C.headerRule && C.headerRule.titleRows) for(const idx of C.headerRule.titleRows){ const bi=band.findIndex(r=>r.index===idx); if(bi>=0) titleSet.add(bi); }
  if(!titleSet.size){                                              // no rule: digit-free rows among the first four are titles
    for(let bi=0;bi<Math.min(4,band.length);bi++){ const r=band[bi];
      const text=cols.map((c,ci)=>localText(bi,ci)).join(' ')+' '+wordsIn(r.row.dy.y0,r.row.dy.y1).map(w=>w.text).join(' ');
      if(!/\d/.test(text) && /[a-z]{3}/i.test(text)) titleSet.add(bi); }
  }
  const titleRows=[...titleSet].sort((a,b)=>a-b);   // every title row, the first block bounding the table's top (tabletop.js)

  /* header labels: rule labels; else the API's title words per column; the
     local title text only where the API read nothing there, read it with
     little confidence (under 50) while the local text is not empty, or
     agrees with the rules' vocabulary less well than the local text does
     ("Category & Produdt Name" from PaddleOCR loses to the local "Category
     & Product Name" by one exact token). */
  // (two title rows whose bands overlap would hand the same word to both:
  // every word counts once, and a word repeated in the label is collapsed)
  const dedupeWords=s=>s.replace(/\b(\S+)(?: \1\b)+/gi,'$1');
  const headerSource=[];
  const headerLabels=cols.map((c,ci)=>{
    if(c.label){ headerSource[ci]=c.manual?'manual':'rule'; return c.group && !c.label.toLowerCase().startsWith(c.group.toLowerCase()) ? c.group+' '+c.label : c.label; }   // "Per pack Trade", "Discount %": the group the rule gives
    const apiWords=[], seen=new Set(); for(const bi of titleRows) for(const w of wordsIn(band[bi].row.dy.y0,band[bi].row.dy.y1)) if(colOf(w.xp)===ci && !seen.has(w)){ seen.add(w); apiWords.push(w); }
    const apiText=apiWords.length ? dedupeWords(norm(apiWords.sort((a,b)=>a.yp-b.yp||a.xp-b.xp).map(w=>w.text).join(' '))) : '';
    const localT=dedupeWords(norm(titleRows.map(bi=>localText(bi,ci)).join(' ')));
    if(!apiText){ headerSource[ci]=localT?'local':'none'; return localT; }
    if(!localT){ headerSource[ci]='api'; return apiText; }
    const apiConf=apiWords.reduce((a,w)=>a+(w.confidence||0),0)/apiWords.length;
    const A=titleAgreement(apiText), L=titleAgreement(localT);
    const localWins=(L.n>A.n) || (L.n===A.n && L.exact>A.exact) || (apiConf<50 && A.n===0);
    headerSource[ci]=localWins?'local':'api'; return localWins?localT:apiText;
  });
  if(titleRows.length){
    const y0=Math.min(...titleRows.map(bi=>band[bi].row.ink.y0)), y1=Math.max(...titleRows.map(bi=>band[bi].row.ink.y1)), ym=(y0+y1)/2;
    out.header={labels:headerLabels, source:headerSource, rule:C.headerRule?C.headerRule.name:null,
      cells:cols.map(c=>{ const a=C.toImage(c.gutterX0,ym), b=C.toImage(c.gutterX1,ym); return {x0:Math.round(a.x),y0,x1:Math.round(b.x),y1}; })};
  } else out.header={labels:headerLabels, source:headerSource, rule:C.headerRule?C.headerRule.name:null, cells:null};

  /* ---- rows -------------------------------------------------------------
     The API's item rows come first where the API found a table: PaddleOCR
     reads whole regions, so a curled row it saw is one row, while the
     local join may have split it or swallowed it into a neighbour. Every
     local band row below the title is attached to the API row holding
     its centre (its recognised text then competes cell by cell); a local
     row no API row covers is a row of its own. An API row has to fill
     columns like an item row, else it is one of the API's own key-value
     rows glued to its table. */
  const rowList=[];
  // the table's top (tabletop.js): the rows above the FIRST title block that look like rows of the table — the items
  // of a group begun on the page before, their SubTotal, an item group's header printed above the titles ("Rx
  // Product … MD JAKARIA HABIB") — are kept; the page header above them is not. Title rows anywhere (the titles
  // printed again at the head of a later group) are not rows.
  const bandCellTexts=bi=>{ const r=band[bi]; const t=cols.map(()=>[]); for(const w of wordsIn(r.row.dy.y0,r.row.dy.y1)){ const ci=colOf(w.xp); if(ci>=0) t[ci].push(w.text); }
    cols.forEach((c,ci)=>{ const s=localText(bi,ci); if(s) t[ci].push(s); }); return t.map(a=>norm(a.join(' '))); };
  const top=tableTop(band.map((r,bi)=>bandCellTexts(bi)), titleRows);
  const keepFrom=titleRows.length?top.keepFrom:0;
  if(top.above) out.note=(out.note?out.note+' · ':'')+top.above+' row'+(top.above>1?'s':'')+' above the column titles kept ('+[...new Set(Object.values(top.kinds).filter(Boolean))].join(', ')+': the table begins before its titles)';
  const localRows=[]; band.forEach((r,bi)=>{ if(bi>=keepFrom && !titleSet.has(bi)) localRows.push({ri:bi, yp0:r.row.dy.y0, yp1:r.row.dy.y1, y0:r.row.ink.y0, y1:r.row.ink.y1}); });
  const localTextFill=r=>{ const hit=new Set(); for(const w of wordsIn(r.yp0,r.yp1)){ const ci=colOf(w.xp); if(ci>=0) hit.add(ci); } cols.forEach((c,ci)=>{ if(localText(r.ri,ci)) hit.add(ci); }); return hit.size; };
  const localFills=localRows.map(localTextFill).sort((a,b)=>a-b);
  let itemFill=localFills.length?localFills[localFills.length>>1]:0;
  const topY=band[keepFrom]?band[keepFrom].row.dy.y0-1:(band[0]?band[0].row.dy.y0:0);
  const onTitle=yp=>titleRows.some(bi=>yp>=band[bi].row.dy.y0-1 && yp<=band[bi].row.dy.y1+1);
  if(api && api.deep && api.deep.table && api.deep.table.rowCount>=3){
    const t=api.deep.table, cand=[];
    for(let k=t.firstRow;k<=t.lastRow;k++){
      const ar=api.deep.rows[k]; if(!ar || ar.kind!=='table' || !ar.bbox) continue;
      const b=ar.bbox, cx=(b.x0+b.x1)/2, cy=(b.y0+b.y1)/2, yp=cy-C.slope*cx;
      if(yp<=topY || onTitle(yp)) continue;                           // only from the table's top, and never a title row
      const txt=(ar.cells||[]).map(c=>c.text).join(' '), yp0=b.y0-C.slope*cx, yp1=b.y1-C.slope*cx;
      // a row without a number is not an item — unless it is an item group name on a row of its own (RPL, RNL: one column, a name)
      const groupCand=!/\d/.test(txt) && fillOf(yp0,yp1)<=1 && isGroupName(txt);
      if(!/\d/.test(txt) && !groupCand) continue;
      cand.push({source:'api', ri:-1, apiRow:k, yp0, yp1, y0:b.y0, y1:b.y1, localRis:[], groupCand});
    }
    if(!itemFill && cand.length){ const f=cand.filter(r=>!r.groupCand).map(r=>fillOf(r.yp0,r.yp1)).sort((a,b)=>a-b); itemFill=f.length?f[f.length>>1]:0; }
    for(const r of cand) if(r.groupCand || fillOf(r.yp0,r.yp1)>=0.6*itemFill) rowList.push(r);
  }
  for(const lr of localRows){
    const yc=(lr.yp0+lr.yp1)/2;
    let host=null, bd=1/0;                                          // the API row whose centre is nearest among those holding this row's centre
    for(const r of rowList){ if(r.source!=='api') continue;
      const inside=yc>=r.yp0-1 && yc<=r.yp1+1, overlap=Math.min(r.yp1,lr.yp1)-Math.max(r.yp0,lr.yp0);
      if(!inside && overlap<=0.5*(lr.yp1-lr.yp0)) continue;
      const d=Math.abs(yc-(r.yp0+r.yp1)/2); if(d<bd){ bd=d; host=r; } }
    if(host){ host.localRis.push(lr.ri); continue; }
    rowList.push({source:'local', ri:lr.ri, yp0:lr.yp0, yp1:lr.yp1, y0:lr.y0, y1:lr.y1, localRis:[lr.ri]});
  }
  rowList.sort((a,b)=>a.yp0-b.yp0);
  const rowCellTexts=r=>{ const t=cols.map(()=>[]); for(const w of wordsIn(r.yp0,r.yp1)){ const ci=colOf(w.xp); if(ci>=0) t[ci].push(w.text); }
    for(const ri of r.localRis) cols.forEach((c,ci)=>{ const s=localText(ri,ci); if(s) t[ci].push(s); }); return t.map(a=>norm(a.join(' '))); };
  // two rows that each carry a serial number in the first column are two items, whatever their bands or the rules say
  const serialOf=r=>/^\d{1,4}$/.test((rowCellTexts(r)[0]||'').trim()); const twoItems=(a,b)=>serialOf(a) && serialOf(b);
  // one line read twice (a SubTotal line as a PaddleOCR row and again as a local row it did not host) is one row
  { const m=mergeOverlappingRows(rowList, 0.6, twoItems); if(m.merged){ rowList.length=0; rowList.push(...m.rows); out.note=(out.note?out.note+' · ':'')+m.merged+' row'+(m.merged>1?'s':'')+' read twice folded'; } }
  /* ---- ruled rows (ruledrows.js): with a rule under every row (a full
     grid, or a row-ruled table), the rows lie between the rules — an item
     whose name wraps to a second line is one band, and the two text lines
     (or the two PaddleOCR rows) it was read as are folded into one row,
     whose cells read both lines in reading order. A band taller than three
     lines is not trusted, so a sparse rule folds nothing. */
  { const L=S.borders&&S.borders.layout;
    if(L && L.rowsY && L.rowsY.length>=3 && (L.rowRuled || L.kind==='full-grid')){
      const m=mergeRowsByRules(rowList, ruleLinesY(L.rowsY, C.slope), 3.2, twoItems);
      if(m.merged){ rowList.length=0; rowList.push(...m.rows); out.note=(out.note?out.note+' · ':'')+m.merged+' wrapped line'+(m.merged>1?'s':'')+' folded into the ruled row above'; } } }
  const rowFill=r=>{ const hit=new Set(); for(const w of wordsIn(r.yp0,r.yp1)){ const ci=colOf(w.xp); if(ci>=0) hit.add(ci); }
    for(const ri of r.localRis) cols.forEach((c,ci)=>{ if(localText(ri,ci)) hit.add(ci); }); return hit.size; };
  // leading / trailing rows that fill hardly any column (a section title
  // under the header, a reference number under the table) are not items —
  // except an item group name at the top (RPL over the first group's rows)
  const groupLike=r=>rowFill(r)<=Math.max(3,0.5*itemFill) && !!groupNameOf(rowCellTexts(r));
  while(rowList.length && rowFill(rowList[rowList.length-1])<0.4*itemFill) rowList.pop();
  const totalLike=r=>{ const t=rowCellTexts(r).join(' '); return TOTAL_RE.test(t) && /\d/.test(t); };   // a SubTotal at the top of the page: the group of the page before ends here
  while(rowList.length>1 && rowFill(rowList[0])<0.4*itemFill && !groupLike(rowList[0]) && !totalLike(rowList[0])) rowList.shift();

  // curled rows overlap in y: a word inside two rows' extents goes to
  // the row whose centre is nearest
  const rowOf=yp=>{ let best=-1,bd=1/0; rowList.forEach((r,i)=>{ if(yp<r.yp0-1||yp>r.yp1+1) return; const d=Math.abs(yp-(r.yp0+r.yp1)/2); if(d<bd){ bd=d; best=i; } }); return best; };
  const apiCell=rowList.map(()=>cols.map(()=>[]));
  for(const w of words){
    const ri=rowOf(w.yp); if(ri<0) continue;
    const ci=colOf(w.xp); if(ci<0) continue;
    apiCell[ri][ci].push(w);
  }
  /* the other engines' words into the same cells */
  const engCell={}; for(const eng of engines) if(eng.name!=='paddle' && eng.regions.length) engCell[eng.name]=rowList.map(()=>cols.map(()=>[]));
  for(const w of extraWords){
    if(!engCell[w.engine]) continue;
    const ri=rowOf(w.yp); if(ri<0) continue;
    const ci=colOf(w.xp); if(ci<0) continue;
    engCell[w.engine][ri][ci].push(w);
  }
  /* local confidence per cell: mean of the characters' confidences */
  const localConf=band.map(()=>cols.map(()=>({sum:0,n:0})));
  if(S.characters) for(const ch of S.characters.characters){ if(!ch.cell || !ch.text || ch.confidence===undefined) continue;
    const s=localConf[ch.cell.row]&&localConf[ch.cell.row][ch.cell.col]; if(s){ s.sum+=ch.confidence; s.n++; } }

  const grid=rowList.map((row,i)=>cols.map((c,ci)=>{
    const local=norm(row.localRis.map(ri=>localText(ri,ci)).filter(Boolean).join(' '));
    const rgs=readingOrder(apiCell[i][ci]);                                  // a two-line cell: line by line, left to right
    const apiText=norm(rgs.map(g=>g.text).join(' '));
    const apiConf=rgs.length?100*rgs.reduce((s,g)=>s+(g.confidence||0),0)/rgs.length:0;
    let lsum=0,ln=0; for(const ri of row.localRis){ const lc=localConf[ri][ci]; lsum+=lc.sum; ln+=lc.n; }
    const lConf=RC&&RC.fromPdf ? (local?100:0) : (ln?lsum/ln:0);          // a PDF page's own words: exact, at full confidence
    let bb=null; for(const ri of row.localRis){ const cell=C.cells[ri][ci]; if(cell){ bb=bb?{x0:Math.min(bb.x0,cell.bb.x0),y0:Math.min(bb.y0,cell.bb.y0),x1:Math.max(bb.x1,cell.bb.x1),y1:Math.max(bb.y1,cell.bb.y1)}:{...cell.bb}; } }
    const ym=(row.y0+row.y1)/2, ca=C.toImage(c.gutterX0,ym), cb=C.toImage(c.gutterX1,ym);
    const box={x0:Math.round(ca.x),y0:Math.round(row.y0),x1:Math.round(cb.x),y1:Math.round(row.y1)};   // the whole cell: row band × column span
    if(!bb) bb=box;
    const others=Object.keys(engCell).map(name=>{ const gs=readingOrder(engCell[name][i][ci]);
      return {name, text:norm(gs.map(g=>g.text).join(' ')), conf:gs.length?100*gs.reduce((s,g)=>s+(g.confidence||0),0)/gs.length:0}; }).filter(o=>o.text);
    return {local, api:apiText, others, localConf:lConf, apiConf, bb, box, text:'', source:'empty', apiY:rgs.length?rgs.reduce((s,g)=>s+g.yp,0)/rgs.length:null};
  }));

  /* ---- per-column statistics, then the choice --------------------------- */
  const numericCol=cols.map((c,ci)=>{ let n=0,t=0; for(const row of grid){ const g=row[ci]; for(const s of [g.local,g.api].concat((g.others||[]).map(o=>o.text))) if(s){ t++; if(numeric(s)) n++; } } return t>0 && n>=0.6*t; });
  const shapeFreq=cols.map((c,ci)=>{ const f=new Map(); for(const row of grid){ const g=row[ci]; for(const s of [g.local,g.api].concat((g.others||[]).map(o=>o.text))) if(s){ const sh=shape(s); f.set(sh,(f.get(sh)||0)+1); } } return f; });
  grid.forEach(row=>row.forEach((g,ci)=>{
    Object.assign(g, chooseCell(g,{apiPresent:!!api, numeric:numericCol[ci], shapeFreq:shapeFreq[ci]}));
  }));
  /* ---- the invoice header taken for items (headerrows.js) ----------------
     On a page without column titles the address block, the MIO, the mobile number, the delivery line reach the
     table as leading rows. They are told from items by their values not fitting the columns (letters where the
     columns hold numbers) and by their words being the words the other pages — and this one — printed above the
     table. This page's own header words go out with the table for the pages after it. */
  let headerRowsDropped=0;
  { const own=[]; for(const w of words.concat(extraWords)) if(w.yp<topY) own.push(w.text);
    for(let bi=0; bi<keepFrom && bi<band.length; bi++) cols.forEach((c,ci)=>{ const t=localText(bi,ci); if(t) own.push(t); });
    out.headerWords=[...headerVocabulary(own)];
    const vocab=headerVocabulary(own.concat(S.sharedHeaderWords||[]));
    const fills=grid.map(r=>r.filter(g=>g.text).length).filter(x=>x>0).sort((a,b)=>a-b); const fillMed=fills.length?fills[fills.length>>1]:0;
    const n=leadingHeaderRows(grid.map(r=>r.map(g=>g.text)), numericCol, vocab, {itemFill:fillMed,
      isGroup:t=>!!groupNameOf(t), isTotal:t=>TOTAL_RE.test(t.join(' ')) && /\d/.test(t.join(' '))});
    headerRowsDropped=n;
    if(n){ grid.splice(0,n); rowList.splice(0,n); out.note=(out.note?out.note+' · ':'')+n+' leading row'+(n>1?'s':'')+' of the invoice header dropped'; } }
  /* ---- repairs on the finished grid --------------------------------------
     · a row the local join still left in two halves (the right half a row
       of its own) shows as two neighbouring rows whose filled columns do
       not overlap and together make one item row: they are joined;
     · a row without any text at all (a dotted rule the text stage kept)
       goes. */
  const filled=row=>{ const f=new Set(); row.forEach((g,ci)=>{ if(g.text) f.add(ci); }); return f; };
  const itemH=(()=>{ const h=rowList.map(r=>r.yp1-r.yp0).filter(x=>x>0).sort((a,b)=>a-b); return h.length?h[h.length>>1]:0; })();
  const itemCols=(()=>{ const n=grid.map(r=>filled(r).size).filter(x=>x>0).sort((a,b)=>a-b); return n.length?n[n.length>>1]:cols.length; })();
  for(let i=0;i<grid.length-1;i++){
    const A=filled(grid[i]), B=filled(grid[i+1]);
    if(!A.size || !B.size || A.size>=itemCols || B.size>=itemCols) continue;
    if(groupNameOf(grid[i].map(g=>g.text), grid[i].map(g=>g.source))) continue;   // an item group name on a row of its own is never joined into an item
    if([...A].some(ci=>B.has(ci)) || A.size+B.size<0.6*itemCols) continue;
    grid[i+1].forEach((g,ci)=>{ if(!grid[i][ci].text) grid[i][ci]=g; });
    rowList[i].localRis=rowList[i].localRis.concat(rowList[i+1].localRis); if(rowList[i].source==='local' && rowList[i+1].source==='api') rowList[i].source='api';
    rowList[i].yp1=Math.max(rowList[i].yp1,rowList[i+1].yp1); rowList[i].y1=Math.max(rowList[i].y1,rowList[i+1].y1);
    grid.splice(i+1,1); rowList.splice(i+1,1); i--;
  }
  for(let i=grid.length-1;i>=0;i--) if(!filled(grid[i]).size){ grid.splice(i,1); rowList.splice(i,1); }
  // the column titles printed again at the head of a group inside the table are not items
  { const labels=cols.map(c=>c.label||''); let dropped=0;
    for(let i=grid.length-1;i>=0;i--) if(isTitleRow(grid[i].map(g=>g.text), labels.some(Boolean)?labels:null)){ grid.splice(i,1); rowList.splice(i,1); dropped++; }
    if(dropped) out.note=(out.note?out.note+' · ':'')+dropped+' repeated title row'+(dropped>1?'s':'')+' dropped'; }
  /* ---- the invoice closes at its summary (invoiceclose.js) ---------------
     The last page prints, under a section border, the invoice's own totals — Total Trade Price, Total VAT, Less
     Discount Amount, Net Invoice Amount; Grand Total, Less Discount, Total Payable; the amount in words — and other
     tables may follow (today's invoice summary, outstanding invoices). The first such line after an item closes the
     invoice: the items are what lies between the column titles and it; nothing after it is an item. */
  { const at=invoiceCloseAt(grid.map(r=>r.map(g=>g.text)));
    if(at>=0){ const gone=grid.length-at; const line=grid[at].map(g=>g.text).filter(Boolean).join(' ').slice(0,60);
      grid.splice(at); rowList.splice(at); out.invoiceClosed={line, rowsAfter:gone-1};
      out.note=(out.note?out.note+' · ':'')+'the invoice closes at "'+line+'": '+gone+' row'+(gone>1?'s':'')+' from there dropped'; } }
  // a group name read into a total row ("MSD Product" under the SubTotal box, in one region with it): the leading
  // cells become a group row of their own — under the total when their words sit lower, above it otherwise
  { const emptyCell=(g)=>({local:'', api:'', others:[], localConf:0, apiConf:0, bb:g.box, box:g.box, text:'', source:'empty'});
    let split=0;
    for(let i=0;i<grid.length;i++){
      const g=groupInsideTotal(grid[i].map(x=>x.text), grid[i].map(x=>x.source)); if(!g) continue;
      const row=grid[i], r=rowList[i];
      const yOf=cis=>{ const ys=cis.map(ci=>row[ci].apiY).filter(y=>y!==null && y!==undefined); return ys.length?ys.reduce((a,b)=>a+b,0)/ys.length:null; };
      const tot=row.map((x,ci)=>ci).filter(ci=>!g.cells.includes(ci) && row[ci].text);
      const yg=yOf(g.cells), yt=yOf(tot); const below=yg===null||yt===null ? true : yg>yt;
      const groupRow=row.map((x,ci)=>g.cells.includes(ci)?x:emptyCell(x));
      for(const ci of g.cells) row[ci]=emptyCell(row[ci]);
      const mid=(r.yp0+r.yp1)/2, ymid=(r.y0+r.y1)/2, tall=(r.yp1-r.yp0)>1.5*Math.max(1,itemH);
      const gr={...r, localRis:r.localRis.slice(), source:'local'}; delete gr.apiRow; delete gr.groupCand;
      if(tall){ if(below){ gr.yp0=mid; gr.y0=ymid; r.yp1=mid; r.y1=ymid; } else { gr.yp1=mid; gr.y1=ymid; r.yp0=mid; r.y0=ymid; } }
      const at=below?i+1:i; grid.splice(at,0,groupRow); rowList.splice(at,0,gr); if(below) i++; split++;
    }
    if(split) out.note=(out.note?out.note+' · ':'')+split+' group name'+(split>1?'s':'')+' split out of a total row'; }
  markGroups(grid, rowList, out);

  /* ---- column names: recheck -------------------------------------------
     A column the rule did not key and whose title the API words missed (a
     narrow Qty column whose word landed in the gutter, a two-line title) is
     named here from every title source at once: the label found above, the
     local title text, every engine's words in the title rows and the API
     table's own title row mapped onto our columns. A title token that is a
     quantity word (qty, qnt, qnty, quantity, quan …, one letter off allowed)
     keys the column qty; any other title is matched against the rules'
     label vocabulary. Quantity is insisted on — every invoice has one — so
     when no title names it, the column of small whole numbers that is not
     a serial, a code or a bonus column (mostly zeros) is taken as Qty. */
  const titleCands=cols.map((c,ci)=>{ const s=new Set();
    if(headerLabels[ci]) s.add(headerLabels[ci]);
    for(const bi of titleRows){ const t=localText(bi,ci); if(t) s.add(t);
      const r=band[bi]; for(const w of words.concat(extraWords)) if(w.yp>=r.row.dy.y0-1 && w.yp<=r.row.dy.y1+1 && colOf(w.xp)===ci) s.add(w.text); }
    if(api && api.deep && api.deep.table){ const t=api.deep.table, r0=api.deep.rows[t.firstRow];
      if(r0 && r0.cells && !/\d/.test(r0.text||'')) for(const cell of r0.cells){ if(!cell.bbox || !cell.text) continue;
        const cx=(cell.bbox.x0+cell.bbox.x1)/2, cy=(cell.bbox.y0+cell.bbox.y1)/2; if(colOf(C.toDeskewedX(cx,cy))===ci) s.add(cell.text); } }
    return [...s]; });
  const named=resolveColumnKeys({keys:cols.map(c=>c.key||null), labels:headerLabels, titleCands, columnValues:cols.map((c,ci)=>grid.map(r=>r[ci].text)), locked:cols.map(c=>!!c.manual)});
  out.keys=named.keys.map((k,i)=>k||('c'+(i+1))); out.header.labels=named.labels;
  out.columnsMode=C.headerRule?C.headerRule.mode:null;               // how the columns stage named the columns (shown in the FINAL badge)
  /* the pack size is sometimes printed at the end of the name instead of in
     its own column: a pack cell that is blank, or reads like nothing a pack
     size looks like (a stray mark, one character), takes the pack the name
     ends with — the name keeps it, the matcher strips it on its own */
  { const pi=packColumnIndex(out.keys, grid), ni=out.keys.indexOf('name');
    if(pi>=0){ const counts={}; grid.forEach((row,ri)=>{ const pc=row[pi]; if(!pc) return; const nameText=ni>=0&&row[ni]?row[ni].text||'':'';
        // the engines' readings of the cell by the shape of a pack size, then the name, then a repaired count
        const r=resolvePackCell(pc, nameText); if(!r || r.text===pc.text) return;
        pc.packWas=pc.text; pc.text=r.text; pc.source=r.source==='name'?'name':r.source==='repair'?'manual':r.source; pc.packFrom=r.source;
        if(r.source==='name') pc.packFromName=true; counts[r.source]=(counts[r.source]||0)+1; });
      // the column as a whole: an 8 or a 5 at the end of a pack where the other cells end with an S is that S
      for(const rp of repairPacksByColumn(grid.map(row=>row[pi]?row[pi].text:''))){ const pc=grid[rp.index][pi];
        if(pc.packWas===undefined) pc.packWas=pc.text; pc.text=rp.text; pc.source='manual'; pc.packFrom='column';
        pc.packNote='the S read as a digit: the other pack cells of the column end with an S'; counts.column=(counts.column||0)+1; }
      const parts=Object.entries(counts).map(([k,v])=>v+' '+(k==='name'?'from the name':k==='repair'?'repaired (308 → 30S)':k==='column'?'with the S the column ends with (5X98 → 5X9\'S)':'from '+k));
      if(parts.length) out.note=(out.note?out.note+' · ':'')+'pack sizes: '+parts.join(', '); } }
  if(named.renamed.length) out.note=(out.note?out.note+' · ':'')+'columns named on recheck: '+named.renamed.map(r=>(r.column+1)+'→'+r.key+' by '+r.by).join(', ');
  if(!named.keys.includes('qty')) out.note=(out.note?out.note+' · ':'')+'no quantity column found';

  out.grid=grid; out.rows=rowList; out.stats=count(grid,rowList);
  out.stats.titleRows=titleRows.length; out.stats.droppedTop=keepFrom; out.stats.keptAbove=top.above||0; out.stats.headerRowsDropped=headerRowsDropped;
  // the arithmetic check of the number columns (numcheck) on the finished grid:
  // roles, relations, per-row rule results, filled / fixed cells — drawn by
  // the NUMBERS stages and written into the JSON
  /* the number check waits for the API answer: run on the local reading
     alone it would judge cells the answer is about to replace; the NUMBERS
     stages show "waiting" until the final table is rebuilt with both sides */
  if(S.api && S.api.status==='pending'){ out.numbers=null; out.numbersPending=true; }
  else try{ out.numbers=analyseNumbers(tableForNumbers(out)); }catch(e){ out.numbers={error:String(e&&e.message||e), roles:{}, model:{relations:[]}, rows:[], summary:{}}; }
  return out;
}

/* the final table in the shape analyseNumbers reads: header keys and labels,
   per row the cell texts, every engine's reading and the confidence of the
   chosen text (the OCR vote's: the API's or the local one, whichever won) */
/* ---- item groups ---------------------------------------------------------
   A row holding one text and no number that spans the table (RPL, RNL,
   JBL: a manufacturer or a category) is an item group name (group.js): the
   row stays where it is, marked kind "group", and every item row below it
   carries the group's name down to the next group row. The number check,
   the product match and the tables read the mark. */
function markGroups(grid, rows, out){
  const groups=groupRowsOf(grid.map(r=>r.map(g=>g.text)), grid.map(r=>r.map(g=>g.source)));
  const byIdx=new Map(groups.map(g=>[g.index,g.name])); let cur=null;
  rows.forEach((r,i)=>{ if(byIdx.has(i)){ r.kind='group'; r.groupName=byIdx.get(i); cur=r.groupName; } else { if(r.kind==='group'){ delete r.kind; delete r.groupName; } if(cur) r.group=cur; else delete r.group; } });
  if(groups.length) out.note=(out.note?out.note+' · ':'')+groups.length+' item group'+(groups.length>1?'s':'')+': '+groups.map(g=>g.name).join(', ');
  return groups;
}
export function isGroupRow(F, ri){ const r=F&&F.rows&&F.rows[ri]; return !!(r && r.kind==='group'); }

export function tableForNumbers(F){
  if(!F || !F.grid) return {header:{keys:[],labels:[]}, rows:[]};
  const C=S.columns, keys=F.keys||(C&&C.columns||[]).map((c,i)=>c.key||('c'+(i+1)));
  const labels=F.header?F.header.labels:keys;
  // the relations the header rule writes for its columns ({qty}*{unittp} …), for the columns the table has
  const rule=C&&C.headerRule&&C.headerRule.id ? HEADER_RULES.find(r=>r.id===C.headerRule.id) : null;
  const relations=rule ? rule.columns.filter(c=>c.relation && keys.includes(c.key)).map(c=>({key:c.key, formula:c.relation, source:'rule'})) : [];
  // the column catalogue's relations for the other keys (a column named by hand follows its type's rule)
  for(const cr of catalogueRelations(keys)) if(!relations.some(r=>r.key===cr.key)) relations.push(cr);
  return {header:{labels, keys}, relations,
    rows:F.grid.map((row,ri)=>{ const o={row:ri+1, cells:{}, readings:{}, confidence:{}, locked:{}};
      if(isGroupRow(F,ri)) o.isGroup=true;                                            // an item group name: not a row to check
      row.forEach((g,ci)=>{ const k=keys[ci]; o.cells[k]=g.text; if(g.edited) o.locked[k]=true;   // typed by hand: the check never changes it
        const r={paddle:g.api||''}; for(const x of g.others||[]) r[x.name]=x.text; r.local=g.local||''; o.readings[k]=r;
        if(g.text) o.confidence[k]=g.source==='local'||g.source==='local-only'?(g.localConf||0):g.source==='api'?(g.apiConf||0):Math.max(g.apiConf||0,g.localConf||0); });
      return o; })};
}

/* The final table as plain data: the engines that took part, header
   labels and keys, one object per row (cell texts by key, the source of
   every cell — "vote:paddle+tesseract5", "agreed", "api", "local", … —
   and every engine's reading of the cell), the statistics. */
export function finalTableJson(F){
  if(!F || !F.grid) return {table:false, note:F?F.note:'no run'};
  const C=S.columns, keys=F.keys||(C&&C.columns||[]).map((c,i)=>c.key||('c'+(i+1)));   // F.keys: the names after the recheck (Qty insisted on)
  const labels=F.header?F.header.labels:keys;
  const json={
    table:true, rule:F.header?F.header.rule:null, note:F.note||'',
    engines:(F.engines||[]).concat([{name:'local', label:'Tesseract.js (browser)', status:S.recognition&&S.recognition.available?'ok':'off'}]),
    header:{labels, keys},
    rows:F.grid.map((row,ri)=>{ const o={row:ri+1, source:F.rows?F.rows[ri].source:F.source, cells:{}, sources:{}, readings:{}};
      { const fr=F.rows&&F.rows[ri]; if(fr&&fr.kind==='group'){ o.kind='group'; o.group=fr.groupName; } else if(fr&&fr.group) o.group=fr.group; }
      row.forEach((g,ci)=>{ o.cells[keys[ci]]=g.text; o.sources[keys[ci]]=g.source+(g.votes?':'+g.votes.join('+'):'');
        const r={paddle:g.api||''}; for(const x of g.others||[]) r[x.name]=x.text; r.local=g.local||''; o.readings[keys[ci]]=r;
        if(g.packWas!==undefined){ o.pack={asRead:g.packWas, from:g.packFrom||g.source}; if(g.packNote) o.pack.note=g.packNote; } }); return o; }),
    stats:F.stats
  };
  if(F.edits && F.edits.length) json.edits=F.edits;                   // cells typed by hand in the editable table (stage 38)
  // the unit conversion per row: the invoice's column of that meaning, the operator's entry, or the pack size rule (4X10'S → 40)
  try{ json.rows.forEach((row,ri)=>{ const c=rowConversion(F,ri); row.unitConversion=c.value; row.unitConversionFrom=c.source; }); }catch(e){}
  /* The table AFTER the number check's repair (stage NM · Repair): a cell the
     rules filled or fixed carries its corrected text in `cells`, with the text
     as read kept in `asRead`; `check` gives every number cell's status
     (verified, filled, fixed, conflict, unverified, unchecked, blank) with the
     note of a repair; `rules` the row rules after the repair (ids that pass /
     fail); `numberCheck` the roles, the relations in force and the summary. */
  if(F.numbersPending){ json.numberCheck={pending:true, note:'waiting for the OCR API answer — the check and the repair run once it is in'}; return json; }
  try{
    const nc=F.numbers && F.numbers.rows ? F.numbers : analyseNumbers(tableForNumbers(F));
    json.numberCheck={roles:nc.roles, model:nc.model, summary:nc.summary, note:nc.note, repaired:true};
    json.rows.forEach((row,ri)=>{ const r=nc.rows[ri]; if(!r) return;
      row.isTotal=r.isTotal; if(r.isGroup) row.isGroup=true; row.check={}; row.asRead={};
      for(const k in r.cells){ const c=r.cells[k]; if(!nc.roles[k]) continue; row.check[k]=c.status+(c.note?' — '+c.note:'');
        if((c.status==='fixed'||c.status==='filled') && c.fixedText!==undefined){ row.asRead[k]=row.cells[k]; row.cells[k]=c.fixedText; } }
      if(!Object.keys(row.asRead).length) delete row.asRead;
      const after=(r.rules&&r.rules.after)||[];
      row.rules={pass:after.filter(x=>x.status==='pass').map(x=>x.id), fail:after.filter(x=>x.status==='fail').map(x=>x.id)}; });
  }catch(e){ json.numberCheck={error:String(e&&e.message||e)}; }
  /* The product match (stage PR · Product Match), when it has answered: per
     row the product the item was matched to (status match / uncertain /
     none / total, the score, id, code, name, strength, category, MRP =
     UnitSalePrice, the purchase and trade prices) and the comparison of the
     invoice TP with the purchase price on file; `products` sums it up. */
  try{
    const P=S.products;
    if(P && P.status==='done' && P.results){
      const counts={match:0, uncertain:0, none:0, priceDiff:0};
      json.rows.forEach((row,ri)=>{ const r=P.results[ri]; if(!r) return;
        const st=r.status; if(st in counts) counts[st]++;
        const o={status:st, score:r.score||0}; if(r.manual) o.manual=true;   // picked by hand in the editable table's product popup
        if(r.retry) o.retry=r.retry;                                          // matched on a retry from another engine's reading, or the readings' disagreement
        if(r.product){ const p=r.product; Object.assign(o,{id:p.id, code:p.code, name:p.name, strength:p.strength, category:p.category, manufacturer:p.manufacturer, mrp:p.mrp, purchasePrice:p.purchasePrice, tradePrice:p.tradePrice, unitConversion:p.unitConversion}); }
        if(r.price){ o.price={invoiceTp:r.price.invoiceTp, onFile:r.price.nearest, expected:r.price.expected, unitConversion:r.price.unitConversion, relDiff:r.price.relDiff, differs:r.price.differs}; if(r.price.differs) counts.priceDiff++; }
        // the pack's MRP (UnitSalePrice × the row's conversion) and the profit on the invoice's unit TP
        if(r.product && r.product.mrp!=null){ try{ const conv=rowConversion(F,ri).value||1; o.mrpPack=Math.round(+r.product.mrp*conv*100)/100; const tp=r.price?r.price.invoiceTp:null; if(tp>0) o.profitPct=Math.round((o.mrpPack-tp)/tp*1000)/10; }catch(e){} }
        row.product=o; });
      json.products={engine:P.engine, matchMs:P.matchMs, ms:Math.round(P.ms), ...counts};
    } else if(P) json.products={status:P.status, error:P.error||undefined};
  }catch(e){ json.products={error:String(e&&e.message||e)}; }
  return json;
}

/* One cell from all its readings. cands: PaddleOCR (api), the API's other
   engines (others) and the local one, each with a confidence 0–100.
     · a text at least two ENGINE FAMILIES agree on (same letters and
       digits; spaces and punctuation aside) wins — Tesseract 5 on the
       server and Tesseract.js in the browser are the same engine and
       share their mistakes, so together they are one voice, not two;
       the group with the most families, then the one holding PaddleOCR,
       then the more confident; it is spelled the way the engine highest
       in ENGINE_ORDER spelled it, in a numeric column the way that gives
       one clean number;
     · in a numeric column a reading that is not one clean number ("~187",
       "7 1") does not vote while a clean one exists — a pen tick read as
       a character is not a second opinion on the digits;
     · otherwise the pairwise rule between the local reading and the
       PaddleOCR one (chooseText) — with the most confident other engine
       standing in when PaddleOCR read nothing there.                   */
const ENGINE_ORDER=['paddle','easyocr','tesseract5','local'];
const FAMILY={paddle:'paddle', easyocr:'easyocr', tesseract5:'tesseract', local:'tesseract'};
export function chooseCell(g,ctx){
  const r=chooseCellRaw(g,ctx);
  // a text cell gets its word gaps back: from another reading of the cell that kept them, else from the words themselves (js/final/respace.js)
  if(!ctx.numeric && r.text){ const donors=[g.api].concat((g.others||[]).map(o=>o.text), [g.local]).filter(Boolean); const t=respace(r.text, donors); if(t!==r.text){ r.text=t; r.respaced=true; } }
  return r;
}
function chooseCellRaw(g,ctx){
  const cands=[];
  if(g.api) cands.push({name:'paddle', text:g.api, conf:g.apiConf||0});
  for(const o of g.others||[]) if(o.text) cands.push({name:o.name, text:o.text, conf:o.conf||0});
  if(g.local) cands.push({name:'local', text:g.local, conf:g.localConf||0});
  if(!cands.length) return {text:'', source:'empty', votes:null};
  const voters=ctx.numeric && cands.some(c=>tidy(c.text)) ? cands.filter(c=>tidy(c.text)) : cands;
  const groups=new Map();
  for(const c of voters){ const k=key(c.text); if(!k) continue; if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(c); }
  const sum=arr=>arr.reduce((s,c)=>s+c.conf,0), hasPaddle=arr=>arr.some(c=>c.name==='paddle')?1:0;
  const families=arr=>new Set(arr.map(c=>FAMILY[c.name]||c.name)).size;
  const ranked=[...groups.values()].sort((a,b)=>families(b)-families(a) || b.length-a.length || hasPaddle(b)-hasPaddle(a) || sum(b)-sum(a));
  if(ranked.length && families(ranked[0])>=2){
    const grp=ranked[0].slice().sort((a,b)=>ENGINE_ORDER.indexOf(a.name)-ENGINE_ORDER.indexOf(b.name));
    let pick=grp[0];
    if(ctx.numeric && !tidy(pick.text)){ const t=grp.find(c=>tidy(c.text)); if(t) pick=t; }
    const names=grp.map(c=>c.name);
    return {text:pick.text, source:names.includes('paddle')&&names.includes('local')?'agreed':'vote', votes:names};
  }
  const eng=voters.find(c=>c.name==='paddle') || voters.filter(c=>c.name!=='local').sort((a,b)=>b.conf-a.conf)[0] || cands.find(c=>c.name==='paddle') || cands.filter(c=>c.name!=='local').sort((a,b)=>b.conf-a.conf)[0] || null;
  const r=chooseText(g.local, eng?eng.text:'', g.localConf||0, eng?eng.conf:0, ctx);
  if(r.source==='api' && eng && eng.name!=='paddle') r.source=eng.name;
  r.votes=null;
  return r;
}

/* One cell's text, API first:
     · the API text when it has one and the local reading agrees or the
       API is confident (≥ API_STRONG);
     · the local reading when the API has none — in a numeric column only
       a well-formed number (a pen tick makes Tesseract read "7 1", "17°");
     · when the API is unsure, the local reading if it is clearly more
       confident (by API_WEAK_MARGIN) and at least as plausible: in a
       numeric column well-formed when the API's is, elsewhere a shape at
       least as common in the column; otherwise the API still.          */
const API_STRONG=85, API_WEAK_MARGIN=10;
const tidy=t=>/^[-+]?\d[\d,]*(\.\d+)?%?$/.test(norm(t));   // one clean number, no inner spaces ("7 1" is a tick plus a digit)
export function chooseText(L,A2,localConf,apiConf,ctx){
  if(!L && !A2) return {text:'', source:'empty'};
  if(!A2){
    if(ctx.numeric && !tidy(L)) return {text:'', source:'empty', rejectedLocal:L};
    return {text:L, source:ctx.apiPresent?'local':'local-only'};
  }
  if(!L) return {text:A2, source:'api'};
  if(key(L)===key(A2)){                                            // same reading: in a numeric column the clean spelling ("337.20" over "337..20")
    if(ctx.numeric && tidy(L)!==tidy(A2)) return {text:tidy(L)?L:A2, source:'agreed'};
    return {text:A2.length>=L.length?A2:L, source:'agreed'}; }
  if(apiConf>=API_STRONG) return {text:A2, source:'api'};
  const plausible = ctx.numeric ? (tidy(L) || !tidy(A2))
                                : ((ctx.shapeFreq.get(shape(L))||0) >= (ctx.shapeFreq.get(shape(A2))||0));
  if(plausible && localConf>apiConf+API_WEAK_MARGIN) return {text:L, source:'local'};
  return {text:A2, source:'api'};
}

function count(grid,rows){
  const st={cells:0, empty:0, agreed:0, vote:0, local:0, api:0, easyocr:0, tesseract5:0, localOnly:0, both:0, localRows:0, apiRows:0};
  for(const row of grid) for(const g of row){ st.cells++;
    if(g.source==='empty') st.empty++; else if(g.source==='agreed') st.agreed++; else if(g.source==='vote') st.vote++; else if(g.source==='api') st.api++;
    else if(g.source==='easyocr'||g.source==='tesseract5') st[g.source]++; else if(g.source==='local-only') st.localOnly++; else st.local++;
    if(g.local && g.api) st.both++; }
  for(const r of rows||[]) if(r.source==='api') st.apiRows++; else st.localRows++;
  st.agreement=st.both?st.agreed/st.both:0;
  return st;
}
