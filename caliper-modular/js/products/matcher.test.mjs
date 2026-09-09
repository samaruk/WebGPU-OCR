// node matcher.test.mjs — the product matcher against the real product list
import { PRODUCTS, PRODUCT_COLUMNS } from './products-data.js';
import { buildIndex, matchItem, matchRows, parseName, tokenSim } from './matcher.js';

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
  const st=parseName('(200 mg+125 mg)/5 ml'); check(st.brand.length===0 && st.strength.length===2, '"/5 ml" is neither a strength nor a brand word');
}

console.log('[4] price comparison');
{
  const m=matchRows(index,[{name:'SECLO 20MG Cap', tp:7}],{})[0];
  check(m.price && typeof m.price.differs==='boolean', 'price comparison reported');
  console.log('    price', JSON.stringify(m.price));
}

console.log('[5] speed');
{
  const names=index.items.slice(0,300).map(it=>({name:it.name}));
  const t=performance.now(); matchRows(index,names,{}); const ms=performance.now()-t;
  console.log(`    300 queries in ${ms.toFixed(0)} ms (${(ms/300).toFixed(2)} ms each)`);
  check(ms/300<15, 'under 15 ms per line');
}

console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED');
process.exit(failures?1:0);
