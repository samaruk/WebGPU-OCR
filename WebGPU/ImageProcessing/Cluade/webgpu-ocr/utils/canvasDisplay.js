// Canvas display helpers

/**
 * Display a Float32 grayscale [0..1] buffer on a canvas.
 */
export function displayGray(data, W, H, canvas) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const id  = ctx.createImageData(W, H);
  const raw = id.data;
  for (let i = 0; i < W * H; i++) {
    const v = Math.round(Math.max(0, Math.min(1, data[i])) * 255);
    raw[i*4+0] = v; raw[i*4+1] = v; raw[i*4+2] = v; raw[i*4+3] = 255;
  }
  ctx.putImageData(id, 0, 0);
}

/**
 * Display Float32 RGBA [0..1] on canvas.
 */
export function displayRGBA(data, W, H, canvas) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const id  = ctx.createImageData(W, H);
  const raw = id.data;
  for (let i = 0; i < W * H * 4; i++) {
    raw[i] = Math.round(Math.max(0, Math.min(1, data[i])) * 255);
  }
  id.data.set(raw);
  ctx.putImageData(id, 0, 0);
}

/**
 * Display heatmap (grayscale float -> viridis-ish colormap).
 */
export function displayHeatmap(data, W, H, canvas) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const id  = ctx.createImageData(W, H);
  const raw = id.data;
  for (let i = 0; i < W * H; i++) {
    const t = Math.max(0, Math.min(1, data[i]));
    const [r, g, b] = viridis(t);
    raw[i*4+0] = r; raw[i*4+1] = g; raw[i*4+2] = b; raw[i*4+3] = 255;
  }
  ctx.putImageData(id, 0, 0);
}

function viridis(t) {
  // Simplified viridis colormap
  const r = Math.round(clamp( 0.267 + t*(0.005 + t*(1.398 + t*(-0.946 + t*0.276))), 0, 1) * 255);
  const g = Math.round(clamp( 0.005 + t*(0.542 + t*( 0.236 + t*(-0.226 + t*0.443))), 0, 1) * 255);
  const b = Math.round(clamp( 0.329 + t*(0.743 + t*(-1.564 + t*( 1.360 + t*-0.868))), 0, 1) * 255);
  return [r, g, b];
}
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }
