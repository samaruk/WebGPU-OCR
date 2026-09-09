/* synthetic Incepta-style page: a boxed customer block (2 horizontals,
   3 verticals) above an item table whose header and 23 item rows each
   carry a long horizontal rule and no vertical rules at all */
export function synthRowRules(tallBox=false){
  const W=1500,H=2000; const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const c=cv.getContext('2d',{willReadFrequently:true}); c.fillStyle='#fff'; c.fillRect(0,0,W,H); c.fillStyle='#000'; c.textBaseline='top';
  const put=(t,x,y)=>c.fillText(t,x,y);
  const hrule=(x0,x1,y)=>c.fillRect(x0,y,x1-x0,2), vrule=(x,y0,y1)=>c.fillRect(x,y0,2,y1-y0);
  c.font='26px Arial'; put('Incepta Pharmaceuticals Ltd.',520,50); c.font='20px Arial';
  put('Head Office: 40, Shahid Tajuddin Ahmed Sarani, Tejgaon I/A, Dhaka-1208, Bangladesh.',330,95);
  put('Sales Invoice',660,240); put('Print On: 16-MAY-26 10:23 AM',1050,215);
  // boxed customer block
  const boxTop=tallBox?180:270;
  hrule(60,1400,boxTop); hrule(60,1400,460); vrule(60,boxTop,460); vrule(1400,boxTop,460); vrule(880,boxTop,460);
  const kv=[['Customer ID','24L22183','Invoice Date :','16-MAY-26'],['Customer Name','LAZZ PHARMA','Delivery Date :','16-MAY-26'],['Address','PLOT 3449,SAGUPTA HOUSING,MIRPUR DOHS','Printing Date :','16-MAY-26'],['Invoice ID','24L1984973','Delivery Asst. :','MD.MONIR UDDIN SHEIKH'],['Invoice Type','CASH','Summary No :','38']];
  kv.forEach((r,i)=>{ const y=290+i*36; put(r[0],80,y); put(r[1],280,y); put(r[2],900,y); put(r[3],1100,y); });
  // item table: title row + 23 ruled item rows
  const colX=[70,110,185,480,545,630,700,760,830,880,930,1040,1110,1260,1380];
  const titles=['SL','Code','Product Name','Type','PSize','TP','VAT','SP','OP','Qty','BQ','Batch','Vat Value','TP Value','SP Value'];
  titles.forEach((t,j)=>put(t,colX[j],520));
  hrule(60,1420,552);
  const names=['ARIPRA ORAL SOLUTION 50ML','ARITONE ZI SYRUP(100 ML)','BISOPRO 5 TABLET 30S','BISOPRO 2.5 TABLET 50S','BARBIT ELIXIR','CLINDACIN 150 CAPSULE (30S)','CRAN-B SOFT GEL CAPSULE','CANDELA SHAMPOO 100 ML','DELANIX 30 CAPSULE 50S','FLAMYD 500 TABLET (100S)','FITARO 1.70 INJECTION','KERASOL 6% CREAM 30G','LACOMAX 50 TABLET 30S','MAXSULIN 30/70 INJ. 100 IU','MYOLAX 50 TABLET 70S','NINTOIN SR CAPSULE 30S','OMIDON TABLET 150S','OSARTIL 50 PLUS TABLET (50S)','PANTONIX 20 TABLET 98S','RAMORIL 2.5 TAB 50S','SINDOLA 2.5 TABLET 30S','URIKAL SOLUTION 200 ML','VIBRENTA INJECTION'];
  let y=566;
  names.forEach((n,i)=>{ const code=['ARO','ATP','BP1','BP6','BRE','CN5','CSG','CSH','DN4','FL5','FT2','KR6','LXL','MX3','MY2','NN3','OML','OS7','P98','RM2','SD3','UKS','VBI'][i];
    const row=[String(i+1),code,n,'IPL',"30'S",(50+i*37.3).toFixed(2),(9+i*3.1).toFixed(2),(60+i*41).toFixed(2),'2','0','2600'+(i%9),'2',(15+i*7.7).toFixed(2),(110+i*60.2).toFixed(2),(130+i*70).toFixed(2)];
    row.forEach((t,j)=>put(t,colX[j],y));
    y+=36; hrule(60,1420,y-6);
  });
  y+=10; put('Total:',900,y); put('1,729.86',1040,y); put('12,566.36',1180,y); put('14,296.22',1330,y);
  y+=60; hrule(60,1420,y); put('Previous Outstanding Balance :',80,y+10); put('0',520,y+10); put('Discountable TP Value :',600,y+10); put('12566.36',900,y+10); put('Invoice Value',1000,y+10); put('14,296.22',1300,y+10);
  put('Current Invoice Value :',80,y+46); put('13,919',520,y+46); put('Trade Discount Rate(%) :',600,y+46); put('3',900,y+46); put('Trade Discount',1000,y+46); put('376.99',1300,y+46);
  y+=100; hrule(60,1420,y); put('This Invoice Value : Taka Thirteen Thousand Nine Hundred Nineteen Only',80,y+12);
  return cv;
}
