// node matcher.test.mjs — the product matcher against the real product list
import { PRODUCTS, PRODUCT_COLUMNS } from './products-data.js';
import { buildIndex, matchItem, matchRows, parseName, tokenSim, searchProducts, priceOf, segmentToken } from './matcher.js';

let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const t0=performance.now(); const index=buildIndex(PRODUCTS, PRODUCT_COLUMNS); const buildMs=performance.now()-t0;
console.log(`index: ${index.items.length} products in ${buildMs.toFixed(0)} ms`);
const col=index.col;
const show=(q,m)=>console.log(`    "${q}" → ${m.status} ${m.score} ${m.product?'['+m.product.name+' | '+(m.product.strength||'')+' | '+(m.product.category||'')+' | MRP '+m.product.mrp+']':''}`);

console.log('[1] parsing');
const p1=parseName('SECLO 20MG Capsule (Delayed Release)'); check(p1.brand.join(' ')==='SECLO' && p1.strength.length===1 && p1.strength[0].v===20 && p1.strength[0].u==='MG' && p1.form==='CAPSULE', 'SECLO 20MG Capsule (Delayed Release) → SECLO / 20 MG / CAPSULE');
const p2=parseName('OTEZOL150MG'); check(p2.brand[0]==='OTEZOL' && p2.strength[0].v===150, 'glued strength split: OTEZOL150MG');
const p3=parseName('Camlosart 5/40 Tab 30\'s'); check(p3.strength.length===2 && p3.strength[0].v===5 && p3.strength[1].v===40 && p3.form==='TABLET' && p3.packs.length===1, '5/40 strengths, Tab, pack size 30\'s');
const p4=parseName('Bactin D Eye & Ear Drop 5ml'); check(p4.brand.join(' ')==='BACTIN D' && p4.form==='DROPS' && p4.strength[0].u==='ML', 'descriptors dropped, qualifier D kept, drops');
check(tokenSim('SECL0','SECLO')>=0.9 && tokenSim('SECLO','SECLO')===1 && tokenSim('SECLO','SUCLO')<0.9, 'OCR look-alike costs half an edit');

console.log('[2] the SECLO spellings all land on the same product');
{
  const variants=['SECLO 20MG Capsule (Delayed Release)','SECLO 20MG Capsule','SECLO Capsule 20MG','SECLO 20MG Cap','SECLO Caps 20MG','Seclo 20 mg cap','SECL0 20MG CAP'];
  const ms=variants.map(v=>matchItem(index,{name:v})); ms.forEach((m,i)=>show(variants[i],m));
  const names=new Set(ms.filter(m=>m.product).map(m=>(m.product.name+'|'+(m.product.strength||'')).toUpperCase().replace(/\s+/g,'')));
  check(ms.every(m=>m.status==='match'), 'every spelling is a match');
  check(names.size<=2, 'all spellings resolve to the same product (or its pack variants)');
  const m40=matchItem(index,{name:'SECLO 40MG Cap'}); show('SECLO 40MG Cap',m40);
  check(!m40.product || !/\b20\b/.test(m40.product.strength||'') , 'SECLO 40 does not take the 20 mg product');
}

console.log('[3] real invoice lines');
{
  const lines=[{name:'Adovas Syp 200ml', pack:"1X1'S"},{name:'Alatrol Tab 150s', pack:"15X10'S"},{name:'Anzitor 10 Tab 50s'},{name:'Cef-3 200 Cap 14\'s'},{name:'Fexo 120 Tab 50s'},{name:'BISOPRO 5 TABLET 30\'S'},{name:'ARIPRA ORAL SOLUTION 50ML'},{name:'BACTIN D EYE & EAR DROP', pack:'5ml'},{name:'FLOROMOX EYE DROPS', pack:'5ml'},{name:'Itokine Tablet 120S'},{name:'Povin M/W 100ml Sol'},{name:'NOT A REAL PRODUCT XQZ'}];
  const res=matchRows(index, lines, {});
  res.forEach((m,i)=>show(lines[i].name,m));
  const matched=res.filter(m=>m.status==='match').length;
  check(matched>=6, 'at least 6 of the 11 real lines match ('+matched+')');
  check(res[res.length-1].status==='none', 'a made-up name is no match');
}

