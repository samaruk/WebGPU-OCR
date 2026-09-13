/* ======================================================================
   EDITABLE TABLE  ·  the fixed final table as an HTML table (stage 38)
   Why: the canvas stages show the table over the page; the operator also
   wants the result as a plain table to read and correct. This panel sits
   over the viewport while its stage is selected and shows the final table
   AFTER the number check's repair, one input per number cell and per pack
   cell. An edit writes the cell back into the final table (source
   "manual"), runs the number check again under the rules in force,
   matches the products again and redraws the stages, so the colours and
   the JSON follow the correction at once.
   Once the product match is in, the item name column shows the MATCHED
   PRODUCT's name in place of the invoice's reading, which stays in the
   tooltip; a row with no match reads "no match"; clicking the cell opens
   the product popup. Every number stays the INVOICE's: the pack size
   column shows the invoice's units per pack (1X30s → 30, 5x4's → 20,
   100ml → 1, by the pack rule) as an input whose typed value is the row's
   conversion, the unit conversion column (the invoice's own, or the one
   the table adds from the pack size) likewise, and the MRP, the profit and
   the price check follow them.
   Colours are the final table's: text by source (white agreed, yellow
   vote, orange PaddleOCR, violet EasyOCR, pink Tesseract 5, green local,
   cyan typed by hand); a number cell's underline by its check (cyan filled,
   magenta fixed, red conflict); a total row blue.
   ====================================================================== */
import { S } from '../state/state.js';
import { STAGES } from '../config/config.js';
import { viewport } from '../dom/dom.js';
import { analyseNumbers } from '../numcheck/numcheck.js';
import { tableForNumbers } from '../final/final.js';
import { columnType } from '../config/columntypes.js';
import { updateFinalJson } from '../ui/ui.js';
import { startProducts } from '../pipeline/pipeline.js';
import { searchProducts, manualMatch } from '../products/products.js';
import { rowConversion, rowPackMrp, profitRange, profitColor } from '../products/mrp.js';
import { packColumnIndex } from '../final/pack.js';
import { refreshStages } from '../gallery/gallery.js';

const SRC={agreed:'#f0f5f5', vote:'#ffe182', local:'#54dd7e', api:'#ffaa46', easyocr:'#c896ff', tesseract5:'#ff82be', 'local-only':'#6ec8ff', manual:'#6edcff', name:'#7fd0ff', empty:'#96a5aa'};
const CHECK={filled:'#6ec8ff', fixed:'#ff78e6', conflict:'#ff5a5a', verified:'#54dd7e'};
const KIND='final-edit';

const panel=document.createElement('div');
panel.id='editTable';
panel.style.cssText='position:absolute;inset:0;display:none;overflow:auto;background:#0a0e0f;color:#e6f0eb;font:12px "JetBrains Mono",monospace;padding:10px 12px;z-index:5;';
viewport.appendChild(panel);

const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* a product of the list as shown in the table: Product, Strength and Category, space-separated ("BINOCLAR 500 MG Tab") */
const productLabel=p=>[p.name,p.strength,p.category].map(v=>String(v??'').trim()).filter(Boolean).join(' ');
/* the row's number as shown: the rows above it that are not item groups, plus one; '' on a group row, which takes no number */
function itemNumber(F,ri){ const rows=F.rows||[]; if(rows[ri]&&rows[ri].kind==='group') return ''; let n=0; for(let i=0;i<=ri;i++) if(!(rows[i]&&rows[i].kind==='group')) n++; return n; }

/* is the column one the operator may edit: a number column (by its role, its key's type, or its values) or the pack size */
function editable(F,ci,key){
  if(key==='pack') return true;
  const roles=(F.numbers&&F.numbers.roles)||{}; if(roles[key]) return true;
  const t=columnType(key); if(t && t.numeric) return true;
  const vals=F.grid.map(r=>(r[ci]&&r[ci].text)||'').filter(Boolean); if(!vals.length) return false;
  return vals.filter(v=>/^[\d.,]+%?$/.test(v.trim())).length>=0.6*vals.length;
}

/* a row's band of the RECTIFIED page — the table's full width, the row's own
   height — drawn at a small height for the table: the print the numbers
   were read from, right above the numbers */
/* The table is laid out AT THE PAGE'S OWN PROPORTIONS: every column as wide
   as its column on the page, the text as tall as the print, both at one
   scale — the page's table width fitted to the panel, times the zoom the
   operator picks — so the crop of a row above and the reading below line up
   column for column. */
let zoom=1;                                            // the operator's zoom (0.5 … 2.5)
const colWidths={};                                    // widths the operator dragged, per column key (screen px at zoom 1)
const LABEL_W=56;                                      // the "#" / "page N" column
function cropRow(src, tx0, tx1, y0, y1, scale){
  const pad=3, cx0=Math.max(0,Math.floor(tx0)), cx1=Math.min(src.width,Math.ceil(tx1)), cy0=Math.max(0,Math.floor(y0-pad)), cy1=Math.min(src.height,Math.ceil(y1+pad));
  const w=cx1-cx0, h=cy1-cy0; if(w<2||h<2) return null;
  const dpr=Math.min(3,window.devicePixelRatio||1), sc=scale*dpr;
  const cv=document.createElement('canvas'); cv.width=Math.max(1,Math.round(w*sc)); cv.height=Math.max(1,Math.round(h*sc));
  const ctx=cv.getContext('2d'); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high'; ctx.drawImage(src,cx0,cy0,w,h,0,0,cv.width,cv.height);
  return {url:cv.toDataURL('image/jpeg',0.85), cssW:Math.round(w*scale), cssH:Math.round(h*scale)};
}
/* the columns' x-ranges on the page: the header cells when the table has them, else each column's cell boxes with the gaps split midway */
function columnRanges(F, n){
  let r;
  if(F.header && F.header.cells && F.header.cells.filter(Boolean).length===n) r=F.header.cells.map(b=>[b.x0,b.x1]);
  else {
    r=[]; for(let ci=0;ci<n;ci++){ const bs=F.grid.map(row=>row[ci]&&(row[ci].box||row[ci].bb)).filter(Boolean); r.push(bs.length?[Math.min(...bs.map(b=>b.x0)),Math.max(...bs.map(b=>b.x1))]:null); }
    for(let ci=0;ci<n;ci++) if(!r[ci]){ const L=r.slice(0,ci).reverse().find(Boolean), Rn=r.slice(ci+1).find(Boolean); r[ci]=[L?L[1]:(Rn?Rn[0]-40:0), Rn?Rn[0]:(L?L[1]+40:40)]; }
  }
  // every column runs from the middle of the gap on its left to the middle of the gap on its right: the gaps
  // belong half to each neighbour, so a title or a number that leans into a gap is not cut off in the crop;
  // the first and the last column take half of their outer gap too, as wide as the inner ones
  const gaps=[]; for(let ci=0;ci<n-1;ci++) gaps.push(Math.max(0,r[ci+1][0]-r[ci][1]));
  const typical=gaps.length?gaps.slice().sort((a,b)=>a-b)[gaps.length>>1]:0;
  for(let ci=0;ci<n-1;ci++){ const mid=(r[ci][1]+r[ci+1][0])/2; r[ci][1]=mid; r[ci+1][0]=mid; }
  r[0][0]=Math.max(0, r[0][0]-typical/2); r[n-1][1]=r[n-1][1]+typical/2;
  return r;
}

