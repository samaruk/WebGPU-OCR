/* synthetic layouts (CPU, binary straight from the canvas) */
import { readParams } from '/caliper-modular/js/pipeline/pipeline.js';
import { analyseTextLines } from '/caliper-modular/js/textlines/textlines.js';
import { detectColumns } from '/caliper-modular/js/columns/columns.js';
import { dilateCPU } from '/caliper-modular/js/morph/morph.js';

function canvasOf(W,H,draw){ const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const c=cv.getContext('2d',{willReadFrequently:true}); c.fillStyle='#fff'; c.fillRect(0,0,W,H); c.fillStyle='#000'; c.textBaseline='top'; draw(c,(t,x,y)=>c.fillText(t,x,y)); return cv; }
export function runSynthetic(cv,opts={}){
  const p=readParams(); const W=cv.width,H=cv.height; const d=cv.getContext('2d').getImageData(0,0,W,H).data;
  const raw=new Uint8Array(W*H); for(let i=0;i<W*H;i++) raw[i]=d[i*4]<128?1:0;
  const TL=analyseTextLines(raw,dilateCPU(raw,W,H,1,1),W,H,p);
  const limits=opts.footerRows? {footerRows:opts.footerRows(TL)} : null;
  return {TL, C:detectColumns(TL,p.columns,null,limits)};
}
export function synthAcme(drift=0){ return canvasOf(1500,2000,(c,put)=>{ c.font='22px Arial';
  put('The ACME Laboratories Ltd.',470,150); put('CUSTOMER COPY',1150,140);
  put('Corporate Office : Court de la ACME, 1/4, Kallayanpur, Mirpur Road, Dhaka-1207',190,195);
  put('Tel : 88-02-8091051-3, Fax : 88-02-9016515, E-mail: headoffice@acmeglobal.com',370,230);
  put('INVOICE',690,285); put('Page No.  7 of 10',1090,265);
  put('Outstanding',80,320); put('No of due bill : 1 and due Amt. 67619.83',260,320); put('Division',805,320); put('Human Medicine',975,320); put('Credit',1210,320);
  const kv=[['Order Mode','Credit','MPO Name','Mo. Shahidul Islam (05p48)'],['Client Name','Lazz Pharma Ltd. (002)','MPO Base','BASE : RAJBARI'],['Client Address','Boropul','Bill No.','1196619'],['Sales Center','Faridpur (25)','Bill Dt.','12/02/22'],['District','Rajbari (46)','Category','WHOLE SALE-MUNICIPAL'],['Thana','Rajbari Town (05)','Order No.','320092'],['Micro Union','Rotan Clinic (059)','SR Name','Mohammad Shahjahan Ali (02J56)']];
  kv.forEach((r,i)=>{ const y=355+i*34; put(r[0],80,y); put(r[1],260,y); put(r[2],805,y); put(r[3],975,y); if(i===3){ put('Delivery Dt.',1140,y); put('12/02/22',1260,y);} if(i===5){ put('Order Dt.',1140,y); put('12/02/22',1260,y);} });
  put('Pack',490,605); put('Batch',585,605); put('Per pack',745,605); put('Value',960,605); put('Discount',1140,605); put('Net',1295,605);
  put('Category & Product Name',75,622); put('Size.',490,630); put('No.',585,630); put('Qty',675,622); put('Trade',740,630); put('VAT',830,630); put('Trade',915,630); put('VAT',1050,630); put('%',1140,630); put('Value',1190,630); put('Value',1290,630);
  put('NORMAL ITEM',75,665);
  const items=[['1306','ELODEP 5MG',"3X10'S",'T3061012','1','124.20','21.60','124.20','21.60','3','3.73','142.07'],['1307','ELODEP 10MG',"3x10's",'T3071008','1','225.60','39.30','225.60','39.30','3','6.77','258.13'],['1312','ORBAS PLUS 20/12.5',"3X10'S",'T3121006','1','180.60','31.50','180.60','31.50','3','5.42','206.68'],['1316','GLICLID MR 30MG',"3 x 10'S",'T3161007','1','135.30','23.40','135.30','23.40','3','4.06','154.64'],['1321','ARTH-A MAX',"3x10's",'T3211017','1','270.60','47.10','270.60','47.10','3','8.12','309.58'],['1322','LOSART 50 (50 PCS)',"5x10'S",'T3221060','1','301.00','52.50','301.00','52.50','3','9.03','344.47'],['1323','AMLOTEN 50 (50 PCS)',"5x10's",'T3232001','1','225.50','39.00','225.50','39.00','3','6.76','257.74'],['1327','AZIN 500 (12 PCS)',"2x6's",'T3271074','1','315.84','54.96','315.84','54.96','3','9.48','361.32'],['1333','DEFROL',"3x10's",'T3331009','1','45.00','7.80','45.00','7.80','3','1.35','51.45'],['1334','LIMBIX',"5X10's",'T3342005','3','281.00','49.00','843.00','147.00','3','25.29','964.71'],['1336','SEVEL 800MG',"2x6's",'T3361018','1','539.76','93.96','539.76','93.96','3','16.19','617.53'],['1337','JANMET 500 (30PCS)',"3x10's",'T3371066','1','360.60','62.70','360.60','62.70','3','10.82','412.48'],['1360','RABIZOL 20MG (140)',"10 x 14'S",'T3601017','1','526.40','91.00','526.40','91.00','3','15.79','601.61'],['1364','CORTIMAX 24MG',"2x10's",'T3641004','1','449.80','78.20','449.80','78.20','3','13.49','514.51'],['1365','PROTOCID 20MG (140 PCS)',"10 X 14'S",'T3651015','1','525.00','91.00','525.00','91.00','3','15.75','600.25'],['1381','MONAS 4 OFT',"3x10's",'T3812003','1','157.50','27.30','157.50','27.30','3','4.73','180.07']];
  const colX=[75,125,495,580,685,755,830,940,1060,1130,1200,1315];
  items.forEach((r,i)=>{ const y=725+i*30; r.forEach((t,j)=>put(t,colX[j],y+((drift&&i===12&&j<2)?drift:0))); });
  let y=725+items.length*30+150; put("Customer's Signature",55,y+55); put('Prepared By',630,y+55); put('Manager / Depot - in - charge',1115,y+45);
  y+=120; c.font='16px Arial'; put('WARRANTY : We do hereby give this warranty that the goods or classes of goods above described as sold by us, do not contravene in any way provisions of section of 18 of the Drugs Act, 1940.',120,y); put('Company is not responsible if payment is made Without money Receipt.',120,y+26); put("All orders shall be considered to have been accepted by the Head office. In case of litigation, etc. proceedings shall follow in areas under jurisdiction of the company's Dhaka Office.",120,y+52); }); }