console.log('[3b] an IBN SINA invoice: serial numbers glued to the names, packs and forms glued to the strengths');
{
  const lines=["8 CEFIXIM200CAP20'S","9 CINARZIN PLUS TABLET","10 CINARZIN TAB","12CORALTAB-DX TABLET","13 DEXLAN 30MG CAP","14DOPADON-10MG TAB","16 ESOLOK-20MGCAP","17FEXOMIN 120 TABLET-","18FEXOMIN SUS","19FLOROMOX TABLET","22 FUNGIN-B CREAM","24GEMITAB-320 TAB","25IPICAL D TAB-15S","26 LINAX PLUS -2.5/500","27LINAX PLUS 2.5/850","29LONGPARA TABLET","32 MEROCLAV250mg","34MONTEX-10TABLET30'S","36 MYCOCIN SUS","37 MYOTRIL-0.50 TAB","39 NEURALGIN TAB-60S","40OLMEDIP 5/20 MG","41OLMEDIP 5/40 MG"];
  const res=matchRows(index, lines.map(name=>({name})), {});
  res.forEach((m,i)=>show(lines[i],m));
  const p0=parseName(lines[0],'',{serial:true});
  check(p0.brand.join(' ')==='CEFIXIM' && p0.strength.length===1 && p0.strength[0].v===200 && p0.form==='CAPSULE' && p0.packs.length===1, "8 CEFIXIM200CAP20'S → CEFIXIM / 200 / CAPSULE / pack 20'S");
  check(res[0].status==='match' && /CEFIXIM/i.test(res[0].product.name) && /200/.test(res[0].product.strength||''), 'CEFIXIM 200 MG Cap is found');
  const matched=res.filter(m=>m.status==='match').length;
  check(matched>=20, 'at least 20 of the '+lines.length+' lines match ('+matched+')');
  check(res.every(m=>m.status!=='none'), 'no line is left without a product');
  const olm=res.slice(-2); check(olm[0].product && /5\s*\/\s*20/.test(olm[0].product.strength||'') && olm[1].product && /5\s*\/\s*40/.test(olm[1].product.strength||''), 'OLMEDIP 5/20 and 5/40 are told apart');
}

