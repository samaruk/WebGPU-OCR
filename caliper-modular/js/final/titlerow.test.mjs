// node titlerow.test.mjs — the column titles printed again inside the table
import { isTitleRow } from './titlerow.js';
let failures=0;
const check=(cond,msg)=>{ if(!cond){ failures++; console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
const labels=['Sl No','Product Code','Product Name','Pack Size','Batch Number','TP(TK) PACK','VAT(TK) /PACK','Invoice Qty','Bonus Qty','TP(TK) Value','VAT(TK) Value','Total Value'];
console.log('[1] a repeated title row against its own labels');
check(isTitleRow(['Sl.No','Product Code','Product Name','Pack Size','Batch Number','TP(TK) PACK','VAT(TK) /PACK','Invoice Qty.','Bonus Qty.','TP(TK) Value','VAT(TK) Value','Total Value'], labels), 'the Healthcare titles as printed under a group header');
check(isTitleRow(['SI.No','Product Code','Product Narne','Pack Size','Batch Nurnber','TP(TK) PACK','VAT(TK) /PACK','Invoice Qty','Bonus Qty','TP(TK) Value','VAT(TK) Value','Total Value'], labels), 'the titles with OCR slips (Narne, Nurnber, SI.No)');
check(isTitleRow(['','','Product Name','Pack Size','Batch Number','','','Qty','','','','Total Value'], labels), 'half the titles read, the rest blank: still the title row');
console.log('[2] rows that are not title rows');
check(!isTitleRow(['93','20000002','Andriol TestoCaps 40mg','','HPLR011499','593.64','','3','','1,780.92','','1,780.92'], labels), 'an item row');
check(!isTitleRow(['','','SubTotal :','','','','','156','','43,090.25','7,497.71','50,587.96'], labels), 'a sub-total row');
check(!isTitleRow(['','','MSD Product','','','','','','','','',''], labels), 'a group header');
check(!isTitleRow(['','','Rx Product','','','MD JAKARIA HABIB','','','','','',''], labels), 'a group header with its keeper');
check(!isTitleRow(['','','Product Name','','','','','','','','',''], labels), 'one title word alone (two cells short of three)');
console.log('[3] without labels: the vocabulary of every rule');
check(isTitleRow(['Sl.No','Product Code','Product Name','Pack Size','Batch Number','TP(TK) PACK','VAT(TK) /PACK','Invoice Qty','Bonus Qty','TP(TK) Value','VAT(TK) Value','Total Value'], null), 'the same titles on a page whose columns carry no labels yet');
check(!isTitleRow(['Zoventa Capsule','','','','','','','','','','',''], null) && !isTitleRow(['Amount In Words','Sixty Six Thousand','',''], null), 'an item name or an amount-in-words line is not');
console.log(failures?`\n${failures} FAILURE(S)`:'\nALL PASSED'); process.exit(failures?1:0);
