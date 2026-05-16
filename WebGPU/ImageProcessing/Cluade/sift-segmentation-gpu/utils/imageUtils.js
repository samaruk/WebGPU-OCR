/**
 * utils/imageUtils.js – bitmap / canvas helpers.
 */
/** Load an Image from a URL, returning a resolved ImageBitmap. */
export function loadBitmap(url) {
  return fetch(url).then(r => r.blob()).then(b => createImageBitmap(b));
}

/** Convert an ImageData to a greyscale Uint8Array. */
export function imageDataToGray(id) {
  const out = new Uint8Array(id.width * id.height);
  for (let i = 0; i < out.length; i++) {
    const r = id.data[i*4], g = id.data[i*4+1], b = id.data[i*4+2];
    out[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return out;
}

/** Draw a coloured mask overlay on a 2D canvas context. */
export function drawMaskOverlay(ctx, labels, palette, W, H, alpha = 0.35) {
  const id = ctx.createImageData(W, H);
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i]; if (l < 0) continue;
    const c = palette[l % palette.length];
    id.data[i*4]   = c[0]; id.data[i*4+1] = c[1];
    id.data[i*4+2] = c[2]; id.data[i*4+3] = Math.round(alpha * 255);
  }
  ctx.putImageData(id, 0, 0);
}

/** Generate N visually distinct HSL colours. */
export function genPalette(n) {
  return Array.from({ length: n }, (_, i) => {
    const h = (i * 47 + 30) % 360;
    const [r, g, b] = hslToRgb(h / 360, 0.70, 0.55);
    return [r, g, b];
  });
}

function hslToRgb(h, s, l) {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [h + 1/3, h, h - 1/3].map(t => {
    if (t < 0) t++; if (t > 1) t--;
    if (t < 1/6) return Math.round((p + (q - p) * 6 * t) * 255);
    if (t < 1/2) return Math.round(q * 255);
    if (t < 2/3) return Math.round((p + (q - p) * (2/3 - t) * 6) * 255);
    return Math.round(p * 255);
  });
}