console.log('[3c] the pack column beside a concentration strength');
{
  const q=[{name:'3 ANTANIL SUS', pack:'200ml'},{name:'4 ANTANIL TAB', pack:"10X10'S"},{name:'LYTEX SYRUP', pack:'100ml'},{name:'GAVISOL SUSPENSION', pack:'200ml'}];
  const res=matchRows(index,q,{}); res.forEach((m,i)=>show(q[i].name+' / '+q[i].pack,m));
  check(res[0].status==='match' && /SUSPENSION/i.test(res[0].product.category||''), 'ANTANIL SUS with pack 200ml is the suspension (200 mg+125 mg)/5 ml');
  check(res[1].status==='match' && /TAB/i.test(res[1].product.category||''), 'ANTANIL TAB is the tablet');
  const tm=matchRows(index,[{name:'27 OINTMENT TOMYCIN-EYE- 0.3%', pack:'3gm'}],{})[0]; show('27 OINTMENT TOMYCIN-EYE- 0.3% / 3gm',tm);
  check(tm.status==='match' && /^TOMYCIN$/i.test(tm.product.name) && /3\s*GM/i.test(tm.product.strength||''), 'TOMYCIN eye ointment 0.3 % with pack 3gm is the 3 GM eye ointment');
  const ly=matchRows(index,[{name:'18LYFLOX EYEDROPS', pack:'Sml'},{name:'18LYFLOX EYE DROPS', pack:'5ml'}],{}); ly.forEach((m,i)=>show(['18LYFLOX EYEDROPS / Sml','18LYFLOX EYE DROPS / 5ml'][i],m));
  check(ly.every(m=>m.status==='match' && /^LYFLOX$/i.test(m.product.name) && /5\s*ML/i.test(m.product.strength||'')), 'LYFLOX EYEDROPS with the pack read as Sml is the 5 ML drop');
  const pl=parseName('18LYFLOX EYEDROPS','Sml',{serial:true}); check(pl.form==='DROPS' && pl.brand.join('')==='LYFLOX' && pl.strength.some(x=>x.v===5&&x.u==='ML'), 'EYEDROPS is EYE + DROPS, Sml is 5 ML');
  const cl=matchRows(index,[{name:'6 CLORAMEYE DROPS', pack:'10ml'},{name:'CLORAM EYE DROPS', pack:'5ml'}],{}); cl.forEach((m,i)=>show(['6 CLORAMEYE DROPS / 10ml','CLORAM EYE DROPS / 5ml'][i],m));
  check(cl[0].status==='match' && /^CLORAM$/i.test(cl[0].product.name) && /10\s*ML/i.test(cl[0].product.strength||''), 'CLORAMEYE DROPS with pack 10ml is CLORAM Eye Drop 10 ML (EYE glued to the brand)');
  check(cl[1].product && /^CLORAM(-D)?$/i.test(cl[1].product.name) && /5\s*ML/i.test(cl[1].product.strength||''), 'CLORAM EYE DROPS with pack 5ml takes a 5 ML drop');
  const iso=matchRows(index,[{name:'15ISOLONEYEDROP-1%', pack:'5ml'}],{})[0]; show('15ISOLONEYEDROP-1% / 5ml',iso);
  check(iso.status==='match' && /^ISOLON/i.test(iso.product.name), 'ISOLONEYEDROP-1% is ISOLON EYE DROP-1% 5ML (two words glued to the brand)');
  const zif=matchRows(index,[{name:"Zif Cl Cap 60's"}],{})[0]; show("Zif Cl Cap 60's",zif);
  check(zif.status==='match' && /^ZIF[ -]CI$/i.test(zif.product.name), "Zif Cl Cap (an l for the I) is ZIF CI Cap");
  const zox=matchRows(index,[{name:'Zox Susp 30ml'}],{})[0]; show('Zox Susp 30ml',zox);
  check(zox.status==='match' && /^ZOX 30 ml POWDER$/i.test(zox.product.name), 'Zox Susp 30ml is the ZOX 30 ml powder for suspension');
  const toco=matchRows(index,[{name:"Toco Soft Gel Cap 30's"}],{})[0]; show("Toco Soft Gel Cap 30's",toco);
  check(toco.status==='match' && /^TOCO SOFT$/i.test(toco.product.name), 'Toco Soft Gel Cap is the TOCO SOFT capsule (a soft gel capsule is a capsule)');
  check(parseName("Toco Soft Gel Cap 30's").packCount===30 && parseName("Alatrol Tab 15X10'S").packCount===150, 'pack counts: 30, 15X10 = 150');
  const tg=matchRows(index,[{name:'Togent Crm 10g'},{name:'21FUNGIN CREAM', pack:'10gm'}],{}); tg.forEach((m,i)=>show(['Togent Crm 10g','21FUNGIN CREAM / 10gm'][i],m));
  check(tg[0].status==='match' && /^TOGENT$/i.test(tg[0].product.name), 'Togent Crm 10g is the Togent cream (10 g is the tube, not a dose)');
  check(tg[1].status==='match' && /^FUNGIN$/i.test(tg[1].product.name), 'FUNGIN CREAM with pack 10gm is the 10 GM tube');
  const tu=matchRows(index,[{name:'Tusca Plus Syp 100ml'}],{})[0]; show('Tusca Plus Syp 100ml',tu);
  check(tu.status==='match' && /^TUSCA PLUS$/i.test(tu.product.name), 'Tusca Plus Syp 100ml is the Tusca Plus syrup (100 ml is the bottle beside a per-5-ml strength)');
  const oro=[{name:'Orostar Coal Mint M-Wash', pack:'120ml'},{name:'Orostar Plus M-Wash 120ml'},{name:'Orostar Plus M-Wash 250ml'}];
  const orr=matchRows(index,oro,{}); orr.forEach((m,i)=>show(oro[i].name+(oro[i].pack?' / '+oro[i].pack:''),m));
  check(orr[0].status==='match' && /COOL MINT/i.test(orr[0].product.name), 'Orostar Coal Mint M-Wash is OROSTAR COOL MINT 120 ML mouth wash');
  check(orr[1].status==='match' && /^OROSTAR PLUS 120 ML$/i.test(orr[1].product.name), 'Orostar Plus M-Wash 120ml is the 120 ml bottle');
  check(orr[2].status==='match' && /^OROSTAR PLUS$/i.test(orr[2].product.name) && /250/.test(orr[2].product.strength||''), 'Orostar Plus M-Wash 250ml is the 250 ml bottle');
  const mv=matchRows(index,[{name:"Multivit Plus Tab 30's"}],{})[0]; show("Multivit Plus Tab 30's",mv);
  check(mv.status==='match' && /^Multivit PLUS POT 30$/i.test(mv.product.name), "Multivit Plus Tab 30's is Multivit PLUS POT 30 (POT 30 is a pot of 30, not a strength)");
  const pm=parseName('Multivit PLUS POT 30'); check(pm.brand.join(' ')==='MULTIVIT PLUS' && pm.strength.length===0 && pm.packCount===30, 'POT 30 parses as a pack of 30');
  const mx=matchRows(index,[{name:'Moxaclav Forte PFS 50ml'}],{})[0]; show('Moxaclav Forte PFS 50ml',mx);
  check(mx.status==='match' && /^Moxaclav Forte$/i.test(mx.product.name) && /suspension/i.test(mx.product.category||''), 'Moxaclav Forte PFS is the powder for suspension');
  const mg=matchRows(index,[{name:"Maganta Plus Tab 100's T"}],{})[0]; show("Maganta Plus Tab 100's T",mg);
  check(mg.status==='match' && /^Maganta Plus$/i.test(mg.product.name) && /TABLET/i.test(mg.product.category||''), "Maganta Plus Tab 100's T is the chewable tablet (the stray T is dropped, 100's is the pack of 100)");
  check(parseName('Bactin D Eye Drop').brand.join(' ')==='BACTIN D' && parseName("Zif Cl Cap 60's").brand.join(' ')==='ZIF CL', 'a one-letter qualifier before the form stays');
  const cz=matchRows(index,[{name:'CEFAZIDIV/IM 250MG INJ', pack:'VIAL'},{name:'Cefazid iv/im 250mg'}],{}); cz.forEach((m,i)=>show(['CEFAZIDIV/IM 250MG INJ / VIAL','Cefazid iv/im 250mg'][i],m));
  check(cz.every(m=>m.status==='match' && /^Cefazid iv\/im$/i.test(m.product.name) && /250/.test(m.product.strength||'')), 'CEFAZIDIV/IM 250MG INJ is Cefazid iv/im 250mg Injection (the route glued to the brand)');
  const eg=matchRows(index,[{name:"E-GELCAP200MG10X10'S", pack:'100S'},{name:"E-GEL CAP 200MG 10X10'S"}],{}); eg.forEach((m,i)=>show(["E-GELCAP200MG10X10'S / 100S","E-GEL CAP 200MG 10X10'S"][i],m));
  check(eg.every(m=>m.status==='match' && /^E-GEL 200GM$/i.test(m.product.name)), "E-GELCAP200MG10X10'S is E-GEL 200GM capsule (GEL kept in the brand, CAP cut off, 200GM read as 200 mg)");
  const pe=parseName("E-GELCAP200MG10X10'S"); check(pe.brand.join(' ')==='E GEL' && pe.form==='CAPSULE' && pe.strength[0].v===200, 'E-GELCAP parses as E GEL + capsule + 200 mg');
  const ds=matchRows(index,[{name:"E-GEL DSCAP 400MG 5X10'S", pack:'50S'}],{})[0]; show("E-GEL DSCAP 400MG 5X10'S / 50S",ds);
  check(ds.status==='match' && /^E-GEL DS$/i.test(ds.product.name) && /400/.test(ds.product.strength||''), 'E-GEL DSCAP 400MG is E-GEL DS 400 MG capsule (CAP cut off the DS)');
  const fx=matchRows(index,[{name:'Fexo Susp 5Oml'},{name:'Fexo Susp 5 Oml'}],{}); fx.forEach((m,i)=>show(['Fexo Susp 5Oml','Fexo Susp 5 Oml'][i],m));
  check(fx.every(m=>m.status==='match' && /^FEXO/i.test(m.product.name) && /50/.test((m.product.name+' '+(m.product.strength||''))) ), 'Fexo Susp 5Oml (and 5 Oml) is the Fexo 50 ml suspension');
  const fl=matchRows(index,[{name:'Flacol P-Drop 15ml'},{name:'Flacol PD Drops', pack:'15ml'},{name:'Lytex P/D 15ml'}],{}); fl.forEach((m,i)=>show(['Flacol P-Drop 15ml','Flacol PD Drops / 15ml','Lytex P/D 15ml'][i],m));
  check(fl[0].status==='match' && /PEDIATRIC DROP/i.test(fl[0].product.name) && fl[1].status==='match' && /PEDIATRIC DROP/i.test(fl[1].product.name), 'Flacol P-Drop / PD Drops is FLACOL PEDIATRIC DROP 15ML (P-Drop: paediatric drops)');
  check(fl[2].product && /^LYTEX/i.test(fl[2].product.name) && /drop/i.test(fl[2].product.name+' '+(fl[2].product.category||'')), 'Lytex P/D is a Lytex drop');
  check((segmentToken(index,'FILWELTEEN')||[]).join(' ')==='FILWEL TEEN' && (segmentToken(index,'HRTAB')||[]).join(' ')==='HR TAB' && segmentToken(index,'SECLO')===null, 'run-together words are cut into vocabulary words ('+(segmentToken(index,'FILWELTEEN')||[]).join('+')+', '+(segmentToken(index,'HRTAB')||[]).join('+')+')');
  const fw=matchRows(index,[{name:"FilwelTeen hrTab 30's"},{name:"FILWELTEEN HRTAB 30'S"},{name:"Filwel Teen hr Tab 30's"}],{}); fw.forEach((m,i)=>show(["FilwelTeen hrTab 30's","FILWELTEEN HRTAB 30'S","Filwel Teen hr Tab 30's"][i],m));
  check(fw.every(m=>m.status==='match' && /^FILWEL TEEN HR$/i.test(m.product.name)), "FilwelTeen hrTab, run together, is FILWEL TEEN HR like the spaced reading");
  const hb=matchRows(index,[{name:'Halobet O.05%Crm 20g', tp:111.25},{name:'Halobet 0.05% Crm 20g'}],{}); hb.forEach((m,i)=>show(['Halobet O.05%Crm 20g / tp 111.25','Halobet 0.05% Crm 20g'][i],m));
  check(hb.every(m=>m.status==='match' && /^Halobet$/i.test(m.product.name) && /CREAM/i.test(m.product.category||'')), 'Halobet O.05%Crm (an O for the zero, the form glued to the %) is the Halobet 0.05% cream');
  check(hb[0].price && hb[0].price.differs===false, 'and its TP agrees with the price on file');
  const ip=matchRows(index,[{name:'Iprex Resp Saln 20ml'},{name:'Iprex Resp Soln 20ml'}],{}); ip.forEach((m,i)=>show(['Iprex Resp Saln 20ml','Iprex Resp Soln 20ml'][i],m));
  check(ip.every(m=>m.status==='match' && /^IPREX RESPIROTY SOLUTION$/i.test(m.product.name)), 'Iprex Resp Saln 20ml (Saln for Soln, Resp for respiratory) is IPREX RESPIROTY SOLUTION 20ML');
  check(parseName('Iprex Resp Saln 20ml').form==='SOLUTION' && parseName('Napa Crean').form==='CREAM' && parseName('Zolax').form===null, 'a form word one letter off is the form; a brand is not');
  const al=matchRows(index,[{name:'Alacot DS E-Drop 5ml'},{name:'Alacot DS Eye Drop 5ml'}],{}); al.forEach((m,i)=>show(['Alacot DS E-Drop 5ml','Alacot DS Eye Drop 5ml'][i],m));
  check(al.every(m=>m.status==='match' && /^ALACOT DS$/i.test(m.product.name) && /5\s*ML/i.test(m.product.strength||'')), 'Alacot DS E-Drop 5ml is ALACOT DS 5 ML Eye Drop (E-Drop: eye drops)');
  const ap=matchRows(index,[{name:'Apsol O-Paste 5g'}],{})[0]; show('Apsol O-Paste 5g',ap);
  check(ap.status==='match' && /^APSOL$/i.test(ap.product.name) && /paste/i.test(ap.product.category||''), 'Apsol O-Paste 5g is the APSOL oral paste (O-Paste: oral paste)');
  const st=parseName('(200 mg+125 mg)/5 ml'); check(st.brand.length===0 && st.strength.length===2, '"/5 ml" is neither a strength nor a brand word');
}

console.log('[3d] the popup search: the matches first, then every product holding the words');
{
  const r=searchProducts(index,'seclo 20',300);
  check(r.length>0 && r[0].by==='match' && /SECLO/i.test(r[0].product.name), 'seclo 20: a SECLO match on top ('+(r[0]&&r[0].product.name)+')');
  check(r.every(it=>/SECLO|OMEPRAZOLE|20/i.test(it.product.name+' '+(it.product.generic||'')+' '+(it.product.strength||''))||it.by==='match'), 'every listed product holds the words or is a match');
  const t=searchProducts(index,'square',300); check(t.length>10 && t.every(it=>it.by!=='match' || it.score>0), 'a manufacturer name lists its products');
  check(searchProducts(index,'',50).length===50, 'an empty search lists the first products');
  const pr=priceOf(r[0].product, 7); check(pr && typeof pr.differs==='boolean', 'priceOf compares a TP with the product on file');
  const p0=r[0].product, pc=priceOf(p0, Math.round(p0.purchasePrice*40*100)/100, 40); check(pc && pc.expected===Math.round(p0.purchasePrice*40*10000)/10000 && pc.differs===false && pc.invoiceConversion===40, "with the invoice's conversion: UnitConversion × UnitPurchasePrice is the unit TP (40 × "+p0.purchasePrice+')');
}