/* the row's pack MRP (typed, else UnitSalePrice × units per pack — mrp.js) and its profit on the invoice's unit TP */
function priceHelpers(F,keys,N,P){
  const tpKey=keys.find(k=>((N&&N.roles)||{})[k]==='unitTp')||(keys.includes('tp')?'tp':null);
  const rowTp=ri=>{ if(!tpKey) return null; const c=N&&N.rows&&N.rows[ri]&&N.rows[ri].cells?N.rows[ri].cells[tpKey]:null; if(c && c.value!==null && c.value!==undefined) return c.value; const v=parseFloat(String((F.grid[ri][keys.indexOf(tpKey)]||{}).text||'').replace(/,/g,'')); return isFinite(v)?v:null; };
  const packMrp=(r,ri)=>rowPackMrp(F,P,ri).value;
  const profitPct=(r,ri)=>{ const m=packMrp(r,ri), tp=rowTp(ri); if(m===null || tp===null || !(tp>0)) return null; return (m-tp)/tp*100; };
  return {tpKey, rowTp, packMrp, profitPct};
}

function build(){
  const F=S.final;
  if(!F || !F.grid){ panel.innerHTML='<div style="color:#8fa39a;padding:20px">'+esc(F&&F.waitingApi?'waiting for the OCR API answer — the table is built from both readings once it is in':'no final table yet — run the pipeline')+'</div>'; return; }
  const keys=F.keys||(S.columns&&S.columns.columns||[]).map((c,i)=>c.key||('c'+(i+1)));
  const labels=(F.header&&F.header.labels)||keys;
  const N=F.numbers, P=S.products;
  const prodDone=P && P.status==='done' && P.results;
  let h='<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:8px;color:#8fa39a">'
    +'<b style="color:#e6f0eb">FINAL · editable table</b><span>'+F.grid.length+' rows × '+keys.length+' columns · values after the number check\'s repair · columns and text at the page\'s proportions, the row\'s band of the page above each row · number cells are inputs · the name shows the matched product (click to pick another) · pack size and unit conversion are the invoice\'s units per pack, typed over to correct them</span>'
    +'<label style="margin-left:auto;white-space:nowrap">zoom <input id="etZoom" type="range" min="50" max="250" step="10" value="'+Math.round(zoom*100)+'" style="vertical-align:middle;width:120px"> <span id="etZoomV">'+Math.round(zoom*100)+'%</span></label>'
    +'<button id="etReset" title="drag a column\'s right edge to resize it; double-click the edge to reset that column" style="font:inherit;font-size:11px;padding:2px 8px;background:transparent;color:#8fa39a;border:1px solid #2a3a3a;border-radius:3px;cursor:pointer">reset widths</button></div>';
  h+='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px;font-size:11px">'
    +[['agreed',SRC.agreed],['vote',SRC.vote],['PaddleOCR',SRC.api],['EasyOCR',SRC.easyocr],['Tesseract 5',SRC.tesseract5],['local',SRC.local],['typed',SRC.manual],['pack from the name',SRC.name]].map(([n,c])=>'<span><i style="display:inline-block;width:10px;height:10px;background:'+c+';margin-right:4px;vertical-align:-1px"></i>'+n+'</span>').join('')
    +'<span style="margin-left:8px">underline:</span>'+[['filled',CHECK.filled],['fixed',CHECK.fixed],['conflict',CHECK.conflict]].map(([n,c])=>'<span><i style="display:inline-block;width:14px;height:3px;background:'+c+';margin-right:4px;vertical-align:2px"></i>'+n+'</span>').join('')+'</div>';
  // the source of the crops and the table's x-range on the page (every cell box, header included)
  const src=S.workCanvas||S.origCanvas||null;
  const boxes=F.grid.flatMap(r=>r.map(g=>g.box||g.bb)).concat(F.header&&F.header.cells?F.header.cells:[]).filter(Boolean);
  const ranges=columnRanges(F, keys.length);
  const tx0=ranges[0][0], tx1=ranges[ranges.length-1][1];
  // the scale: the page's table width fitted to the panel, times the zoom; the print's height sets the font
  const avail=Math.max(300,(panel.clientWidth||900)-LABEL_W-48);
  const scale=Math.max(0.05, Math.min(1.5, avail/Math.max(1,tx1-tx0)))*zoom;
  const rowHs=F.grid.map(row=>{ const bs=row.map(g=>g.box||g.bb).filter(Boolean); return bs.length?Math.max(...bs.map(b=>b.y1))-Math.min(...bs.map(b=>b.y0)):0; }).filter(v=>v>0).sort((a,b)=>a-b);
  const glyph=(S.textLines&&S.textLines.stats&&S.textLines.stats.reference)||(rowHs.length?rowHs[rowHs.length>>1]*0.6:20);
  const fontPx=Math.max(8, Math.min(48, Math.round(glyph*scale)));
  const pageW=ranges.map(([a,b])=>Math.max(8,Math.round((b-a)*scale)));            // each column at the page's scale (the crop's geometry)
  // no column narrower than four characters of the table's font (a quantity or a % column on the page can be a sliver)
  const minW=Math.round(fontPx*0.62*4)+10;
  const widths=pageW.map((w,i)=>Math.max(minW, colWidths[keys[i]]?Math.round(colWidths[keys[i]]*zoom):w));   // the column as shown (dragged widths scale with the zoom)
  const pageOff=pageW.map((w,i)=>pageW.slice(0,i).reduce((a,b)=>a+b,0));           // where each column starts in the row's crop
  const cropW=pageW.reduce((a,b)=>a+b,0);
  const tableW=widths.reduce((a,b)=>a+b,0);
  // the columns beyond the page: the product's MRP (editable) and the profit; a Unit Conv column only when the invoice
  // prints neither a pack size nor a units-per-pack column (else the Pack Size cell is the row's units-per-pack input)
  const hasConvCol=keys.includes('unitconversion');
  const packCiEarly=packColumnIndex(keys, F.grid);
  const showConv=!hasConvCol && packCiEarly<0;
  const EXTRA=(showConv?80:0)+(prodDone?150:0);
  const {rowTp, packMrp, profitPct}=priceHelpers(F,keys,N,P);
  const RANGE=profitRange();
  // the product-list column: once the match is in, the item name (key name, else the widest text column, as the
  // matcher picks it) shows the matched product's name, the invoice's reading in the tooltip, and opens the product
  // popup; no product → "no match"; a total row is left as read. Every number stays the invoice's: the pack size
  // column shows its units per pack (the pack rule on the reading, or the operator's value) as an input.
  let nameCi=keys.indexOf('name');
  if(nameCi<0){ let bw=-1; keys.forEach((k,ci)=>{ const w=F.grid.reduce((s,r)=>s+((r[ci]&&r[ci].text)||'').replace(/[\d.,]/g,'').length,0); if(w>bw){ bw=w; nameCi=ci; } }); }
  const packCi=packColumnIndex(keys, F.grid);
  const prodCol=ci=>prodDone && ci===nameCi;
  const packCol=ci=>prodDone && ci===packCi && ci!==nameCi;
  // the row's units per pack as an input (the Pack Size cell once the match is in, and the Unit Conv column the table adds
  // when the invoice prints none): the typed value first, else the invoice's own column, else the pack rule on the reading
  const convInput=(ri,total,invoice)=>{ const cv=rowConversion(F,ri); const typed=cv.source==='typed'; const pc=packCi>=0?F.grid[ri][packCi]:null;
    const title=[typed?'typed by hand':'units per pack: '+cv.source, invoice?'invoice reads: "'+invoice+'"':'', pc&&pc.packWas!==undefined&&pc.packWas!==pc.text?'as read: "'+pc.packWas+'"':'', pc&&pc.packNote?pc.packNote:'', 'type a number to set the row\'s units per pack; the MRP, the profit and the price check follow'].filter(Boolean).join('\n');
    return '<td style="'+cell+'padding:0" title="'+esc(title)+'"><input data-conv="'+ri+'" value="'+(total?'':esc(String(cv.value)))+'" style="width:100%;box-sizing:border-box;background:transparent;border:0;outline:0;padding:2px 4px;color:'+(typed?SRC.manual:'#6edcff')+';font:inherit;text-align:right"'+(total?' disabled':'')+'></td>'; };
  const isTotalRow=ri=>!!(P && P.results && P.results[ri] && P.results[ri].status==='total');
  const prodCell=(ri,invoice)=>{ const r=P.results[ri]; const st=r?r.status:'none'; const col=st==='match'?'#54dd7e':st==='uncertain'?'#ffc85a':'#ff5a5a';
    let text='', suffix='', title='';
    if(r && r.product){ const p=r.product;
      const retried=r.retry&&r.retry.by;
      text=esc(productLabel(p)); suffix='<span style="color:#8fa39a;font-size:10px"> '+(r.manual?'(picked)':'('+r.score+(retried?' ↻':'')+')')+'</span>';
      title=['product: '+[p.name,p.strength,p.category].filter(Boolean).join(' · '), r.manual?'picked by hand':'score '+r.score, retried?'matched on a retry from the '+r.retry.by.join(' and ')+' reading "'+r.retry.text+'" — the chosen text "'+r.retry.was+'" matched nothing':'', 'UnitConversion on file (units per pack): '+(p.unitConversion!=null?p.unitConversion:''), invoice?'invoice reads: "'+invoice+'"':'invoice reads nothing', 'click: pick the product from the list'].filter(Boolean).join('\n'); }
    else { text='no match'; title=['no product matched', r.retry&&r.retry.disagree?'the other readings disagree: '+r.retry.disagree.join('; '):'', invoice?'invoice reads: "'+invoice+'"':'invoice reads nothing', 'click: pick the product from the list'].filter(Boolean).join('\n'); }
    return '<td data-prod="'+ri+'" title="'+esc(title)+'" style="'+cell+'padding:2px 4px;color:'+col+';cursor:pointer;text-decoration:underline dotted rgba(110,220,255,.5);text-align:left">'+text+suffix+'</td>'; };
  // one crop per row; every column cell shows its own window of it (background offset by the column's start), so a
  // column dragged wider or narrower keeps the print at the page's scale and just shows more or less of it
  const cropCell=(b0,b1,label)=>{ if(!src || !boxes.length) return ''; const c=cropRow(src,tx0,tx1,b0,b1,scale); if(!c) return '';
    let r='<tr class="crop"><td style="border:1px solid #2a3a3a;padding:2px 6px;color:#8fa39a;font-size:10px;vertical-align:middle">'+label+'</td>';
    // the column's own window of the page, exactly its page width, at the cell's left edge: a column shown wider than on
    // the page leaves blank space beside the print instead of showing its neighbour; one shown narrower is clipped
    keys.forEach((k,i)=>{ r+='<td style="border:1px solid #2a3a3a;padding:0;height:'+c.cssH+'px;overflow:hidden;background:#141a1c" title="'+esc(labels[i]||k)+' on the page"><div style="width:'+pageW[i]+'px;height:'+c.cssH+'px;background:url('+c.url+') no-repeat -'+pageOff[i]+'px 0 / '+cropW+'px '+c.cssH+'px"></div></td>'; });
    return r+(hasConvCol?'':'<td style="border:1px solid #2a3a3a"></td>')+(prodDone?'<td colspan="2" style="border:1px solid #2a3a3a"></td>':'')+'</tr>'; };
  const cell='border:1px solid #2a3a3a;box-sizing:border-box;overflow:hidden;text-overflow:ellipsis;';
  h+='<table style="border-collapse:collapse;white-space:nowrap;table-layout:fixed;width:'+(LABEL_W+tableW+EXTRA)+'px;font-size:'+fontPx+'px"><colgroup><col style="width:'+LABEL_W+'px">'+widths.map(w=>'<col style="width:'+w+'px">').join('')+(hasConvCol?'':'<col style="width:80px">')+(prodDone?'<col style="width:70px"><col style="width:70px">':'')+'</colgroup><thead><tr>';
  h+='<th style="'+cell+'padding:4px 6px;color:#8fa39a;font-size:11px">#</th>';
  keys.forEach((k,ci)=>{ const pc=prodCol(ci), pk=packCol(ci); h+='<th data-col="'+ci+'" style="'+cell+'position:relative;padding:4px 10px 4px 4px;color:'+(pc||pk?'#6edcff':'#ffe68c')+';text-align:left;font-size:'+Math.max(9,Math.min(14,fontPx))+'px" title="'+esc(labels[ci]||k)+' · '+esc(k)+(pc?' · the matched product\'s name (the invoice\'s reading in the tooltip) · click a cell to pick the product':pk?' · the invoice\'s units per pack (1X30s → 30, 5x4\'s → 20, 100ml → 1); type a number to correct it; the MRP, the profit and the price check follow':editable(F,ci,k)?' · editable':'')+'">'+esc(labels[ci]||k)+'<div style="color:#8fa39a;font-weight:normal;font-size:9px;overflow:hidden;text-overflow:ellipsis">'+esc(k)+(pc?' · product list':pk?' · units per pack · edit':editable(F,ci,k)?' · edit':'')+'</div>'
      +'<div class="etGrip" data-col="'+ci+'" title="drag to resize · double-click to reset" style="position:absolute;top:0;right:-4px;width:8px;height:100%;cursor:col-resize;z-index:2"></div></th>'; });
  if(showConv) h+='<th style="'+cell+'padding:4px 6px;color:#6edcff;font-size:11px" title="units per pack (the invoice prints no pack size): UnitConversion × UnitPurchasePrice = the invoice\'s unit TP; editable">Unit Conv<div style="color:#8fa39a;font-weight:normal;font-size:9px">edit</div></th>';
  if(prodDone) h+='<th style="'+cell+'padding:4px 6px;color:#6edcff;font-size:11px" title="the pack\'s MRP: the list\'s UnitSalePrice × the row\'s units per pack — type over it to set the pack MRP by hand (the profit and the summaries follow)">MRP<div style="color:#8fa39a;font-weight:normal;font-size:9px">pack · edit</div></th><th style="'+cell+'padding:4px 6px;color:#6edcff;font-size:11px" title="profit on the invoice\'s unit TP: (pack MRP − TP) / TP × 100 — danger colour outside the Options\' profit range ('+RANGE.min+' … '+RANGE.max+' %)">Profit %<div style="color:#8fa39a;font-weight:normal;font-size:9px">'+RANGE.min+'–'+RANGE.max+' fine</div></th>';
  h+='</tr></thead><tbody>';
  if(F.header && F.header.cells){ const hb=F.header.cells.filter(Boolean); if(hb.length) h+=cropCell(Math.min(...hb.map(b=>b.y0)),Math.max(...hb.map(b=>b.y1)),'page'); }
  F.grid.forEach((row,ri)=>{
    const nr=N&&N.rows?N.rows[ri]:null, total=!!(nr&&nr.isTotal);
    const no=itemNumber(F,ri);                                        // '' on an item group row: the groups are not counted
    // the row on the page first, then the row as read
    const rb=row.map(g=>g.box||g.bb).filter(Boolean); if(rb.length) h+=cropCell(Math.min(...rb.map(b=>b.y0)),Math.max(...rb.map(b=>b.y1)),'page'+(no?' '+no:''));
    // an item group name (RPL, RNL …): one cell across the table, no inputs, nothing to match
    const fr=F.rows&&F.rows[ri];
    if(fr && fr.kind==='group'){ h+='<tr style="background:rgba(255,225,130,.10)"><td style="'+cell+'padding:2px 6px;color:#8fa39a;font-size:11px"></td>'
        +'<td colspan="'+(keys.length+(hasConvCol?0:1)+(prodDone?2:0))+'" style="'+cell+'padding:3px 6px;color:#ffe182;font-weight:600" title="item group: the rows below belong to '+esc(fr.groupName)+'">▸ '+esc(fr.groupName)+' <span style="color:#8fa39a;font-weight:normal;font-size:10px">item group</span></td></tr>'; return; }
    h+='<tr style="background:'+(total?'rgba(110,160,255,.14)':(ri%2?'rgba(255,255,255,.025)':'transparent'))+'">';
    h+='<td style="'+cell+'padding:2px 6px;color:#8fa39a;font-size:11px">'+no+'</td>';
    row.forEach((g,ci)=>{
      const k=keys[ci], c=nr&&nr.cells?nr.cells[k]:null;
      const shown=c && (c.status==='fixed'||c.status==='filled') && c.fixedText!==undefined ? c.fixedText : (g.text||'');
      const color=SRC[g.source]||SRC.agreed, under=c&&CHECK[c.status]?'border-bottom:3px solid '+CHECK[c.status]+';':'';
      const title=[g.source?'source: '+g.source:'', c?c.status+(c.note?' — '+c.note:''):'', c&&c.status!=='blank'&&shown!==g.text?'as read: "'+g.text+'"':''].filter(Boolean).join('\n');
      const align=/^[\d.,%\-+ ]*$/.test(shown)&&shown?'right':'left';
      if(prodCol(ci) && !isTotalRow(ri)){ h+=prodCell(ri, shown); return; }
      if(packCol(ci)){ h+=convInput(ri, total, shown); return; }
      if(editable(F,ci,k)) h+='<td style="'+cell+'padding:0;'+under+'"><input data-ri="'+ri+'" data-ci="'+ci+'" value="'+esc(shown)+'" title="'+esc(title)+'" style="width:100%;box-sizing:border-box;background:transparent;border:0;outline:0;padding:2px 4px;color:'+color+';font:inherit;text-align:'+align+'"></td>';
      else h+='<td style="'+cell+'padding:2px 4px;color:'+color+';'+under+'text-align:'+align+'" title="'+esc(title)+'">'+esc(shown)+'</td>';
    });
    if(showConv) h+=convInput(ri, total, '');
    if(prodDone){ const r=P.results[ri]; const st=r?r.status:'none'; const col=st==='match'?'#54dd7e':st==='uncertain'?'#ffc85a':st==='total'?'#6ea0ff':'#ff5a5a';
      const mr=rowPackMrp(F,P,ri), pm=mr.value, pp=profitPct(r,ri);
      const mrpTitle=[mr.source==='typed'?'pack MRP typed by hand':(r&&r.product&&pm!==null?'MRP '+pm.toFixed(2)+' = '+mr.unit.toFixed(2)+' × '+mr.conv+' units per pack':'no product: type the pack MRP'),
        r&&r.price?'invoice TP '+r.price.invoiceTp+(r.price.expected!=null?' · expected '+r.price.expected+' = '+r.price.purchasePrice+' × '+r.price.unitConversion:'')+(r.price.differs?' · differs':' · agrees'):'', 'type a number to set the pack MRP; the profit and the summaries follow; clear it to take the list\'s again'].filter(Boolean).join('\n');
      if(total) h+='<td style="'+cell+'"></td>';
      else h+='<td style="'+cell+'padding:0" title="'+esc(mrpTitle)+'"><input data-mrp="'+ri+'" value="'+(pm!==null?pm.toFixed(2):'')+'" style="width:100%;box-sizing:border-box;background:transparent;border:0;outline:0;padding:2px 4px;color:'+(mr.source==='typed'?SRC.manual:col)+';font:inherit;text-align:right;font-size:11px">'+(r&&r.price&&r.price.differs?'<span style="color:#ff78e6;font-size:10px" title="the invoice TP is not UnitConversion × UnitPurchasePrice">≠</span>':'')+'</td>';
      h+='<td style="'+cell+'padding:3px 6px;text-align:right;font-size:11px;color:'+profitColor(pp,RANGE)+'" title="'+(pp!==null?esc('('+pm.toFixed(2)+' − '+rowTp(ri)+') / '+rowTp(ri)+' × 100'+(profitColor(pp,RANGE)==='#ff5a5a'?' — outside the profit range '+RANGE.min+' … '+RANGE.max+' %':'')):'')+'">'+(pp!==null?pp.toFixed(1)+'%':'')+'</td>'; }
    h+='</tr>';
  });
  h+='</tbody></table>';
  h+=summaryHtml(F,keys,labels,N,P,prodDone);
  if(N&&N.summary) h+='<div style="margin-top:8px;color:#8fa39a">number check: '+esc(Object.entries(N.summary).map(([k,v])=>k+' '+v).join(' · '))+(N.model&&N.model.relations.length?' · rules: '+esc(N.model.relations.map(r=>r.id).join(', ')):'')+'</div>';
  panel.innerHTML=h;
  panel.querySelectorAll('input[data-ri]').forEach(inp=>{
    // live: the row and the summary follow while typing (a short pause after the last key), the field keeps the focus
    let timer=null;
    inp.oninput=()=>{ clearTimeout(timer); timer=setTimeout(()=>applyEdit(+inp.dataset.ri,+inp.dataset.ci,inp.value,true),350); };
    inp.onchange=()=>{ clearTimeout(timer); applyEdit(+inp.dataset.ri,+inp.dataset.ci,inp.value,false); };
    inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); clearTimeout(timer); applyEdit(+inp.dataset.ri,+inp.dataset.ci,inp.value,false); } }; });
  panel.querySelectorAll('td[data-prod]').forEach(td=>{ td.onclick=()=>openProductPopup(+td.dataset.prod); });
  panel.querySelectorAll('input[data-conv]').forEach(inp=>{ const go=()=>{ const F=S.final, ri=+inp.dataset.conv; const v=parseFloat(inp.value); if(!F) return;
      F.rowMeta=F.rowMeta||{}; F.rowMeta[ri]=F.rowMeta[ri]||{}; if(isFinite(v) && v>0) F.rowMeta[ri].unitConversion=v; else delete F.rowMeta[ri].unitConversion;
      updateFinalJson(); if(S.pipelineDone) startProducts(); const top=panel.scrollTop; build(); panel.scrollTop=top; edited(); };
    inp.onchange=go; inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); go(); } }; });
  // the pack MRP typed over: kept on the row (F.rowMeta[ri].mrp), the profit and the summaries follow; cleared → the list's again
  panel.querySelectorAll('input[data-mrp]').forEach(inp=>{ const go=()=>{ const F=S.final, ri=+inp.dataset.mrp; if(!F) return; const v=parseFloat(String(inp.value).replace(/,/g,''));
      F.rowMeta=F.rowMeta||{}; F.rowMeta[ri]=F.rowMeta[ri]||{}; const listed=rowPackMrp({...F, rowMeta:{}},S.products,ri).value;
      if(isFinite(v) && v>=0 && (listed===null || Math.abs(v-listed)>0.005)) F.rowMeta[ri].mrp=v; else delete F.rowMeta[ri].mrp;
      updateFinalJson(); const top=panel.scrollTop; build(); panel.scrollTop=top; edited(); };
    inp.onchange=go; inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); go(); } }; });
  // column resizing: drag a header cell's right edge; the <col> follows live, the width is kept per column key
  const tbl=panel.querySelector('table'), colEls=tbl?[...tbl.querySelectorAll('colgroup col')]:[];
  panel.querySelectorAll('.etGrip').forEach(grip=>{
    const ci=+grip.dataset.col, colEl=colEls[ci+1];
    grip.onmousedown=e=>{ if(e.button!==0) return; e.preventDefault(); e.stopPropagation();
      const x0=e.clientX, w0=colEl.getBoundingClientRect().width || widths[ci]; grip.style.background='rgba(110,220,255,.5)';
      const move=ev=>{ const w=Math.max(minW,Math.round(w0+ev.clientX-x0)); colEl.style.width=w+'px'; tbl.style.width=(LABEL_W+widths.reduce((a,b,i)=>a+(i===ci?w:b),0)+EXTRA)+'px'; };
      const up=ev=>{ removeEventListener('mousemove',move); removeEventListener('mouseup',up); grip.style.background='';
        const w=Math.max(minW,Math.round(w0+ev.clientX-x0)); colWidths[keys[ci]]=w/zoom; const top=panel.scrollTop, left=panel.scrollLeft; build(); panel.scrollTop=top; panel.scrollLeft=left; };
      addEventListener('mousemove',move); addEventListener('mouseup',up); };
    grip.ondblclick=e=>{ e.stopPropagation(); delete colWidths[keys[ci]]; const top=panel.scrollTop; build(); panel.scrollTop=top; }; });
  const rs=panel.querySelector('#etReset'); if(rs) rs.onclick=()=>{ for(const k of Object.keys(colWidths)) delete colWidths[k]; const top=panel.scrollTop; build(); panel.scrollTop=top; };
  const z=panel.querySelector('#etZoom'); if(z){ z.oninput=()=>{ panel.querySelector('#etZoomV').textContent=z.value+'%'; }; z.onchange=()=>{ zoom=(+z.value)/100; const top=panel.scrollTop; build(); panel.scrollTop=top; }; }
}

