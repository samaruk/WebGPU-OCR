/**
 * Demo harness.
 *
 * Draws the geometry graph back over the page so every stage is inspectable:
 * which rules were found and whether they were called decorative, where the
 * table band landed, which hypothesis won, what each column was typed as, and
 * exactly which rectangles would be escalated to the sidecar.
 */

import { InvoiceEngine, loadImage } from '../index.js';
import { PaddleOcrVLSidecar } from '../ocr/paddleSidecar.js';
import { createTesseractProvider } from '../ocr/tesseract.js';
import { warpCropToCanvas } from '../gridlift/rectify/warp.js';
import { M } from '../gridlift/rectify/linalg.js';
import { makeSampleInvoice } from './sample.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');

let engine = null;
let lastResult = null;
let lastBitmap = null;

const COLORS = {
  rule: '#4ec9a0',
  ruleDecorative: '#e0715f',
  comp: 'rgba(94,176,255,.55)',
  line: 'rgba(224,176,85,.9)',
  cell: 'rgba(94,176,255,.75)',
  cellEmpty: 'rgba(94,176,255,.2)',
  col: '#c58bff',
  region: '#e0b055',
  esc: '#e0715f',
};

/* ------------------------------------------------------------------ */

let baseOcr = null;

async function ensureEngine(maxDim) {
  if (engine) engine.destroy();
  const endpoint = $('sidecar').value.trim();

  if ($('use-ocr').checked && !baseOcr) {
    showError('loading tesseract.js …');
    try {
      baseOcr = await createTesseractProvider();
      showError(null);
    } catch (e) {
      showError(`OCR unavailable (${e.message}) - running geometry-only.`);
    }
  }

  engine = await InvoiceEngine.create({
    config: { workingMaxDim: +maxDim },
    baseOcr: ($('use-ocr').checked && baseOcr) || undefined,
    sidecar: endpoint ? new PaddleOcrVLSidecar({ endpoint }) : null,
  });
  return engine;
}

async function analyse(bitmap) {
  showError(null);
  lastBitmap = bitmap;
  try {
    const eng = await ensureEngine($('maxDim').value);
    const mode = $('rectify').value;
    const result = await eng.process(bitmap, {
      rectify: mode === 'auto' ? 'auto' : mode === 'true',
    });
    lastResult = result;
    render(result);
  } catch (e) {
    console.error(e);
    showError(e.message ?? String(e));
  }
}