console.log('[4] price comparison');
{
  const m=matchRows(index,[{name:'SECLO 20MG Cap', tp:7}],{})[0];
  check(m.price && typeof m.price.differs==='boolean', 'price comparison reported');
  console.log('    price', JSON.stringify(m.price));
}

console.log('[4b] a pack count before the form word, FC / BD dropped, the retry on the other readings');
{
  const pb=parseName('BINOCLAR 500MG 14FCT BD'); check(pb.brand.join(' ')==='BINOCLAR' && pb.packCount===14 && pb.form==='TABLET' && pb.strength.length===1 && pb.strength[0].v===500, 'BINOCLAR 500MG 14FCT BD → brand BINOCLAR, 500 MG, tablet, pack 14 ('+JSON.stringify(pb)+')');
  const b=matchItem(index,{name:'BINOCLAR 500MG 14FCT BD'}); show('BINOCLAR 500MG 14FCT BD',b); check(b.status==='match' && /BINOCLAR/i.test(b.product.name) && /500/.test(b.product.strength||''), 'BINOCLAR 500MG 14FCT BD → BINOCLAR 500 MG');
  const x=matchItem(index,{name:'XIONIL 3MG 50TAB BD'}); show('XIONIL 3MG 50TAB BD',x); check(x.status==='match' && /XIONIL/i.test(x.product.name), 'XIONIL 3MG 50TAB BD → XIONIL');
  const sc=parseName('Seclo 20 Cap'); check(sc.strength.length===1 && sc.strength[0].v===20 && sc.packCount===0, 'Seclo 20 Cap: the 20 is still the strength (no strength with a unit before it)');
  const pc=parseName('NAPA 50 PCS'); check(pc.packCount===50 && pc.strength.length===0, 'NAPA 50 PCS: a count before a container word is the pack');
  const a=matchItem(index,{name:'Acos FC Tab 500mg (6s)'}); show('Acos FC Tab 500mg (6s)',a); check(a.product && /ACOS/i.test(a.product.name) && a.score>0.76, 'Acos FC Tab 500mg: FC dropped, the score rises above the old 0.76');
  const cx=parseName('Coralcal-DX FC Tab 600mg/400IU(50s)'); check(cx.brand.join(' ')==='CORALCAL DX' && cx.strength.length===2 && cx.strength[0].v===600 && cx.strength[0].u==='MG' && cx.strength[1].v===400 && cx.strength[1].u==='IU' && cx.packCount===50, 'Coralcal-DX FC Tab 600mg/400IU(50s) → CORALCAL DX, 600 MG + 400 IU, pack 50 ('+JSON.stringify(cx)+')');
  const cdx=matchItem(index,{name:'Coralcal-DX FC Tab 600mg/400IU(50s)'}); show('Coralcal-DX FC Tab 600mg/400IU(50s)',cdx); check(cdx.status==='match' && /CORALCAL.?DX/i.test(cdx.product.name), 'Coralcal-DX FC Tab 600mg/400IU(50s) → CORALCAL DX 600/400IU');
  const cd=matchItem(index,{name:'Coralcal-D FC Tab 500mg/200IU (60s)'}); show('Coralcal-D FC Tab 500mg/200IU (60s)',cd); check(cd.status==='match' && /CORALCAL.?D\b/i.test(cd.product.name) && /500/.test(cd.product.strength||''), 'Coralcal-D FC Tab 500mg/200IU (60s) → CORALCAL D 500MG/200IU');
  const tp=parseName('Aeron Flash Tablet 5mg 1X3X10'); check(tp.packs.length===1 && tp.packCount===30 && tp.strength.length===1 && tp.strength[0].v===5, '1X3X10 beside the name: one pack of 30 (pieces × per strip × strips), not a strength ('+JSON.stringify(tp)+')');
  for(const [n,v] of [['Napa Tab 6X2',12],['Seclo Cap 20X7',140],['Ace 500mg 10X5',50]]){ const pp=parseName(n); check(pp.packCount===v && !pp.strength.some(s=>s.v===v), n+': pack '+pp.packCount+' (two parts, no S), not a strength'); }
  const ab=parseName('OLMEDIP 5/40 MG'); check(ab.strength.length===2 && ab.strength[0].v===5 && ab.strength[0].u==='' && ab.strength[1].v===40 && ab.strength[1].u==='MG', '5/40 MG: the unit on the second figure, the first without one');
  // an ACME line: a four-digit product code in front, no strength, the descriptor NASAL; the invoice TP is the purchase price on file
  const pf=parseName('1018 FLUTICON NASAL SPRAY','',{serial:true}); check(pf.brand.join(' ')==='FLUTICON' && pf.strength.length===0 && pf.form==='SPRAY' && pf.descriptors.join()==='NASAL', '1018 FLUTICON NASAL SPRAY: the code stripped, brand FLUTICON, spray, descriptor NASAL ('+JSON.stringify(pf)+')');
  const fl=matchItem(index,{name:'1018 FLUTICON NASAL SPRAY', pack:"1x1's", tp:187.98},{manufacturer:'The ACME Laboratories Ltd'}); show('1018 FLUTICON NASAL SPRAY / TP 187.98',fl);
  check(fl.status==='match' && /^Fluticon$/i.test(fl.product.name) && /NASAL/i.test(fl.product.category||''), 'Fluticon 50 mcg/spray NASAL SPRAY, not FLUTICA NASAL of another company');
  const fl2=matchItem(index,{name:'1018 FLUTICON NASAL SPRAY'},{}); show('1018 FLUTICON NASAL SPRAY (no TP)',fl2);
  check(fl2.product && /^Fluticon$/i.test(fl2.product.name) && /NASAL/i.test(fl2.product.category||''), 'without the TP the Fluticon listing whose category says NASAL still comes first');
  // a tube's size is its identity: the list files CLOTRIM 20GM and CLOTRIM "10MG" (a 10 g tube) creams — a 5 g tube is neither
  const cl5=matchItem(index,{name:'1002 CLOTRIM 5GM'},{}); show('1002 CLOTRIM 5GM',cl5);
  check(cl5.status==='none' && !cl5.product, 'CLOTRIM 5GM matches neither the 10 g nor the 20 g tube: no match');
  const cl10=matchItem(index,{name:'1002 CLOTRIM CREAM 10GM'},{}); show('1002 CLOTRIM CREAM 10GM',cl10);
  check(cl10.status==='match' && /^CLOTRIM$/i.test(cl10.product.name) && /10/.test(cl10.product.strength||''), 'CLOTRIM CREAM 10GM is the tube filed as 10MG');
  const cl20=matchItem(index,{name:'1002 CLOTRIM 20GM'},{}); show('1002 CLOTRIM 20GM',cl20);
  check(cl20.status==='match' && /20/.test(cl20.product.strength||''), 'CLOTRIM 20GM is the 20 g tube');
  // the brand is in the list, spelled so, but not in this size: a similar brand of another company must not step in
  const ac=matchItem(index,{name:'1011 ACLOBET 10GM'},{manufacturer:'The ACME Laboratories Ltd'}); show('1011 ACLOBET 10GM',ac);
  check(!ac.product || /^ACLOBET/i.test(ac.product.name), 'ACLOBET 10GM never takes NYCLOBET ('+(ac.product?ac.product.name:'no product')+')');
  check(ac.status!=='match', 'no 10 g ACLOBET on the list: not a match');
  const ac30=matchItem(index,{name:'1011 ACLOBET 30GM'},{}); show('1011 ACLOBET 30GM',ac30);
  check(ac30.status==='match' && /^ACLOBET 30GM$/i.test(ac30.product.name), 'ACLOBET 30GM is the 30 g ointment');
  const ocr=matchItem(index,{name:'SECL0 20MG CAP'},{}); check(ocr.status==='match' && /^SECLO/i.test(ocr.product.name), 'an OCR slip in the brand (SECL0) still matches when no exact brand competes');
  // ACME's TRIZON lines: the route (IM / IV) told apart, an injection's grams as its dose, the list's "250 GM" as 250 mg
  const tz=[['1017 TRIZON-IV 1G',/^TRIZON 1 GM IV$/i],['1018 TRIZON-IM 250MG',/^TRIZON 250GM$/i],['1019 TRIZON-IM500MG',/^TRIZON 500 GM IM$/i],['1020 TRIZON-IM 1G',/^TRIZON 1 GM IM$/i],['1028 TRIZONIV 2GM',/^TRIZON(-IV INJ)? 2 GM( IV)?$/i]];
  for(const [q,want] of tz){ const m=matchItem(index,{name:q},{manufacturer:'The ACME Laboratories Ltd'}); show(q,m); check(m.status==='match' && want.test(m.product.name), q+' → '+want.source.replace(/[\^$]/g,'')+' ('+(m.product?m.product.name:'none')+' '+m.status+')'); }
  const pt=parseName('1019 TRIZON-IM500MG','',{serial:true}); check(pt.brand.join(' ')==='TRIZON' && pt.route.join()==='IM' && pt.form==='INJECTION' && pt.strength.length===1 && pt.strength[0].v===500 && !pt.strength[0].size, 'TRIZON-IM500MG: brand TRIZON, route IM, injection, 500 mg dose ('+JSON.stringify(pt)+')');
  const pg=parseName('TRIZON-IV 1G'); check(pg.strength[0].v===1000 && !pg.strength[0].size && pg.route.join()==='IV', 'TRIZON-IV 1G: a 1000 mg dose, route IV');
  // the retry: the chosen text is garbage, the other engines read the line right
  const r=matchRows(index,[{name:'XXXXXXX ZZZ', alts:[{by:'EasyOCR', text:'BINOCLAR 500MG 14FCT BD'},{by:'Tesseract 5', text:'BINOCLAR 500 MG 14FCT BD'}]}],{})[0]; show('retry from EasyOCR / Tesseract 5',r);
  check(r.status==='match' && /BINOCLAR/i.test(r.product.name) && r.retry && r.retry.by.join(',')==='EasyOCR,Tesseract 5' && r.retry.was==='XXXXXXX ZZZ' && r.retry.text==='BINOCLAR 500MG 14FCT BD', 'a no-match text is retried on the other readings; their agreed product stands, marked with the readings it came from');
  const d=matchRows(index,[{name:'XXXXXXX ZZZ', alts:[{by:'EasyOCR', text:'SECLO 20MG CAP'},{by:'Tesseract 5', text:'NAPA 500MG TAB'}]}],{})[0];
  check(d.status==='none' && !d.product && d.retry && d.retry.disagree && d.retry.disagree.length===2, 'two readings matching different products: still no match, the disagreement noted');
  const u=matchRows(index,[{name:'SECLO 20MG CAP', alts:[{by:'EasyOCR', text:'NAPA 500MG TAB'}]}],{})[0];
  check(u.status==='match' && /SECLO/i.test(u.product.name) && !u.retry, 'a text that matches is never retried');
  const n=matchRows(index,[{name:'XXXXXXX ZZZ', alts:[{by:'EasyOCR', text:'QQQQQQ WWW'},{by:'local', text:'XXXXXXX ZZZ'}]}],{})[0];
  check(n.status==='none' && !n.retry, 'readings that match nothing either: no match, nothing noted');
}

