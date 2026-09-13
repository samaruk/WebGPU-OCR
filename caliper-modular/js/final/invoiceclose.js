/* ======================================================================
   INVOICE CLOSE  ·  where the invoice ends on its last page
   Why: the last page of an invoice prints its last items, then — under a
   section border — the invoice's own summary: Total Trade Price, Total
   VAT, Less Discount Amount, Net Invoice Amount (Square); Grand Total,
   Less Discount, Total Payable (Healthcare); the amount in words. Below
   that come other tables (today's invoice summary, outstanding invoices)
   whose rows are numbers in columns like any item's. The summary closes
   the invoice: the items are what lies between the column titles and the
   first summary line, and nothing after it is an item.
     isSummaryLine(text)          → the text names an invoice-level total
     invoiceCloseAt(rowTexts)     → the index of the first row that closes
                                    the invoice, after at least one item row; -1 when none
   A group's Sub Total inside the table is not a close.
   ====================================================================== */
export const SUMMARY_LINE=/\b(total\s*trade\s*price|total\s*vat\b(?!\s*\/)|less\s*discount|net\s*invoice\s*amount|total\s*invoice\s*amount|grand\s*total|net\s*total|total\s*payable|net\s*payable|amount\s*payable|adjustment\s*amount|(?:previous|total)\s*outstanding|amount\s+in\s+(?:words|figures|tk|taka)|in\s+words|invoice\s*amount\s*:)/i;
const SUB_TOTAL=/\bsub\s*-?\s*total\b/i;
export function isSummaryLine(text){
  const t=String(text||'').replace(/\s+/g,' ');
  return SUMMARY_LINE.test(t) && !(SUB_TOTAL.test(t) && !SUMMARY_LINE.test(t.replace(SUB_TOTAL,'')));
}
export function invoiceCloseAt(rowTexts){
  let items=0;
  for(let i=0;i<rowTexts.length;i++){
    const t=rowTexts[i].map(s=>String(s||'').trim()); const joined=t.join(' ');
    if(!joined.trim()) continue;
    if(isSummaryLine(joined)){ if(items>0) return i; continue; }
    if(/\d/.test(joined)) items++;
  }
  return -1;
}