/* ---- the product popup: the list ranked for the row, a search, Merge ---------
   Click a Product cell: the popup lists the product list ranked for that
   row's item name (the matcher's candidates first, then every product whose
   name holds the words typed), a search field re-ranks it for any text, a
   click selects a product, Merge writes it into the row — the PRODUCTS stage,
   the MRP column and the JSON follow, the product marked as picked by hand. */
const pop=document.createElement('div');
pop.style.cssText='position:fixed;inset:0;display:none;z-index:1100;background:rgba(0,0,0,.55);align-items:center;justify-content:center;font:12px "JetBrains Mono",monospace;color:#e6f0eb';
pop.innerHTML='<div id="ppBox" style="width:min(900px,92vw);max-height:86vh;display:flex;flex-direction:column;background:#101416;border:1px solid rgba(166,255,63,.45);border-radius:6px;box-shadow:0 10px 40px rgba(0,0,0,.7)">'
 +'<div id="ppHead" style="padding:10px 14px;border-bottom:1px solid rgba(166,255,63,.2);color:#8fa39a"></div>'
 +'<div id="ppCrop" style="display:none;padding:6px 14px;border-bottom:1px solid rgba(166,255,63,.2);background:#141a1c;overflow:auto"></div>'
 +'<div style="padding:8px 14px;display:flex;gap:8px;align-items:center"><input id="ppSearch" placeholder="search the product list — name, generic, manufacturer" style="flex:1;background:#0a0e0f;color:#e6f0eb;border:1px solid rgba(166,255,63,.35);border-radius:3px;font:inherit;padding:6px 8px"><span id="ppCount" style="color:#8fa39a;white-space:nowrap"></span></div>'
 +'<div id="ppList" style="flex:1;overflow:auto;padding:0 6px 6px"></div>'
 +'<div style="padding:10px 14px;border-top:1px solid rgba(166,255,63,.2);display:flex;gap:10px;align-items:center"><span id="ppPick" style="flex:1;color:#8fa39a">no product selected</span><button id="ppMerge" disabled style="font:inherit;padding:6px 16px;background:rgba(166,255,63,.18);color:#e6f0eb;border:1px solid rgba(166,255,63,.6);border-radius:3px;cursor:pointer">Merge</button><button id="ppClose" style="font:inherit;padding:6px 12px;background:transparent;color:#e6f0eb;border:1px solid rgba(166,255,63,.35);border-radius:3px;cursor:pointer">Close</button></div></div>';
document.body.appendChild(pop);
const pp={row:-1, items:[], picked:null, seq:0};
const $p=id=>pop.querySelector('#'+id);
function closePopup(){ pop.style.display='none'; pp.row=-1; pp.picked=null; }
/* the popup is dragged by its head: the box leaves the centre and keeps the
   place it was dropped at until the page is reloaded */
{
  const box=$p('ppBox'), head=$p('ppHead'); head.style.cursor='move'; head.title='drag to move';
  let drag=null;
  head.addEventListener('mousedown',e=>{ if(e.button!==0) return; const r=box.getBoundingClientRect();
    box.style.position='fixed'; box.style.margin='0'; box.style.left=r.left+'px'; box.style.top=r.top+'px'; pop.style.alignItems='flex-start'; pop.style.justifyContent='flex-start';
    drag={dx:e.clientX-r.left, dy:e.clientY-r.top, w:r.width, h:r.height}; e.preventDefault(); });
  addEventListener('mousemove',e=>{ if(!drag) return; const vw=innerWidth||1600, vh=innerHeight||900;   // at least 80 px of the box stay on screen
    const x=Math.max(-drag.w+80,Math.min(vw-80,e.clientX-drag.dx)), y=Math.max(0,Math.min(vh-40,e.clientY-drag.dy)); box.style.left=x+'px'; box.style.top=y+'px'; });
  addEventListener('mouseup',()=>{ drag=null; });
}
$p('ppClose').onclick=closePopup;
pop.addEventListener('mousedown',e=>{ if(e.target===pop) closePopup(); });
addEventListener('keydown',e=>{ if(e.key==='Escape' && pop.style.display!=='none') closePopup(); });
function renderList(){
  const L=$p('ppList'); const n=v=>v===null||v===undefined?'':(+v).toFixed(2);
  L.innerHTML='<table style="border-collapse:collapse;width:100%"><thead><tr>'+['','Product','Strength','Category','Pack Size','Manufacturer','MRP','TP','Purchase','Score'].map(h=>'<th style="text-align:left;padding:4px 6px;color:#ffe68c;border-bottom:1px solid #2a3a3a;position:sticky;top:0;background:#101416">'+h+'</th>').join('')+'</tr></thead><tbody>'
    +pp.items.map((it,i)=>{ const p=it.product, sel=pp.picked&&pp.picked.id===p.id;
      return '<tr data-i="'+i+'" style="cursor:pointer;background:'+(sel?'rgba(166,255,63,.18)':(i%2?'rgba(255,255,255,.025)':'transparent'))+'">'
        +'<td style="padding:3px 6px;color:#8fa39a">'+(i+1)+'</td><td style="padding:3px 6px;color:'+(it.by==='match'?'#54dd7e':'#e6f0eb')+'">'+esc(p.name)+'</td><td style="padding:3px 6px">'+esc(p.strength||'')+'</td><td style="padding:3px 6px">'+esc(p.category||'')+'</td><td style="padding:3px 6px;text-align:right" title="UnitConversion: units per pack">'+(p.unitConversion!=null?esc(String(p.unitConversion)):'')+'</td><td style="padding:3px 6px;color:#8fa39a">'+esc(p.manufacturer||'')+'</td>'
        +'<td style="padding:3px 6px;text-align:right">'+n(p.mrp)+'</td><td style="padding:3px 6px;text-align:right">'+n(p.tradePrice)+'</td><td style="padding:3px 6px;text-align:right">'+n(p.purchasePrice)+'</td><td style="padding:3px 6px;text-align:right;color:'+(it.score>=0.85?'#54dd7e':it.score>=0.6?'#ffc85a':'#8fa39a')+'">'+(it.score?it.score.toFixed(3):'')+'</td></tr>'; }).join('')+'</tbody></table>';
  L.querySelectorAll('tr[data-i]').forEach(tr=>{ tr.onclick=()=>{ pp.picked=pp.items[+tr.dataset.i].product; $p('ppPick').textContent='selected: '+productLabel(pp.picked)+(pp.picked.mrp!=null?' · MRP '+(+pp.picked.mrp).toFixed(2):''); $p('ppMerge').disabled=false; renderList(); };
    tr.ondblclick=()=>{ tr.onclick(); $p('ppMerge').click(); }; });
  $p('ppCount').textContent=pp.items.length+' shown'+(pp.items.some(i=>i.by==='match')?' · best matches first':'');
}
async function runSearch(text){
  const my=++pp.seq; $p('ppCount').textContent='searching…';
  try{ const items=await searchProducts(text, 300); if(my!==pp.seq) return; pp.items=items; renderList(); }
  catch(e){ if(my===pp.seq) $p('ppList').innerHTML='<div style="padding:12px;color:#ff5a5a">search failed: '+esc(e.message||e)+'</div>'; }
}
let searchTimer=null;
$p('ppSearch').oninput=()=>{ clearTimeout(searchTimer); searchTimer=setTimeout(()=>runSearch($p('ppSearch').value),150); };
$p('ppSearch').onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); clearTimeout(searchTimer); runSearch($p('ppSearch').value); } };
function openProductPopup(ri){
  const F=S.final, P=S.products; if(!F || !F.grid) return;
  const keys=F.keys||[]; const nameCi=keys.indexOf('name'); const packCi=keys.indexOf('pack');
  const name=(nameCi>=0&&F.grid[ri][nameCi].text)||(F.grid[ri].map(g=>g.text).find(t=>/[A-Za-z]{3}/.test(t||''))||'');
  const pack=packCi>=0?(F.grid[ri][packCi].text||''):'';
  pp.row=ri; pp.picked=null; pp.items=[];
  $p('ppHead').innerHTML='row '+(itemNumber(F,ri)||ri+1)+' · <b style="color:#e6f0eb">'+esc(name)+'</b>'+(pack?' · pack '+esc(pack):'')+(P&&P.results&&P.results[ri]&&P.results[ri].product?' · now: '+esc(productLabel(P.results[ri].product))+(P.results[ri].manual?' (picked)':''):' · now: no match')+' — pick a product and press Merge';
  $p('ppPick').textContent='no product selected'; $p('ppMerge').disabled=true;
  // the row on the page, the table's full width, fitted to the popup: what is being matched, right above the list
  { const cropEl=$p('ppCrop'); const src=S.workCanvas||S.origCanvas||null; const rb=F.grid[ri].map(g=>g.box||g.bb).filter(Boolean);
    if(src && rb.length){ const ranges=columnRanges(F, keys.length); const tx0=ranges[0][0], tx1=ranges[ranges.length-1][1];
      const boxW=Math.min(900, (innerWidth||1200)*0.92)-28, sc=Math.max(0.05, Math.min(1.5, boxW/Math.max(1,tx1-tx0)));
      const c=cropRow(src,tx0,tx1,Math.min(...rb.map(b=>b.y0)),Math.max(...rb.map(b=>b.y1)),sc);
      if(c){ cropEl.innerHTML='<img src="'+c.url+'" style="display:block;width:'+c.cssW+'px;height:'+c.cssH+'px" alt="the row on the page">'; cropEl.style.display='block'; } else cropEl.style.display='none'; }
    else cropEl.style.display='none'; }
  $p('ppSearch').value=name; pop.style.display='flex'; $p('ppSearch').focus(); $p('ppSearch').select();
  runSearch((name+' '+pack).trim());
}
$p('ppMerge').onclick=async()=>{
  if(!pp.picked || pp.row<0) return;
  const ri=pp.row, product=pp.picked;
  let P=S.products;
  if(!P || P.status!=='done'){ if(P && P.promise) await P.promise; P=S.products; }
  if(!P || !P.results){ $p('ppPick').textContent='the product match has not run yet — run the pipeline first'; return; }
  await manualMatch(ri, product);
  closePopup();
  updateFinalJson();
  build();
  refreshStages(['products-match',KIND]);
};

