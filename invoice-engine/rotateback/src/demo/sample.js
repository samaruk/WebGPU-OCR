/**
 * A canvas-drawn sample invoice, so the demo has something to chew on without
 * a scan to hand. Three variants exercise the interesting cases.
 */

const ITEMS = [
  ['1', 'Napa 500mg Tablet', '10', '5.00', '50.00'],
  ['2', 'Paracetamol BP Syrup', '5', '8.00', '40.00'],
  ['3', 'Disposable Syringe 5ml', '3', '15.00', '45.00'],
  ['4', 'Cotton Bandage Roll', '2', '12.50', '25.00'],
];

const COLS = [
  { x: 70, align: 'left', header: 'SL' },
  { x: 120, align: 'left', header: 'Description' },
  { x: 540, align: 'right', header: 'Qty' },
  { x: 680, align: 'right', header: 'Rate' },
  { x: 840, align: 'right', header: 'Amount' },
];

/**
 * @param {'bordered'|'borderless'|'broken'} variant
 * @returns {Promise<ImageBitmap>}
 */
export async function makeSampleInvoice(variant = 'bordered', scale = 2) {
  const W = 900, H = 1180;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const c = canvas.getContext('2d');
  c.scale(scale, scale);
  c.fillStyle = '#fdfdfb';
  c.fillRect(0, 0, W, H);
  c.fillStyle = '#101010';
  c.textBaseline = 'alphabetic';

  const put = (text, x, y, { size = 14, weight = 400, align = 'left' } = {}) => {
    c.font = `${weight} ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    c.textAlign = align === 'right' ? 'right' : align === 'center' ? 'center' : 'left';
    c.fillText(text, x, y);
    c.textAlign = 'left';
  };
  const rule = (x0, x1, y, w = 1) => {
    c.fillRect(x0, y, x1 - x0, w);
  };
  const vrule = (y0, y1, x, w = 1) => {
    c.fillRect(x, y0, w, y1 - y0);
  };

  put('ABC PHARMACY LTD', W / 2, 58, { size: 24, weight: 700, align: 'center' });
  put('12 Bijoy Sarani, Dhaka 1215  ·  BIN 001234567-0101', W / 2, 80, { size: 11, align: 'center' });
  put('TAX INVOICE', W / 2, 116, { size: 17, weight: 600, align: 'center' });

  put('Invoice No: INV-2026-0042', 70, 160, { size: 13 });
  put('Date: 12/03/2026', 70, 180, { size: 13 });
  put('Bill To: Rahim Traders', 520, 160, { size: 13 });
  put('123 Market Road, Dhaka', 520, 180, { size: 13 });

  const top = 250;
  const pitch = 34;
  COLS.forEach((col) => put(col.header, col.x, top, { size: 13, weight: 600, align: col.align }));
  ITEMS.forEach((item, r) => {
    const y = top + pitch * (r + 1);
    item.forEach((cell, i) => put(cell, COLS[i].x, y, { size: 13, align: COLS[i].align }));
  });
  const bottom = top + pitch * (ITEMS.length + 1) - 12;

  if (variant === 'bordered') {
    for (let r = 0; r <= ITEMS.length + 1; r++) rule(60, 860, top - 20 + pitch * r);
    for (const x of [60, 110, 500, 570, 700, 860]) vrule(top - 20, bottom + 2, x);
  } else if (variant === 'broken') {
    for (let r = 0; r <= ITEMS.length + 1; r += 2) {
      const y = top - 20 + pitch * r;
      rule(60, 300, y); rule(340, 560, y); rule(600, 860, y);
    }
    vrule(top - 20, bottom, 500);
    vrule(top - 20, bottom, 700);
  }

  const sy = bottom + 60;
  put('Subtotal', 700, sy, { size: 13, align: 'right' });
  put('160.00', 860, sy, { size: 13, align: 'right' });
  put('VAT 15%', 700, sy + 26, { size: 13, align: 'right' });
  put('24.00', 860, sy + 26, { size: 13, align: 'right' });
  rule(600, 860, sy + 38);
  put('Grand Total', 700, sy + 62, { size: 14, weight: 700, align: 'right' });
  put('184.00', 860, sy + 62, { size: 14, weight: 700, align: 'right' });

  put('Payment: bKash 01700-000000  ·  Bank: XYZ Bank, A/C 1234567890', 70, sy + 140, { size: 11 });
  put('Thank you for your business.', W / 2, sy + 200, { size: 12, align: 'center' });
  put('This is a computer generated invoice.', W / 2, sy + 220, { size: 10, align: 'center' });

  return createImageBitmap(canvas);
}