function showError(msg) {
  const el = $('err');
  el.hidden = !msg;
  el.textContent = msg ?? '';
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

function render(result) {
  const g = result.geometry;
  const w = g.image.workingWidth;
  const h = g.image.workingHeight;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Geometry is reported in the rectified frame, so the backdrop has to be the
  // rectified page or every overlay lands in the wrong place.
  const rectInfo = result.rectification;
  if (rectInfo?.applied && rectInfo.Hinv) {
    const Hinv = Float64Array.from(rectInfo.Hinv);
    const scaleToWorking = M.mul(Hinv, M.scale(1 / g.image.scale));
    const warped = warpCropToCanvas(lastBitmap, { x: 0, y: 0, w, h }, scaleToWorking, { pad: 0 });
    if (warped) ctx.drawImage(warped.canvas, 0, 0);
    else ctx.drawImage(lastBitmap, 0, 0, w, h);
  } else {
    ctx.drawImage(lastBitmap, 0, 0, w, h);
  }
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#0a0d12';
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;

  const on = (id) => $(id).checked;

  if (on('ov-comps')) {
    ctx.fillStyle = COLORS.comp;
    for (const c of g.components) ctx.fillRect(c.x, c.y, c.w, c.h);
  }

  if (on('ov-regions')) {
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    for (const r of result.regions) {
      if (r.region === 'UNKNOWN') continue;
      ctx.strokeStyle = COLORS.region;
      ctx.strokeRect(r.bounds.x - 3, r.bounds.y - 3, r.bounds.w + 6, r.bounds.h + 6);
      label(ctx, r.region, r.bounds.x - 3, r.bounds.y - 6, COLORS.region);
    }
    ctx.setLineDash([]);
  }

  if (on('ov-lines')) {
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1;
    for (const L of g.textLines) {
      ctx.strokeRect(L.x, L.y, L.w, L.h);
      for (const wd of L.words) ctx.strokeRect(wd.x, wd.y, wd.w, wd.h);
    }
  }

  if (on('ov-rules')) {
    for (const l of g.lines) {
      ctx.strokeStyle = l.decorative ? COLORS.ruleDecorative : COLORS.rule;
      ctx.lineWidth = Math.max(1, Math.min(4, l.thickness));
      ctx.globalAlpha = 0.4 + 0.6 * l.tableness;
      ctx.beginPath();
      if (l.axis === 'h') { ctx.moveTo(l.x0, l.y); ctx.lineTo(l.x1, l.y); }
      else { ctx.moveTo(l.x, l.y0); ctx.lineTo(l.x, l.y1); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  for (const t of g.tables) {
    if (on('ov-cells')) {
      ctx.lineWidth = 1;
      for (const c of t.cells) {
        ctx.strokeStyle = c.hasText ? COLORS.cell : COLORS.cellEmpty;
        ctx.strokeRect(c.bounds.x + 0.5, c.bounds.y + 0.5, c.bounds.w - 1, c.bounds.h - 1);
      }
    }
    if (on('ov-cols')) {
      const ft = result.tables.find((x) => x.index === g.tables.indexOf(t));
      if (!ft || ft.rejected) continue;
      ctx.strokeStyle = COLORS.col;
      ctx.lineWidth = 1.5;
      for (const x of t.xs) {
        ctx.beginPath();
        ctx.moveTo(x, t.bounds.y - 6);
        ctx.lineTo(x, t.bounds.y + t.bounds.h + 6);
        ctx.stroke();
      }
      for (const col of ft?.columns ?? []) {
        label(ctx, `${col.role} ${(col.confidence * 100) | 0}%`,
          col.bounds.x + 3, t.bounds.y - 8, COLORS.col);
      }
    }
  }

  if (on('ov-esc')) {
    ctx.strokeStyle = COLORS.esc;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    for (const e of result.escalations ?? []) {
      ctx.strokeRect(e.bounds.x, e.bounds.y, e.bounds.w, e.bounds.h);
    }
    ctx.setLineDash([]);
  }

  stage.replaceChildren(canvas);
  renderPanels(result);
}

const fmtVp = (v) => (v?.euclidean
  ? `(${Math.round(v.euclidean[0])}, ${Math.round(v.euclidean[1])}) ${Math.round(v.support * 100)}%`
  : '∞');

function label(ctx, text, x, y, color) {
  ctx.save();
  ctx.font = '10px ui-monospace, monospace';
  const wpx = ctx.measureText(text).width + 6;
  ctx.fillStyle = 'rgba(10,13,18,.85)';
  ctx.fillRect(x, y - 10, wpx, 12);
  ctx.fillStyle = color;
  ctx.fillText(text, x + 3, y - 1);
  ctx.restore();
}

const rows = (el, data) => {
  el.querySelector('tbody').replaceChildren(...data.map(([a, b, cls]) => {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    td1.textContent = a;
    const td2 = document.createElement('td');
    td2.className = `num ${cls ?? ''}`;
    td2.textContent = b;
    tr.append(td1, td2);
    return tr;
  }));
};

function renderPanels(result) {
  const conf = result.confidence ?? 0;
  $('conf').textContent = conf.toFixed(3);
  $('conf').className = `big ${conf > 0.85 ? 'ok' : conf > 0.6 ? 'warn' : 'bad'}`;
  $('confbar').style.width = `${Math.round(conf * 100)}%`;
  $('confnote').textContent = result.warnings?.length
    ? result.warnings.join(' · ')
    : `${result.escalation?.outcome ?? '—'} · ${result.escalation?.roisEscalated ?? 0} ROI escalated`;

  const r = result.rectification ?? {};
  const d = r.diagnostics ?? {};
  $('rect').textContent = r.applied === undefined
    ? '—'
    : [
        `${r.applied ? 'APPLIED' : 'not applied'} — ${r.method ?? 'n/a'}`,
        `quarter turns ${r.quarterTurns ?? 0} (ambiguous: ${(d.orientation?.ambiguous ?? []).join('/') || 'n/a'}), skew ${(r.skewDeg ?? 0).toFixed(2)}°`,
        `line angle spread ${(r.quality?.lineAngleSpreadBefore ?? 0).toFixed(2)}° → ${(r.quality?.lineAngleSpreadAfter ?? 0).toFixed(2)}°`,
        `row pitch drift ${(r.quality?.pitchDriftBefore ?? 0).toFixed(3)} → ${(r.quality?.pitchDriftAfter ?? 0).toFixed(3)}`,
        `vanishing pts: H ${fmtVp(d.vanishingHorizontal)}  V ${fmtVp(d.vanishingVertical)}`,
      ].join('\n');

  rows($('timings'), [
    ...result.timings.gpu.map((s) => [`${String(s.id).padStart(2, '0')} ${s.name}`, `${s.ms} ms`]),
    ...result.timings.cpu.map((s) => [`${s.id} ${s.name}`, `${s.ms} ms`]),
    ['total', `${result.timings.wallMs} ms`, 'ok'],
  ]);

  const t = result.tables.find((x) => x.index === result.primaryTableIndex) ?? result.tables[0];
  const gt = result.geometry.tables[t?.index ?? 0];
  $('hyps').textContent = gt
    ? `${gt.cols}x${gt.rows} via "${gt.evidence}" (rows: ${gt.rowEvidence}) score ${gt.score}` +
      `\n${Object.entries(gt.parts).map(([k, v]) => `${k}=${v}`).join('  ')}` +
      `\nalternatives: ${gt.alternatives.map((a) => `${a.source}:${a.score}`).join(', ') || 'none'}`
    : 'no table found';

  rows($('cols'), (t?.columns ?? []).map((c) => [
    `${c.index}. ${c.role}${c.header ? ` — “${c.header}”` : ''}`,
    c.confidence.toFixed(2),
    c.confidence > 0.6 ? 'ok' : 'warn',
  ]));

  rows($('items'), (result.invoice?.lineItems ?? []).map((i) => [
    `${i.description || '(no text)'}`,
    `${i.qty ?? '—'} x ${i.unitPrice ?? '—'} = ${i.amount ?? '—'}`,
    i.checks.some((c) => c.status === 'ok' || c.status === 'derived') ? 'ok'
      : i.checks.some((c) => c.status === 'mismatch') ? 'bad' : 'warn',
  ]));

  rows($('checks'), [
    ...Object.entries(result.invoice?.totals ?? {}).map(([k, v]) => [k, String(v)]),
    ...(result.invoice?.checks ?? [])
      .filter((c) => c.scope === 'document')
      .map((c) => [`${c.check}: ${c.detail ?? ''}`, c.status,
        c.status === 'ok' ? 'ok' : c.status === 'info' ? 'muted' : 'bad']),
  ]);

  $('json').textContent = JSON.stringify(
    { invoice: result.invoice, geometry: { ...result.geometry, components: `[${result.geometry.components.length}]` } },
    null, 2,
  ).slice(0, 60000);
}

/* ------------------------------------------------------------------ *
 * Wiring
 * ------------------------------------------------------------------ */

$('pick').onclick = () => $('file').click();
$('file').onchange = async (e) => {
  const f = e.target.files?.[0];
  if (f) analyse(await loadImage(f));
};
$('sample').onclick = async () => analyse(await makeSampleInvoice($('variant').value));
$('maxDim').onchange = () => lastBitmap && analyse(lastBitmap);
$('rectify').onchange = () => lastBitmap && analyse(lastBitmap);
for (const id of ['ov-rules', 'ov-comps', 'ov-lines', 'ov-cells', 'ov-cols', 'ov-regions', 'ov-esc']) {
  $(id).onchange = () => lastResult && render(lastResult);
}
$('dl').onclick = () => {
  if (!lastResult) return;
  const blob = new Blob([JSON.stringify(lastResult.geometry, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'geometry-graph.json';
  a.click();
  URL.revokeObjectURL(a.href);
};

stage.addEventListener('dragover', (e) => e.preventDefault());
stage.addEventListener('drop', async (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files?.[0];
  if (f) analyse(await loadImage(f));
});

if (!navigator.gpu) {
  showError('WebGPU is unavailable in this browser. Chrome/Edge 113+ over https or localhost is required.');
}
