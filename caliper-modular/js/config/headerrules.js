/* ======================================================================
   ITEM-TABLE HEADER RULES  ·  known column-title layouts
   Why: the column stage finds columns from the glyph coverage profile
   alone, which works on any page but knows nothing about what a column
   IS. When the recognised title row matches one of the layouts below,
   the rule decides the columns instead: their number, order, meaning
   and position, with the detected gutters snapping each boundary to the
   real gap. A page that matches no rule keeps the arbitrary columns.

   One rule per template:
     id, name   – free text (shown in the badge and the JSON)
     columns    – left to right; each column:
       key      – semantic name (sl, code, name, pack, batch, unit, qty,
                  bonus, tp, vat, tpVat, tpValue, vatValue, discountPct,
                  discountValue, mfg, exp, sbu, net …) — free, but keep
                  the same key for the same meaning across rules; the
                  number check reads keys without case or punctuation, so
                  tp / unittp, tpValue / totaltp, discountValue / totaldiscount
                  name the same thing
       label    – the printed title exactly as on the page; it is split
                  into alphanumeric tokens for matching ("%" → "pct"),
                  so "Batch No." matches "Batch" over "No." on two lines
       relation – optional: how this column's value follows from others,
                  keys in braces — '{qty}*{unittp}', '{totaltp}*{discountpct}/100',
                  '{totaltp}+{totalvat}-{totaldiscount}'. The number check
                  uses it in place of its built-in guesses for that column:
                  to verify the row, to fill a blank cell, to fix a misread
       x0, x1   – the column's left / right edge as a fraction of the
                  header strip width (0 = left edge, 1 = right edge),
                  measured on a sample page; they seed the boundaries
                  and are refined from the recognised title positions
                  and the detected gutters
   To add a template: copy a rule, fix the labels and fractions, give it
   a new id. A rule drives the columns only when it matches exactly (every
   title found, in its order); otherwise the page's own columns stand and
   the labels of ALL rules serve as a vocabulary to name them.
   ====================================================================== */