console.log('[4c] a unit per vial, puff, sachet in the list’s strength field');
{ const pv=parseName('1 gm/vial'); check(pv.strength.length===1 && pv.strength[0].v===1000 && pv.strength[0].u==='MG', '"1 gm/vial" is one gram ('+JSON.stringify(pv.strength)+')');
  const pm=parseName('500 mg/vial'); check(pm.strength.length===1 && pm.strength[0].v===500 && pm.strength[0].u==='MG', '"500 mg/vial" is 500 mg with its unit');
  const pp=parseName('250 mcg/puff'); check(pp.strength[0].v===250 && pp.strength[0].u==='MCG', '"250 mcg/puff" is 250 mcg');
  const pi=parseName('40 IU/ml'); check(pi.strength[0].v===40 && pi.strength[0].u==='IU', '"40 IU/ml" is 40 IU');
  const neo=matchRows(index,[{name:'Neopenem IV Injection 1gm'},{name:'1023 Neopenem IV Injection 1gm'},{name:'Neopenem IV Inj 500mg'},{name:'Neopenem 250mg IV'}],{}); neo.forEach((m,i)=>show(['Neopenem IV Injection 1gm','1023 Neopenem IV Injection 1gm','Neopenem IV Inj 500mg','Neopenem 250mg IV'][i],m));
  check(neo[0].status==='match' && neo[0].product.name==='Neopenem' && /1 gm/.test(neo[0].product.strength), 'Neopenem IV Injection 1gm → Neopenem 1 gm/vial IV Injection or Infusion');
  check(neo[1].status==='match' && /1 gm/.test(neo[1].product.strength), 'the same line behind its serial number');
  check(neo[2].status==='match' && /500 mg/.test(neo[2].product.strength) && neo[3].status==='match' && /250/.test(neo[3].product.strength), 'the 500 mg and 250 mg vials each to their own listing'); }
