// node respace.test.mjs — the word gaps a reading lost
import { respace, spaceWords, spacesFrom } from './respace.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
console.log('[1] from the words themselves');
for(const [a,b] of [["E-GELCAP200MG10X10'S","E-GEL CAP 200MG 10X10'S"],['KETIFEN100ML','KETIFEN 100ML'],['X-COLD15MLDROPS','X-COLD 15ML DROPS'],['SALMOLIN-L60ML','SALMOLIN-L 60ML'],['FLATUNILPAEDIATRICDROPS15ML','FLATUNIL PAEDIATRIC DROPS 15ML'],['DERMUPIN10GM','DERMUPIN 10GM'],['VITAMIN B12','VITAMIN B12'],["10X10'S","10X10'S"],['L0361040','L0361040'],['1x15gm','1x15gm'],['SECLO 20MG Cap','SECLO 20MG Cap'],['62.50','62.50'],['E-GEL 200GM','E-GEL 200GM'],["E-GEL DSCAP 400MG 5X10'S","E-GEL DS CAP 400MG 5X10'S"],['NAPA SRTAB 665MG','NAPA SR TAB 665MG'],['ESCAPE','ESCAPE'],["Epitra0.5Tab 50's","Epitra 0.5 Tab 50's"],['Anzitor10Tablet','Anzitor 10 Tablet'],['Cef-3 200mg','Cef-3 200mg'],['Napa 500MGTab','Napa 500MG Tab'],['12mgm','12mgm'],["Eromycin DSTab 30's","Eromycin DS Tab 30's"],['Napa XRCap 10s','Napa XR Cap 10s'],['Fexo PlusTab','Fexo Plus Tab'],['Cef-3 ForteSusp 50ml','Cef-3 Forte Susp 50ml'],['Deltasone 10MGTAB 10X10S','Deltasone 10MG TAB 10X10S'],['Dermasol Oint 20g','Dermasol Oint 20g'],['Dermasol-N Crm 25g','Dermasol-N Crm 25g'],['Dermasol-SScalp Soln 25ml','Dermasol-S Scalp Soln 25ml'],['CORALTAB TABLET','CORALTAB TABLET'],['Gemitab 320 mg','Gemitab 320 mg'],['Fexosol Syp','Fexosol Syp'],['Coraltab-DX','Coraltab-DX'],['Fexo Susp 5Oml','Fexo Susp 50ml'],['Adovas Syp l00ml','Adovas Syp 100ml'],['Napa 5OOmg','Napa 500mg'],['Sml drops','Sml drops'],['Bactin D Eye Drop 5ml','Bactin D Eye Drop 5ml'],["FilwelTeen hrTab 30's","Filwel Teen hr Tab 30's"],['Napa Extend 665mg','Napa Extend 665mg'],['Halobet O.05%Crm 20g','Halobet 0.05% Crm 20g'],['Timolol 0.5%Eye Drop','Timolol 0.5% Eye Drop']])
  check(spaceWords(a)===b, JSON.stringify(a)+' → '+JSON.stringify(spaceWords(a))+(spaceWords(a)===b?'':' (wanted '+JSON.stringify(b)+')'));
console.log('[2] from another reading of the cell');
check(spacesFrom("E-GELCAP200MG10X10'S",["E-GEL CAP 200MG 10X10'S"])==="E-GEL CAP 200MG 10X10'S", 'the same reading with spaces gives its spaces');
check(spacesFrom("E-GELCAP200MG10X10'S",["E-GEL CAP 200MG"])==="E-GEL CAP 200MG10X10'S", 'a prefix reading gives the spaces it has');
check(spacesFrom('ACEMOX250MG',['COSIUM 10MG'])==='ACEMOX250MG', 'a different reading gives nothing');
check(respace("E-GELCAP200MG10X10'S",["E-GEL CAP 200MG"])==="E-GEL CAP 200MG 10X10'S", 'both together');
check(spacesFrom("Foli ta 5 Tab 30's",["Folita 5 Tab"])==="Folita 5 Tab 30's", 'a gap the donor does not have goes: Foli ta → Folita');
check(respace("Foli ta 5 Tab 30's",["Folita 5 Tab 30's"])==="Folita 5 Tab 30's", 'the same reading with the right gaps wins whole');
check(spacesFrom("Foli ta 5 Tab 30's",["Napa 500"])==="Foli ta 5 Tab 30's", 'an unrelated reading changes nothing');
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
