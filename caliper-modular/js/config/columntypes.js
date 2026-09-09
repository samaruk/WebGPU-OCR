/* ======================================================================
   COLUMN TYPES  ·  every column an item table may have, with its row rule
   Why: a header rule names the columns of a known template, and the
   vocabulary names the rest — but a column can still come out wrong (a
   title misread, two columns run together), and then the operator must be
   able to say what a column IS. This catalogue is what the right-click
   "Set name" menu offers, and each entry carries the row rule its value
   follows, so a renamed column is checked and repaired by the right rule
   at once. The number check reads the keys without case or punctuation,
   and it resolves the keys in a relation by MEANING, so '{qty}*{unittp}'
   holds on a table whose columns a rule keyed qty and tp as well.
     key      – the column's key (the same meaning under the same key as in
                config/headerrules.js; aliases there — tp, tpValue … — map
                to the same roles)
     label    – shown in the header of the final table and in the menu
     numeric  – a number column (read cell by cell with a digit whitelist)
     relation – how the value follows from other columns, keys in braces;
                the check verifies the row with it, fills a blank cell and
                fixes a misread by it, and solves for the other columns too
   A relation is a DEFAULT: a header rule may write its own for a column
   (that one wins), and a relation that does not hold on a table's rows
   yields to the check's built-in variants for the same column.
   ====================================================================== */
export const COLUMN_TYPES=[
  { key:'sl',            label:'Sl No',            numeric:true,  desc:'serial number of the line' },
  { key:'code',          label:'Product Code',     numeric:false, desc:'product code' },
  { key:'name',          label:'Product Name',     numeric:false, desc:'the item name, with or without strength and form' },
  { key:'pack',          label:'Pack Size',        numeric:false, desc:"30's, 10x10, 100ml" },
  { key:'batch',         label:'Batch No',         numeric:false, desc:'batch number' },
  { key:'unit',          label:'Unit',             numeric:false, desc:'unit of sale' },
  { key:'mfg',           label:'Mfg Date',         numeric:false, desc:'manufacturing date' },
  { key:'exp',           label:'Exp Date',         numeric:false, desc:'expiry date' },
  { key:'qty',           label:'Qty',              numeric:true,  desc:'quantity invoiced' },
  { key:'bonus',         label:'Bonus',            numeric:true,  desc:'free quantity' },
  { key:'unittp',        label:'Unit TP',          numeric:true,  desc:'trade price per unit or pack' },
  { key:'vatpct',        label:'VAT %',            numeric:true,  desc:'VAT rate' },
  { key:'unitvat',       label:'Unit VAT',         numeric:true,  desc:'VAT per unit or pack',            relation:'{unittp}*{vatpct}/100' },
  { key:'unitgross',     label:'TP+VAT (unit)',    numeric:true,  desc:'trade price plus VAT per unit',   relation:'{unittp}+{unitvat}' },
  { key:'unitsp',        label:'Unit SP',          numeric:true,  desc:'selling price per unit' },
  { key:'mrp',           label:'MRP',              numeric:true,  desc:'maximum retail price' },
  { key:'totaltp',       label:'Total TP',         numeric:true,  desc:'trade value of the line',          relation:'{qty}*{unittp}' },
  { key:'totalvat',      label:'Total VAT',        numeric:true,  desc:'VAT of the line',                  relation:'{qty}*{unitvat}' },
  { key:'totalsp',       label:'Total SP',         numeric:true,  desc:'selling value of the line',        relation:'{qty}*{unitsp}' },
  { key:'discountpct',   label:'Discount %',       numeric:true,  desc:'discount rate' },
  { key:'unitdiscount',  label:'Unit Discount',    numeric:true,  desc:'discount per unit' },
  { key:'totaldiscount', label:'Discount Value',   numeric:true,  desc:'discount of the line',             relation:'{totaltp}*{discountpct}/100' },
  { key:'net',           label:'Net Amount',       numeric:true,  desc:'what the line costs',              relation:'{totaltp}+{totalvat}-{totaldiscount}' },
  { key:'invoiceNo',     label:'Invoice No',       numeric:false, desc:'invoice number printed per line' },
  { key:'sbu',           label:'SBU',              numeric:false, desc:'business unit' },
  { key:'type',          label:'Type',             numeric:false, desc:'item type or category' },
];
const BY_KEY=new Map(COLUMN_TYPES.map(t=>[t.key,t]));
export const columnType=key=>BY_KEY.get(key)||null;
/* the catalogue's relations for the keys a table has (a rule's own relation for a key takes precedence: the caller filters) */
export const catalogueRelations=keys=>COLUMN_TYPES.filter(t=>t.relation && keys.includes(t.key)).map(t=>({key:t.key, formula:t.relation, source:'catalogue'}));