console.log('[4d] a qualifier hyphenated to the form word: every part of the line is in the list');
{ const pa=parseName('Angivent MR-Tab'); check(pa.brand.join(' ')==='ANGIVENT MR' && pa.form==='TABLET', '"Angivent MR-Tab" → brand ANGIVENT MR, form TABLET ('+JSON.stringify([pa.brand,pa.form])+')');
  const pe=parseName('E-Cap 200mg'); check(pe.brand.join(' ')==='E CAP' && pe.strength[0].v===200, '"E-Cap 200mg" still keeps CAP as the brand’s second half');
  const an=matchRows(index,[{name:'Angivent MR-Tab'},{name:"12 Angivent MR-Tab 30's"}],{}); an.forEach((m,i)=>show(['Angivent MR-Tab',"12 Angivent MR-Tab 30's"][i],m));
  check(an[0].status==='match' && an[0].product.name==='ANGIVENT MR' && an[1].status==='match', 'Angivent MR-Tab → ANGIVENT MR 35 MG TABLET, with and without serial and pack'); }
console.log('[4e] a nasal spray by its count of sprays');
{ const pa=parseName('Antazol Plus N-Spray 1 20 sprays'); check(pa.brand.join(' ')==='ANTAZOL PLUS' && pa.form==='SPRAY' && pa.strength.length===1 && pa.strength[0].v===120 && pa.strength[0].u==='PUFF' && pa.descriptors.includes('NASAL'), '"Antazol Plus N-Spray 1 20 sprays" → ANTAZOL PLUS, nasal, spray, 120 puffs ('+JSON.stringify([pa.brand,pa.form,pa.strength,pa.descriptors])+')');
  const pd=parseName('120P'); check(pd.strength.length===1 && pd.strength[0].v===120 && pd.strength[0].u==='PUFF' && !pd.brand.length, 'the list\'s "120P" is 120 puffs');
  const pn=parseName('ANTAZOL PLUS N-SPRAY'); check(pn.brand.join(' ')==='ANTAZOL PLUS' && pn.form==='SPRAY', 'the list\'s name parses the same way');
  const an=matchRows(index,[{name:'Antazol Plus N-Spray 1 20 sprays'},{name:'15 Antazol Plus N-Spray 120 sprays'},{name:'Antazol 0.05% N-Drops 15ML'}],{}); an.forEach((m,i)=>show(['Antazol Plus N-Spray 1 20 sprays','15 Antazol Plus N-Spray 120 sprays','Antazol 0.05% N-Drops 15ML'][i],m));
  check(an[0].status==='match' && an[0].product.name==='ANTAZOL PLUS N-SPRAY' && an[1].status==='match' && an[1].product.name==='ANTAZOL PLUS N-SPRAY', 'Antazol Plus N-Spray, with the count split by a space or not → ANTAZOL PLUS N-SPRAY 120P NASAL SPRAY');
  check(an[2].status==='match' && /0\.05/.test(an[2].product.name+' '+an[2].product.strength), 'the 0.05 % nasal drops still go to their own listing');
  const bec=parseName('Beclomin 100 HFA MDI 200puff'); check(bec.strength.some(s=>s.v===200 && s.u==='PUFF') && bec.form==='INHALER' && !bec.brand.includes('PUFF'), '"200puff" on an inhaler is 200 puffs, not a brand word'); }
console.log('[5] speed');
{
  const names=index.items.slice(0,300).map(it=>({name:it.name}));
  const t=performance.now(); matchRows(index,names,{}); const ms=performance.now()-t;
  console.log(`    300 queries in ${ms.toFixed(0)} ms (${(ms/300).toFixed(2)} ms each)`);
  check(ms/300<15, 'under 15 ms per line');
}

console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED');
process.exit(failures?1:0);