export function synthTotals(){ return canvasOf(1200,760,(c,put)=>{ c.font='24px Arial';
  put('Outstanding',60,30); put('No of due bill : 1 and due Amt. 67619.83',260,30); put('Order Mode',60,60); put('Credit',260,60);
  put('Category & Product Name',60,110); put('Pack',480,110); put('Batch',560,110); put('Qty',680,110); put('Trade',740,110); put('VAT',860,110); put('Net Value',1000,110);
  const items=[['1493','EDEMIDE 40 TABLET','4x10','T4931003','1','300.80','52.40','344.18'],['1495','ANGRID MR TABLET','6x10','T4951003','1','261.00','45.60','298.77'],['1503','LOSART 50 PLUS','3x10','T5031005','1','301.00','52.50','344.47'],['1505','BETABIS PLUS 5','3x10','T5051004','1','225.00','39.30','257.55'],['1016','SALFLU 100 ROTACAP','3x10','H0161016','1','146.10','25.50','167.22'],['1017','SALFLU 250 ROTACAP','3x10','H0172001','2','270.00','47.10','618.00'],['1018','SALFLU 500 ROTACAP','3x10','H0181019','1','359.70','62.70','411.61'],['1059','ALOVERA 385MG','3x10','T0101016','1','207.00','9.00','300.79']];
  const colX=[60,130,480,560,680,740,860,1000];
  items.forEach((r,i)=>{ const y=150+i*34; r.forEach((t,j)=>put(t,colX[j],y)); });
  let y=150+items.length*34+10; put('Sub Total :',300,y); put('58,616.88',740,y); put('3,995.72',860,y); put('65,213.23',1000,y);
  y+=34; put('Grand Total :',300,y); put('60,763.48',740,y); put('10,213.72',860,y); put('67,619.83',1000,y);
  y+=34; put('Amount in Tk. : Sixty-Seven Thousand Six Hundred Nineteen And Paisa Eighty-Three Only',60,y);
  y+=60; put('Free Product :',60,y); y+=34; put('Product Code & Name',60,y); put('Batch No.',600,y); put('Bns Qty',760,y); put('Bonus Value',900,y);
  y+=34; put('09',60,y); put('1185 ZERO 8MG',130,y); put('T1852001',600,y); put('1.00',760,y); put('88.00',900,y);
  y+=80; put("Customer's Signature",60,y); put('Prepared By',560,y); put('Manager / Depot - in - charge',900,y); }); }
export const brief=(X)=>{ const B=X.C.band; return B?{band:B.first+'-'+B.last, rows:B.rows.length, cols:X.C.columns.length, foreign:B.foreignRows, merged:B.mergedRows, footerCut:B.footerCut, firstY:Math.round(B.rows[0].row.ink.y0), lastY:Math.round(B.rows[B.rows.length-1].row.ink.y0), kinds:X.C.rows.map(r=>r.kind[0]).join('')}:'no band'; };