/* ---- the summary under the table -------------------------------------------
   The item rows added up, column by column: every number column the check
   gave a role (quantity, total TP, total VAT, discount, net …) is summed
   over the item rows (sub-total rows left out, repaired values used), and
   where the invoice prints a sub-total row its figure stands beside the
   sum with a check — green when they agree, red when they do not. Then
   the products: matched, uncertain, unmatched, the TPs that differ from
   the price on file, and the MRP value of the matched lines (qty × MRP). */
const ROLE_LABEL={qty:'Quantity', bonus:'Bonus', unitTp:'Unit TP', unitVat:'Unit VAT', vatPct:'VAT %', unitGross:'TP+VAT (unit)', unitSp:'Unit SP', totalSp:'Total SP',
                  totalTp:'Total TP', totalVat:'Total VAT', discPct:'Discount %', discAmt:'Discount', unitDisc:'Unit discount', net:'Net amount', mrp:'MRP'};
const SUMMED=new Set(['qty','bonus','totalTp','totalVat','discAmt','net','totalSp']);       // the columns whose sum means something
function summaryHtml(F,keys,labels,N,P,prodDone){
  const rows=N&&N.rows?N.rows:null; if(!rows) return '';
  const {rowTp, packMrp}=priceHelpers(F,keys,N,P);
  const RANGE=profitRange();
  const roles=N.roles||{};
  const items=rows.filter(r=>!r.isTotal && !r.isGroup), totals=rows.filter(r=>r.isTotal);
  const fmt=(v,k)=>v===null||v===undefined||!isFinite(v)?'':(roles[k]==='qty'||roles[k]==='bonus'?String(Math.round(v)):(+v).toFixed(2));
  const lines=[];
  lines.push(['Item rows', String(items.length), '', '']);
  for(const k of keys){ const role=roles[k]; if(!role || !SUMMED.has(role)) continue;
    let sum=0, n=0; for(const r of items){ const c=r.cells[k]; if(c && c.value!==null && c.value!==undefined){ sum+=c.value; n++; } }
    if(!n) continue;
    // the printed sub-total for this column: the last total row that has a value there
    let printed=null; for(const r of totals){ const c=r.cells[k]; if(c && c.value!==null && c.value!==undefined) printed=c.value; }
    const agree=printed===null?null:Math.abs(printed-sum)<=0.02+0.001*Math.abs(sum);
    lines.push([ROLE_LABEL[role]+' <span style="color:#8fa39a">('+esc(labels[keys.indexOf(k)]||k)+')</span>', fmt(sum,k), printed===null?'':fmt(printed,k), printed===null?'':(agree?'<span style="color:#54dd7e">agrees</span>':'<span style="color:#ff5a5a">differs by '+fmt(printed-sum,k)+'</span>')]);
  }
  let h='<div style="margin-top:14px;display:flex;gap:28px;flex-wrap:wrap;align-items:flex-start">';
  h+='<div><div style="color:#ffe68c;margin-bottom:4px">Item table summary</div><table style="border-collapse:collapse;font-size:12px"><thead><tr>'+['','sum of the item rows','printed sub-total','check'].map(t=>'<th style="border:1px solid #2a3a3a;padding:3px 8px;color:#8fa39a;font-weight:normal;text-align:left">'+t+'</th>').join('')+'</tr></thead><tbody>'
    +lines.map(l=>'<tr><td style="border:1px solid #2a3a3a;padding:3px 8px">'+l[0]+'</td><td style="border:1px solid #2a3a3a;padding:3px 8px;text-align:right;color:#f0f5f5">'+l[1]+'</td><td style="border:1px solid #2a3a3a;padding:3px 8px;text-align:right;color:#6ea0ff">'+l[2]+'</td><td style="border:1px solid #2a3a3a;padding:3px 8px">'+l[3]+'</td></tr>').join('')+'</tbody></table></div>';
  if(prodDone){
    const counts={match:0, uncertain:0, none:0, priceDiff:0, picked:0, retry:0}; let mrpValue=0, mrpRows=0, costValue=0;
    const qtyKey=keys.find(k=>roles[k]==='qty');
    P.results.forEach((r,ri)=>{ if(!r || r.status==='total' || r.status==='group') return; counts[r.status]=(counts[r.status]||0)+1; if(r.manual) counts.picked++; if(r.retry&&r.retry.by) counts.retry++; if(r.price&&r.price.differs) counts.priceDiff++;
      const pm=packMrp(r,ri), tp=rowTp(ri);
      if(pm!==null && qtyKey && rows[ri] && rows[ri].cells[qtyKey] && rows[ri].cells[qtyKey].value!==null){ const q=rows[ri].cells[qtyKey].value; mrpValue+=q*pm; mrpRows++; if(tp!==null) costValue+=q*tp; } });
    const profitAll=costValue>0?(mrpValue-costValue)/costValue*100:null;
    const pl=[['Matched','<span style="color:#54dd7e">'+counts.match+'</span>'+(counts.picked?' <span style="color:#8fa39a">('+counts.picked+' picked by hand)</span>':'')+(counts.retry?' <span style="color:#8fa39a">('+counts.retry+' on a retry from another reading)</span>':'')],['Uncertain','<span style="color:#ffc85a">'+counts.uncertain+'</span>'],['No match','<span style="color:#ff5a5a">'+counts.none+'</span>'],['TP differs from the price on file','<span style="color:#ff78e6">'+counts.priceDiff+'</span>'],['MRP sum (Σ qty × pack MRP)',mrpRows?'<b style="color:#e6f0eb">'+(mrpValue).toFixed(2)+'</b> <span style="color:#8fa39a">('+mrpRows+' rows)</span>':''],['TP value of those lines (qty × TP)',costValue>0?costValue.toFixed(2):''],['Profit on TP',profitAll!==null?'<span style="color:'+profitColor(profitAll,RANGE)+'">'+profitAll.toFixed(1)+'%</span> <span style="color:#8fa39a">(range '+RANGE.min+' … '+RANGE.max+' %)</span>':'']];
    h+='<div><div style="color:#6edcff;margin-bottom:4px">Products</div><table style="border-collapse:collapse;font-size:12px"><tbody>'+pl.map(l=>'<tr><td style="border:1px solid #2a3a3a;padding:3px 8px">'+l[0]+'</td><td style="border:1px solid #2a3a3a;padding:3px 8px;text-align:right">'+l[1]+'</td></tr>').join('')+'</tbody></table></div>';
  }
  return h+'</div>';
}

