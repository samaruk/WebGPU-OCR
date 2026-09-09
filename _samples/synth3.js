/* synthetic Square (Tongi) page: Sl.No | Invoice No | Product Name | Batch | Qty | Pack Size | Unit (T.P) | Unit VAT | Total (T.P)
   with a two-line title; returns the canvas and every drawn title word with its box,
   so a recognition-shaped object can be built for the header-rule matcher */
export function synthSquareTongi(){
  const W=1500,H=2000; const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const c=cv.getContext('2d',{willReadFrequently:true}); c.fillStyle='#fff'; c.fillRect(0,0,W,H); c.fillStyle='#000'; c.textBaseline='top'; c.font='22px Arial';
  const words=[]; const put=(t,x,y,record)=>{ c.fillText(t,x,y); if(record){ const w=c.measureText(t).width; words.push({text:t,bb:{x0:x,y0:y,x1:x+w,y1:y+22}}); } };
  put('SQUARE PHARMACEUTICALS PLC.',420,60); put('Registered Office : "SQUARE CENTRE" 48, Mohakhali C/A, Dhaka-1212',300,100);
  put('Tongi Sales Office',600,140); put('INVOICE',680,230); put('Page : 1 of 2',1150,230);
  put('Customer',80,300); put(': 372824 - Lazz Pharma Ltd. - Z001',240,300); put('Printing Date',950,300); put(': 08.09.2026',1160,300);
  put('Address',80,334); put(': Hasan Mahmud Complex, Azampur, Kach ,',240,334); put('Invoice Date',950,334); put(': 08.09.2026',1160,334);
  put('Invoice No',80,368); put(': 872967985',240,368); put('Route',480,368); put(': Azampur',560,368); put('Delivery Date',950,368); put(': 08.09.2026 / M',1160,368);
  // two-line title
  const t1=[['Sl.No',72],['Invoice No',135],['Product Name',300],['Batch',690],['Qty',870],['Pack',950],['Unit',1085],['Unit',1200],['Total',1345]];
  const t2=[['Size',950],['(T.P)',1085],['VAT',1200],['(T.P)',1345]];
  for(const [t,x] of t1) put(t,x,440,true); for(const [t,x] of t2) put(t,x,470,true);
  c.fillRect(60,505,1400,2);
  const names=['Alatrol Tab 150\'s','Alice Lotion 60g','Arnodis 400 Tab 240\'s','Anleptic 200 CR-Tab 50\'s','Ansulin 50/50 100 Inj 10ml','B-9 O-Soln 100ml','Betameson Oint 20g','Betameson-CL Crm 15g','Bicozin Tab 30\'s','Camlodin 5 Tab 60\'s','Cef-3 DS Cap 14\'s','Ceftron 2g IV Inj','Clofenac Gel 20g','Comet 500 Tab 100\'s','Comprid 80 Tab 60\'s','Deprex 5 Tab 50\'s','Emoli Lotion 100ml','Entacyd Plus Susp 200ml','Epitra 0.5 Tab 50\'s','Erian Supp 20\'s','Fexo 120 Tab 50\'s','Filwel Silver Tab 30\'s','Flugal 150 Cap 20\'s','Fosfomax GFS Sachet 1\'s T','Genacyn Oint 10g','Lanso D 30 Cap 60\'s','Levocar 330 Tab 30\'s','Maxrin D Cap 20\'s','Methicol Tab 60\'s','Montaro 5 PFS-Inj 0.5ml','Neumig 2.5 Tab 20\'s'];
  const colX=[72,135,300,690,880,950,1080,1200,1330];
  names.forEach((n,i)=>{ const y=530+i*36; const row=[String(i+1),'872967985',n,'6G0'+(2397+i*13),String(1+i%5),(i%2?'1X1\'S':'5X10\'S'),(100+i*17.3).toFixed(2),(17+i*3.1).toFixed(2),(100+i*23.7).toFixed(2)];
    row.forEach((t,j)=>put(t,colX[j],y)); });
  let y=530+names.length*36+70; put('Received above goods in good condition.',80,y); y+=60; put('GAZ_SALES03',660,y); y+=50; put('Customer Signature',120,y); put('Prepared By',660,y); put('Authorized Signature',1100,y);
  return {canvas:cv, titleWords:words};
}
/* recognition-shaped object: every title word placed on the C.rows row holding its centre */
export function fakeRecognition(C,titleWords){
  const lines=new Map();
  for(const w of titleWords){ const cy=(w.bb.y0+w.bb.y1)/2, cx=(w.bb.x0+w.bb.x1)/2, yp=cy-C.slope*cx;
    let ri=-1; C.rows.forEach(r=>{ if(yp>=r.row.dy.y0-2 && yp<=r.row.dy.y1+2) ri=r.index; });
    if(ri<0) continue; if(!lines.has(ri)) lines.set(ri,[]); lines.get(ri).push({text:w.text,confidence:90,bb:w.bb}); }
  return {available:true, lines:[...lines].map(([rowIndex,words])=>({rowIndex, text:words.map(w=>w.text).join(' '), confidence:90, words}))};
}