export const HEADER_RULES=[
  { id:'acme', name:'ACME Laboratories',
    columns:[
      {key:'name',          label:'Category & Product Name', x0:0.00, x1:0.31},
      {key:'pack',          label:'Pack Size.',              x0:0.31, x1:0.37},
      {key:'batch',         label:'Batch No.',               x0:0.37, x1:0.45},
      {key:'qty',           label:'Qty',                     x0:0.45, x1:0.50},
      {key:'unittp',            label:'Trade',                   x0:0.50, x1:0.56, group:'Per pack'},
        { key: 'unitvat', label: 'VAT', x0: 0.56, x1: 0.62, group: 'Per pack' },
        { key: 'totaltp', label: 'Trade', x0: 0.62, x1: 0.70, group: 'Value', relation:'{qty}*{unittp}'},
        { key: 'totalvat', label: 'VAT', x0: 0.70, x1: 0.79, group: 'Value', relation: '{qty}*{unitvat}' },
      {key:'discountpct',   label:'%',                       x0:0.79, x1:0.84, group:'Discount'},
        { key: 'totaldiscount', label: 'Value', x0: 0.84, x1: 0.90, group: 'Discount', relation: '{totaltp}*{discountpct}/100' },
        { key: 'net', label: 'Net Value', x0: 0.90, x1: 1.00, relation: '{totaltp}+{totalvat}-{totaldiscount}' }
    ] },
    { id:'renata', name:'Renata (Code / Product Name / Trade Price)',
    columns:[
      {key:'code',     label:'Code',              x0:0.00, x1:0.06},
      {key:'name',     label:'Product Name',      x0:0.06, x1:0.34},
      {key:'unit',     label:'Unit',              x0:0.34, x1:0.39},
      {key:'batch',    label:'Batch No.',         x0:0.39, x1:0.52},
      {key:'tp',       label:'Trade Price',       x0:0.52, x1:0.63},
      {key:'qty',      label:'Quantity',          x0:0.63, x1:0.72},
      {key:'tpValue',  label:'Trade Amount',      x0:0.72, x1:0.81},
      {key:'vatValue', label:'VAT Amount',        x0:0.81, x1:0.90},
      {key:'net',      label:'Total Amount',      x0:0.90, x1:1.00}
    ] },
  { id:'sn-net-price', name:'SN · Bonus · T.Price · Net Price',
    columns:[
      {key:'sl',       label:'SN',           x0:0.00, x1:0.03},
      {key:'name',     label:'Product Name', x0:0.03, x1:0.23},
      {key:'pack',     label:'Pack Size',    x0:0.23, x1:0.32},
      {key:'batch',    label:'Batch No',     x0:0.32, x1:0.41},
      {key:'qty',      label:'Qty',          x0:0.41, x1:0.46},
      {key:'bonus',    label:'Bonus',        x0:0.46, x1:0.53},
      {key:'tp',       label:'T.Price',      x0:0.53, x1:0.62},
      {key:'vat',      label:'VAT',          x0:0.62, x1:0.70},
      {key:'tpValue',  label:'Total T P',    x0:0.70, x1:0.78},
      {key:'vatValue', label:'Total VAT',    x0:0.78, x1:0.86},
      {key:'net',      label:'Net Price',    x0:0.86, x1:1.00}
    ] },
  { id:'item-id-uom', name:'Sl. No · Item ID · UOM · Discount / Offer',
    columns:[
      {key:'sl',            label:'Sl. No',           x0:0.000, x1:0.035},
      {key:'code',          label:'Item ID',          x0:0.035, x1:0.10},
      {key:'name',          label:'Item Name',        x0:0.10,  x1:0.45},
      {key:'batch',         label:'Batch',            x0:0.45,  x1:0.52},
      {key:'unit',          label:'UOM',              x0:0.52,  x1:0.57},
      {key:'tp',            label:'TP',               x0:0.57,  x1:0.62},
      {key:'vat',           label:'VAT',              x0:0.62,  x1:0.69},
      {key:'qty',           label:'Quantity',         x0:0.69,  x1:0.76},
      {key:'bonus',         label:'Bonus Qty',        x0:0.76,  x1:0.81},
      {key:'discountValue', label:'Discount / Offer', x0:0.81,  x1:0.88},
      {key:'tpValue',       label:'Total TP',         x0:0.88,  x1:1.00}
    ] },
  { id:'material-bdt', name:'Material Name · Mfg / Exp Date · (BDT)',
    columns:[
      {key:'sl',            label:'Sl No',             x0:0.000, x1:0.035},
      {key:'name',          label:'Material Name',     x0:0.035, x1:0.27},
      {key:'pack',          label:'Pack Size',         x0:0.27,  x1:0.34},
      {key:'tp',            label:'Unit TP',           x0:0.34,  x1:0.42},
      {key:'batch',         label:'Batch No',          x0:0.42,  x1:0.50},
      {key:'mfg',           label:'Mfg. Date',         x0:0.50,  x1:0.55},
      {key:'exp',           label:'Exp. Date',         x0:0.55,  x1:0.60},
      {key:'qty',           label:'Inv. Qty',          x0:0.60,  x1:0.65},
      {key:'bonus',         label:'Bonus Qty',         x0:0.65,  x1:0.70},
      {key:'tpValue',       label:'TP Value (BDT)',    x0:0.70,  x1:0.79},
      {key:'vatValue',      label:'VAT (BDT)',         x0:0.79,  x1:0.86},
      {key:'discountValue', label:'Dis. Value (BDT)',  x0:0.86,  x1:0.93},
      {key:'net',           label:'Total Value (BDT)', x0:0.93,  x1:1.00}
    ] },
  { id:'sbu-inv', name:'Sl.No · SBU Inv. · Unit (T.P)',
    columns:[
      {key:'sl',      label:'Sl.No',        x0:0.000, x1:0.065},
      {key:'name',    label:'Product Name', x0:0.065, x1:0.335},
      {key:'sbu',     label:'SBU Inv.',     x0:0.335, x1:0.455},
      {key:'batch',   label:'Batch',        x0:0.455, x1:0.56},
      {key:'pack',    label:'Pack Size',    x0:0.56,  x1:0.66},
      {key:'qty',     label:'Qty',          x0:0.66,  x1:0.74},
      {key:'tp',      label:'Unit (T.P)',   x0:0.74,  x1:0.815},
      {key:'vat',     label:'Unit VAT',     x0:0.815, x1:0.905},
      {key:'tpValue', label:'Total (T.P)',  x0:0.905, x1:1.00}
    ] },
  { id:'ibnsina', name:'IBN SINA (TP+VAT Per Pack · Net Amount)',
    columns:[
      {key:'name',          label:'Product Name',    x0:0.00,  x1:0.22},
      {key:'pack',          label:'Pack Size',       x0:0.22,  x1:0.29},
      {key:'tp',            label:'TP',              x0:0.29,  x1:0.33},
      {key:'vat',           label:'VAT',             x0:0.33,  x1:0.385},
      {key:'tpVat',         label:'TP+VAT Per Pack', x0:0.385, x1:0.475},
      {key:'qty',           label:'Qty',             x0:0.475, x1:0.525},
      {key:'bonus',         label:'Bon us',          x0:0.525, x1:0.565},   // printed "Bon" over "us"
      {key:'tpValue',       label:'Total TP',        x0:0.565, x1:0.67},
      {key:'vatValue',      label:'Total VAT',       x0:0.67,  x1:0.77},
      {key:'discountValue', label:'Disc Amt',        x0:0.77,  x1:0.87},
      {key:'net',           label:'Net Amount',      x0:0.87,  x1:1.00}
    ] },
  { id:'tk-pack', name:'Sl.No · Product Code · TP(TK) PACK',
    columns:[
      {key:'sl',       label:'Sl.No',         x0:0.000, x1:0.065},
      {key:'code',     label:'Product Code',  x0:0.065, x1:0.155},
      {key:'name',     label:'Product Name',  x0:0.155, x1:0.33},
      {key:'pack',     label:'Pack Size',     x0:0.33,  x1:0.40},
      {key:'batch',    label:'Batch Number',  x0:0.40,  x1:0.47},
      {key:'tp',       label:'TP(TK) PACK',   x0:0.47,  x1:0.54},
      {key:'vat',      label:'VAT(TK) /PACK', x0:0.54,  x1:0.62},
      {key:'qty',      label:'Invoice Qty.',  x0:0.62,  x1:0.69},
      {key:'bonus',    label:'Bonus Qty.',    x0:0.69,  x1:0.75},
      {key:'tpValue',  label:'TP(TK) Value',  x0:0.75,  x1:0.83},
      {key:'vatValue', label:'VAT(TK) Value', x0:0.83,  x1:0.905},
      {key:'net',      label:'Total Value',   x0:0.905, x1:1.00}
    ] },
  { id:'incepta', name:'Incepta (SL / Code / Type / PSize / OP / BQ / Btch Qty)',
    columns:[
      {key:'sl',       label:'SL',           x0:0.000, x1:0.044},
      {key:'code',     label:'Code',         x0:0.044, x1:0.115},
      {key:'name',     label:'Product Name', x0:0.115, x1:0.280},
      {key:'type',     label:'Type',         x0:0.280, x1:0.326},
      {key:'pack',     label:'PSize',        x0:0.326, x1:0.400},
      {key:'tp',       label:'TP',           x0:0.400, x1:0.440},
      {key:'vat',      label:'VAT',          x0:0.440, x1:0.490},
      {key:'sp',       label:'SP',           x0:0.490, x1:0.523},
      {key:'op',       label:'OP',           x0:0.523, x1:0.555},
      {key:'qty',      label:'Qty',          x0:0.555, x1:0.592},
      {key:'bonus',    label:'BQ',           x0:0.592, x1:0.628},
      {key:'batch',    label:'Batch',        x0:0.628, x1:0.680},
      {key:'batchQty', label:'Btch Qty',     x0:0.680, x1:0.734},
      {key:'vatValue', label:'Vat Value',    x0:0.734, x1:0.820},
      {key:'tpValue',  label:'TP Value',     x0:0.820, x1:0.908},
      {key:'spValue',  label:'SP Value',     x0:0.908, x1:1.000}
    ] },
  { id:'square-invoice-no', name:'Square (Sl.No / Invoice No / Batch / Qty / Pack Size)',
    columns:[
      {key:'sl',        label:'Sl.No',        x0:0.000, x1:0.045},
      {key:'invoiceNo', label:'Invoice No',   x0:0.045, x1:0.165},
      {key:'name',      label:'Product Name', x0:0.165, x1:0.420},
      {key:'batch',     label:'Batch',        x0:0.420, x1:0.580},
      {key:'qty',       label:'Qty',          x0:0.580, x1:0.640},
      {key:'pack',      label:'Pack Size',    x0:0.640, x1:0.735},
      {key:'tp',        label:'Unit (T.P)',   x0:0.735, x1:0.815},
      {key:'vat',       label:'Unit VAT',     x0:0.815, x1:0.905},
      {key:'tpValue',   label:'Total (T.P)',  x0:0.905, x1:1.000}
    ] }
];