/* one cell typed: into the final table, then the check, the products, the stages */
let applying=false;
async function applyEdit(ri,ci,value,live){
  const F=S.final; if(!F || !F.grid || !F.grid[ri] || !F.grid[ri][ci] || applying) return;
  const g=F.grid[ri][ci]; const text=String(value).trim();
  if(text===(g.text||'') && !live) { build(); return; }
  if(text===(g.text||'')) return;
  applying=true;
  try{
    g.text=text; g.source='manual'; g.edited=true; g.votes=null;
    F.edits=(F.edits||[]).filter(e=>!(e.row===ri+1 && e.key===(F.keys||[])[ci])).concat([{row:ri+1, key:(F.keys||[])[ci], text}]);
    try{ F.numbers=analyseNumbers(tableForNumbers(F)); }catch(e){ console.warn('number check after the edit failed', e); }
    updateFinalJson();
    // the field being typed in keeps the focus and the caret through the rebuild
    const focused=document.activeElement, keep=focused && focused.dataset && focused.dataset.ri!==undefined ? {ri:focused.dataset.ri, ci:focused.dataset.ci, pos:focused.selectionStart} : null;
    const top=panel.scrollTop, left=panel.scrollLeft;
    build(); panel.scrollTop=top; panel.scrollLeft=left;
    if(keep){ const again=panel.querySelector('input[data-ri="'+keep.ri+'"][data-ci="'+keep.ci+'"]'); if(again){ again.focus(); try{ again.setSelectionRange(keep.pos,keep.pos); }catch(e){} } }
    if(!live){ if(S.pipelineDone) startProducts(); refreshStages(['final-table','num-columns','num-fields','num-rules','num-repair','products-match',KIND]); edited(); }
  } finally { applying=false; }
}
/* a field of the page changed: the all-pages summary (js/pages/pages.js listens) follows */
function edited(){ document.dispatchEvent(new CustomEvent('finaledited')); }
/* the profit range in the Options: every row's colour is checked again, in the table and the summaries */
for(const id of ['profitMin','profitMax']){ const el=document.getElementById(id); if(el) el.addEventListener('change',()=>{ if(panel.style.display!=='none'){ const top=panel.scrollTop; build(); panel.scrollTop=top; } document.dispatchEvent(new CustomEvent('profitrange')); }); }

function sync(){ const st=STAGES[S.stage]; const on=!!(st && st.kind===KIND && S.W); panel.style.display=on?'block':'none'; if(on) build(); }
document.addEventListener('stagechange',sync);
document.addEventListener('finalchanged',()=>{ if(panel.style.display!=='none') build(); });
