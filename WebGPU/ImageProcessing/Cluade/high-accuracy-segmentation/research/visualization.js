/**
 * research/visualization.js
 * Stage-by-stage visual debug overlays.
 * Call with any intermediate texture or label map to get a colorized canvas.
 */

/** Color a label map with distinct random hues per label ID. */
export function visualizeLabels(labelArray, width, height) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx    = canvas.getContext("2d");
  const imgData = ctx.createImageData(width, height);
  const palette = buildPalette(65536);

  for (let i = 0; i < labelArray.length; i++) {
    const id = labelArray[i];
    if (!id) { imgData.data[i*4+3] = 0; continue; }
    const [r,g,b] = palette[id % palette.length];
    imgData.data[i*4]   = r;
    imgData.data[i*4+1] = g;
    imgData.data[i*4+2] = b;
    imgData.data[i*4+3] = 200;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/** Visualize a float map (e.g. distance transform, SWT) as a heatmap. */
export function visualizeHeatmap(floatArray, width, height) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx    = canvas.getContext("2d");
  const imgData = ctx.createImageData(width, height);

  let maxVal = 0;
  for (const v of floatArray) if (v > maxVal) maxVal = v;

  for (let i = 0; i < floatArray.length; i++) {
    const t = maxVal > 0 ? floatArray[i] / maxVal : 0;
    const [r,g,b] = heatColor(t);
    imgData.data[i*4]   = r;
    imgData.data[i*4+1] = g;
    imgData.data[i*4+2] = b;
    imgData.data[i*4+3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function heatColor(t) {
  // Blue → Cyan → Green → Yellow → Red
  const r = Math.round(Math.max(0, Math.min(1, 2*t - 1)) * 255);
  const g = Math.round(Math.max(0, Math.min(1, 2*t, 2 - 2*t)) * 255);
  const b = Math.round(Math.max(0, Math.min(1, 1 - 2*t)) * 255);
  return [r, g, b];
}

function buildPalette(n) {
  const palette = [];
  for (let i = 0; i < n; i++) {
    const hue = (i * 137.508) % 360; // golden angle for distinct hues
    const [r,g,b] = hslToRgb(hue/360, 0.7, 0.5);
    palette.push([r,g,b]);
  }
  return palette;
}

function hslToRgb(h, s, l) {
  let r,g,b;
  if (s === 0) { r=g=b=l; }
  else {
    const q = l < 0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l-q;
    const hue2rgb = (p,q,t) => { if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; };
    r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3);
  }
  return [Math.round(r*255), Math.round(g*255), Math.round(b*255)];
}
